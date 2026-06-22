// ── Dashboard ────────────────────────────────────────────────────────────────
// The first screen you see after logging in. For now it greets you and shows
// placeholder cards for the features we'll build in the coming phases.

import {
  GraduationCap,
  Upload,
  MessagesSquare,
  ScrollText,
  Brain,
  BarChart3,
  LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const FEATURES = [
  { Icon: Upload, title: "Upload Notes", desc: "Add PDFs and notes", soon: "Phase 2" },
  { Icon: MessagesSquare, title: "Chat with Notes", desc: "Ask questions, get answers", soon: "Phase 4" },
  { Icon: ScrollText, title: "Summaries", desc: "Auto-condense your material", soon: "Phase 5" },
  { Icon: Brain, title: "Quizzes", desc: "Test yourself automatically", soon: "Phase 5" },
  { Icon: BarChart3, title: "Analytics", desc: "Track your progress", soon: "Phase 6" },
];

export default function Dashboard() {
  const { user, logout } = useAuth();

  return (
    <div className="dash">
      {/* background orbs reused from the auth screens */}
      <div className="orb orb--1" />
      <div className="orb orb--2" />

      <header className="dash__header">
        <div className="auth-brand">
          <span className="auth-brand__logo">
            <GraduationCap size={20} strokeWidth={2.2} />
          </span>
          <span className="auth-brand__name">Studyify</span>
        </div>
        <div className="dash__user">
          <div className="dash__avatar">
            {user?.name?.charAt(0).toUpperCase() || "?"}
          </div>
          <span className="dash__name">{user?.name}</span>
          <button className="btn-ghost" onClick={logout}>
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </header>

      <main className="dash__main">
        <h1 className="dash__greeting">
          Welcome, {user?.name?.split(" ")[0] || "there"}
        </h1>
        <p className="dash__sub">
          You're logged in. Your study tools will appear here as we build them.
        </p>

        <div className="feature-grid">
          {FEATURES.map(({ Icon, title, desc, soon }) => (
            <div className="feature-card" key={title}>
              <div className="feature-card__icon">
                <Icon size={24} strokeWidth={1.9} />
              </div>
              <h3 className="feature-card__title">{title}</h3>
              <p className="feature-card__desc">{desc}</p>
              <span className="feature-card__badge">Coming · {soon}</span>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
