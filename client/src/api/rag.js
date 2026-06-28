const API_URL = "http://localhost:5000";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

export async function getRagStatusApi() {
  const res = await fetch(`${API_URL}/api/rag/status`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Could not load index status.");
  return data;
}

// force=true re-embeds every note; otherwise only notes not yet indexed.
export async function reindexApi(force = false) {
  const res = await fetch(`${API_URL}/api/rag/reindex`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ force }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Could not update the index.");
  return data;
}
