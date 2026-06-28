const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

function authHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${localStorage.getItem("token")}`,
  };
}

async function request(urlPath) {
  const res = await fetch(`${API_URL}${urlPath}`, { headers: authHeaders() });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

export function getAnalyticsApi() {
  return request("/api/analytics");
}

export function getInsightsApi() {
  return request("/api/analytics/insights");
}
