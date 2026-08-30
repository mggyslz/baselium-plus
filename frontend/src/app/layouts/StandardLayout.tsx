import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../features/auth/auth.context";

export function StandardLayout({ children }: { children: ReactNode }) {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="app-shell">
      <div className="topbar">
        <h1>Baselium+</h1>
        <div className="row">
          <span className="role-badge">{session?.role}</span>
          <button className="secondary" onClick={() => { logout(); navigate("/login"); }}>Log out</button>
        </div>
      </div>
      {children}
    </div>
  );
}
