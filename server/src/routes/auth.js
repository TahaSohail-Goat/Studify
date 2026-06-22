import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { User } from "../models/User.js";
import { OtpCode } from "../models/OtpCode.js";
import { sendOtpEmail } from "../utils/sendEmail.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// ── Helper ────────────────────────────────────────────────────────────────────
function generateOtp() {
  // Cryptographically random 6-digit code, zero-padded (e.g. "047291").
  return String(crypto.randomInt(0, 999999)).padStart(6, "0");
}

function signToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" });
}

// ── POST /api/auth/register ───────────────────────────────────────────────────
// Step 1: validate input → check email not taken → send OTP.
// We do NOT create the user yet — only after they verify the OTP.
router.post("/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "Name, email, and password are all required." });

    if (password.length < 6)
      return res.status(400).json({ message: "Password must be at least 6 characters." });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing)
      return res.status(409).json({ message: "An account with this email already exists." });

    const code = generateOtp();

    // Upsert: replace any previous OTP for this email so there's only ever one.
    await OtpCode.findOneAndUpdate(
      { email: email.toLowerCase() },
      { code, createdAt: new Date() },
      { upsert: true, new: true }
    );

    await sendOtpEmail(email, code);

    res.json({ message: "Verification code sent to your email." });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Could not send verification email. Check your email settings." });
  }
});

// ── POST /api/auth/verify-otp ─────────────────────────────────────────────────
// Step 2: user submits the 6-digit code.
// If valid → create the account → return JWT (auto log-in).
router.post("/verify-otp", async (req, res) => {
  try {
    const { name, email, password, code } = req.body;

    if (!name || !email || !password || !code)
      return res.status(400).json({ message: "All fields are required." });

    const record = await OtpCode.findOne({ email: email.toLowerCase() });

    if (!record || record.code !== code)
      return res.status(400).json({ message: "Invalid or expired code. Try resending." });

    // Code is correct — delete it so it can't be reused.
    await OtpCode.deleteOne({ _id: record._id });

    // Create the verified account now.
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, email, password: hashedPassword });

    const token = signToken(user._id);

    res.status(201).json({
      message: "Account verified and created!",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Verify OTP error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// ── POST /api/auth/resend-otp ─────────────────────────────────────────────────
// User can request a fresh code without re-filling the form.
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
    console.error("Resend OTP error:", err);
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
      message: "Logged in successfully!",
      token: signToken(user._id),
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
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
