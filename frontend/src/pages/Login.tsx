import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { HeartPulse, Mail, Lock, Eye, EyeOff, AlertCircle, KeyRound } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login({ email, password });
      login(data);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Invalid credentials. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("secret123");
    setError("");
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-brand-logo">
            <HeartPulse size={28} />
          </div>
          <h1>Log in to Baselium+</h1>
          <p>Elder Behavioral Monitoring & Triage System</p>
        </div>

        {/* Login Form */}
        <form className="stack" onSubmit={handleSubmit} style={{ gap: 16 }}>
          <div>
            <label htmlFor="login-email">Email Address</label>
            <div className="input-icon-wrapper">
              <span className="input-icon-prefix">
                <Mail size={16} />
              </span>
              <input
                id="login-email"
                type="email"
                className="input-with-prefix"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div>
            <label htmlFor="login-password">Password</label>
            <div className="input-icon-wrapper">
              <span className="input-icon-prefix">
                <Lock size={16} />
              </span>
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                className="input-with-prefix"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{ paddingRight: 40 }}
              />
              <button
                type="button"
                className="btn-eye-toggle"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="error" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="submit-btn-large" disabled={loading}>
            {loading ? "Logging in…" : "Log In"}
          </button>
        </form>

        {/* 1-Click Test Credentials Helper */}
        <div className="demo-creds-box">
          <div className="demo-creds-title">
            <KeyRound size={14} /> Quick Demo Accounts (Test Environment):
          </div>
          <div className="demo-creds-buttons">
            <button type="button" className="btn-demo-tag" onClick={() => fillDemo("elder1@test.com")}>
              Elder (elder1)
            </button>
            <button type="button" className="btn-demo-tag" onClick={() => fillDemo("caregiver1@test.com")}>
              Caregiver (caregiver1)
            </button>
            <button type="button" className="btn-demo-tag" onClick={() => fillDemo("family1@test.com")}>
              Family (family1)
            </button>
            <button type="button" className="btn-demo-tag" onClick={() => fillDemo("admin1@test.com")}>
              Admin (admin1)
            </button>
          </div>
        </div>

        <p className="muted" style={{ marginTop: 24, textAlign: "center", fontSize: 13 }}>
          Don't have an account yet? <Link to="/signup" style={{ fontWeight: 600, color: "var(--primary)" }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}
