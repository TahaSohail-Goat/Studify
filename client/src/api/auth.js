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

// Step 1: send OTP to email.
export function registerApi(name, email, password) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password }),
  });
}

// Step 2: verify OTP → account created + JWT returned.
export function verifyOtpApi(name, email, password, code) {
  return request("/api/auth/verify-otp", {
    method: "POST",
    body: JSON.stringify({ name, email, password, code }),
  });
}

// Resend a fresh OTP.
export function resendOtpApi(email) {
  return request("/api/auth/resend-otp", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function loginApi(email, password) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function getMeApi(token) {
  return request("/api/auth/me", {
    headers: { Authorization: `Bearer ${token}` },
  }).then((d) => d.user);
}
