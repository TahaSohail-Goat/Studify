import { useEffect, useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { User, Mail, Lock, AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { registerApi, verifyOtpApi, resendOtpApi } from "../api/auth.js";
import AuthLayout from "../components/AuthLayout.jsx";
import FloatingField from "../components/FloatingField.jsx";
import OtpInput from "../components/OtpInput.jsx";

const RESEND_COOLDOWN = 60; // seconds before the user can resend

export default function Signup() {
  const { setSession, token } = useAuth();
  const navigate = useNavigate();

  // ── Step 1 state ────────────────────────────────────────────────────────
  const [name, setName]         = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  // ── Step 2 (OTP) state ──────────────────────────────────────────────────
  const [step, setStep]         = useState(1); // 1 = form  |  2 = OTP screen
  const [code, setCode]         = useState("");
  const [cooldown, setCooldown] = useState(0); // resend countdown in seconds

  // ── Shared ──────────────────────────────────────────────────────────────
  const [error, setError]         = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  // Countdown timer for the resend button.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // ── Step 1: send OTP ────────────────────────────────────────────────────
  async function handleRegister(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await registerApi(name, email, password);
      setStep(2);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 2: verify OTP ──────────────────────────────────────────────────
  async function handleVerify(e) {
    e.preventDefault();
    if (code.length < 6) return setError("Please enter the full 6-digit code.");
    setError("");
    setSubmitting(true);
    try {
      const data = await verifyOtpApi(name, email, password, code);
      setSession(data.token, data.user); // log the user in
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      setCode("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setError("");
    setCode("");
    try {
      await resendOtpApi(email);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────
  if (step === 2) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={`We sent a 6-digit code to ${email}`}
        footer={<><Link to="/login">Back to login</Link></>}
      >
        <form className="auth-form" onSubmit={handleVerify}>
          {error && (
            <div className="form-alert">
              <AlertCircle size={17} />
              {error}
            </div>
          )}

          <OtpInput value={code} onChange={setCode} />

          <button className="btn-primary" type="submit" disabled={submitting || code.length < 6}>
            {submitting ? <span className="spinner" /> : "Verify & create account"}
          </button>

          <div className="otp-resend">
            {cooldown > 0 ? (
              <span className="otp-resend__timer">
                Resend code in {cooldown}s
              </span>
            ) : (
              <button type="button" className="otp-resend__btn" onClick={handleResend}>
                <RotateCcw size={14} />
                Resend code
              </button>
            )}
          </div>

          <button
            type="button"
            className="btn-back"
            onClick={() => { setStep(1); setError(""); setCode(""); }}
          >
            <ArrowLeft size={15} />
            Change email
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start studying smarter with AI."
      footer={<>Already have an account? <Link to="/login">Log in</Link></>}
    >
      <form className="auth-form" onSubmit={handleRegister}>
        {error && (
          <div className="form-alert">
            <AlertCircle size={17} />
            {error}
          </div>
        )}

        <FloatingField label="Full name" icon={<User size={18} />}
          name="name" autoComplete="name" value={name}
          onChange={(e) => setName(e.target.value)} />

        <FloatingField label="Email" type="email" icon={<Mail size={18} />}
          name="email" autoComplete="email" value={email}
          onChange={(e) => setEmail(e.target.value)} />

        <FloatingField label="Password (min 6 characters)" type="password"
          icon={<Lock size={18} />} name="password" autoComplete="new-password"
          value={password} onChange={(e) => setPassword(e.target.value)} />

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? <span className="spinner" /> : "Send verification code"}
        </button>
      </form>
    </AuthLayout>
  );
}
