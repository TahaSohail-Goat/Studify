import { useState } from "react";
import { AlertCircle, CheckCircle, KeyRound } from "lucide-react";
import AppLayout from "../components/AppLayout.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { changePasswordApi } from "../api/auth.js";

export default function Settings() {
  const { user } = useAuth();

  const [current, setCurrent]   = useState("");
  const [next, setNext]         = useState("");
  const [confirm, setConfirm]   = useState("");
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState("");
  const [success, setSuccess]   = useState("");

  async function handleChangePassword(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (next.length < 6)
      return setError("New password must be at least 6 characters.");
    if (next !== confirm)
      return setError("New passwords do not match.");
    if (next === current)
      return setError("New password must be different from your current one.");

    setSaving(true);
    try {
      await changePasswordApi(current, next);
      setSuccess("Password changed successfully.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppLayout title="Settings">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account and preferences.</p>
      </div>

      <div className="settings-layout">
        {/* Profile info — read only */}
        <div className="settings-card">
          <div className="settings-card__header">
            <p className="settings-card__title">Profile</p>
            <p className="settings-card__subtitle">Your account information.</p>
          </div>
          <div className="settings-card__body">
            <div className="profile-field">
              <label>Full name</label>
              <div className="profile-field__value">{user?.name}</div>
            </div>
            <div className="profile-field">
              <label>Email</label>
              <div className="profile-field__value">{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Change password */}
        <div className="settings-card">
          <div className="settings-card__header">
            <p className="settings-card__title">Change password</p>
            <p className="settings-card__subtitle">
              Use a strong password you don't use elsewhere.
            </p>
          </div>
          <form className="settings-card__body" onSubmit={handleChangePassword}>
            {error && (
              <div className="settings-alert settings-alert--error">
                <AlertCircle size={15} />
                {error}
              </div>
            )}
            {success && (
              <div className="settings-alert settings-alert--success">
                <CheckCircle size={15} />
                {success}
              </div>
            )}

            <div className="settings-input-wrap">
              <label htmlFor="current-pw">Current password</label>
              <input
                id="current-pw"
                className="settings-input"
                type="password"
                autoComplete="current-password"
                placeholder="Enter current password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
              />
            </div>

            <div className="settings-input-wrap">
              <label htmlFor="new-pw">New password</label>
              <input
                id="new-pw"
                className="settings-input"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 6 characters"
                value={next}
                onChange={(e) => setNext(e.target.value)}
              />
            </div>

            <div className="settings-input-wrap">
              <label htmlFor="confirm-pw">Confirm new password</label>
              <input
                id="confirm-pw"
                className="settings-input"
                type="password"
                autoComplete="new-password"
                placeholder="Repeat new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>

            <div>
              <button
                className="settings-btn settings-btn--primary"
                type="submit"
                disabled={saving || !current || !next || !confirm}
              >
                <KeyRound size={14} />
                {saving ? "Saving…" : "Update password"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
