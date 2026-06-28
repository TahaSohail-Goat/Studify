// ── AuthLayout ───────────────────────────────────────────────────────────────
// Split-screen shell for Login & Signup: a brand image panel on the left and
// the form on the right (the image collapses on small screens).

export default function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth-split">
      {/* Left — full-bleed image */}
      <aside className="auth-visual">
        <img src="/download.jpg" alt="A cozy study desk at sunset" className="auth-visual__img" />
      </aside>

      {/* Right — brand lockup above the form */}
      <main className="auth-panel">
        <div className="auth-formwrap">
          <div className="auth-brand">
            <img src="/studify-logo.png" alt="" className="auth-brand__img" />
            <span className="auth-brand__name">Studify</span>
          </div>

          <h1 className="auth-title">{title}</h1>
          <p className="auth-subtitle">{subtitle}</p>

          {children}

          <div className="auth-footer">{footer}</div>
        </div>
      </main>
    </div>
  );
}
