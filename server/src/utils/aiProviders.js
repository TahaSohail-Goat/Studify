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

// Groq is OpenAI-compatible: a flat messages array with roles system/user/assistant.
function toGroqMessages(messages) {
  return [
    { role: "system", content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ];
}

// ── Non-streaming: get the whole reply at once ────────────────────────────────
export async function chatComplete(modelId, messages) {
  resolveModel(modelId); // validate the id
  const key = groqKey();

  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: modelId, messages: toGroqMessages(messages) }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(friendlyError(res.status, data));

  const text = data?.choices?.[0]?.message?.content || "";
  if (!text) throw new Error("The model returned an empty response. Try again.");
  return text;
}

// ── Streaming: invoke onChunk(textDelta) as tokens arrive; resolves to full text ─
// Pass an AbortSignal to support "stop generating" — on abort we keep the partial.
export async function chatStream(modelId, messages, onChunk, signal) {
  resolveModel(modelId);
  const key = groqKey();

  let res;
  try {
    res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: modelId, stream: true, messages: toGroqMessages(messages) }),
      signal,
    });
  } catch (err) {
    if (err.name === "AbortError") return ""; // stopped before any reply
    throw err;
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
