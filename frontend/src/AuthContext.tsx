import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./api";
import type { Session } from "./types";

interface AuthContextValue { session: Session | null; login: (data: Session) => void; logout: () => void }
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem("baselium_session");
    return raw ? JSON.parse(raw) as Session : null;
  });

  function login(data: Session) {
    localStorage.setItem("baselium_session", JSON.stringify(data));
    setSession(data);
  }

  function logout() {
    localStorage.removeItem("baselium_session");
    setSession(null);
  }

  // Access JWTs last 15 minutes. Rotate shortly before expiry, preserving a
  // session without leaving a long-lived bearer token in use.
  useEffect(() => {
    if (!session?.refresh_token) return;
    const expiresAt = new Date(session.access_expires_at || 0).getTime();
    const delay = Math.max(0, expiresAt - Date.now() - 60_000);
    const timer = window.setTimeout(async () => {
      try { login(await api.refresh(session.refresh_token!)); }
      catch { logout(); }
    }, delay);
    return () => window.clearTimeout(timer);
  }, [session?.token, session?.refresh_token]);

  return (
    <AuthContext.Provider value={{ session, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
