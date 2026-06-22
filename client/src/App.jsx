// ── App: the route map ───────────────────────────────────────────────────────
// Decides which page to show for each URL path.

import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

export default function App() {
  return (
    <Routes>
      {/* Visiting "/" sends you to login (which itself bounces to the dashboard
          if you're already logged in). */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      {/* The dashboard is wrapped so only logged-in users can reach it. */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />

      {/* Any unknown URL → back to login. */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
