// ── Studyify backend: the entry point of our server ──────────────────────────
// This file starts a small web server that the React app will talk to.

import express from "express"; // Express = a tiny framework that makes building an HTTP API easy
import cors from "cors";       // CORS = lets our React app (a different port) call this server safely
import "dotenv/config";        // loads secret settings from the .env file into process.env
import { connectDB } from "./config/db.js"; // our database connection helper
import authRoutes from "./routes/auth.js";  // register / login routes

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

// ── Routes: "when someone visits this URL, do this" ──────────────────────────
// A health check is the simplest possible route. We use it to confirm the
// server is alive. Visit http://localhost:5000/api/health to see it.
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "studyify-server",
    time: new Date().toISOString(),
  });
});

// All routes inside auth.js get the "/api/auth" prefix.
// So router.post("/register") becomes POST /api/auth/register.
app.use("/api/auth", authRoutes);

// ── Start listening ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
  console.log(`   Try the health check: http://localhost:${PORT}/api/health`);
});
