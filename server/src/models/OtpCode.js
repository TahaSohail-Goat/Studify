import mongoose from "mongoose";

const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true },
  code:  { type: String, required: true },
  // MongoDB will automatically delete this document 10 minutes after createdAt.
  createdAt: { type: Date, default: Date.now, expires: 600 },
});

export const OtpCode = mongoose.model("OtpCode", otpSchema);
