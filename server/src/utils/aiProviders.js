// ── AI provider (Groq) ────────────────────────────────────────────────────────
// The rest of the app speaks one normalized message format:
//
//     [{ role: "user" | "assistant", content: "..." }, ...]
//
// and this file translates that into Groq's (OpenAI-compatible) API, calls it,
// and hands back plain text — either all at once (chatComplete) or streamed
// token-by-token (chatStream).

// Models we offer in the UI. To add/swap one, edit this list.
const MODELS = [
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "groq" },
  { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B",  provider: "groq" },
];

// The "personality" given to the model so replies feel on-brand for Studify.
const SYSTEM_PROMPT =
  "You are Studify's AI study assistant. You help students understand concepts, " +
  "summarize their notes, and study more effectively. Be clear, accurate, and " +
  "encouraging. Use simple language and concrete examples. Format answers with " +
  "Markdown — short paragraphs, **bold** for key terms, bullet or numbered lists, " +
  "and fenced code blocks for code.";

function providerReady(provider) {
  if (provider === "groq") return Boolean(process.env.GROQ_API_KEY);
  return false;
}

// Public: the model list the frontend renders, each flagged with availability.
export function listModels() {
  return MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    available: providerReady(m.provider),
  }));
}

function resolveModel(modelId) {
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) throw new Error("Unknown model selected.");
  return model;
}

// Turn raw Groq error responses into short, actionable messages for the UI.
function friendlyError(status, data) {
  const raw = data?.error?.message || data?.message || "AI request failed.";
  if (status === 429 || /quota|rate.?limit/i.test(raw)) {
    return "Rate limit reached on Groq. Wait a few seconds and try again, or check your usage at console.groq.com.";
  }
  if (status === 401 || status === 403 || /invalid api key|unauthorized/i.test(raw)) {
    return "Your Groq API key was rejected. Create a fresh key at console.groq.com/keys and update GROQ_API_KEY in the server .env.";
  }
  if (status === 404 || /model.*not found|does not exist|decommissioned/i.test(raw)) {
    return "That model isn't available for your key. Try a different model from the dropdown.";
  }
  return raw;
}

function groqKey() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Groq isn't configured — add GROQ_API_KEY to the server .env.");
  return key;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// How long to wait before retrying a rate-limited (429) or overloaded (503)
// request. Groq sends a `retry-after` header (seconds); otherwise we back off
// exponentially. Capped so a user never waits absurdly long.
function retryDelayMs(res, attempt) {
  const header = res.headers.get("retry-after");
  if (header) {
    const secs = Number(header);
    if (!Number.isNaN(secs)) return Math.min(secs * 1000 + 250, 20000);
  }
  return Math.min(1000 * 2 ** attempt, 20000); // 1s, 2s, 4s, 8s … (max 20s)
}

const MAX_RETRIES = 4;
const isRetryable = (status) => status === 429 || status === 503;

// Groq is OpenAI-compatible: a flat messages array with roles system/user/assistant.
// Pass `system` to override the default Studify persona (e.g. JSON-only tasks).
function toGroqMessages(messages, system) {
  return [
    { role: "system", content: system || SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

// ── Non-streaming: get the whole reply at once ────────────────────────────────
// options: { system, temperature, maxTokens, responseFormat } — all optional.
export async function chatComplete(modelId, messages, options = {}) {
  resolveModel(modelId); // validate the id
  const key = groqKey();

  const body = {
    model: modelId,
    messages: toGroqMessages(messages, options.system),
  };
  if (options.temperature != null) body.temperature = options.temperature;
  if (options.maxTokens != null) body.max_tokens = options.maxTokens;
  if (options.responseFormat) body.response_format = options.responseFormat;

  // Retry on rate-limit/overload so a burst of calls (summaries, quizzes) rides
  // out Groq's per-minute cap instead of failing the whole operation.
  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
    });
    if (isRetryable(res.status) && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(res, attempt));
      continue;
    }
    break;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(friendlyError(res.status, data));

  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("The model returned an empty response. Try again.");
  return text;
}

// ── Streaming: invoke onChunk(textDelta) as tokens arrive; resolves to full text ─
// Pass an AbortSignal to support "stop generating" — on abort we keep the partial.
// options: { system } — optional system-prompt override (used for RAG grounding).
export async function chatStream(modelId, messages, onChunk, signal, options = {}) {
  resolveModel(modelId);
  const key = groqKey();

  let res;
  for (let attempt = 0; ; attempt++) {
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model: modelId, stream: true, messages: toGroqMessages(messages, options.system) }),
        signal,
      });
    } catch (err) {
      if (err.name === "AbortError") return ""; // stopped before any reply
      throw err;
    }
    // Only safe to retry before we've started reading the stream.
    if (isRetryable(res.status) && attempt < MAX_RETRIES) {
      await sleep(retryDelayMs(res, attempt));
      continue;
    }
    break;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(friendlyError(res.status, data));
  }

  // Groq streams Server-Sent Events ("data: {json}\n"); extract delta content.
  let full = "";
  let buffer = "";
  const decoder = new TextDecoder();

  try {
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith("data:")) continue;

        const payload = trimmed.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const data = JSON.parse(payload);
          const text = data?.choices?.[0]?.delta?.content || "";
          if (text) {
            full += text;
            onChunk(text);
          }
        } catch {
          // Ignore partial / non-JSON frames.
        }
      }
    }
  } catch (err) {
    if (err.name === "AbortError") return full; // stopped mid-reply — keep partial
    throw err;
  }

  if (!full) throw new Error("The model returned an empty response. Try again.");
  return full;
}
