// ── Database connection ──────────────────────────────────────────────────────
// This file knows how to connect our server to MongoDB using Mongoose.

import mongoose from "mongoose";
import dns from "node:dns";

// Windows fix: Node's built-in DNS resolver sometimes can't look up the special
// "mongodb+srv" records and fails with "querySrv ECONNREFUSED". Pointing it at
// Google's public DNS (8.8.8.8) and Cloudflare's (1.1.1.1) makes those lookups work.
dns.setServers(["8.8.8.8", "1.1.1.1"]);

// We export a function the server calls once, on startup.
export async function connectDB() {
  const uri = process.env.MONGODB_URI;

  // Fail loudly and early if the setting is missing — much easier to debug.
  if (!uri) {
    console.error("❌ MONGODB_URI is missing. Add it to server/.env");
    process.exit(1); // stop the server; there's no point running without a DB
  }

  try {
    await mongoose.connect(uri); // this actually opens the connection
    console.log("✅ Connected to MongoDB");
  } catch (err) {
    console.error("❌ Could not connect to MongoDB:", err.message);
    process.exit(1);
  }
}
