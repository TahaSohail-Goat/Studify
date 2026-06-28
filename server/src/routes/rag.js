import express from "express";
import { Note } from "../models/Note.js";
import { Chunk } from "../models/Chunk.js";
import { requireAuth } from "../middleware/auth.js";
import { reindexUser } from "../utils/rag.js";
import { INDEXABLE_MIMETYPES } from "../utils/extractText.js";

const router = express.Router();
router.use(requireAuth);

const INDEXABLE = [...INDEXABLE_MIMETYPES];

// ── GET /api/rag/status ───────────────────────────────────────────────────────
// How much of the user's material is searchable by the AI right now.
router.get("/status", async (req, res) => {
  try {
    const [indexableNotes, chunks, indexedNoteIds] = await Promise.all([
      Note.countDocuments({ userId: req.userId, mimetype: { $in: INDEXABLE } }),
      Chunk.countDocuments({ userId: req.userId }),
      Chunk.distinct("noteId", { userId: req.userId }),
    ]);
    res.json({
      indexableNotes,
      indexedNotes: indexedNoteIds.length,
      chunks,
    });
  } catch (err) {
    console.error("rag status error:", err.message);
    res.status(500).json({ message: "Could not load index status." });
  }
});

// ── POST /api/rag/reindex ─────────────────────────────────────────────────────
// Build (or rebuild) the search index for the user's notes.
// body: { force?: boolean } — force re-embeds everything; otherwise only new notes.
router.post("/reindex", async (req, res) => {
  try {
    const force = Boolean(req.body?.force);
    const result = await reindexUser(req.userId, { force });
    res.json({ ...result, message: "Search index updated." });
  } catch (err) {
    console.error("reindex error:", err.message);
    res.status(500).json({ message: "Could not build the search index. Please try again." });
  }
});

export default router;
