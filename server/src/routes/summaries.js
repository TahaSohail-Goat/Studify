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
  "You are a study assistant that writes accurate, well-structured summaries of a student's " +
  "material. Summarize ONLY what is in the provided text — never invent facts. Use clear Markdown.";

function finalPrompt(text) {
  return (
    "Summarize the following study material for a student. Respond in Markdown using exactly " +
    "these section headings:\n\n" +
    "## Overview\n2-3 sentences capturing the main idea.\n\n" +
    "## Key Points\nA concise bullet list of the most important ideas.\n\n" +
    "## Key Terms\nA bullet list of **term** — short definition (include only if the material has notable terms).\n\n" +
    "Material:\n---\n" + text
  );
}

function segmentPrompt(text, i, n) {
  return (
    `This is part ${i} of ${n} of a longer document. Pull out the key information from THIS part ` +
    "as a concise bullet list of the important facts, ideas, and terms. Use only what's in the text.\n\n" +
    "---\n" + text
  );
}

function combinePrompt(noteBlocks) {
  return (
    "Below are notes taken from consecutive parts of one document. Merge them into a single, " +
    "de-duplicated study summary in Markdown using exactly these headings:\n\n" +
    "## Overview\n2-3 sentences.\n\n## Key Points\nbullet list of the most important ideas.\n\n" +
    "## Key Terms\nbullet list of **term** — definition (only if there are notable terms).\n\n" +
    "Notes:\n---\n" + noteBlocks
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
        { system: SUMMARY_SYSTEM, maxTokens: 900 }
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
