// ── Auth routes ──────────────────────────────────────────────────────────────
// Everything about accounts: registering now, logging in next (step 1.3).

import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { requireAuth } from "../middleware/auth.js";

// A "router" is a mini collection of routes we'll plug into the main app.
const router = express.Router();

// POST /api/auth/register  → create a new account
router.post("/register", async (req, res) => {
  try {
    // req.body holds the JSON the frontend sent us (name, email, password).
    const { name, email, password } = req.body;

    // 1) Basic validation — never trust incoming data.
    if (!name || !email || !password) {
      return res
        .status(400) // 400 = "Bad Request" (the client sent something invalid)
        .json({ message: "Name, email, and password are all required." });
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters." });
    }

    // 2) Make sure this email isn't already taken.
    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res
        .status(409) // 409 = "Conflict" (it already exists)
        .json({ message: "An account with this email already exists." });
    }

    // 3) Scramble (hash) the password before saving. 10 = how much work bcrypt does.
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4) Save the new user to MongoDB.
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
    });

    // 5) Respond with the new user — but NEVER send the password back.
    res.status(201).json({
      message: "Account created successfully!",
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// POST /api/auth/login  → check credentials and hand back a JWT
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    }

    // Find the user by email.
    const user = await User.findOne({ email: email.toLowerCase() });

    // Security note: whether the email doesn't exist OR the password is wrong,
    // we return the SAME vague message. This stops attackers from discovering
    // which emails are registered.
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // bcrypt.compare re-hashes the typed password and checks it against the
    // stored hash — without ever un-scrambling the stored one.
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Credentials are good → create the "wristband" (JWT).
    // We bake the user's id into it and sign it with our secret.
    const token = jwt.sign(
      { userId: user._id },        // the payload (data inside the token)
      process.env.JWT_SECRET,      // the secret seal — only our server knows it
      { expiresIn: "7d" }          // the wristband stops working after 7 days
    );

    res.json({
      message: "Logged in successfully!",
      token,
      user: { id: user._id, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// GET /api/auth/me  → who am I? (a PROTECTED route)
// `requireAuth` runs first; it only lets the request through if a valid token
// was sent. Then we look up and return the logged-in user.
router.get("/me", requireAuth, async (req, res) => {
  // requireAuth attached req.userId for us. ".select('-password')" means
  // "give me everything EXCEPT the password field".
  const user = await User.findById(req.userId).select("-password");
  if (!user) {
    return res.status(404).json({ message: "User not found." });
  }
  res.json({ user });
});

export default router;
