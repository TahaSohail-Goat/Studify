import { Routes, Route, Navigate } from "react-router-dom";
import { BookOpen, MessageSquare, ScrollText, Brain, BarChart3 } from "lucide-react";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
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

      {/* Placeholder routes for upcoming phases */}
      <Route path="/notes" element={
        <Protected>
          <ComingSoon
            title="My Notes"
            icon={BookOpen}
            description="Upload PDFs, images, and text notes to power your AI study assistant."
            phase="Phase 2"
          />
        </Protected>
      } />
      <Route path="/chat" element={
        <Protected>
          <ComingSoon
            title="AI Chat"
            icon={MessageSquare}
            description="Chat with your notes using Gemini AI — cited, accurate answers in seconds."
            phase="Phase 3"
          />
        </Protected>
      } />
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
