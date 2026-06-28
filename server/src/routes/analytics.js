import express from "express";
import { Note } from "../models/Note.js";
import { Conversation } from "../models/Conversation.js";
import { Summary } from "../models/Summary.js";
import { Quiz } from "../models/Quiz.js";
import { Chunk } from "../models/Chunk.js";
import { requireAuth } from "../middleware/auth.js";
import { chatComplete } from "../utils/aiProviders.js";

const router = express.Router();
router.use(requireAuth);

const INSIGHTS_MODEL = "llama-3.1-8b-instant";
const DAYS = 14;

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

// Build the last N day-keys (oldest → newest), e.g. ["2026-06-15", …].
function lastNDays(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    out.push(dayKey(d));
  }
  return out;
}

// Current + longest streak of consecutive active days from a set of day-keys.
function computeStreak(daySet) {
  if (daySet.size === 0) return { current: 0, longest: 0, activeDays: 0 };
  const days = [...daySet].sort();

  let longest = 1, run = 1;
  for (let i = 1; i < days.length; i++) {
    const prev = new Date(days[i - 1] + "T00:00:00Z");
    const cur = new Date(days[i] + "T00:00:00Z");
    const gap = Math.round((cur - prev) / 86400000);
    run = gap === 1 ? run + 1 : 1;
    if (run > longest) longest = run;
  }

  // Current streak: walk back from today while each day is present.
  let current = 0;
  const cursor = new Date();
  // Allow the streak to "count" even if nothing logged yet today (start at yesterday).
  if (!daySet.has(dayKey(cursor))) cursor.setUTCDate(cursor.getUTCDate() - 1);
  while (daySet.has(dayKey(cursor))) {
    current++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return { current, longest, activeDays: daySet.size };
}

// ── GET /api/analytics ────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const userId = req.userId;
    const [notes, conversations, summaries, quizzes, chunks] = await Promise.all([
      Note.find({ userId }).select("size createdAt"),
      Conversation.find({ userId }).select("messages createdAt updatedAt"),
      Summary.find({ userId }).select("createdAt"),
      Quiz.find({ userId }).select("mcqs saqs createdAt"),
      Chunk.countDocuments({ userId }),
    ]);

    // Totals
    const storageBytes = notes.reduce((s, n) => s + (n.size || 0), 0);
    const messages = conversations.reduce((s, c) => s + (c.messages?.length || 0), 0);
    const totalMcq = quizzes.reduce((s, q) => s + (q.mcqs?.length || 0), 0);
    const totalSaq = quizzes.reduce((s, q) => s + (q.saqs?.length || 0), 0);

    // Activity over the last N days
    const keys = lastNDays(DAYS);
    const blank = () => Object.fromEntries(keys.map((k) => [k, 0]));
    const bucket = { notes: blank(), conversations: blank(), summaries: blank(), quizzes: blank() };
    const tally = (items, field) => {
      for (const it of items) {
        const k = dayKey(it.createdAt);
        if (k in bucket[field]) bucket[field][k]++;
      }
    };
    tally(notes, "notes");
    tally(conversations, "conversations");
    tally(summaries, "summaries");
    tally(quizzes, "quizzes");

    const activity = keys.map((k) => ({
      date: k,
      notes: bucket.notes[k],
      conversations: bucket.conversations[k],
      summaries: bucket.summaries[k],
      quizzes: bucket.quizzes[k],
    }));

    // Streak across every kind of activity
    const daySet = new Set();
    for (const arr of [notes, summaries, quizzes]) arr.forEach((x) => daySet.add(dayKey(x.createdAt)));
    conversations.forEach((c) => daySet.add(dayKey(c.updatedAt || c.createdAt)));
    const streak = computeStreak(daySet);

    res.json({
      totals: {
        notes: notes.length,
        conversations: conversations.length,
        messages,
        summaries: summaries.length,
        quizzes: quizzes.length,
        questions: totalMcq + totalSaq,
        chunks,
        storageBytes,
      },
      activity,
      quiz: {
        quizzes: quizzes.length,
        totalMcq,
        totalSaq,
        avgPerQuiz: quizzes.length ? Math.round((totalMcq + totalSaq) / quizzes.length) : 0,
      },
      featureUsage: [
        { key: "notes", label: "Notes", value: notes.length },
        { key: "chat", label: "AI chats", value: conversations.length },
        { key: "summaries", label: "Summaries", value: summaries.length },
        { key: "quizzes", label: "Quizzes", value: quizzes.length },
      ],
      knowledge: { chunks, indexedNotes: await Chunk.distinct("noteId", { userId }).then((a) => a.length) },
      streak,
    });
  } catch (err) {
    console.error("analytics error:", err.message);
    res.status(500).json({ message: "Could not load analytics." });
  }
});

// ── GET /api/analytics/insights ───────────────────────────────────────────────
// An AI "study coach" reads the numbers and writes a short, encouraging take.
router.get("/insights", async (req, res) => {
  try {
    const userId = req.userId;
    const [notes, conversations, summaries, quizzes] = await Promise.all([
      Note.countDocuments({ userId }),
      Conversation.countDocuments({ userId }),
      Summary.countDocuments({ userId }),
      Quiz.find({ userId }).select("mcqs saqs createdAt"),
    ]);

    const totalQ = quizzes.reduce((s, q) => s + (q.mcqs?.length || 0) + (q.saqs?.length || 0), 0);
    const daySet = new Set();
    quizzes.forEach((q) => daySet.add(dayKey(q.createdAt)));
    const streak = computeStreak(daySet);

    if (notes + conversations + summaries + quizzes.length === 0) {
      return res.json({
        insights:
          "You're just getting started! Upload your first set of notes, then try the AI chat and a quiz to see your progress grow here.",
      });
    }

    const stats =
      `Notes uploaded: ${notes}\n` +
      `AI conversations: ${conversations}\n` +
      `Summaries generated: ${summaries}\n` +
      `Quizzes created: ${quizzes.length} (with ${totalQ} questions total)\n` +
      `Longest quiz streak: ${streak.longest} day(s)`;

    const system =
      "You are an encouraging study coach. Given a student's usage stats on the Studify app, " +
      "write a short, motivating analysis. Use Markdown: one upbeat opening sentence, then a " +
      "bullet list of 2-3 specific, actionable suggestions based on the numbers. Keep it under " +
      "120 words. Do not invent data beyond what's given.";

    let insights;
    try {
      insights = await chatComplete(
        INSIGHTS_MODEL,
        [{ role: "user", content: `Here are my Studify stats:\n${stats}\n\nGive me my study insights.` }],
        { system, temperature: 0.7, maxTokens: 350 }
      );
    } catch (err) {
      return res.status(502).json({ message: err.message || "Could not generate insights." });
    }

    res.json({ insights });
  } catch (err) {
    console.error("insights error:", err.message);
    res.status(500).json({ message: "Could not generate insights." });
  }
});

export default router;
