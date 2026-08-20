import { useEffect, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";

export default function FamilyStatus() {
  const { session } = useAuth();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.familyStatus(session.token).then(setStatus).catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="container" style={{ maxWidth: 480 }}>
        <div className="card"><div className="error">{error}</div></div>
      </div>
    );
  }

  if (!status) return <div className="container">Loading…</div>;

  return (
    <div className="container" style={{ maxWidth: 480 }}>
      <div className="card">
        <h2>{status.elder_name}</h2>
        <p className="muted">
          You have read-only access. You'll only see high-priority alerts here — detailed
          check-in history stays with {status.elder_name}'s caregivers.
        </p>
        <div style={{ marginTop: 16 }}>
          <div className="spread">
            <span>Last check-in</span>
            <strong>{status.last_checkin ? new Date(status.last_checkin).toLocaleString() : "No check-ins yet"}</strong>
          </div>
          <div className="spread" style={{ marginTop: 10 }}>
            <span>Open high-priority alerts</span>
            <strong style={{ color: status.open_high_severity_alerts > 0 ? "var(--high)" : "var(--ok)" }}>
              {status.open_high_severity_alerts}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}
