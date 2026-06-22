import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, BookOpen, MessageSquare, ScrollText,
  Brain, BarChart3, Settings, LogOut,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";

const NAV_ITEMS = [
  { to: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { to: "/notes",      icon: BookOpen,         label: "My Notes" },
  { to: "/chat",       icon: MessageSquare,    label: "AI Chat" },
  { to: "/summaries",  icon: ScrollText,       label: "Summaries" },
  { to: "/quizzes",    icon: Brain,            label: "Quizzes" },
  { to: "/analytics",  icon: BarChart3,        label: "Analytics" },
];

function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout } = useAuth();
  const { pathname } = useLocation();

  return (
    <aside className={`app-sidebar${isOpen ? " sidebar--open" : ""}`}>
      {/* Brand */}
      <div className="sidebar-brand">
        <div className="sidebar-brand__logo">S</div>
        <span className="sidebar-brand__name">Studyify</span>
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        <span className="nav-section-label">Menu</span>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <Link
            key={to}
            to={to}
            className={`nav-item${pathname === to ? " nav-item--active" : ""}`}
            onClick={onClose}
          >
            <Icon size={17} className="nav-item__icon" />
            {label}
          </Link>
        ))}

        <span className="nav-section-label" style={{ marginTop: 8 }}>Account</span>
        <Link
          to="/settings"
          className={`nav-item${pathname === "/settings" ? " nav-item--active" : ""}`}
          onClick={onClose}
        >
          <Settings size={17} className="nav-item__icon" />
          Settings
        </Link>
      </nav>

      {/* User + logout */}
      <div className="sidebar-bottom">
        <div className="sidebar-user">
          <div className="sidebar-user__avatar">{getInitials(user?.name)}</div>
          <div className="sidebar-user__info">
            <div className="sidebar-user__name">{user?.name || "User"}</div>
            <div className="sidebar-user__email">{user?.email || ""}</div>
          </div>
        </div>
        <button className="nav-item" onClick={logout} style={{ color: "var(--app-danger)" }}>
          <LogOut size={17} className="nav-item__icon" style={{ opacity: 1 }} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
