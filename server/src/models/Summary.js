import mongoose from "mongoose";

// One summary per note per user. Re-summarizing a file upserts (replaces) it,
// so a file never accumulates duplicate summaries.
const summarySchema = new mongoose.Schema(
  {
    userId:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    noteId:    { type: mongoose.Schema.Types.ObjectId, ref: "Note", required: true },
    noteName:  { type: String, required: true }, // copy of the file name at generation time
    content:   { type: String, required: true }, // the summary (Markdown)
    model:     { type: String },                 // which model produced it
    truncated: { type: Boolean, default: false }, // was the source text too long to send in full
  },
  { timestamps: true }
);

// Enforce a single summary per (user, note).
summarySchema.index({ userId: 1, noteId: 1 }, { unique: true });

export const Summary = mongoose.model("Summary", summarySchema);
