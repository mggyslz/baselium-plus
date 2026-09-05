import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/auth.context";
import { HeartPulse, LogOut } from "lucide-react";

export function StandardLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();

  const userInitial = (session?.full_name || session?.email || "U")[0].toUpperCase();
  const roleDisplay = session?.role === "elder" ? "Senior" : session?.role === "family" ? "Family Viewer" : session?.role;

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <HeartPulse size={24} color="var(--primary)" />
          <h1>
            Baselium+
            <span className="topbar-brand-badge">{roleDisplay}</span>
          </h1>
        </div>
        <div className="topbar-user-section">
          <div className="user-pill" title={session?.email}>
            <div className="user-pill-avatar">{userInitial}</div>
            <span>{session?.full_name || session?.email}</span>
          </div>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              logout();
              navigate("/login");
            }}
            style={{ padding: "7px 12px", fontSize: 13 }}
            aria-label="Log out"
          >
            <LogOut size={15} />
            <span>Log out</span>
          </button>
        </div>
      </header>
      <main style={{ flex: 1 }}>{children}</main>
    </div>
  );
}
