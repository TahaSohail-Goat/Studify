import { useEffect, useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import { Mail, Lock, User, AlertCircle, ArrowLeft, RotateCcw } from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { sendOtpApi, verifyOtpApi, completeSignupApi, resendOtpApi } from "../api/auth.js";
import AuthLayout from "../components/AuthLayout.jsx";
import FloatingField from "../components/FloatingField.jsx";
import OtpInput from "../components/OtpInput.jsx";

const RESEND_COOLDOWN = 60;

export default function Signup() {
  const { token, setSession } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1=email  2=otp  3=details

  // Field values preserved across steps
  const [email, setEmail]               = useState("");
  const [code, setCode]                 = useState("");
  const [verifiedToken, setVerifiedToken] = useState("");
  const [name, setName]                 = useState("");
  const [password, setPassword]         = useState("");

  const [error, setError]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  if (token) return <Navigate to="/dashboard" replace />;

  // Resend countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  // ── Step 1: send OTP ───────────────────────────────────────────────────────
  async function handleSendOtp(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await sendOtpApi(email);
      setStep(2);
      setCooldown(RESEND_COOLDOWN);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 2: verify OTP ────────────────────────────────────────────────────
  async function handleVerify(e) {
    e.preventDefault();
    if (code.replace(/\s/g, "").length < 6)
      return setError("Please enter the full 6-digit code.");
    setError("");
    setSubmitting(true);
    try {
      const data = await verifyOtpApi(email, code);
      setVerifiedToken(data.verifiedToken);
      setStep(3);
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

  // ── Step 3: complete signup ───────────────────────────────────────────────
  async function handleComplete(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const data = await completeSignupApi(verifiedToken, name, password);
      setSession(data.token, data.user);
      navigate("/dashboard");
    } catch (err) {
      setError(err.message);
      // If the verified token expired, restart from step 1
      if (err.message.includes("expired") || err.message.includes("start over")) {
        setStep(1);
        setCode("");
        setVerifiedToken("");
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step 1: email screen ─────────────────────────────────────────────────
  if (step === 1) {
    return (
      <AuthLayout
        title="Create your account"
        subtitle="Enter your email to get started."
        footer={<>Already have an account? <Link to="/login">Sign in</Link></>}
      >
        <form className="auth-form" onSubmit={handleSendOtp}>
          {error && (
            <div className="form-alert">
              <AlertCircle size={17} />
              {error}
            </div>
          )}

          <FloatingField
            label="Email address"
            type="email"
            icon={<Mail size={18} />}
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />

          <button className="btn-primary" type="submit" disabled={submitting || !email}>
            {submitting ? <span className="spinner" /> : "Continue"}
          </button>
        </form>
      </AuthLayout>
    );
  }

  // ── Step 2: OTP screen ───────────────────────────────────────────────────
  if (step === 2) {
    return (
      <AuthLayout
        title="Check your email"
        subtitle={
          <>
            We sent a 6-digit code to{" "}
            <span className="highlight-email">{email}</span>
          </>
        }
        footer={<><Link to="/login">Back to sign in</Link></>}
      >
        <form className="auth-form" onSubmit={handleVerify}>
          {error && (
            <div className="form-alert">
              <AlertCircle size={17} />
              {error}
            </div>
          )}

          <OtpInput value={code} onChange={setCode} />

          <button
            className="btn-primary"
            type="submit"
            disabled={submitting || code.replace(/\s/g, "").length < 6}
          >
            {submitting ? <span className="spinner" /> : "Verify email"}
          </button>

          <div className="otp-resend">
            {cooldown > 0 ? (
              <span className="otp-resend__timer">Resend code in {cooldown}s</span>
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
            Use a different email
          </button>
        </form>
      </AuthLayout>
    );
  }

  // ── Step 3: name + password screen ───────────────────────────────────────
  return (
    <AuthLayout
      title="Almost there"
      subtitle="Set up your name and password."
      footer={null}
    >
      <form className="auth-form" onSubmit={handleComplete}>
        {error && (
          <div className="form-alert">
            <AlertCircle size={17} />
            {error}
          </div>
        )}

        <div className="verified-email-badge">
          <Mail size={14} />
          {email}
        </div>

        <FloatingField
          label="Full name"
          icon={<User size={18} />}
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />

        <FloatingField
          label="Password (min 6 characters)"
          type="password"
          icon={<Lock size={18} />}
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        <button className="btn-primary" type="submit" disabled={submitting || !name || !password}>
          {submitting ? <span className="spinner" /> : "Create account"}
        </button>
      </form>
    </AuthLayout>
  );
}
