// ── Auth middleware ──────────────────────────────────────────────────────────
// "Middleware" = a function that runs BEFORE a route, and can either let the
// request continue (call next()) or stop it with an error response.
//
// This one is our "bouncer": it checks for a valid JWT and, if found, attaches
// the user's id to the request so the route knows who is asking.

import jwt from "jsonwebtoken";
import { User } from "../models/User.js";

export async function requireAuth(req, res, next) {
  // The browser sends the token in a header like:  Authorization: Bearer <token>
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: "You must be logged in." });
  }

  try {
    // jwt.verify checks the signature using our secret. If the token was forged
    // or tampered with, this throws and we reject the request.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Look the user up so we can confirm the token hasn't been revoked.
    // "Sign out of all devices" bumps tokenVersion; tokens minted before that
    // carry an older version and are rejected here. (Older tokens with no
    // version are treated as 0 so existing logins keep working.)
    const user = await User.findById(decoded.userId).select("tokenVersion");
    if (!user) {
      return res.status(401).json({ message: "Your account no longer exists." });
    }
    if ((decoded.tokenVersion ?? 0) !== (user.tokenVersion ?? 0)) {
      return res
        .status(401)
        .json({ message: "You've been signed out. Please log in again." });
    }

    // Stash the id so the route handler can use it (e.g. "find THIS user's notes").
    req.userId = decoded.userId;

    next(); // all good — let the request proceed to the actual route
  } catch {
    return res
      .status(401)
      .json({ message: "Your session is invalid or has expired. Please log in again." });
  }
}
