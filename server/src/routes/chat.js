import express from "express";
import { Conversation } from "../models/Conversation.js";
import { requireAuth } from "../middleware/auth.js";
import { listModels, chatStream } from "../utils/aiProviders.js";

const router = express.Router();

// Every route here requires a logged-in user.
router.use(requireAuth);

// Build a short title from the user's first message (so the sidebar isn't all
// "New chat"). Trim to ~40 chars on a word boundary.
function titleFromMessage(text) {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= 40) return clean;
  return clean.slice(0, 40).replace(/\s\S*$/, "") + "…";
}

// ── GET /api/chat/models ──────────────────────────────────────────────────────
// Which models can the user pick, and which are actually configured on the server.
router.get("/models", (_req, res) => {
  res.json({ models: listModels() });
});

// ── GET /api/chat/conversations ───────────────────────────────────────────────
// Lightweight list for the sidebar — no message bodies.
router.get("/conversations", async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.userId })
      .select("title model updatedAt")
      .sort({ updatedAt: -1 });
    res.json({ conversations });
  } catch (err) {
    console.error("list conversations error:", err.message);
    res.status(500).json({ message: "Could not load conversations." });
  }
});

// ── GET /api/chat/conversations/:id ───────────────────────────────────────────
// Full conversation with all messages (ownership enforced).
router.get("/conversations/:id", async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found." });
    if (conversation.userId.toString() !== req.userId)
      return res.status(403).json({ message: "Access denied." });
    res.json({ conversation });
  } catch (err) {
    console.error("get conversation error:", err.message);
    res.status(500).json({ message: "Could not load conversation." });
  }
});

// ── DELETE /api/chat/conversations/:id ────────────────────────────────────────
router.delete("/conversations/:id", async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);
    if (!conversation) return res.status(404).json({ message: "Conversation not found." });
    if (conversation.userId.toString() !== req.userId)
      return res.status(403).json({ message: "Access denied." });

    await Conversation.deleteOne({ _id: conversation._id });
    res.json({ message: "Conversation deleted." });
  } catch (err) {
    console.error("delete conversation error:", err.message);
    res.status(500).json({ message: "Could not delete conversation." });
  }
});

// ── POST /api/chat/send ───────────────────────────────────────────────────────
// The heart of the feature. Body: { conversationId?, model, content }.
//   1. Find (or create) the conversation and append the user's message.
//   2. Stream the model's reply back as newline-delimited JSON (NDJSON) events:
//        {"type":"delta","text":"..."}   ← repeated as tokens arrive
//        {"type":"done","conversationId":"...","title":"..."}
//        {"type":"error","message":"..."}
//   3. Persist the full reply once streaming completes.
router.post("/send", async (req, res) => {
  const { conversationId, model, content } = req.body;

  // Validate while we can still send a normal HTTP status (before streaming starts).
  if (!content || !content.trim())
    return res.status(400).json({ message: "Message cannot be empty." });
  if (!model)
    return res.status(400).json({ message: "Please choose a model." });

  let conversation;
  try {
    if (conversationId) {
      conversation = await Conversation.findById(conversationId);
      if (!conversation) return res.status(404).json({ message: "Conversation not found." });
      if (conversation.userId.toString() !== req.userId)
        return res.status(403).json({ message: "Access denied." });
    } else {
      conversation = new Conversation({
        userId: req.userId,
        title: titleFromMessage(content),
        model,
      });
    }
  } catch (err) {
    console.error("chat load error:", err.message);
    return res.status(500).json({ message: "Could not load the conversation." });
  }

  conversation.messages.push({ role: "user", content: content.trim() });
  conversation.model = model;
  const history = conversation.messages.map((m) => ({ role: m.role, content: m.content }));

  // From here on we stream — headers are committed, so errors go through events.
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering if present
  res.flushHeaders?.();

  // Only write while the client is still connected (avoids "write after end").
  const send = (obj) => {
    if (!res.writableEnded) {
      try { res.write(JSON.stringify(obj) + "\n"); } catch { /* socket gone */ }
    }
  };

  // Hand the client its conversation id up-front, so "Stop" still tracks the chat
  // even if the reply is interrupted before the final "done" event.
  send({ type: "start", conversationId: conversation._id, title: conversation.title });

  // If the client disconnects (e.g. presses Stop), abort the upstream Gemini call.
  const ac = new AbortController();
  req.on("close", () => ac.abort());

  let full = "";
  try {
    full = await chatStream(model, history, (delta) => send({ type: "delta", text: delta }), ac.signal);
  } catch (err) {
    console.error("chat stream error:", err.message);
    send({ type: "error", message: err.message || "The AI request failed." });
    return res.end();
  }

  // Persist whatever arrived — the full reply, or a partial one if the user stopped.
  try {
    if (full) {
      conversation.messages.push({ role: "assistant", content: full });
      await conversation.save();
    }
    send({ type: "done", conversationId: conversation._id, title: conversation.title });
  } catch (err) {
    console.error("chat save error:", err.message);
    send({ type: "error", message: "Reply received, but it couldn't be saved." });
  }
  res.end();
});

export default router;
