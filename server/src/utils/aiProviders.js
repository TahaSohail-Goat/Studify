// ── AI providers (Groq primary, Cerebras fallback) ───────────────────────────
// The rest of the app speaks one normalized message format:
//
//     [{ role: "user" | "assistant", content: "..." }, ...]
//
// This file translates that into the providers' (OpenAI-compatible) APIs, calls
// them, and hands back plain text — either all at once (chatComplete) or streamed
// token-by-token (chatStream).
//
// Groq is tried first. If Groq is rate-limited or out of quota AND a Cerebras key
// is set, the request transparently falls back to Cerebras (same Llama models,
// same API shape). If no Cerebras key is set, nothing changes — Groq only.

// Models we offer in the UI. The FIRST entry is the default in chat (the client
// selects the first available model). 8B is default — it's fast and has much
// higher rate limits; 70B is there for when you want the smartest answers.
// `id` is our canonical id (matches Groq's model names).
const MODELS = [
  { id: "llama-3.1-8b-instant",    label: "Llama 3.1 8B",  provider: "groq" },
  { id: "llama-3.3-70b-versatile", label: "Llama 3.3 70B", provider: "groq" },
];

// Provider endpoints + which env var holds each key. Order matters: Groq first.
const PROVIDERS = [
  { name: "groq",     url: "https://api.groq.com/openai/v1/chat/completions", keyEnv: "GROQ_API_KEY" },
  { name: "cerebras", url: "https://api.cerebras.ai/v1/chat/completions",     keyEnv: "CEREBRAS_API_KEY" },
];

// Cerebras names its models slightly differently — map our canonical ids across.
// (If Cerebras renames a model, update it here; Groq stays primary regardless.)
const CEREBRAS_MODEL_IDS = {
  "llama-3.1-8b-instant":    "llama3.1-8b",
  "llama-3.3-70b-versatile": "llama-3.3-70b",
};

// The "personality" given to the model so replies feel on-brand for Studify.
const SYSTEM_PROMPT =
  "You are Studify's AI study assistant. You help students understand concepts, " +
  "summarize their notes, and study more effectively. Be clear, accurate, and " +
  "encouraging. Use simple language and concrete examples. Format answers with " +
  "Markdown — short paragraphs, **bold** for key terms, bullet or numbered lists, " +
  "and fenced code blocks for code.";

function keyFor(name) {
  const p = PROVIDERS.find((x) => x.name === name);
  return p ? process.env[p.keyEnv] : null;
}

// Providers that have a key configured, in priority order (Groq first).
function activeProviders() {
  return PROVIDERS.filter((p) => Boolean(process.env[p.keyEnv]));
}

// Translate our canonical model id to the provider's own id.
function providerModelId(providerName, modelId) {
  if (providerName === "cerebras") return CEREBRAS_MODEL_IDS[modelId] || modelId;
  return modelId;
}

// Public: the model list the frontend renders, each flagged with availability.
// A model is available if ANY provider (Groq or Cerebras) is configured.
export function listModels() {
  const ready = activeProviders().length > 0;
  return MODELS.map((m) => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    available: ready,
  }));
}

function resolveModel(modelId) {
  const model = MODELS.find((m) => m.id === modelId);
  if (!model) throw new Error("Unknown model selected.");
  return model;
}

// Turn raw error responses into short, actionable messages for the UI.
function friendlyError(status, data) {
  const raw = data?.error?.message || data?.message || "AI request failed.";
  if (status === 429 || /quota|rate.?limit/i.test(raw)) {
    return "The AI is busy right now (rate limit). Please wait a few seconds and try again.";
  }
  if (status === 401 || status === 403 || /invalid api key|unauthorized/i.test(raw)) {
    return "The AI API key was rejected. Check GROQ_API_KEY (and CEREBRAS_API_KEY) on the server.";
  }
  if (status === 404 || /model.*not found|does not exist|decommissioned/i.test(raw)) {
    return "That model isn't available right now. Try a different model from the dropdown.";
  }
  return raw;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// How long to wait before retrying a rate-limited (429) or overloaded (503)
// request. Providers send a `retry-after` header (seconds); otherwise we back off
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

// Should we fall through to the next provider for this error? Only for
// rate-limit / quota problems — not for bad keys, bad models, etc.
function isQuotaError(err) {
  if (err?.status === 429 || err?.status === 503) return true;
  return /rate.?limit|quota|busy/i.test(err?.message || "");
}

// OpenAI-compatible: a flat messages array with roles system/user/assistant.
// Pass `system` to override the default Studify persona (e.g. JSON-only tasks).
function toMessages(messages, system) {
  return [
    { role: "system", content: system || SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

function authHeaders(name) {
  return { "Content-Type": "application/json", Authorization: `Bearer ${keyFor(name)}` };
}

// ── Non-streaming against ONE provider, with retry on rate-limit/overload ──────
async function completeOnce(provider, modelId, baseBody, retry) {
  const body = { ...baseBody, model: providerModelId(provider.name, modelId) };
  const maxRetries = retry ? MAX_RETRIES : 0;

  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(provider.url, {
      method: "POST",
      headers: authHeaders(provider.name),
      body: JSON.stringify(body),
    });
    if (isRetryable(res.status) && attempt < maxRetries) {
      await sleep(retryDelayMs(res, attempt));
      continue;
    }
    break;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(friendlyError(res.status, data));
    err.status = res.status;
    throw err;
  }
  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("The model returned an empty response. Try again.");
  return text;
}

// ── Non-streaming: get the whole reply at once ────────────────────────────────
// options: { system, temperature, maxTokens, responseFormat } — all optional.
// Tries Groq, then falls back to Cerebras on rate-limit/quota errors.
export async function chatComplete(modelId, messages, options = {}) {
  resolveModel(modelId);
  const providers = activeProviders();
  if (!providers.length) throw new Error("AI isn't configured — add GROQ_API_KEY (or CEREBRAS_API_KEY) on the server.");

  const baseBody = { messages: toMessages(messages, options.system) };
  if (options.temperature != null) baseBody.temperature = options.temperature;
  if (options.maxTokens != null) baseBody.max_tokens = options.maxTokens;
  if (options.responseFormat) baseBody.response_format = options.responseFormat;

  let lastErr;
  for (let i = 0; i < providers.length; i++) {
    const isLast = i === providers.length - 1;
    try {
      // Retry the primary only when it's the last option; otherwise fail fast
      // and fall back to the next provider (faster recovery from a daily cap).
      return await completeOnce(providers[i], modelId, baseBody, isLast);
    } catch (err) {
      lastErr = err;
      if (!isQuotaError(err) || isLast) throw err;
    }
  }
  throw lastErr;
}

// ── Streaming against ONE provider; invokes onChunk(textDelta) as tokens arrive ─
async function streamOnce(provider, modelId, messages, onChunk, signal, options, retry) {
  const body = {
    model: providerModelId(provider.name, modelId),
    stream: true,
    messages: toMessages(messages, options.system),
  };
  const maxRetries = retry ? MAX_RETRIES : 0;

  let res;
  for (let attempt = 0; ; attempt++) {
    res = await fetch(provider.url, {
      method: "POST",
      headers: authHeaders(provider.name),
      body: JSON.stringify(body),
      signal,
    });
    // Safe to retry only before we've started reading the stream.
    if (isRetryable(res.status) && attempt < maxRetries) {
      await sleep(retryDelayMs(res, attempt));
      continue;
    }
    break;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    const err = new Error(friendlyError(res.status, data));
    err.status = res.status;
    throw err;
  }

  // OpenAI-compatible Server-Sent Events ("data: {json}\n"); extract delta content.
  let full = "";
  let buffer = "";
  const decoder = new TextDecoder();

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

  if (!full) throw new Error("The model returned an empty response. Try again.");
  return full;
}

// ── Streaming: invoke onChunk(textDelta) as tokens arrive; resolves to full text ─
// Pass an AbortSignal to support "stop generating" — on abort we keep the partial.
// options: { system } — optional system-prompt override (used for RAG grounding).
// Tries Groq, then falls back to Cerebras on rate-limit/quota — but only before
// any tokens have streamed (a quota error is detected up-front, so this is safe).
export async function chatStream(modelId, messages, onChunk, signal, options = {}) {
  resolveModel(modelId);
  const providers = activeProviders();
  if (!providers.length) throw new Error("AI isn't configured — add GROQ_API_KEY (or CEREBRAS_API_KEY) on the server.");

  let full = "";
  const track = (text) => { full += text; onChunk(text); };

  let lastErr;
  for (let i = 0; i < providers.length; i++) {
    const isLast = i === providers.length - 1;
    full = "";
    try {
      return await streamOnce(providers[i], modelId, messages, track, signal, options, isLast);
    } catch (err) {
      if (err.name === "AbortError") return full; // stopped — keep partial
      lastErr = err;
      // Don't fall back if we already emitted tokens (would duplicate output),
      // or for non-quota errors, or if this was the last provider.
      if (full || !isQuotaError(err) || isLast) throw err;
    }
  }
  throw lastErr;
}
