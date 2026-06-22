import { useState } from "react";
import { Menu, Sun, Moon } from "lucide-react";
import Sidebar from "./Sidebar.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";

function getInitials(name = "") {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) || "?";
}

export default function AppLayout({ title, children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggle } = useTheme();
  const { user } = useAuth();

  return (
    <div className="app-root">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="app-main">
        {/* Top header */}
        <header className="app-header">
          <button
            className="header-menu-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={19} />
          </button>

          <span className="header-title">{title}</span>

          <div className="header-actions">
            <button
              className="theme-toggle"
              onClick={toggle}
              aria-label="Toggle theme"
              title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>

            <div className="header-avatar" title={user?.name}>
              {getInitials(user?.name)}
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
