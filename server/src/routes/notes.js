import express from "express";
import path from "node:path";
import fs from "node:fs";
import { Note } from "../models/Note.js";
import { Summary } from "../models/Summary.js";
import { Quiz } from "../models/Quiz.js";
import { Chunk } from "../models/Chunk.js";
import { upload, UPLOADS_DIR } from "../middleware/upload.js";
import { requireAuth } from "../middleware/auth.js";
import { indexNote } from "../utils/rag.js";

const router = express.Router();

const STORAGE_LIMIT = 400 * 1024 * 1024; // 400 MB per user
const STORAGE_LIMIT_MB = Math.round(STORAGE_LIMIT / (1024 * 1024));

// ── POST /api/notes/upload ─────────────────────────────────────────────────────
router.post("/upload", requireAuth, (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No file provided." });

    // Enforce the per-user storage cap (the file is already on disk via multer).
    const existing = await Note.find({ userId: req.userId }, "size");
    const used = existing.reduce((sum, n) => sum + n.size, 0);
    if (used + req.file.size > STORAGE_LIMIT) {
      fs.unlink(path.join(UPLOADS_DIR, req.file.filename), () => {});
      return res.status(413).json({
        message: `You've reached your ${STORAGE_LIMIT_MB} MB storage limit. Delete some files and try again.`,
      });
    }

    const note = await Note.create({
      userId:       req.userId,
      originalName: req.file.originalname,
      storedName:   req.file.filename,
      mimetype:     req.file.mimetype,
      size:         req.file.size,
    });

    // Respond right away, then build the RAG search index in the background so
    // the upload feels instant. Failures here never break the upload.
    res.status(201).json({ note });
    indexNote(note).catch((e) => console.error("auto-index error:", e.message));
  } catch (err) {
    console.error("upload error:", err.message);
    res.status(500).json({ message: "Upload failed. Please try again." });
  }
});

// ── GET /api/notes/storage ────────────────────────────────────────────────────
router.get("/storage", requireAuth, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.userId }, "size");
    const totalBytes = notes.reduce((sum, n) => sum + n.size, 0);
    res.json({ totalBytes, count: notes.length, limitBytes: STORAGE_LIMIT });
  } catch (err) {
    console.error("storage error:", err.message);
    res.status(500).json({ message: "Could not get storage info." });
  }
});

// ── GET /api/notes ─────────────────────────────────────────────────────────────
router.get("/", requireAuth, async (req, res) => {
  try {
    const notes = await Note.find({ userId: req.userId }).sort({ createdAt: -1 });
    res.json({ notes });
  } catch (err) {
    console.error("get notes error:", err.message);
    res.status(500).json({ message: "Could not fetch notes." });
  }
});

// ── DELETE /api/notes/:id ──────────────────────────────────────────────────────
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found." });
    if (note.userId.toString() !== req.userId)
      return res.status(403).json({ message: "You don't have permission to delete this note." });

    fs.unlink(path.join(UPLOADS_DIR, note.storedName), () => {});
    await Note.deleteOne({ _id: note._id });
    await Summary.deleteOne({ noteId: note._id }); // drop its summary too
    await Quiz.deleteOne({ noteId: note._id });    // ...and its quiz
    await Chunk.deleteMany({ noteId: note._id });  // ...and its search chunks
    res.json({ message: "Note deleted." });
  } catch (err) {
    console.error("delete note error:", err.message);
    res.status(500).json({ message: "Could not delete note." });
  }
});

// ── GET /api/notes/file/:id ────────────────────────────────────────────────────
// Serves the actual file — auth + ownership required.
router.get("/file/:id", requireAuth, async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) return res.status(404).json({ message: "Note not found." });
    if (note.userId.toString() !== req.userId)
      return res.status(403).json({ message: "Access denied." });

    const filePath = path.join(UPLOADS_DIR, note.storedName);
    if (!fs.existsSync(filePath))
      return res.status(404).json({ message: "File not found on server." });

    res.setHeader("Content-Disposition", `attachment; filename="${note.originalName}"`);
    res.setHeader("Content-Type", note.mimetype);
    res.sendFile(filePath);
  } catch (err) {
    console.error("serve file error:", err.message);
    res.status(500).json({ message: "Could not retrieve file." });
  }
});

export default router;
