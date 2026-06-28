import { Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Signup from "./pages/Signup.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Notes from "./pages/Notes.jsx";
import Chat from "./pages/Chat.jsx";
import Summaries from "./pages/Summaries.jsx";
import Quizzes from "./pages/Quizzes.jsx";
import Analytics from "./pages/Analytics.jsx";
import Settings from "./pages/Settings.jsx";
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

      <Route path="/notes"     element={<Protected><Notes /></Protected>} />
      <Route path="/chat"      element={<Protected><Chat /></Protected>} />
      <Route path="/summaries" element={<Protected><Summaries /></Protected>} />
      <Route path="/quizzes"   element={<Protected><Quizzes /></Protected>} />
      <Route path="/analytics" element={<Protected><Analytics /></Protected>} />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
