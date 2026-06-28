import { useState, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  BookOpen, MessageSquare, ScrollText, Brain, HelpCircle,
  Flame, Database, Sparkles, RefreshCw, AlertCircle, TrendingUp,
} from "lucide-react";
import AppLayout from "../components/AppLayout.jsx";
import Reveal from "../components/Reveal.jsx";
import TiltCard from "../components/TiltCard.jsx";
import { getAnalyticsApi, getInsightsApi } from "../api/analytics.js";
import { getRagStatusApi, reindexApi } from "../api/rag.js";

// Brown/tan palette that reads well on both light and dark cards.
const SERIES = [
  { key: "notes",         label: "Notes",     color: "#c9a47a" },
  { key: "conversations", label: "Chats",     color: "#8b6f4e" },
  { key: "summaries",     label: "Summaries", color: "#ddbf9b" },
  { key: "quizzes",       label: "Quizzes",   color: "#a9743f" },
];

function fmtBytes(bytes = 0) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Stacked bar chart of the last 14 days (SVG) ──────────────────────────── */
function ActivityChart({ activity }) {
  const W = 720, H = 240, PAD = { l: 10, r: 10, t: 16, b: 26 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const n = activity.length;
  const totals = activity.map((d) => SERIES.reduce((s, ser) => s + d[ser.key], 0));
  const max = Math.max(1, ...totals);
  const slot = plotW / n;
  const barW = Math.min(30, slot * 0.62);
  const grid = [0, 0.25, 0.5, 0.75, 1];
  const empty = totals.every((t) => t === 0);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="chart-svg" role="img" aria-label="Activity over the last 14 days">
        {grid.map((g) => {
          const y = PAD.t + plotH * (1 - g);
          return (
            <line key={g} x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
              className="chart-grid" />
          );
        })}
        {activity.map((d, i) => {
          const x = PAD.l + slot * i + (slot - barW) / 2;
          let cursor = PAD.t + plotH;
          const day = d.date.slice(8);
          return (
            <g key={d.date}>
              {SERIES.map((ser) => {
                const v = d[ser.key];
                if (!v) return null;
                const h = (v / max) * plotH;
                cursor -= h;
                return <rect key={ser.key} x={x} y={cursor} width={barW} height={h} rx="2.5" fill={ser.color} />;
              })}
              {i % 2 === 0 && (
                <text x={x + barW / 2} y={H - 8} className="chart-xlabel" textAnchor="middle">{day}</text>
              )}
            </g>
          );
        })}
      </svg>
      {empty && <div className="chart-empty">No activity in the last 14 days yet — start studying!</div>}
    </div>
  );
}

/* ── Conic-gradient donut for quiz composition ────────────────────────────── */
function Donut({ a, b, labelA, labelB, colorA, colorB }) {
  const total = a + b;
  const pctA = total ? (a / total) * 100 : 0;
  const bg = total
    ? `conic-gradient(${colorA} 0 ${pctA}%, ${colorB} ${pctA}% 100%)`
    : "var(--app-input-bg)";
  return (
    <div className="donut-wrap">
      <div className="donut" style={{ background: bg }}>
        <div className="donut__hole">
          <div className="donut__total">{total}</div>
          <div className="donut__cap">questions</div>
        </div>
      </div>
      <div className="donut-legend">
        <div><span className="dot" style={{ background: colorA }} /> {labelA} <strong>{a}</strong></div>
        <div><span className="dot" style={{ background: colorB }} /> {labelB} <strong>{b}</strong></div>
      </div>
    </div>
  );
}

/* ── Horizontal bars for feature usage ────────────────────────────────────── */
function HBars({ items }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="hbars">
      {items.map((it) => (
        <div className="hbar" key={it.key}>
          <span className="hbar__label">{it.label}</span>
          <div className="hbar__track">
            <div className="hbar__fill" style={{ width: `${(it.value / max) * 100}%` }} />
          </div>
          <span className="hbar__value">{it.value}</span>
        </div>
      ))}
    </div>
  );
}

export default function Analytics() {
  const [data, setData]       = useState(null);
  const [rag, setRag]         = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const [insights, setInsights]             = useState("");
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [insightsError, setInsightsError]   = useState("");

  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState("");

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [a, r] = await Promise.all([getAnalyticsApi(), getRagStatusApi().catch(() => null)]);
      setData(a);
      setRag(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadInsights = useCallback(async () => {
    setInsightsLoading(true);
    setInsightsError("");
    try {
      const { insights } = await getInsightsApi();
      setInsights(insights);
    } catch (err) {
      setInsightsError(err.message);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); loadInsights(); }, [loadAll, loadInsights]);

  async function handleReindex() {
    setReindexing(true);
    setReindexMsg("");
    try {
      const r = await reindexApi(false);
      setReindexMsg(
        r.indexedNotes > 0
          ? `Added ${r.indexedNotes} note${r.indexedNotes === 1 ? "" : "s"} (${r.totalChunks} sections).`
          : "Everything is already up to date."
      );
      setRag(await getRagStatusApi());
    } catch (err) {
      setReindexMsg(err.message);
    } finally {
      setReindexing(false);
    }
  }

  const TILES = data ? [
    { icon: BookOpen,      label: "Notes",         value: data.totals.notes },
    { icon: MessageSquare, label: "AI messages",   value: data.totals.messages },
    { icon: ScrollText,    label: "Summaries",     value: data.totals.summaries },
    { icon: Brain,         label: "Quizzes",       value: data.totals.quizzes },
    { icon: HelpCircle,    label: "Questions made", value: data.totals.questions },
    { icon: Database,      label: "Searchable sections", value: data.totals.chunks },
  ] : [];

  return (
    <AppLayout title="Analytics">
      <div className="page-header">
        <h1>Analytics</h1>
        <p>Your study activity, quiz output, and AI-powered insights.</p>
      </div>

      {error && (
        <div className="settings-alert settings-alert--error" style={{ marginBottom: 18 }}>
          <AlertCircle size={15} /> {error}
        </div>
      )}

      {loading ? (
        <div className="summary-list">
          {[0, 1].map((i) => <div key={i} className="summary-skeleton" style={{ height: 120 }} />)}
        </div>
      ) : data && (
        <>
          {/* Stat tiles */}
          <Reveal as="div" className="an-tiles">
            {TILES.map(({ icon: Icon, label, value }) => (
              <TiltCard className="an-tile" key={label} max={6}>
                <div className="an-tile__icon"><Icon size={17} /></div>
                <div className="an-tile__value">{value}</div>
                <div className="an-tile__label">{label}</div>
              </TiltCard>
            ))}
          </Reveal>

          {/* AI insights */}
          <Reveal as="section" className="an-card an-insights">
            <div className="an-card__head">
              <h2><Sparkles size={16} /> AI study insights</h2>
              <button className="an-mini" onClick={loadInsights} disabled={insightsLoading}>
                <RefreshCw size={13} className={insightsLoading ? "spin-ico" : ""} /> Refresh
              </button>
            </div>
            {insightsLoading ? (
              <div className="an-insights__loading"><span className="summary-spin" /> Reading your stats…</div>
            ) : insightsError ? (
              <div className="an-insights__error">{insightsError}</div>
            ) : (
              <div className="chat-markdown">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{insights}</ReactMarkdown>
              </div>
            )}
          </Reveal>

          {/* Activity + streak */}
          <div className="an-grid an-grid--split">
            <Reveal as="section" className="an-card">
              <div className="an-card__head"><h2><TrendingUp size={16} /> Activity — last 14 days</h2></div>
              <ActivityChart activity={data.activity} />
              <div className="chart-legend">
                {SERIES.map((s) => (
                  <span key={s.key}><span className="dot" style={{ background: s.color }} /> {s.label}</span>
                ))}
              </div>
            </Reveal>

            <Reveal as="section" className="an-card an-streak">
              <div className="an-card__head"><h2><Flame size={16} /> Study streak</h2></div>
              <div className="an-streak__big">{data.streak.current}<span>day{data.streak.current === 1 ? "" : "s"}</span></div>
              <div className="an-streak__sub">Current streak</div>
              <div className="an-streak__row">
                <div><strong>{data.streak.longest}</strong><span>Longest</span></div>
                <div><strong>{data.streak.activeDays}</strong><span>Active days</span></div>
              </div>
            </Reveal>
          </div>

          {/* Quiz composition + feature usage */}
          <div className="an-grid">
            <Reveal as="section" className="an-card">
              <div className="an-card__head"><h2><Brain size={16} /> Quiz composition</h2></div>
              <Donut
                a={data.quiz.totalMcq} b={data.quiz.totalSaq}
                labelA="MCQ" labelB="Short answer"
                colorA="#c9a47a" colorB="#a9743f"
              />
              <p className="an-foot">{data.quiz.quizzes} quizzes · avg {data.quiz.avgPerQuiz} questions each</p>
            </Reveal>

            <Reveal as="section" className="an-card">
              <div className="an-card__head"><h2><TrendingUp size={16} /> Feature usage</h2></div>
              <HBars items={data.featureUsage} />
            </Reveal>
          </div>

          {/* What the AI can read from your notes */}
          <Reveal as="section" className="an-card an-kb">
            <div className="an-card__head">
              <h2><Database size={16} /> Notes the AI can search</h2>
              <button className="an-mini" onClick={handleReindex} disabled={reindexing}>
                <RefreshCw size={13} className={reindexing ? "spin-ico" : ""} /> {reindexing ? "Refreshing…" : "Refresh"}
              </button>
            </div>
            <p className="an-kb__desc">
              When you chat, Studify reads your uploaded notes and uses the most relevant parts to
              answer — so the AI's replies come from <em>your</em> own material.
            </p>
            <div className="an-kb__stats">
              <div><strong>{rag?.indexedNotes ?? data.knowledge.indexedNotes}</strong><span>notes ready</span></div>
              <div><strong>{rag?.indexableNotes ?? "—"}</strong><span>total notes</span></div>
              <div><strong>{rag?.chunks ?? data.totals.chunks}</strong><span>searchable sections</span></div>
              <div><strong>{fmtBytes(data.totals.storageBytes)}</strong><span>storage used</span></div>
            </div>
            {reindexMsg && <p className="an-kb__msg">{reindexMsg}</p>}
          </Reveal>
        </>
      )}
    </AppLayout>
  );
}
