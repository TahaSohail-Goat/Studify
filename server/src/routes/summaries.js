import express from "express";
import fs from "node:fs";
import path from "node:path";
// Import the inner lib directly — pdf-parse's index.js runs debug code on import.
import pdfParse from "pdf-parse/lib/pdf-parse.js";
import { Note } from "../models/Note.js";
import { Summary } from "../models/Summary.js";
import { UPLOADS_DIR } from "../middleware/upload.js";
import { requireAuth } from "../middleware/auth.js";
import { chatComplete } from "../utils/aiProviders.js";

const router = express.Router();
router.use(requireAuth);

const SUMMARY_MODEL = "llama-3.3-70b-versatile";
const MAX_CHARS = 16000; // cap source text so we stay within the model's context

const SUMMARIZABLE = new Set(["application/pdf", "text/plain"]);

// Pull plain text out of a stored note file (PDF or TXT).
async function extractText(note) {
  const filePath = path.join(UPLOADS_DIR, note.storedName);
  if (!fs.existsSync(filePath)) throw new Error("The file is missing on the server.");

  if (note.mimetype === "application/pdf") {
    const buffer = fs.readFileSync(filePath);
    const data = await pdfParse(buffer);
    return data.text || "";
  }
  if (note.mimetype === "text/plain") {
    return fs.readFileSync(filePath, "utf-8");
  }
  throw new Error("Only PDF and text files can be summarized.");
}

function buildPrompt(text) {
  return (
    "Summarize the following study material for a student. " +
    "Respond in Markdown with these sections:\n" +
    "1. **Overview** — 2-3 sentences capturing the main idea.\n" +
    "2. **Key Points** — a concise bullet list of the most important ideas.\n" +
    "3. **Key Terms** — bold term followed by a short definition (include only if the material has notable terms).\n\n" +
    "Keep it focused on what's worth learning. Here is the material:\n\n" +
    "---\n" +
    text
  );
}

// ── GET /api/summaries ────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const summaries = await Summary.find({ userId: req.userId }).sort({ updatedAt: -1 });
    res.json({ summaries });
  } catch (err) {
    console.error("list summaries error:", err.message);
    res.status(500).json({ message: "Could not load summaries." });
  }
});

// ── POST /api/summaries/:noteId ───────────────────────────────────────────────
// Generate (or regenerate) the summary for one of the user's files.
router.post("/:noteId", async (req, res) => {
  try {
    const note = await Note.findById(req.params.noteId);
    if (!note) return res.status(404).json({ message: "File not found." });
    if (note.userId.toString() !== req.userId)
      return res.status(403).json({ message: "Access denied." });
    if (!SUMMARIZABLE.has(note.mimetype))
      return res.status(400).json({ message: "Only PDF and text files can be summarized." });

    // 1. Extract text from the file.
    let text;
    try {
      text = await extractText(note);
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!text.trim())
      return res.status(422).json({
        message: "No readable text found — this file may be scanned images rather than text.",
      });

    const truncated = text.length > MAX_CHARS;
    const source = truncated ? text.slice(0, MAX_CHARS) : text;

    // 2. Ask the model to summarize it.
    let content;
    try {
      content = await chatComplete(SUMMARY_MODEL, [{ role: "user", content: buildPrompt(source) }]);
    } catch (err) {
      return res.status(502).json({ message: err.message || "The AI request failed." });
    }

    // 3. Upsert — one summary per file.
    const summary = await Summary.findOneAndUpdate(
      { userId: req.userId, noteId: note._id },
      {
        userId: req.userId,
        noteId: note._id,
        noteName: note.originalName,
        content,
        model: SUMMARY_MODEL,
        truncated,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.json({ summary });
  } catch (err) {
    console.error("generate summary error:", err.message);
    res.status(500).json({ message: "Could not generate the summary." });
  }
});

// ── DELETE /api/summaries/:id ─────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const summary = await Summary.findById(req.params.id);
    if (!summary) return res.status(404).json({ message: "Summary not found." });
    if (summary.userId.toString() !== req.userId)
      return res.status(403).json({ message: "Access denied." });

    await Summary.deleteOne({ _id: summary._id });
    res.json({ message: "Summary deleted." });
  } catch (err) {
    console.error("delete summary error:", err.message);
    res.status(500).json({ message: "Could not delete the summary." });
  }
});

export default router;
