const API_URL = "http://localhost:5000";

async function request(path, options = {}) {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}

// Step 1 — send OTP to email.
export function sendOtpApi(email) {
  return request("/api/auth/send-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

// Step 2 — verify OTP, get back a short-lived verifiedToken.
export function verifyOtpApi(email, code) {
  return request("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ email, code }),
  });
}

// Step 3 — complete signup with name + password.
export function completeSignupApi(verifiedToken, name, password) {
  return request("/api/auth/complete-signup", {
    method: "POST",
    body: JSON.stringify({ verifiedToken, name, password }),
  });
}

// Resend a fresh code.
export function resendOtpApi(email) {
  return request("/api/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function changePasswordApi(currentPassword, newPassword) {
  const token = localStorage.getItem("token");
  return request("/api/auth/change-password", {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function loginApi(email, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function getMeApi(token) {
  const data = await request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.user;
}
