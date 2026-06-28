import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  BookOpen, MessageSquare, ScrollText, Brain, BarChart3, Upload,
  UserPlus, Sparkles, Trophy, FileText, Bot, Zap, ArrowRight,
} from "lucide-react";
import AppLayout from "../components/AppLayout.jsx";
import Reveal from "../components/Reveal.jsx";
import TiltCard from "../components/TiltCard.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { getNotesApi } from "../api/notes.js";
import { getConversationsApi } from "../api/chat.js";
import { getSummariesApi } from "../api/summaries.js";
import { getQuizzesApi } from "../api/quizzes.js";

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

/* The end-to-end journey through the product — a clickable scroll timeline. */
const FLOW = [
  {
    icon: UserPlus,
    to: "/settings",
    title: "Create your account",
    desc: "Sign up and verify your email with a secure one-time code. Your study space is private to you.",
    tag: "Step 1",
  },
  {
    icon: Upload,
    to: "/notes",
    title: "Upload your material",
    desc: "Drop in PDFs or text notes. Studify extracts the text and gets it ready for AI.",
    tag: "Step 2",
  },
  {
    icon: MessageSquare,
    to: "/chat",
    title: "Chat with your notes",
    desc: "Ask anything about what you uploaded and get instant, grounded answers — like a tutor who has read everything.",
    tag: "Step 3",
  },
  {
    icon: ScrollText,
    to: "/summaries",
    title: "Summarize in one click",
    desc: "Turn long documents into clean overviews, key points, and key terms you can actually revise from.",
    tag: "Step 4",
  },
  {
    icon: Brain,
    to: "/quizzes",
    title: "Test yourself",
    desc: "Auto-generate quizzes from your material to lock in what you've learned.",
    tag: "Step 5",
  },
  {
    icon: Trophy,
    to: "/analytics",
    title: "Track your progress",
    desc: "Watch your streaks, quiz output, and AI-powered study insights grow as you go.",
    tag: "Step 6",
  },
];

const FEATURES = [
  { to: "/notes",     icon: Upload,        name: "Upload Notes",   desc: "Upload PDFs or paste text and Studify will index them for AI search." },
  { to: "/chat",      icon: MessageSquare, name: "AI Chat",        desc: "Ask anything about your notes. Get precise, cited answers instantly." },
  { to: "/summaries", icon: ScrollText,    name: "Summaries",      desc: "One-click summary of any note or PDF using AI." },
  { to: "/quizzes",   icon: Brain,         name: "Quiz Generator", desc: "Auto-generate quizzes from your material to test your knowledge." },
  { to: "/notes",     icon: BookOpen,      name: "My Notes",       desc: "Browse, search, and manage all your uploaded study materials." },
  { to: "/analytics", icon: BarChart3,     name: "Analytics",      desc: "Track your study streaks, quiz scores, and AI usage over time." },
];

function greeting(name) {
  const h = new Date().getHours();
  const part = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `Good ${part}, ${name?.split(" ")[0] || "there"}`;
}

// Smoothly count from 0 up to `target` once it's a real number.
function useCountUp(target, duration = 1000) {
  const ready = typeof target === "number";
  const [val, setVal] = useState(0);

  useEffect(() => {
    if (!ready) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setVal(target);
      return;
    }
    let raf;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setVal(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [ready, target, duration]);

  return ready ? val : null;
}

function StatCard({ icon: Icon, value, label }) {
  const display = useCountUp(value);
  return (
    <TiltCard className="stat-card" max={6}>
      <div className="stat-card__icon"><Icon size={18} /></div>
      <div className="stat-card__value">
        {display == null ? <span className="stat-card__loading" /> : display}
      </div>
      <div className="stat-card__label">{label}</div>
    </TiltCard>
  );
}

// Spotlight follows the cursor across the hero (CSS vars, no re-render).
function handleHeroMove(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty("--hx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
  el.style.setProperty("--hy", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
}

export default function Dashboard() {
  const { user } = useAuth();
  const [noteCount, setNoteCount]       = useState(null);
  const [convoCount, setConvoCount]     = useState(null);
  const [summaryCount, setSummaryCount] = useState(null);
  const [quizCount, setQuizCount]       = useState(null);

  useEffect(() => {
    getNotesApi().then((d) => setNoteCount(d.notes.length)).catch(() => setNoteCount(0));
    getConversationsApi().then((d) => setConvoCount(d.conversations.length)).catch(() => setConvoCount(0));
    getSummariesApi().then((d) => setSummaryCount(d.summaries.length)).catch(() => setSummaryCount(0));
    getQuizzesApi().then((d) => setQuizCount(d.quizzes.length)).catch(() => setQuizCount(0));
  }, []);

  const STATS = [
    { icon: BookOpen,      value: noteCount,    label: "Notes uploaded" },
    { icon: MessageSquare, value: convoCount,   label: "AI conversations" },
    { icon: ScrollText,    value: summaryCount, label: "Summaries made" },
    { icon: Brain,         value: quizCount,    label: "Quizzes created" },
  ];

  return (
    <AppLayout title="Dashboard">
      {/* ── Hero — the Studify wordmark + what it is ───────────────────────── */}
      <section className="dash-hero" onMouseMove={handleHeroMove}>
        <div className="dash-hero__glow" aria-hidden="true" />
        <div className="dash-hero__inner">
          <span className="dash-hero__eyebrow">
            <Sparkles size={13} /> AI-powered study hub
          </span>

          <h1 className="dash-hero__title">Studify</h1>

          <p className="dash-hero__tagline">Turn your notes into knowledge.</p>

          <p className="dash-hero__desc">
            Studify is your personal AI study companion. Upload your notes and PDFs, then chat
            with them, summarize them, and quiz yourself  everything you need to understand your
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

          <p className="dash-hero__hello">{greeting(user?.name)}  here's your workspace.</p>
        </div>
      </section>

      {/* ── Live stats (animated count-up + tilt) ──────────────────────────── */}
      <Reveal as="div" className="stat-row">
        {STATS.map((s) => <StatCard key={s.label} {...s} />)}
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
            <TiltCard className="pillar-card" key={title} max={6}>
              <div className="pillar-card__icon"><Icon size={20} /></div>
              <h3 className="pillar-card__title">{title}</h3>
              <p className="pillar-card__desc">{desc}</p>
            </TiltCard>
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
          {FLOW.map(({ icon: Icon, to, title, desc, tag }, i) => (
            <Reveal className="flow-step" key={title} delay={i * 70}>
              <div className="flow-step__rail">
                <div className="flow-step__node"><Icon size={18} /></div>
                {i < FLOW.length - 1 && <span className="flow-step__line" />}
              </div>
              <Link to={to} className="flow-step__body">
                <span className="flow-step__tag">{tag}</span>
                <h3 className="flow-step__title">{title}</h3>
                <p className="flow-step__desc">{desc}</p>
                <ArrowRight size={16} className="flow-step__arrow" />
              </Link>
            </Reveal>
          ))}
        </div>
      </Reveal>

      {/* ── Explore features (tilt + spotlight) ────────────────────────────── */}
      <Reveal as="section" className="dash-section">
        <p className="section-title">Explore Studify</p>
        <Reveal as="div" className="feature-grid-app">
          {FEATURES.map(({ to, icon: Icon, name, desc }, i) => (
            <TiltCard as={Link} key={name + i} to={to} className="feature-card-app">
              <div className="feature-card-app__icon"><Icon size={20} /></div>
              <div className="feature-card-app__name">{name}</div>
              <div className="feature-card-app__desc">{desc}</div>
            </TiltCard>
          ))}
        </Reveal>
      </Reveal>
    </AppLayout>
  );
}
