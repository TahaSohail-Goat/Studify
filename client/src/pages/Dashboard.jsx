import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, MessageSquare, ScrollText, Brain, BarChart3, Upload, ArrowRight,
} from "lucide-react";
import AppLayout from "../components/AppLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getNotesApi } from "../api/notes.js";
import { getConversationsApi } from "../api/chat.js";

const FEATURES = [
  {
    to: "/notes",
    icon: Upload,
    name: "Upload Notes",
    desc: "Upload PDFs or paste text and Studify will index them for AI search.",
    badge: "Phase 2",
  },
  {
    to: "/chat",
    icon: MessageSquare,
    name: "AI Chat",
    desc: "Ask anything about your notes. Get precise, cited answers instantly.",
    badge: "Phase 3",
  },
  {
    to: "/summaries",
    icon: ScrollText,
    name: "Summaries",
    desc: "One-click summary of any note or PDF using AI.",
    badge: "Phase 4",
  },
  {
    to: "/quizzes",
    icon: Brain,
    name: "Quiz Generator",
    desc: "Auto-generate quizzes from your material to test your knowledge.",
    badge: "Phase 5",
  },
  {
    to: "/notes",
    icon: BookOpen,
    name: "My Notes",
    desc: "Browse, search, and manage all your uploaded study materials.",
    badge: "Phase 2",
  },
  {
    to: "/analytics",
    icon: BarChart3,
    name: "Analytics",
    desc: "Track your study streaks, quiz scores, and AI usage over time.",
    badge: "Phase 6",
  },
];

function greeting(name) {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${name?.split(" ")[0] || "there"}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [noteCount, setNoteCount]     = useState("…");
  const [convoCount, setConvoCount]   = useState("…");
  const [recentChats, setRecentChats] = useState([]);

  useEffect(() => {
    getNotesApi()
      .then((data) => setNoteCount(data.notes.length))
      .catch(() => setNoteCount(0));

    getConversationsApi()
      .then((data) => {
        setConvoCount(data.conversations.length);
        setRecentChats(data.conversations.slice(0, 4));
      })
      .catch(() => setConvoCount(0));
  }, []);

  const STATS = [
    { icon: BookOpen,      value: String(noteCount),  label: "Notes uploaded" },
    { icon: MessageSquare, value: String(convoCount), label: "AI conversations" },
    { icon: ScrollText,    value: "0",                label: "Summaries made" },
    { icon: Brain,         value: "0",                label: "Quizzes taken" },
  ];

  return (
    <AppLayout title="Dashboard">
      <div className="page-header">
        <h1>{greeting(user?.name)}</h1>
        <p>Here's an overview of your Studify workspace.</p>
      </div>

      {/* Stats row */}
      <div className="stat-row">
        {STATS.map(({ icon: Icon, value, label }) => (
          <div className="stat-card" key={label}>
            <div className="stat-card__icon">
              <Icon size={18} />
            </div>
            <div className="stat-card__value">{value}</div>
            <div className="stat-card__label">{label}</div>
          </div>
        ))}
      </div>

      {/* Recent conversations — links straight back into the chat */}
      {recentChats.length > 0 && (
        <>
          <p className="section-title">Jump back in</p>
          <div className="recent-chats">
            {recentChats.map((c) => (
              <Link key={c._id} to={`/chat?c=${c._id}`} className="recent-chat">
                <MessageSquare size={16} className="recent-chat__icon" />
                <span className="recent-chat__title">{c.title}</span>
                <ArrowRight size={15} className="recent-chat__arrow" />
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Feature cards */}
      <p className="section-title">Features</p>
      <div className="feature-grid-app">
        {FEATURES.map(({ to, icon: Icon, name, desc, badge }) => (
          <Link key={name} to={to} className="feature-card-app">
            <div className="feature-card-app__icon">
              <Icon size={20} />
            </div>
            <div className="feature-card-app__name">{name}</div>
            <div className="feature-card-app__desc">{desc}</div>
            <span className="feature-card-app__badge">{badge}</span>
          </Link>
        ))}
      </div>
    </AppLayout>
  );
}
