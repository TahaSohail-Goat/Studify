const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

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

// All summaries the user has generated.
export function getSummariesApi() {
  return request("/api/summaries");
}

// Generate (or regenerate) the summary for one uploaded file.
export function generateSummaryApi(noteId) {
  return request(`/api/summaries/${noteId}`, { method: "POST" });
}

export function deleteSummaryApi(id) {
  return request(`/api/summaries/${id}`, { method: "DELETE" });
}
