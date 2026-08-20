import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function Signup() {
  const [role, setRole] = useState("elder");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [relationship, setRelationship] = useState("");
  const [elderUserId, setElderUserId] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = { email, password, role, full_name: fullName };
      if (role === "caregiver") payload.relationship = relationship;
      if (role === "family") {
        payload.relationship = relationship;
        payload.elder_user_id = Number(elderUserId);
      }
      const data = await api.signup(payload);
      login(data);
      navigate("/");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <div className="card">
        <h2>Create an account</h2>
        <form className="stack" onSubmit={handleSubmit}>
          <div>
            <label>I am a</label>
            <select value={role} onChange={(e) => setRole(e.target.value)}>
              <option value="elder">Elder (submits check-ins)</option>
              <option value="caregiver">Caregiver</option>
              <option value="family">Family viewer</option>
            </select>
          </div>
          <div>
            <label>Full name</label>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          </div>
          <div>
            <label>Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div>
            <label>Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          {(role === "caregiver" || role === "family") && (
            <div>
              <label>Relationship to elder</label>
              <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="e.g. daughter, nurse" />
            </div>
          )}
          {role === "family" && (
            <div>
              <label>Elder's user ID</label>
              <input
                type="number"
                value={elderUserId}
                onChange={(e) => setElderUserId(e.target.value)}
                placeholder="Ask the elder's caregiver for this ID"
                required
              />
            </div>
          )}
          {error && <div className="error">{error}</div>}
          <button type="submit" disabled={loading}>{loading ? "Creating…" : "Create account"}</button>
        </form>
        <p className="muted" style={{ marginTop: 16 }}>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}
