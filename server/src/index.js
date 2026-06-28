// ── Studify backend: the entry point of our server ───────────────────────────
// This file starts a small web server that the React app will talk to.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express"; // Express = a tiny framework that makes building an HTTP API easy
import cors from "cors";       // CORS = lets our React app (a different port) call this server safely
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

// The "port" is the door number the server listens on. We read it from .env,
// and fall back to 5000 if it isn't set.
const PORT = process.env.PORT || 5000;

// ── Middleware: code that runs on every incoming request ─────────────────────
app.use(cors());          // allow the browser app to make requests to us
app.use(express.json());  // automatically turn JSON request bodies into JS objects

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
app.use("/api/auth", authRoutes);
app.use("/api/notes", notesRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/summaries", summariesRoutes);
app.use("/api/quizzes", quizzesRoutes);
app.use("/api/rag", ragRoutes);
app.use("/api/analytics", analyticsRoutes);

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
