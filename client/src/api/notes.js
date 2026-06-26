const API_URL = "http://localhost:5000";

function getToken() {
  return localStorage.getItem("token");
}

async function request(urlPath, options = {}) {
  const res = await fetch(`${API_URL}${urlPath}`, {
    headers: {
      Authorization: `Bearer ${getToken()}`,
      ...options.headers,
    },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

export function getNotesApi() {
  return request("/api/notes");
}

export function getStorageApi() {
  return request("/api/notes/storage");
}

// FormData upload — no Content-Type header: browser sets it with the multipart boundary.
export async function uploadNoteApi(file) {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_URL}/api/notes/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${getToken()}` },
    body: formData,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Upload failed.");
  return data;
}

export function deleteNoteApi(id) {
  return request(`/api/notes/${id}`, { method: "DELETE" });
}

// Download triggers a browser "Save file" dialog via a temporary blob URL.
export async function downloadNoteApi(id, originalName) {
  const res = await fetch(`${API_URL}/api/notes/file/${id}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || "Download failed.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = originalName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
