import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, MessageSquare, ScrollText, Brain, BarChart3, Upload, ArrowRight,
  UserPlus, Sparkles, Trophy, FileText, Bot, Zap,
} from "lucide-react";
import AppLayout from "../components/AppLayout.jsx";
import Reveal from "../components/Reveal.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getNotesApi } from "../api/notes.js";
import { getConversationsApi } from "../api/chat.js";
import { getSummariesApi } from "../api/summaries.js";

/* What makes Studify, Studify — the value props shown in the "About" band. */
const PILLARS = [
  {
    icon: FileText,
    title: "Bring your own material",
    desc: "Upload PDFs or paste your notes. Studify reads, indexes, and understands every page.",
  },
  {
    icon: Bot,
    title: "An AI that knows your notes",
    desc: "Ask questions in plain English and get precise, context-aware answers grounded in your files.",
  },
  {
    icon: Zap,
    title: "Study smarter, not longer",
    desc: "Summaries, quizzes, and progress tracking turn hours of revision into focused minutes.",
  },
];

/* The end-to-end journey through the product — rendered as a scroll timeline. */
const FLOW = [
  {
    icon: UserPlus,
    title: "Create your account",
    desc: "Sign up and verify your email with a secure one-time code. Your study space is private to you.",
    tag: "Step 1",
  },
  {
    icon: Upload,
    title: "Upload your material",
    desc: "Drop in PDFs or text notes. Studify extracts the text and gets it ready for AI.",
    tag: "Step 2",
  },
  {
    icon: MessageSquare,
    title: "Chat with your notes",
    desc: "Ask anything about what you uploaded and get instant, grounded answers — like a tutor who has read everything.",
    tag: "Step 3",
  },
  {
    icon: ScrollText,
    title: "Summarize in one click",
    desc: "Turn long documents into clean overviews, key points, and key terms you can actually revise from.",
    tag: "Step 4",
  },
  {
    icon: Brain,
    title: "Test yourself",
    desc: "Auto-generate quizzes from your material to lock in what you've learned.",
    tag: "Coming soon",
  },
  {
    icon: Trophy,
    title: "Track your progress",
    desc: "Watch your streaks, scores, and study time grow as you go.",
    tag: "Coming soon",
  },
];

const FEATURES = [
  { to: "/notes",     icon: Upload,        name: "Upload Notes",   desc: "Upload PDFs or paste text and Studify will index them for AI search.", badge: "Phase 2" },
  { to: "/chat",      icon: MessageSquare, name: "AI Chat",        desc: "Ask anything about your notes. Get precise, cited answers instantly.", badge: "Phase 3" },
  { to: "/summaries", icon: ScrollText,    name: "Summaries",      desc: "One-click summary of any note or PDF using AI.",                       badge: "Phase 4" },
  { to: "/quizzes",   icon: Brain,         name: "Quiz Generator", desc: "Auto-generate quizzes from your material to test your knowledge.",     badge: "Phase 5" },
  { to: "/notes",     icon: BookOpen,      name: "My Notes",       desc: "Browse, search, and manage all your uploaded study materials.",        badge: "Phase 2" },
  { to: "/analytics", icon: BarChart3,     name: "Analytics",      desc: "Track your study streaks, quiz scores, and AI usage over time.",       badge: "Phase 6" },
];

function greeting(name) {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${name?.split(" ")[0] || "there"}`;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [noteCount, setNoteCount]       = useState("…");
  const [convoCount, setConvoCount]     = useState("…");
  const [summaryCount, setSummaryCount] = useState("…");
  const [recentChats, setRecentChats]   = useState([]);

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

    getSummariesApi()
      .then((data) => setSummaryCount(data.summaries.length))
      .catch(() => setSummaryCount(0));
  }, []);

  const STATS = [
    { icon: BookOpen,      value: String(noteCount),    label: "Notes uploaded" },
    { icon: MessageSquare, value: String(convoCount),   label: "AI conversations" },
    { icon: ScrollText,    value: String(summaryCount), label: "Summaries made" },
    { icon: Brain,         value: "0",                  label: "Quizzes taken" },
  ];

  return (
    <AppLayout title="Dashboard">
      {/* ── Hero — the Studify wordmark + what it is ───────────────────────── */}
      <section className="dash-hero">
        <div className="dash-hero__glow" aria-hidden="true" />
        <div className="dash-hero__inner">
          <span className="dash-hero__eyebrow">
            <Sparkles size={13} /> AI-powered study hub
          </span>

          <h1 className="dash-hero__title">Studify</h1>

          <p className="dash-hero__tagline">Turn your notes into knowledge.</p>

          <p className="dash-hero__desc">
            Studify is your personal AI study companion. Upload your notes and PDFs, then chat
            with them, summarize them, and quiz yourself , everything you need to understand your
            material and remember it, in one calm, focused workspace.
          </p>

          <div className="dash-hero__cta">
            <Link to="/notes" className="dash-btn dash-btn--primary">
              <Upload size={16} /> Upload your notes
            </Link>
            <Link to="/chat" className="dash-btn dash-btn--ghost">
              <MessageSquare size={16} /> Ask the AI
            </Link>
          </div>

          <p className="dash-hero__hello">{greeting(user?.name)} — here's your workspace.</p>
        </div>
      </section>

      {/* ── Live stats ─────────────────────────────────────────────────────── */}
      <Reveal as="div" className="stat-row">
        {STATS.map(({ icon: Icon, value, label }) => (
          <div className="stat-card" key={label}>
            <div className="stat-card__icon"><Icon size={18} /></div>
            <div className="stat-card__value">{value}</div>
            <div className="stat-card__label">{label}</div>
          </div>
        ))}
      </Reveal>

      {/* ── What is Studify ────────────────────────────────────────────────── */}
      <Reveal as="section" className="dash-section">
        <p className="dash-kicker">What is Studify</p>
        <h2 className="dash-h2">
          A smarter way to study, built around <span className="dash-h2__accent">your</span> material.
        </h2>
        <p className="dash-lead">
          Most study tools give you generic content. Studify works from what <em>you</em> bring  your
          lecture slides, your textbook chapters, your handwritten notes turned into text. The AI reads
          your files first, so every answer, summary, and quiz is rooted in exactly what you need to learn.
        </p>

        <Reveal as="div" className="pillar-grid">
          {PILLARS.map(({ icon: Icon, title, desc }) => (
            <div className="pillar-card" key={title}>
              <div className="pillar-card__icon"><Icon size={20} /></div>
              <h3 className="pillar-card__title">{title}</h3>
              <p className="pillar-card__desc">{desc}</p>
            </div>
          ))}
        </Reveal>
      </Reveal>

      {/* ── The flow — end-to-end journey as a scroll timeline ─────────────── */}
      <Reveal as="section" className="dash-section">
        <p className="dash-kicker">How it works</p>
        <h2 className="dash-h2">From a pile of notes to real understanding.</h2>
        <p className="dash-lead">
          Studify guides you through six simple steps  each one building on the last.
        </p>

        <div className="flow-timeline">
          {FLOW.map(({ icon: Icon, title, desc, tag }, i) => {
            const soon = tag === "Coming soon";
            return (
              <Reveal className="flow-step" key={title} delay={i * 70}>
                <div className="flow-step__rail">
                  <div className={`flow-step__node${soon ? " flow-step__node--soon" : ""}`}>
                    <Icon size={18} />
                  </div>
                  {i < FLOW.length - 1 && <span className="flow-step__line" />}
                </div>
                <div className="flow-step__body">
                  <span className={`flow-step__tag${soon ? " flow-step__tag--soon" : ""}`}>{tag}</span>
                  <h3 className="flow-step__title">{title}</h3>
                  <p className="flow-step__desc">{desc}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Reveal>

      {/* ── Recent conversations — links straight back into the chat ───────── */}
      {recentChats.length > 0 && (
        <Reveal as="section" className="dash-section">
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
        </Reveal>
      )}

      {/* ── Explore features ───────────────────────────────────────────────── */}
      <Reveal as="section" className="dash-section">
        <p className="section-title">Explore Studify</p>
        <Reveal as="div" className="feature-grid-app">
          {FEATURES.map(({ to, icon: Icon, name, desc, badge }, i) => (
            <Link key={name + i} to={to} className="feature-card-app">
              <div className="feature-card-app__icon"><Icon size={20} /></div>
              <div className="feature-card-app__name">{name}</div>
              <div className="feature-card-app__desc">{desc}</div>
              <span className="feature-card-app__badge">{badge}</span>
            </Link>
          ))}
        </Reveal>
      </Reveal>
    </AppLayout>
  );
}
