import mongoose from "mongoose";

const noteSchema = new mongoose.Schema(
  {
    userId:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    originalName: { type: String, required: true },
    storedName:   { type: String, required: true },
    mimetype:     { type: String, required: true },
    size:         { type: Number, required: true },
  },
  { timestamps: true }
);

export const Note = mongoose.model("Note", noteSchema);
