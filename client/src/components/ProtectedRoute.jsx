// ── ProtectedRoute ───────────────────────────────────────────────────────────
// Wrap any page that should require login. If there's no token, we bounce the
// user to /login. While we're still checking the token, we show a loader.

import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ children }) {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="auth-page">
        <div className="page-loader">
          <div className="spinner spinner--lg" />
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
