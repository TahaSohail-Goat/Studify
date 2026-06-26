const API_URL = "http://localhost:5000";

function getToken() {
  return localStorage.getItem("token");
}

async function request(urlPath, options = {}) {
  const res = await fetch(`${API_URL}${urlPath}`, {
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

// Available models + whether each provider's key is configured server-side.
export function getModelsApi() {
  return request("/api/chat/models");
}

// Sidebar list (titles only, no message bodies).
export function getConversationsApi() {
  return request("/api/chat/conversations");
}

// Full conversation with all messages.
export function getConversationApi(id) {
  return request(`/api/chat/conversations/${id}`);
}

export function deleteConversationApi(id) {
  return request(`/api/chat/conversations/${id}`, { method: "DELETE" });
}

// Send a message and stream the reply. Pass conversationId=null to start a new
// conversation. The server replies with newline-delimited JSON events; we parse
// them as they arrive and fire the matching handler:
//   onStart({ conversationId, title }) — fired before the first token
//   onDelta(text)             — a chunk of the reply
//   onDone({ conversationId, title }) — finished + saved
//   onError(message)          — something went wrong
// Pass `signal` (an AbortSignal) to support "stop generating".
export async function sendMessageStreamApi({ conversationId, model, content, signal }, handlers = {}) {
  const res = await fetch(`${API_URL}/api/chat/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getToken()}`,
    },
    body: JSON.stringify({ conversationId, model, content }),
    signal,
  });

  // Validation/auth errors come back as a normal JSON error before streaming.
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Request failed.");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n");
    buffer = lines.pop() ?? ""; // keep the last partial line

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      let evt;
      try {
        evt = JSON.parse(trimmed);
      } catch {
        continue;
      }
      if (evt.type === "start") handlers.onStart?.(evt);
      else if (evt.type === "delta") handlers.onDelta?.(evt.text);
      else if (evt.type === "done") handlers.onDone?.(evt);
      else if (evt.type === "error") handlers.onError?.(evt.message);
    }
  }
}
