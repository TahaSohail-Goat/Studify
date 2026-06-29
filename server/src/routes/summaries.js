import express from "express";
import { Note } from "../models/Note.js";
import { Summary } from "../models/Summary.js";
import { UPLOADS_DIR } from "../middleware/upload.js";
import { requireAuth } from "../middleware/auth.js";
import { chatComplete } from "../utils/aiProviders.js";
import { extractNoteText, isIndexable } from "../utils/extractText.js";

const router = express.Router();
router.use(requireAuth);

const REDUCE_MODEL = "llama-3.3-70b-versatile"; // final, higher-quality pass
const MAP_MODEL = "llama-3.1-8b-instant";       // fast pass over each part
const SINGLE_PASS_CHARS = 18000; // short docs are summarized in one shot
const SEG_SIZE = 14000;          // per-part size when a doc is long
const MAX_SEGMENTS = 6;          // bound the work (≈ up to ~84k chars / ~30 pages)
const MAX_TOTAL = SEG_SIZE * MAX_SEGMENTS;

// Pull plain text out of a stored note (PDF / TXT / PPTX / DOCX).
function extractText(note) {
  return extractNoteText(note, UPLOADS_DIR);
}

// pdf-parse (and slide/doc extraction) leave messy whitespace and hyphenated line
// breaks. Clean it up so the model reads coherent prose.
function cleanText(raw) {
  return String(raw)
    .replace(/\r/g, "")
    .replace(/-\n(\p{L})/gu, "$1")   // join hyphenated line breaks: "exam-\nple" → "example"
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Split long text into a few segments, preferring paragraph/sentence boundaries.
function splitSegments(text, size) {
  const segments = [];
  let start = 0;
  while (start < text.length && segments.length < MAX_SEGMENTS) {
    let end = Math.min(start + size, text.length);
    if (end < text.length) {
      const slice = text.slice(start, end);
      const brk = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "));
      if (brk > size * 0.5) end = start + brk + 1;
    }
    const seg = text.slice(start, end).trim();
    if (seg) segments.push(seg);
    start = end;
  }
  return segments;
}

const SUMMARY_SYSTEM =
  "You are an expert study assistant that writes clear, thorough, exam-ready summaries of a " +
  "student's material. Your summary must be detailed enough that a student could revise from it " +
  "WITHOUT re-reading the original. Summarize ONLY what is in the provided text — never invent " +
  "facts, numbers, or definitions. Preserve the concrete details that matter for studying: " +
  "definitions, key numbers, formulas, names, dates, examples, and cause-and-effect relationships. " +
  "Write full, informative sentences — never vague one-word fragments or generic filler. Use clear Markdown.";

function finalPrompt(text) {
  return (
    "Write a study summary of the following material for a student revising for an exam. Be specific " +
    "and substantive — every line should teach something concrete. Avoid vague, generic statements. " +
    "Respond in Markdown using exactly these section headings:\n\n" +
    "## Overview\n3-4 sentences explaining what the material covers and why it matters.\n\n" +
    "## Key Points\nA detailed bullet list of the most important ideas. Each bullet must be a complete, " +
    "informative sentence that actually explains the idea — include the specific facts, numbers, examples, " +
    "and reasoning from the text, not just keywords. Cover all the major topics; group related points together.\n\n" +
    "## Key Terms\nA bullet list of **term** — a clear, self-contained definition. Include every important " +
    "term, concept, or formula in the material (omit this section only if there genuinely are none).\n\n" +
    "Be comprehensive but do not repeat yourself. Material:\n---\n" + text
  );
}

function segmentPrompt(text, i, n) {
  return (
    `This is part ${i} of ${n} of a longer document. Extract ALL the important information from THIS part ` +
    "as a detailed bullet list — key ideas, facts, definitions, numbers, formulas, names, and examples. " +
    "Keep the specifics; do not generalize or drop details. Use only what's in the text.\n\n" +
    "---\n" + text
  );
}

function combinePrompt(noteBlocks) {
  return (
    "Below are detailed notes taken from consecutive parts of one document. Merge them into a single, " +
    "de-duplicated, exam-ready study summary in Markdown using exactly these headings:\n\n" +
    "## Overview\n3-4 sentences explaining what the material covers and why it matters.\n\n" +
    "## Key Points\nA detailed bullet list. Each bullet must be a complete, informative sentence that " +
    "explains the idea with its specific facts, numbers, and examples — not just keywords. Cover all major " +
    "topics and group related points together.\n\n" +
    "## Key Terms\nA bullet list of **term** — a clear definition (omit only if there genuinely are none).\n\n" +
    "Preserve the specific details from the notes; do not water them down. Notes:\n---\n" + noteBlocks
  );
}

// Summarize the whole document. Short docs → one pass. Long docs → map-reduce:
// summarize each part, then combine the parts into one clean summary.
async function generateSummary(fullText) {
  if (fullText.length <= SINGLE_PASS_CHARS) {
    return chatComplete(REDUCE_MODEL, [{ role: "user", content: finalPrompt(fullText) }], {
      system: SUMMARY_SYSTEM,
    });
  }

  const segments = splitSegments(fullText, SEG_SIZE);
  const partials = [];
  for (let i = 0; i < segments.length; i++) {
    try {
      const part = await chatComplete(
        MAP_MODEL,
        [{ role: "user", content: segmentPrompt(segments[i], i + 1, segments.length) }],
        { system: SUMMARY_SYSTEM, maxTokens: 1300 }
      );
      partials.push(`### Part ${i + 1}\n${part}`);
    } catch (err) {
      if (partials.length) break; // keep what we have if a later part fails (e.g. rate limit)
      throw err;
    }
  }

  return chatComplete(REDUCE_MODEL, [{ role: "user", content: combinePrompt(partials.join("\n\n")) }], {
    system: SUMMARY_SYSTEM,
  });
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
    if (!isIndexable(note.mimetype, note.originalName))
      return res.status(400).json({ message: "Only PDF, PowerPoint, Word, and text files can be summarized." });

    // 1. Extract + clean the text from the file.
    let text;
    try {
      text = cleanText(await extractText(note));
    } catch (err) {
      return res.status(400).json({ message: err.message });
    }
    if (!text.trim())
      return res.status(422).json({
        message: "No readable text found — this file may be scanned images rather than text.",
      });

    const truncated = text.length > MAX_TOTAL;
    const source = truncated ? text.slice(0, MAX_TOTAL) : text;

    // 2. Summarize the whole document (map-reduce for long files).
    let content;
    try {
      content = await generateSummary(source);
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
        model: REDUCE_MODEL,
        truncated,
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
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
