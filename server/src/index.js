// ── Studify backend: the entry point of our server ───────────────────────────
// This file starts a small web server that the React app will talk to.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express"; // Express = a tiny framework that makes building an HTTP API easy
import cors from "cors";       // CORS = lets our React app (a different port) call this server safely
import rateLimit from "express-rate-limit"; // throttles abusive clients
import "dotenv/config";        // loads secret settings from the .env file into process.env
import { connectDB } from "./config/db.js"; // our database connection helper
import authRoutes from "./routes/auth.js";  // register / login routes
import notesRoutes from "./routes/notes.js"; // notes upload / list / delete routes
import chatRoutes from "./routes/chat.js";  // AI chat routes
import summariesRoutes from "./routes/summaries.js"; // AI summaries routes
import quizzesRoutes from "./routes/quizzes.js"; // AI quiz routes
import ragRoutes from "./routes/rag.js"; // RAG index status / reindex routes
import analyticsRoutes from "./routes/analytics.js"; // analytics + AI insights
import { warmEmbeddings } from "./utils/embeddings.js"; // preload the embedding model

// Ensure the uploads directory (and the public avatars sub-folder) exist on boot.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "../uploads");
const avatarsDir = path.join(uploadsDir, "avatars");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);
if (!fs.existsSync(avatarsDir)) fs.mkdirSync(avatarsDir);

// Connect to MongoDB first. `await` means "wait until this finishes" before continuing.
await connectDB();

// `app` is our server. We attach routes and settings to it.
const app = express();

// Trust the first proxy (needed so rate-limiting sees the real client IP when
// deployed behind a host like Render/Railway).
app.set("trust proxy", 1);

// The "port" is the door number the server listens on. We read it from .env,
// and fall back to 5000 if it isn't set.
const PORT = process.env.PORT || 5000;

// ── Middleware: code that runs on every incoming request ─────────────────────
app.use(cors());          // allow the browser app to make requests to us
app.use(express.json());  // automatically turn JSON request bodies into JS objects

// ── Rate limiters: protect against brute-force / abuse and the shared AI key ──
const rateLimitMsg = (message) => ({
  windowMs: 15 * 60 * 1000, // 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  message: { message },
});
// Auth: guards login/OTP against brute-force and spam.
const authLimiter = rateLimit({ ...rateLimitMsg("Too many attempts. Please wait a few minutes and try again."), max: 40 });
// AI: caps how often one client can hit the (cost-bearing) AI endpoints.
const aiLimiter = rateLimit({ ...rateLimitMsg("You're sending requests too quickly. Please slow down and try again shortly."), max: 120 });

// Serve profile photos publicly so <img src="/avatars/..."> works in the browser.
// (Notes stay private — they're only served through an authenticated route.)
app.use("/avatars", express.static(avatarsDir));

// ── Routes: "when someone visits this URL, do this" ──────────────────────────
// A health check is the simplest possible route. We use it to confirm the
// server is alive. Visit http://localhost:5000/api/health to see it.
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "studify-server",
    time: new Date().toISOString(),
  });
});

// All routes inside auth.js get the "/api/auth" prefix.
// So router.post("/register") becomes POST /api/auth/register.
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/chat", aiLimiter, chatRoutes);
app.use("/api/summaries", aiLimiter, summariesRoutes);
app.use("/api/quizzes", aiLimiter, quizzesRoutes);
app.use("/api/rag", ragRoutes);
app.use("/api/analytics", analyticsRoutes);

// ── 404 for any unmatched route — clean JSON, not an HTML page ────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Not found." });
});

// ── Global error handler ──────────────────────────────────────────────────────
// Centralizes errors so the client always gets clean JSON and never sees a
// stack trace or server file paths. (Must be last, and must take 4 args for
// Express to treat it as an error handler.)
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  // Malformed JSON body from express.json()
  if (err.type === "entity.parse.failed" || err instanceof SyntaxError) {
    return res.status(400).json({ message: "Invalid JSON in the request body." });
  }
  // Body larger than the configured limit
  if (err.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large." });
  }
  console.error("unhandled error:", err.stack || err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    message: status === 500 ? "Something went wrong on our end." : err.message,
  });
});

// ── Start listening ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`   Try the health check: http://localhost:${PORT}/api/health`);

  // Preload the embedding model in the background (first call downloads ~30 MB,
  // then it's cached). This keeps the first RAG chat fast.
  console.log("⏳ Warming up the embedding model (first run downloads it)…");
  warmEmbeddings().then((ok) => {
    if (ok) console.log("🧠 Embedding model ready — RAG search is live.");
  });
});
