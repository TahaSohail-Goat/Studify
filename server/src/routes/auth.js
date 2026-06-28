import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { User } from "../models/User.js";
import { OtpCode } from "../models/OtpCode.js";
import { Note } from "../models/Note.js";
import { Summary } from "../models/Summary.js";
import { Quiz } from "../models/Quiz.js";
import { Chunk } from "../models/Chunk.js";
import { UPLOADS_DIR, AVATARS_DIR, avatarUpload } from "../middleware/upload.js";
import { sendOtpEmail } from "../utils/sendEmail.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateOtp() {
  return String(crypto.randomInt(0, 999999)).padStart(6, "0");
}

// The auth token now carries tokenVersion so it can be invalidated on demand.
function signAuthToken(user) {
  return jwt.sign(
    { userId: user._id, tokenVersion: user.tokenVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

// The single, consistent shape of a user we send to the client. Never includes
// the password hash or tokenVersion.
function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    studyGoal: user.studyGoal,
    avatar: user.avatar || "",
    createdAt: user.createdAt,
  };
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
      { upsert: true, returnDocument: "after" }
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
      token: signAuthToken(user),
      user: publicUser(user),
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
      { upsert: true, returnDocument: "after" }
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
      token: signAuthToken(user),
      user: publicUser(user),
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
  res.json({ user: publicUser(user) });
});

// ── PUT /api/auth/update-profile ──────────────────────────────────────────────
router.put("/update-profile", requireAuth, async (req, res) => {
  try {
    const { name, studyGoal } = req.body;
    const update = {};

    if (name !== undefined) {
      if (!String(name).trim()) return res.status(400).json({ message: "Name cannot be empty." });
      update.name = String(name).trim();
    }
    if (studyGoal !== undefined) {
      const g = Number(studyGoal);
      if (isNaN(g) || g < 5 || g > 480)
        return res.status(400).json({ message: "Goal must be between 5 and 480 minutes." });
      update.studyGoal = g;
    }
    if (!Object.keys(update).length)
      return res.status(400).json({ message: "Nothing to update." });

    const user = await User.findByIdAndUpdate(req.userId, update, { returnDocument: "after" }).select("-password");
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("update-profile error:", err.message);
    res.status(500).json({ message: "Something went wrong." });
  }
});

// ── POST /api/auth/request-email-change ───────────────────────────────────────
// Sends an OTP to the *new* email address. Auth required.
router.post("/request-email-change", requireAuth, async (req, res) => {
  try {
    const { newEmail } = req.body;
    if (!newEmail) return res.status(400).json({ message: "New email is required." });

    const existing = await User.findOne({ email: newEmail.toLowerCase() });
    if (existing) return res.status(409).json({ message: "This email is already in use." });

    const code = generateOtp();
    await OtpCode.findOneAndUpdate(
      { email: newEmail.toLowerCase() },
      { code, createdAt: new Date() },
      { upsert: true, returnDocument: "after" }
    );
    await sendOtpEmail(newEmail, code);
    res.json({ message: "Verification code sent to new email." });
  } catch (err) {
    console.error("request-email-change error:", err.message);
    res.status(500).json({ message: "Could not send verification code." });
  }
});

// ── POST /api/auth/confirm-email-change ───────────────────────────────────────
router.post("/confirm-email-change", requireAuth, async (req, res) => {
  try {
    const { newEmail, code } = req.body;
    if (!newEmail || !code) return res.status(400).json({ message: "Email and code are required." });

    const record = await OtpCode.findOne({ email: newEmail.toLowerCase() });
    if (!record || record.code !== code)
      return res.status(400).json({ message: "Invalid or expired code." });

    await OtpCode.deleteOne({ _id: record._id });

    const user = await User.findByIdAndUpdate(
      req.userId,
      { email: newEmail.toLowerCase() },
      { returnDocument: "after" }
    ).select("-password");

    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("confirm-email-change error:", err.message);
    res.status(500).json({ message: "Something went wrong." });
  }
});

// ── DELETE /api/auth/delete-account ───────────────────────────────────────────
router.delete("/delete-account", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Remove uploaded note files from disk...
    const notes = await Note.find({ userId: req.userId }, "storedName");
    for (const note of notes) {
      fs.unlink(path.join(UPLOADS_DIR, note.storedName), () => {});
    }
    // ...the avatar...
    if (user.avatar) {
      fs.unlink(path.join(AVATARS_DIR, user.avatar), () => {});
    }
    // ...then the database records.
    await Note.deleteMany({ userId: req.userId });
    await Summary.deleteMany({ userId: req.userId });
    await Quiz.deleteMany({ userId: req.userId });
    await Chunk.deleteMany({ userId: req.userId });
    await User.findByIdAndDelete(req.userId);
    res.json({ message: "Account deleted." });
  } catch (err) {
    console.error("delete-account error:", err.message);
    res.status(500).json({ message: "Could not delete account." });
  }
});

// ── POST /api/auth/avatar ─────────────────────────────────────────────────────
// Upload (or replace) the profile photo. The old file is removed from disk.
router.post("/avatar", requireAuth, (req, res, next) => {
  avatarUpload.single("avatar")(req, res, (err) => {
    if (err) return res.status(400).json({ message: err.message });
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image provided." });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    // Delete the previous avatar so old files don't pile up.
    if (user.avatar) {
      fs.unlink(path.join(AVATARS_DIR, user.avatar), () => {});
    }

    user.avatar = req.file.filename;
    await user.save();
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("avatar upload error:", err.message);
    res.status(500).json({ message: "Could not update profile photo." });
  }
});

// ── DELETE /api/auth/avatar ───────────────────────────────────────────────────
router.delete("/avatar", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.avatar) {
      fs.unlink(path.join(AVATARS_DIR, user.avatar), () => {});
      user.avatar = "";
      await user.save();
    }
    res.json({ user: publicUser(user) });
  } catch (err) {
    console.error("avatar delete error:", err.message);
    res.status(500).json({ message: "Could not remove profile photo." });
  }
});

// ── POST /api/auth/logout-all ─────────────────────────────────────────────────
// Bumps tokenVersion, which instantly invalidates every existing login token
// (including the current one — the client should log out locally afterwards).
router.post("/logout-all", requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { $inc: { tokenVersion: 1 } });
    res.json({ message: "Signed out of all devices." });
  } catch (err) {
    console.error("logout-all error:", err.message);
    res.status(500).json({ message: "Could not sign out of all devices." });
  }
});

// ── GET /api/auth/export ──────────────────────────────────────────────────────
// Returns a JSON snapshot of the user's account + notes metadata (data export).
router.get("/export", requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found." });

    const notes = await Note.find({ userId: req.userId }).sort({ createdAt: -1 });

    res.json({
      exportedAt: new Date().toISOString(),
      account: publicUser(user),
      notes: notes.map((n) => ({
        originalName: n.originalName,
        mimetype: n.mimetype,
        size: n.size,
        uploadedAt: n.createdAt,
      })),
    });
  } catch (err) {
    console.error("export error:", err.message);
    res.status(500).json({ message: "Could not export your data." });
  }
});

export default router;
