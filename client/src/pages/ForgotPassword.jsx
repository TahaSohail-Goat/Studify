import { useEffect, useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Mail, Lock, AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { forgotPasswordApi, resetPasswordApi } from "../api/auth.js";
import AuthLayout from "../components/AuthLayout.jsx";
import FloatingField from "../components/FloatingField.jsx";
import OtpInput from "../components/OtpInput.jsx";

const RESEND_COOLDOWN = 60;

export default function ForgotPassword() {
  const { token, setSession } = useAuth();
  const navigate = useNavigate();

  const [step, setStep]           = useState(1); // 1=email  2=code + new password
  const [email, setEmail]         = useState("");
  const [code, setCode]           = useState("");
  const [password, setPassword]   = useState("");
  const [error, setError]         = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown]   = useState(0);

  if (token) return <Navigate to="/dashboard" replace />;

  // Resend countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // ── Step 1: email a reset code ──────────────────────────────────────────────
  async function handleSendCode(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await forgotPasswordApi(email);
      setStep(2);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    if (cooldown > 0) return;
    setError("");
    try {
      await forgotPasswordApi(email);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
    }
  }

  // ── Step 2: verify code + set new password ──────────────────────────────────
  async function handleReset(e) {
    e.preventDefault();
    if (code.length !== 6) { setError("Enter the 6-digit code from your email."); return; }
    if (password.length < 6) { setError("New password must be at least 6 characters."); return; }
    setError("");
    setSubmitting(true);
    try {
      const { token: newToken, user } = await resetPasswordApi(email, code, password);
      setSession(newToken, user); // log straight in
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const footer = <>Remembered it? <Link to="/login">Back to log in</Link></>;

  // Step 1 — email
  if (step === 1) {
    return (
      <AuthLayout
        title="Reset your password"
        subtitle="Enter your email and we'll send you a reset code."
        footer={footer}
      >
        <form className="auth-form" onSubmit={handleSendCode}>
          {error && <div className="form-alert"><AlertCircle size={17} /> {error}</div>}
          <FloatingField
            label="Email" type="email" icon={<Mail size={18} />} name="email"
            autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)}
          />
          <button className="btn-primary" type="submit" disabled={submitting}>
            {submitting ? <span className="spinner" /> : "Send reset code"}
          </button>
        </form>
      </AuthLayout>
    );
  }

  // Step 2 — code + new password
  return (
    <AuthLayout
      title="Enter code & new password"
      subtitle={<>We sent a 6-digit code to <span className="highlight-email">{email}</span>.</>}
      footer={footer}
    >
      <form className="auth-form" onSubmit={handleReset}>
        {error && <div className="form-alert"><AlertCircle size={17} /> {error}</div>}

        <OtpInput value={code} onChange={setCode} />
        <div className="otp-resend">
          {cooldown > 0 ? (
            <span className="otp-resend__timer">Resend code in {cooldown}s</span>
          ) : (
            <button type="button" className="otp-resend__btn" onClick={handleResend}>
              <RotateCcw size={14} /> Resend code
            </button>
          )}
        </div>

        <FloatingField
          label="New password" type="password" icon={<Lock size={18} />} name="newPassword"
          autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)}
        />

        <button className="btn-primary" type="submit" disabled={submitting}>
          {submitting ? <span className="spinner" /> : "Reset password"}
        </button>
        <button type="button" className="btn-back" onClick={() => { setStep(1); setError(""); }}>
          <ArrowLeft size={15} /> Use a different email
        </button>
      </form>
    </AuthLayout>
  );
}
