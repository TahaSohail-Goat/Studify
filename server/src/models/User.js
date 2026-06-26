// ── User model ───────────────────────────────────────────────────────────────
// This defines the shape of a "user" document and the rules for each field.

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true, // can't create a user without a name
      trim: true,     // remove accidental spaces around it
    },
    email: {
      type: String,
      required: true,
      unique: true,    // no two users can share an email
      lowercase: true, // store "Taha@X.com" as "taha@x.com" so logins are consistent
      trim: true,
    },
    password: {
      type: String,
      required: true,
      // NOTE: this stores the *hashed* password, never the real one.
    },
    studyGoal: {
      type: Number,
      default: 30,  // minutes per day
      min: 5,
      max: 480,
    },
    avatar: {
      type: String,
      default: "", // stored filename of the profile photo (lives in uploads/avatars)
    },
    tokenVersion: {
      type: Number,
      default: 0,
      // Bumped by "sign out of all devices". Every login token carries the
      // version it was issued under; if it no longer matches, the token is dead.
    },
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt fields
  }
);

// A "model" is the tool we use to create/find/update users in the database.
// mongoose will use the collection name "users" (lowercased + pluralized).
export const User = mongoose.model("User", userSchema);

