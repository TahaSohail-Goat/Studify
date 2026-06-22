import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { User } from "../models/User.js";
import { OtpCode } from "../models/OtpCode.js";
import { sendOtpEmail } from "../utils/sendEmail.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateOtp() {
  return String(crypto.randomInt(0, 999999)).padStart(6, "0");
}

function signAuthToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// A short-lived token that proves "this email was verified by OTP".
// Passed from the verify step to the complete-signup step.
function signVerifiedToken(email) {
  return jwt.sign({ email, type: "email_verified" }, process.env.JWT_SECRET, {
    expiresIn: "15m",
  });
}

// ── POST /api/auth/send-otp ───────────────────────────────────────────────────
// Step 1: user enters email → we send them a code.
router.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ message: "An account with this email already exists." });

    const code = generateOtp();

    await OtpCode.findOneAndUpdate(
      { email: email.toLowerCase() },
      { code, createdAt: new Date() },
      { upsert: true, new: true }
    );

    await sendOtpEmail(email, code);

    res.json({ message: "Verification code sent." });
  } catch (err) {
    console.error("send-otp error:", err.message);
    res.status(500).json({
      message: "Could not send email. Make sure EMAIL_USER and EMAIL_PASS are set correctly in .env.",
      detail: err.message,
    });
  }
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
// Step 2: user submits the 6-digit code → we return a short-lived "verified" token.
// No account is created here yet.
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) return res.status(400).json({ message: "Email and code are required." });

    const record = await OtpCode.findOne({ email: email.toLowerCase() });
    if (!record || record.code !== code)
      return res.status(400).json({ message: "Invalid or expired code. Try resending." });

    // Delete the OTP so it cannot be reused.
    await OtpCode.deleteOne({ _id: record._id });

    res.json({ verifiedToken: signVerifiedToken(email) });
  } catch (err) {
    console.error("verify-otp error:", err.message);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ── POST /api/auth/complete-signup ────────────────────────────────────────────
// Step 3: user provides name + password. We verify their "email verified" token,
// then create the account and return a full auth token.
router.post("/complete-signup", async (req, res) => {
  try {
    const { verifiedToken, name, password } = req.body;
    if (!verifiedToken || !name || !password)
      return res.status(400).json({ message: "All fields are required." });

    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters." });

    let decoded;
    try {
      decoded = jwt.verify(verifiedToken, process.env.JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "Verification expired. Please start over." });
    }

    if (decoded.type !== "email_verified")
      return res.status(401).json({ message: "Invalid verification token." });

    const { email } = decoded;

    // Guard against race condition (someone registered with this email between steps).
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ message: "This email is already registered." });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });

    res.status(201).json({
      message: "Account created!",
      token: signAuthToken(user._id),
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("complete-signup error:", err.message);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ── POST /api/auth/resend-otp ─────────────────────────────────────────────────
router.post("/resend-otp", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required." });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ message: "This email is already registered." });

    const code = generateOtp();
    await OtpCode.findOneAndUpdate(
      { email: email.toLowerCase() },
      { code, createdAt: new Date() },
      { upsert: true, new: true }
    );

    await sendOtpEmail(email, code);
    res.json({ message: "A new code has been sent." });
  } catch (err) {
    console.error("resend-otp error:", err.message);
    res.status(500).json({ message: "Could not resend code. Please try again." });
  }
});

// ── POST /api/auth/login ──────────────────────────────────────────────────────
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ message: "Email and password are required." });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(401).json({ message: "Invalid email or password." });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Invalid email or password." });

    res.json({
      token: signAuthToken(user._id),
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("login error:", err.message);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ── PUT /api/auth/change-password ────────────────────────────────────────────
router.put("/change-password", requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: "Both passwords are required." });
    if (newPassword.length < 6)
      return res.status(400).json({ message: "New password must be at least 6 characters." });

    const user = await User.findById(req.userId);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch)
      return res.status(401).json({ message: "Current password is incorrect." });

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Password changed successfully." });
  } catch (err) {
    console.error("change-password error:", err.message);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ── GET /api/auth/me ──────────────────────────────────────────────────────────
router.get("/me", requireAuth, async (req, res) => {
  const user = await User.findById(req.userId).select("-password");
  if (!user) return res.status(404).json({ message: "User not found." });
  res.json({ user });
});

export default router;
