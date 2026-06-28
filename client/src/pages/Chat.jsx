import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Plus, ArrowUp, Square, Copy, Check, Trash2,
  MessageSquare, Sparkles, AlertCircle, ChevronDown, Database,
} from "lucide-react";
import AppLayout from "../components/AppLayout.jsx";
import {
  getModelsApi, getConversationsApi, getConversationApi,
  deleteConversationApi, sendMessageStreamApi,
} from "../api/chat.js";

// Assistant replies are Markdown; user messages stay as plain text (CSS pre-wrap).
function MessageBody({ content }) {
  return (
    <div className="chat-markdown">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

// RAG: the notes that grounded this reply (shown under the assistant message).
function ChatSources({ sources }) {
  return (
    <div className="chat-sources">
      <Database size={12} />
      <span className="chat-sources__label">From your notes:</span>
      {sources.map((s) => (
        <span key={s.noteId} className="chat-source-chip">{s.noteName}</span>
      ))}
    </div>
  );
}

// Starter prompts shown on an empty conversation.
const SUGGESTIONS = [
  "Explain Newton's three laws of motion with examples.",
  "Give me 5 tips to study more effectively.",
  "Summarize the causes of World War 1.",
  "Quiz me on basic JavaScript concepts.",
];

export default function Chat() {
  const [models, setModels]               = useState([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [conversations, setConversations] = useState([]);
  const [activeId, setActiveId]           = useState(null);
  const [messages, setMessages]           = useState([]);
  const [input, setInput]                 = useState("");
  const [sending, setSending]             = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingSources, setStreamingSources] = useState([]);
  const [error, setError]                 = useState("");
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [copiedIdx, setCopiedIdx]         = useState(null);
  const [atBottom, setAtBottom]           = useState(true);

  const [searchParams, setSearchParams] = useSearchParams();

  const threadRef    = useRef(null);
  const threadEndRef = useRef(null);
  const inputRef     = useRef(null);
  const abortRef     = useRef(null);
  const atBottomRef  = useRef(true);
  const modelMenuRef = useRef(null);

  // Close the model dropdown on outside click or Escape.
  useEffect(() => {
    if (!modelMenuOpen) return;
    function onClick(e) {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target)) setModelMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === "Escape") setModelMenuOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [modelMenuOpen]);

  // ── Load models + conversation list on mount ────────────────────────────────
  useEffect(() => {
    getModelsApi()
      .then(({ models }) => {
        setModels(models);
        const firstAvailable = models.find((m) => m.available) || models[0];
        if (firstAvailable) setSelectedModel(firstAvailable.id);
      })
      .catch(() => {});
    refreshConversations();
  }, []);

  const refreshConversations = useCallback(() => {
    getConversationsApi()
      .then(({ conversations }) => setConversations(conversations))
      .catch(() => {});
  }, []);

  // Deep-link: /chat?c=<id> (e.g. from the dashboard) opens that conversation.
  useEffect(() => {
    const cid = searchParams.get("c");
    if (cid) {
      openConversation(cid);
      setSearchParams({}, { replace: true }); // tidy the URL afterwards
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Grow the textarea with its content (up to a cap), like ChatGPT.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [input]);

  // Keep pinned to the newest content — but only if the user is already at the
  // bottom (so we don't yank them away while they scroll back through history).
  useEffect(() => {
    if (atBottomRef.current) {
      threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent, sending]);

  function handleScroll() {
    const el = threadRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    atBottomRef.current = nearBottom;
    setAtBottom(nearBottom);
  }

  function scrollToBottom() {
    atBottomRef.current = true;
    setAtBottom(true);
    threadEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  // ── Open an existing conversation ───────────────────────────────────────────
  async function openConversation(id) {
    if (id === activeId || sending) return;
    setError("");
    try {
      const { conversation } = await getConversationApi(id);
      setActiveId(conversation._id);
      setMessages(conversation.messages);
      // Only adopt the saved model if it's still one we offer (a chat created
      // with a since-removed model keeps the current selection instead).
      setModels((curr) => {
        if (conversation.model && curr.some((m) => m.id === conversation.model)) {
          setSelectedModel(conversation.model);
        }
        return curr;
      });
      atBottomRef.current = true;
    } catch (err) {
      setError(err.message);
    }
  }

  // ── Start a fresh conversation ──────────────────────────────────────────────
  function newChat() {
    if (sending) return;
    setActiveId(null);
    setMessages([]);
    setInput("");
    setError("");
    inputRef.current?.focus();
  }

  // ── Send a message (streamed, stoppable) ────────────────────────────────────
  async function handleSend(e) {
    e?.preventDefault();
    const content = input.trim();
    if (!content || sending) return;
    setError("");

    setMessages((prev) => [...prev, { role: "user", content }]);
    setInput("");
    setSending(true);
    setStreamingContent("");
    setStreamingSources([]);
    atBottomRef.current = true;
    setAtBottom(true);

    const ac = new AbortController();
    abortRef.current = ac;

    let acc = "";
    let srcs = [];
    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      if (acc) setMessages((prev) => [...prev, { role: "assistant", content: acc, sources: srcs }]);
      setStreamingContent("");
      setStreamingSources([]);
      refreshConversations();
    };

    try {
      await sendMessageStreamApi(
        { conversationId: activeId, model: selectedModel, content, signal: ac.signal },
        {
          onStart: (evt) => {
            if (!activeId) setActiveId(evt.conversationId);
            srcs = evt.sources || [];
            setStreamingSources(srcs);
          },
          onDelta: (text) => { acc += text; setStreamingContent(acc); },
          onDone: commit,
          onError: (msg) => { committed = true; setError(msg); setStreamingContent(""); setStreamingSources([]); },
        }
      );
    } catch (err) {
      if (err.name === "AbortError") {
        commit(); // user pressed Stop — keep the partial reply
      } else {
        setError(err.message);
        setStreamingContent("");
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  }

  function handleStop() {
    abortRef.current?.abort();
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleCopy(text, idx) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  // ── Delete a conversation (single tap) ──────────────────────────────────────
  async function handleDelete(e, id) {
    e.stopPropagation();
    try {
      await deleteConversationApi(id);
      setConversations((prev) => prev.filter((c) => c._id !== id));
      if (id === activeId) newChat();
    } catch (err) {
      setError(err.message);
    }
  }

  const noKeys = models.length > 0 && !models.some((m) => m.available);
  const showEmpty = messages.length === 0 && !sending;

  return (
    <AppLayout title="AI Chat">
      <div className="chat-layout">

        {/* ── Conversations pane ──────────────────────────────────────────── */}
        <aside className="chat-convos">
          <button className="chat-new-btn" onClick={newChat}>
            <Plus size={16} /> New chat
          </button>

          <div className="chat-convo-list">
            {conversations.length === 0 ? (
              <p className="chat-convo-empty">No conversations yet.</p>
            ) : (
              conversations.map((c) => (
                <button
                  key={c._id}
                  className={`chat-convo-item${c._id === activeId ? " chat-convo-item--active" : ""}`}
                  onClick={() => openConversation(c._id)}
                >
                  <MessageSquare size={14} className="chat-convo-icon" />
                  <span className="chat-convo-title">{c.title}</span>
                  <span
                    className="chat-convo-del"
                    onClick={(e) => handleDelete(e, c._id)}
                    title="Delete"
                    role="button"
                  >
                    <Trash2 size={13} />
                  </span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Chat pane ───────────────────────────────────────────────────── */}
        <section className="chat-main">
          <div className="chat-thread" ref={threadRef} onScroll={handleScroll}>
            <div className="chat-thread__inner">
              {showEmpty ? (
                <div className="chat-empty">
                  <div className="chat-empty__icon"><Sparkles size={26} /></div>
                  <h2>How can I help you study?</h2>
                  <p>Ask anything, or pick a starting point below.</p>
                  <div className="chat-suggestions">
                    {SUGGESTIONS.map((s) => (
                      <button key={s} className="chat-suggestion" onClick={() => setInput(s)}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {messages.map((m, i) =>
                    m.role === "user" ? (
                      <div key={i} className="chat-msg chat-msg--user">
                        <div className="chat-msg__bubble">{m.content}</div>
                      </div>
                    ) : (
                      <div key={i} className="chat-msg chat-msg--assistant">
                        <div className="chat-msg__avatar"><Sparkles size={15} /></div>
                        <div className="chat-msg__col">
                          <div className="chat-msg__bubble">
                            <MessageBody content={m.content} />
                          </div>
                          {m.sources?.length > 0 && <ChatSources sources={m.sources} />}
                          <div className="chat-actions">
                            <button
                              className="chat-action-btn"
                              onClick={() => handleCopy(m.content, i)}
                              title="Copy"
                            >
                              {copiedIdx === i ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  )}

                  {/* Live reply while streaming (typing dots until the first token). */}
                  {sending && (
                    <div className="chat-msg chat-msg--assistant">
                      <div className="chat-msg__avatar"><Sparkles size={15} /></div>
                      <div className="chat-msg__col">
                        <div className="chat-msg__bubble">
                          {streamingContent ? (
                            <MessageBody content={streamingContent} />
                          ) : (
                            <span className="chat-typing"><span></span><span></span><span></span></span>
                          )}
                        </div>
                        {streamingSources.length > 0 && <ChatSources sources={streamingSources} />}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div ref={threadEndRef} />
            </div>
          </div>

          {/* Scroll-to-bottom button (only when scrolled up mid-conversation). */}
          {!atBottom && !showEmpty && (
            <button className="chat-scroll-btn" onClick={scrollToBottom} title="Scroll to bottom">
              <ChevronDown size={18} />
            </button>
          )}

          {/* ── Composer ──────────────────────────────────────────────────── */}
          <div className="chat-composer-wrap">
            {error && (
              <div className="chat-error"><AlertCircle size={15} /> {error}</div>
            )}
            {noKeys && (
              <div className="chat-error">
                <AlertCircle size={15} /> No AI model key configured. Add GROQ_API_KEY to the
                server .env and restart the server.
              </div>
            )}

            <form className="chat-composer" onSubmit={handleSend}>
              <textarea
                ref={inputRef}
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Studify AI…"
                rows={1}
              />
              <div className="chat-composer-row">
                <div className="chat-model" ref={modelMenuRef}>
                  <button
                    type="button"
                    className="chat-model-btn"
                    onClick={() => setModelMenuOpen((o) => !o)}
                    aria-haspopup="listbox"
                    aria-expanded={modelMenuOpen}
                    title="Choose a model"
                  >
                    {models.find((m) => m.id === selectedModel)?.label || "Model"}
                    <ChevronDown size={14} className="chat-model-btn__chev" />
                  </button>
                  {modelMenuOpen && (
                    <div className="chat-model-menu" role="listbox">
                      {models.map((m) => (
                        <button
                          type="button"
                          key={m.id}
                          role="option"
                          aria-selected={m.id === selectedModel}
                          className={`chat-model-opt${m.id === selectedModel ? " chat-model-opt--active" : ""}`}
                          disabled={!m.available}
                          onClick={() => { setSelectedModel(m.id); setModelMenuOpen(false); }}
                        >
                          {m.label}{m.available ? "" : " — not configured"}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {sending ? (
                  <button
                    type="button"
                    className="chat-send-btn chat-send-btn--stop"
                    onClick={handleStop}
                    title="Stop generating"
                    aria-label="Stop generating"
                  >
                    <Square size={14} fill="currentColor" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="chat-send-btn"
                    disabled={!input.trim()}
                    title="Send"
                    aria-label="Send message"
                  >
                    <ArrowUp size={18} />
                  </button>
                )}
              </div>
            </form>

            <p className="chat-disclaimer">
              Studify AI can make mistakes. Double-check important info.
            </p>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
