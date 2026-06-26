import mongoose from "mongoose";

// A single message inside a conversation. `_id: false` keeps these lightweight
// (we don't need a separate id for every message).
const messageSchema = new mongoose.Schema(
  {
    role:    { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
  },
  { _id: false, timestamps: { createdAt: true, updatedAt: false } }
);

const conversationSchema = new mongoose.Schema(
  {
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title:    { type: String, default: "New chat" },
    model:    { type: String, default: "gemini-2.0-flash" }, // last model used
    messages: { type: [messageSchema], default: [] },
  },
  { timestamps: true }
);

export const Conversation = mongoose.model("Conversation", conversationSchema);
