import { createContext, useContext, useState, type ReactNode } from "react";
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
