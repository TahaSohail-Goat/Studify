import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertCircle, CheckCircle, KeyRound,
  User, Mail, Target, Sun, Moon, Trash2,
  Camera, Download, LogOut, ShieldCheck,
} from "lucide-react";
import AppLayout from "../components/AppLayout.jsx";
import OtpInput from "../components/OtpInput.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import {
  changePasswordApi, updateProfileApi,
  requestEmailChangeApi, confirmEmailChangeApi,
  deleteAccountApi, uploadAvatarApi, removeAvatarApi,
  logoutAllApi, exportDataApi, avatarUrl,
} from "../api/auth.js";
import { getStorageApi } from "../api/notes.js";

// ── Shared helpers ────────────────────────────────────────────────────────────
function SCard({ title, subtitle, children, danger }) {
  return (
    <div className={`settings-card${danger ? " settings-card--danger" : ""}`}>
      <div className="settings-card__header">
        <p className="settings-card__title">{title}</p>
        <p className="settings-card__subtitle">{subtitle}</p>
      </div>
      <div className="settings-card__body">{children}</div>
    </div>
  );
}

function Msg({ msg }) {
  if (!msg) return null;
  return (
    <div className={`settings-alert settings-alert--${msg.type}`}>
      {msg.type === "success" ? <CheckCircle size={15} /> : <AlertCircle size={15} />}
      {msg.text}
    </div>
  );
}

function BtnRow({ children }) {
  return <div className="settings-btn-row">{children}</div>;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

function formatDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function Settings() {
  const { user, updateUser, logout } = useAuth();
  const { theme, toggle }            = useTheme();
  const navigate                     = useNavigate();

  // 1. Profile / Name
  const [name, setName]               = useState(user?.name || "");
  const [nameSaving, setNameSaving]   = useState(false);
  const [nameMsg, setNameMsg]         = useState(null);

  // 2. Change Email  (0 = hidden, 1 = enter email, 2 = enter OTP)
  const [emailStep, setEmailStep]     = useState(0);
  const [newEmail, setNewEmail]       = useState("");
  const [emailOtp, setEmailOtp]       = useState("");
  const [emailBusy, setEmailBusy]     = useState(false);
  const [emailMsg, setEmailMsg]       = useState(null);

  // 3. Study Goal
  const [goal, setGoal]               = useState(user?.studyGoal ?? 30);
  const [goalSaving, setGoalSaving]   = useState(false);
  const [goalMsg, setGoalMsg]         = useState(null);

  // 5. Password
  const [curPw, setCurPw]             = useState("");
  const [newPw, setNewPw]             = useState("");
  const [confirmPw, setConfirmPw]     = useState("");
  const [pwSaving, setPwSaving]       = useState(false);
  const [pwMsg, setPwMsg]             = useState(null);

  // 6. Storage
  const [storage, setStorage]         = useState(null);

  // 7. Delete Account
  const [deleteText, setDeleteText]   = useState("");
  const [deleting, setDeleting]       = useState(false);
  const [deleteMsg, setDeleteMsg]     = useState(null);

  // 8. Profile photo
  const avatarInputRef                = useRef(null);
  const [avatarBusy, setAvatarBusy]   = useState(false);
  const [avatarMsg, setAvatarMsg]     = useState(null);

  // 9. Sessions (sign out everywhere)
  const [sessionBusy, setSessionBusy] = useState(false);
  const [sessionMsg, setSessionMsg]   = useState(null);

  // 10. Export data
  const [exportBusy, setExportBusy]   = useState(false);
  const [exportMsg, setExportMsg]     = useState(null);

  // Keep inputs in sync if user object updates (e.g. after saving)
  useEffect(() => {
    if (user?.name)      setName(user.name);
    if (user?.studyGoal) setGoal(user.studyGoal);
  }, [user]);

  useEffect(() => {
    getStorageApi().then(setStorage).catch(() => {});
  }, []);

  // ── 1. Save name ─────────────────────────────────────────────────────────────
  async function handleSaveName(e) {
    e.preventDefault();
    setNameMsg(null);
    if (!name.trim())
      return setNameMsg({ type: "error", text: "Name cannot be empty." });
    if (name.trim() === user?.name)
      return setNameMsg({ type: "error", text: "No changes to save." });
    setNameSaving(true);
    try {
      const data = await updateProfileApi({ name: name.trim() });
      updateUser(data.user);
      setNameMsg({ type: "success", text: "Name updated successfully." });
    } catch (err) {
      setNameMsg({ type: "error", text: err.message });
    } finally {
      setNameSaving(false);
    }
  }

  // ── 2. Email change — step 1 ──────────────────────────────────────────────────
  async function handleSendEmailOtp(e) {
    e.preventDefault();
    setEmailMsg(null);
    if (!newEmail.trim())
      return setEmailMsg({ type: "error", text: "Enter a new email address." });
    if (newEmail.toLowerCase() === user?.email)
      return setEmailMsg({ type: "error", text: "This is already your current email." });
    setEmailBusy(true);
    try {
      await requestEmailChangeApi(newEmail.trim());
      setEmailStep(2);
      setEmailMsg({ type: "success", text: `Code sent to ${newEmail}.` });
    } catch (err) {
      setEmailMsg({ type: "error", text: err.message });
    } finally {
      setEmailBusy(false);
    }
  }

  // ── 2. Email change — step 2 ──────────────────────────────────────────────────
  async function handleConfirmEmail(e) {
    e.preventDefault();
    setEmailMsg(null);
    if (emailOtp.replace(/\D/g, "").length < 6)
      return setEmailMsg({ type: "error", text: "Enter the full 6-digit code." });
    setEmailBusy(true);
    try {
      const data = await confirmEmailChangeApi(newEmail.trim(), emailOtp);
      updateUser(data.user);
      setEmailStep(0);
      setNewEmail("");
      setEmailOtp("");
      setEmailMsg({ type: "success", text: "Email address updated." });
    } catch (err) {
      setEmailMsg({ type: "error", text: err.message });
    } finally {
      setEmailBusy(false);
    }
  }

  function cancelEmailChange() {
    setEmailStep(0);
    setNewEmail("");
    setEmailOtp("");
    setEmailMsg(null);
  }

  // ── 3. Save study goal ────────────────────────────────────────────────────────
  async function handleSaveGoal(e) {
    e.preventDefault();
    setGoalMsg(null);
    const g = Number(goal);
    if (isNaN(g) || g < 5 || g > 480)
      return setGoalMsg({ type: "error", text: "Goal must be between 5 and 480 minutes." });
    setGoalSaving(true);
    try {
      const data = await updateProfileApi({ studyGoal: g });
      updateUser(data.user);
      setGoalMsg({ type: "success", text: "Study goal saved." });
    } catch (err) {
      setGoalMsg({ type: "error", text: err.message });
    } finally {
      setGoalSaving(false);
    }
  }

  // ── 5. Change password ────────────────────────────────────────────────────────
  async function handleChangePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (newPw.length < 6)
      return setPwMsg({ type: "error", text: "New password must be at least 6 characters." });
    if (newPw !== confirmPw)
      return setPwMsg({ type: "error", text: "New passwords do not match." });
    if (newPw === curPw)
      return setPwMsg({ type: "error", text: "New password must differ from current." });
    setPwSaving(true);
    try {
      await changePasswordApi(curPw, newPw);
      setPwMsg({ type: "success", text: "Password changed successfully." });
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      setPwMsg({ type: "error", text: err.message });
    } finally {
      setPwSaving(false);
    }
  }

  // ── 7. Delete account ─────────────────────────────────────────────────────────
  async function handleDeleteAccount() {
    setDeleteMsg(null);
    setDeleting(true);
    try {
      await deleteAccountApi();
      logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setDeleteMsg({ type: "error", text: err.message });
      setDeleting(false);
    }
  }

  // ── 8. Profile photo ──────────────────────────────────────────────────────────
  async function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file can be re-selected later
    if (!file) return;
    setAvatarMsg(null);

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      return setAvatarMsg({ type: "error", text: "Please choose a JPG, PNG, or WEBP image." });
    if (file.size > 2 * 1024 * 1024)
      return setAvatarMsg({ type: "error", text: "Image must be 2 MB or smaller." });

    setAvatarBusy(true);
    try {
      const data = await uploadAvatarApi(file);
      updateUser(data.user);
      setAvatarMsg({ type: "success", text: "Profile photo updated." });
    } catch (err) {
      setAvatarMsg({ type: "error", text: err.message });
    } finally {
      setAvatarBusy(false);
    }
  }

  async function handleRemoveAvatar() {
    setAvatarMsg(null);
    setAvatarBusy(true);
    try {
      const data = await removeAvatarApi();
      updateUser(data.user);
      setAvatarMsg({ type: "success", text: "Profile photo removed." });
    } catch (err) {
      setAvatarMsg({ type: "error", text: err.message });
    } finally {
      setAvatarBusy(false);
    }
  }

  // ── 9. Sign out of all devices ────────────────────────────────────────────────
  async function handleLogoutAll() {
    setSessionMsg(null);
    setSessionBusy(true);
    try {
      await logoutAllApi();
      logout();
      navigate("/login", { replace: true });
    } catch (err) {
      setSessionMsg({ type: "error", text: err.message });
      setSessionBusy(false);
    }
  }

  // ── 10. Export data ───────────────────────────────────────────────────────────
  async function handleExport() {
    setExportMsg(null);
    setExportBusy(true);
    try {
      await exportDataApi();
      setExportMsg({ type: "success", text: "Your data has been downloaded." });
    } catch (err) {
      setExportMsg({ type: "error", text: err.message });
    } finally {
      setExportBusy(false);
    }
  }

  const storagePercent = storage
    ? Math.min((storage.totalBytes / storage.limitBytes) * 100, 100)
    : 0;

  return (
    <AppLayout title="Settings">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Manage your account and preferences.</p>
      </div>

      <div className="settings-layout">

        {/* ── Account overview ────────────────────────────────────────────── */}
        <SCard title="Account overview" subtitle="A quick summary of your Studify account.">
          <div className="overview-grid">
            <div className="overview-item">
              <span className="overview-label">Member since</span>
              <span className="overview-value">{formatDate(user?.createdAt)}</span>
            </div>
            <div className="overview-item">
              <span className="overview-label">Email status</span>
              <span className="overview-value overview-badge">
                <ShieldCheck size={13} /> Verified
              </span>
            </div>
            <div className="overview-item">
              <span className="overview-label">Account ID</span>
              <span className="overview-value overview-mono">{user?.id}</span>
            </div>
          </div>
        </SCard>

        {/* ── Profile photo ───────────────────────────────────────────────── */}
        <SCard title="Profile photo" subtitle="JPG, PNG or WEBP, up to 2 MB.">
          <Msg msg={avatarMsg} />
          <div className="avatar-row">
            <div className="avatar-preview">
              {user?.avatar
                ? <img src={avatarUrl(user.avatar)} alt={user?.name || "Avatar"} />
                : <span>{getInitials(user?.name)}</span>}
            </div>
            <div className="avatar-actions">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAvatarChange}
                hidden
              />
              <button
                className="settings-btn settings-btn--secondary"
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={avatarBusy}
              >
                <Camera size={14} />
                {avatarBusy ? "Uploading…" : user?.avatar ? "Change photo" : "Upload photo"}
              </button>
              {user?.avatar && (
                <button
                  className="settings-btn settings-btn--ghost"
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={avatarBusy}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        </SCard>

        {/* ── 1. Profile ──────────────────────────────────────────────────── */}
        <SCard title="Profile" subtitle="Update your display name.">
          <form onSubmit={handleSaveName}>
            <Msg msg={nameMsg} />
            <div className="settings-input-wrap">
              <label htmlFor="sett-name">Full name</label>
              <input
                id="sett-name"
                className="settings-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
              />
            </div>
            <BtnRow>
              <button
                className="settings-btn settings-btn--primary"
                type="submit"
                disabled={nameSaving || !name.trim()}
              >
                <User size={14} />
                {nameSaving ? "Saving…" : "Save name"}
              </button>
            </BtnRow>
          </form>
        </SCard>

        {/* ── 2. Change Email ─────────────────────────────────────────────── */}
        <SCard title="Email address" subtitle="Changing your email requires OTP verification on the new address.">
          <Msg msg={emailMsg} />
          <div className="profile-field">
            <label>Current email</label>
            <div className="profile-field__value">{user?.email}</div>
          </div>

          {emailStep === 0 && (
            <BtnRow>
              <button
                className="settings-btn settings-btn--secondary"
                type="button"
                onClick={() => { setEmailStep(1); setEmailMsg(null); }}
              >
                <Mail size={14} />
                Change email
              </button>
            </BtnRow>
          )}

          {emailStep === 1 && (
            <form onSubmit={handleSendEmailOtp}>
              <div className="settings-input-wrap">
                <label htmlFor="new-email">New email address</label>
                <input
                  id="new-email"
                  className="settings-input"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="new@email.com"
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <BtnRow>
                <button
                  className="settings-btn settings-btn--primary"
                  type="submit"
                  disabled={emailBusy || !newEmail.trim()}
                >
                  {emailBusy ? "Sending…" : "Send code"}
                </button>
                <button
                  className="settings-btn settings-btn--ghost"
                  type="button"
                  onClick={cancelEmailChange}
                >
                  Cancel
                </button>
              </BtnRow>
            </form>
          )}

          {emailStep === 2 && (
            <form onSubmit={handleConfirmEmail}>
              <p className="settings-hint">
                Enter the 6-digit code sent to <strong>{newEmail}</strong>
              </p>
              <OtpInput value={emailOtp} onChange={setEmailOtp} />
              <BtnRow>
                <button
                  className="settings-btn settings-btn--primary"
                  type="submit"
                  disabled={emailBusy || emailOtp.replace(/\D/g, "").length < 6}
                >
                  {emailBusy ? "Verifying…" : "Confirm email"}
                </button>
                <button
                  className="settings-btn settings-btn--ghost"
                  type="button"
                  onClick={() => { setEmailStep(1); setEmailOtp(""); setEmailMsg(null); }}
                >
                  Back
                </button>
              </BtnRow>
            </form>
          )}
        </SCard>

        {/* ── 3. Study Goal ───────────────────────────────────────────────── */}
        <SCard
          title="Daily study goal"
          subtitle="How many minutes per day do you want to study? Used in Analytics."
        >
          <form onSubmit={handleSaveGoal}>
            <Msg msg={goalMsg} />
            <div className="settings-input-wrap">
              <label htmlFor="study-goal">Minutes per day</label>
              <div className="goal-input-row">
                <input
                  id="study-goal"
                  className="settings-input goal-input"
                  type="number"
                  min="5"
                  max="480"
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                />
                <span className="goal-unit">min / day</span>
              </div>
            </div>
            <BtnRow>
              <button
                className="settings-btn settings-btn--primary"
                type="submit"
                disabled={goalSaving}
              >
                <Target size={14} />
                {goalSaving ? "Saving…" : "Save goal"}
              </button>
            </BtnRow>
          </form>
        </SCard>

        {/* ── 4. Appearance ───────────────────────────────────────────────── */}
        <SCard title="Appearance" subtitle="Choose how Studify looks for you.">
          <div className="appearance-row">
            <div className="appearance-label">
              {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
              <span>{theme === "dark" ? "Dark theme" : "Light theme"}</span>
            </div>
            <button
              className={`theme-pill${theme === "light" ? " theme-pill--on" : ""}`}
              type="button"
              onClick={toggle}
              aria-label="Toggle theme"
            >
              <span className="theme-pill__thumb" />
            </button>
          </div>
        </SCard>

        {/* ── 5. Password ─────────────────────────────────────────────────── */}
        <SCard title="Password" subtitle="Use a strong password you don't use elsewhere.">
          <form onSubmit={handleChangePassword}>
            <Msg msg={pwMsg} />
            <div className="settings-input-wrap">
              <label htmlFor="cur-pw">Current password</label>
              <input
                id="cur-pw" className="settings-input" type="password"
                autoComplete="current-password" placeholder="Current password"
                value={curPw} onChange={(e) => setCurPw(e.target.value)}
              />
            </div>
            <div className="settings-input-wrap">
              <label htmlFor="new-pw">New password</label>
              <input
                id="new-pw" className="settings-input" type="password"
                autoComplete="new-password" placeholder="Min. 6 characters"
                value={newPw} onChange={(e) => setNewPw(e.target.value)}
              />
            </div>
            <div className="settings-input-wrap">
              <label htmlFor="confirm-pw">Confirm new password</label>
              <input
                id="confirm-pw" className="settings-input" type="password"
                autoComplete="new-password" placeholder="Repeat new password"
                value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
              />
            </div>
            <BtnRow>
              <button
                className="settings-btn settings-btn--primary"
                type="submit"
                disabled={pwSaving || !curPw || !newPw || !confirmPw}
              >
                <KeyRound size={14} />
                {pwSaving ? "Saving…" : "Update password"}
              </button>
            </BtnRow>
          </form>
        </SCard>

        {/* ── Active sessions ─────────────────────────────────────────────── */}
        <SCard
          title="Active sessions"
          subtitle="Signed in on a shared or old device? Sign out everywhere to stay safe."
        >
          <Msg msg={sessionMsg} />
          <p className="settings-hint">
            This ends every active session, <strong>including this one</strong> — you'll need to log
            in again.
          </p>
          <BtnRow>
            <button
              className="settings-btn settings-btn--secondary"
              type="button"
              onClick={handleLogoutAll}
              disabled={sessionBusy}
            >
              <LogOut size={14} />
              {sessionBusy ? "Signing out…" : "Sign out of all devices"}
            </button>
          </BtnRow>
        </SCard>

        {/* ── 6. Storage ──────────────────────────────────────────────────── */}
        <SCard
          title="Storage"
          subtitle={
            storage
              ? `Files you upload count toward your ${formatBytes(storage.limitBytes)} limit.`
              : "Files you upload count toward your storage limit."
          }
        >
          {storage ? (
            <>
              <div className="storage-track">
                <div className="storage-fill" style={{ width: `${storagePercent}%` }} />
              </div>
              <div className="storage-meta">
                <span>{formatBytes(storage.totalBytes)} used</span>
                <span>{formatBytes(storage.limitBytes)}</span>
              </div>
              <p className="storage-count">
                {storage.count} {storage.count === 1 ? "file" : "files"} uploaded
              </p>
            </>
          ) : (
            <div className="storage-skeleton" />
          )}
        </SCard>

        {/* ── Export data ─────────────────────────────────────────────────── */}
        <SCard
          title="Export your data"
          subtitle="Download a copy of your account info and notes list as a JSON file."
        >
          <Msg msg={exportMsg} />
          <BtnRow>
            <button
              className="settings-btn settings-btn--secondary"
              type="button"
              onClick={handleExport}
              disabled={exportBusy}
            >
              <Download size={14} />
              {exportBusy ? "Preparing…" : "Download my data"}
            </button>
          </BtnRow>
        </SCard>

        {/* ── 7. Danger Zone ──────────────────────────────────────────────── */}
        <SCard
          title="Danger zone"
          subtitle="This action is permanent and cannot be undone."
          danger
        >
          <Msg msg={deleteMsg} />
          <p className="danger-description">
            Deleting your account permanently removes all notes, uploaded files, and account data.
          </p>
          <div className="settings-input-wrap">
            <label htmlFor="del-confirm">
              Type <strong>DELETE</strong> to confirm
            </label>
            <input
              id="del-confirm"
              className="settings-input settings-input--danger"
              type="text"
              placeholder="DELETE"
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
            />
          </div>
          <BtnRow>
            <button
              className="settings-btn settings-btn--danger"
              onClick={handleDeleteAccount}
              disabled={deleteText !== "DELETE" || deleting}
            >
              <Trash2 size={14} />
              {deleting ? "Deleting…" : "Delete my account"}
            </button>
          </BtnRow>
        </SCard>

      </div>
    </AppLayout>
  );
}
