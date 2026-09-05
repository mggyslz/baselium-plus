import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../../../shared/api/client";
import { useAuth } from "../auth.context";
import type { ApiPayload } from "../../../shared/types/models";
import { HeartPulse, Mail, Lock, User, Eye, EyeOff, AlertCircle, HeartHandshake, Stethoscope, Users } from "lucide-react";

export default function Signup() {
  const [role, setRole] = useState<"elder" | "caregiver">("elder");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [relationship, setRelationship] = useState("");

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload: ApiPayload = { email, password, role, full_name: fullName };
      if (role === "caregiver") payload.relationship = relationship;
      const data = await api.signup(payload);
      login(data);
      navigate("/");
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please check your information.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {/* Brand Header */}
        <div className="auth-brand">
          <div className="auth-brand-logo">
            <HeartPulse size={28} />
          </div>
          <h1>Create an Account</h1>
          <p>Join Baselium+ Behavioral Monitoring</p>
        </div>

        <form className="stack" onSubmit={handleSubmit} style={{ gap: 16 }}>
          {/* Visual Role Cards */}
          <div>
            <label id="role-select-label" style={{ fontWeight: 600 }}>
              Select Account Role
            </label>
            <div className="role-card-grid" role="radiogroup" aria-labelledby="role-select-label">
              <button
                type="button"
                role="radio"
                aria-checked={role === "elder"}
                className={`role-card ${role === "elder" ? "selected" : ""}`}
                onClick={() => setRole("elder")}
              >
                <div className="role-card-icon">
                  <HeartHandshake size={22} />
                </div>
                <div className="role-card-title">Elder</div>
                <div className="role-card-desc">Daily check-ins</div>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={role === "caregiver"}
                className={`role-card ${role === "caregiver" ? "selected" : ""}`}
                onClick={() => setRole("caregiver")}
              >
                <div className="role-card-icon">
                  <Stethoscope size={22} />
                </div>
                <div className="role-card-title">Caregiver</div>
                <div className="role-card-desc">Triage alerts</div>
              </button>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="signup-name">Full Name</label>
            <div className="input-icon-wrapper">
              <span className="input-icon-prefix">
                <User size={16} />
              </span>
              <input
                id="signup-name"
                className="input-with-prefix"
                placeholder="Jane Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label htmlFor="signup-email">Email Address</label>
            <div className="input-icon-wrapper">
              <span className="input-icon-prefix">
                <Mail size={16} />
              </span>
              <input
                id="signup-email"
                type="email"
                className="input-with-prefix"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Password */}
          <div>
            <label htmlFor="signup-password">Password (min 8 characters)</label>
            <div className="input-icon-wrapper">
              <span className="input-icon-prefix">
                <Lock size={16} />
              </span>
              <input
                id="signup-password"
                type={showPassword ? "text" : "password"}
                className="input-with-prefix"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
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

          {/* Conditional Caregiver Relationship */}
          {role === "caregiver" && (
            <div>
              <label htmlFor="signup-rel">Relationship to Elder</label>
              <input
                id="signup-rel"
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                placeholder="e.g. daughter, primary nurse"
              />
            </div>
          )}

          {error && (
            <div className="error" style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="submit-btn-large" disabled={loading}>
            {loading ? "Creating Account…" : "Create Account ✨"}
          </button>
        </form>

        <p className="muted" style={{ marginTop: 24, textAlign: "center", fontSize: 13 }}>
          Already have an account? <Link to="/login" style={{ fontWeight: 600, color: "var(--primary)" }}>Log in</Link>
        </p>
      </div>
    </div>
  );
}
