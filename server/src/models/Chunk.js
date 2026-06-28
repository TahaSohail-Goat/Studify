import mongoose from "mongoose";

// A Chunk is one small passage of a note plus its embedding vector. RAG retrieval
// searches across these. One note becomes many chunks.
const chunkSchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    noteId:    { type: mongoose.Schema.Types.ObjectId, ref: "Note", required: true, index: true },
    noteName:  { type: String, required: true },
    index:     { type: Number, required: true },   // position within the note
    text:      { type: String, required: true },
    embedding: { type: [Number], required: true }, // 384-dim MiniLM vector
  },
  { timestamps: true }
);

export const Chunk = mongoose.model("Chunk", chunkSchema);
