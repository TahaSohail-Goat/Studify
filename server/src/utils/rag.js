// ── RAG: index notes into searchable chunks, then retrieve the relevant ones ───
import { Note } from "../models/Note.js";
import { Chunk } from "../models/Chunk.js";
import { UPLOADS_DIR } from "../middleware/upload.js";
import { embed, embedBatch, cosineSim } from "./embeddings.js";
import { extractNoteText, isIndexable } from "./extractText.js";

const MAX_SOURCE_CHARS = 40000; // cap how much of a note we index
const MAX_CHUNKS = 80;          // and how many chunks per note
const MIN_SCORE = 0.18;         // ignore retrieved chunks below this similarity

// Pull plain text out of a stored note (PDF / TXT / PPTX / DOCX). Others → "".
async function extractText(note) {
  if (!isIndexable(note.mimetype, note.originalName)) return "";
  try {
    return await extractNoteText(note, UPLOADS_DIR);
  } catch {
    return "";
  }
}

/**
 * Split text into overlapping chunks of ~`size` characters, preferring to break
 * on sentence/paragraph boundaries. Overlap keeps context from spilling across cuts.
 */
export function chunkText(text, { size = 900, overlap = 150 } = {}) {
  const clean = String(text)
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_SOURCE_CHARS);
  if (!clean) return [];

  const chunks = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);
    if (end < clean.length) {
      const slice = clean.slice(start, end);
      const brk = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("\n"),
        slice.lastIndexOf("? "),
        slice.lastIndexOf("! ")
      );
      if (brk > size * 0.5) end = start + brk + 1;
    }
    const piece = clean.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }
  return chunks.slice(0, MAX_CHUNKS);
}

/**
 * (Re)build the chunk index for one note: extract → chunk → embed → store.
 * Replaces any existing chunks for that note.
 */
export async function indexNote(note) {
  const text = await extractText(note);
  await Chunk.deleteMany({ noteId: note._id });

  const pieces = chunkText(text);
  if (!pieces.length) return { chunks: 0 };

  const vectors = await embedBatch(pieces);
  const docs = pieces.map((t, i) => ({
    userId: note.userId,
    noteId: note._id,
    noteName: note.originalName,
    index: i,
    text: t,
    embedding: vectors[i],
  }));
  await Chunk.insertMany(docs);
  return { chunks: docs.length };
}

// Index every note of a user that doesn't have chunks yet (or all of them).
export async function reindexUser(userId, { force = false } = {}) {
  const all = await Note.find({ userId });
  const notes = all.filter((n) => isIndexable(n.mimetype, n.originalName));
  let indexedNotes = 0;
  let totalChunks = 0;

  for (const note of notes) {
    if (!force) {
      const has = await Chunk.exists({ noteId: note._id });
      if (has) continue;
    }
    const { chunks } = await indexNote(note);
    if (chunks > 0) indexedNotes++;
    totalChunks += chunks;
  }
  return { indexedNotes, totalChunks };
}

/**
 * Retrieve the top-k chunks most similar to `query` across the user's notes.
 * Returns [{ text, noteName, noteId, score }] sorted by relevance.
 *
 * NOTE: we load the user's chunks and score them in memory. That's perfect for a
 * personal study app; at large scale you'd push this into a vector database.
 */
export async function retrieve(userId, query, k = 5) {
  if (!query || !query.trim()) return [];
  const chunks = await Chunk.find({ userId }).select("text noteName noteId embedding");
  if (!chunks.length) return [];

  const qVec = await embed(query);
  const scored = chunks.map((c) => ({
    text: c.text,
    noteName: c.noteName,
    noteId: c.noteId,
    score: cosineSim(qVec, c.embedding),
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score >= MIN_SCORE).slice(0, k);
}

// Unique note names from a set of retrieved hits, preserving best-first order.
export function sourcesFromHits(hits) {
  const seen = new Set();
  const out = [];
  for (const h of hits) {
    const key = String(h.noteId);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ noteId: h.noteId, noteName: h.noteName });
  }
  return out;
}
