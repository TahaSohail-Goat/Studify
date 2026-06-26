import { Routes, Route, Navigate } from "react-router-dom";
import { ScrollText, Brain, BarChart3 } from "lucide-react";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Notes from "./pages/Notes.jsx";
import Chat from "./pages/Chat.jsx";
import Settings from "./pages/Settings.jsx";
import ComingSoon from "./pages/ComingSoon.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

function Protected({ children }) {
  return <ProtectedRoute>{children}</ProtectedRoute>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />

      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/settings"  element={<Protected><Settings /></Protected>} />

      <Route path="/notes" element={<Protected><Notes /></Protected>} />
      <Route path="/chat"  element={<Protected><Chat /></Protected>} />

      {/* Placeholder routes for upcoming phases */}
      <Route path="/summaries" element={
        <Protected>
          <ComingSoon
            title="Summaries"
            icon={ScrollText}
            description="Instantly summarize any note or PDF with one click."
            phase="Phase 4"
          />
        </Protected>
      } />
      <Route path="/quizzes" element={
        <Protected>
          <ComingSoon
            title="Quiz Generator"
            icon={Brain}
            description="Auto-generate multiple-choice and short-answer quizzes from your material."
            phase="Phase 5"
          />
        </Protected>
      } />
      <Route path="/analytics" element={
        <Protected>
          <ComingSoon
            title="Analytics"
            icon={BarChart3}
            description="Visualise study streaks, quiz accuracy, and time spent on each subject."
            phase="Phase 6"
          />
        </Protected>
      } />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
