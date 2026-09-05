import { useEffect, useState } from "react";
import { api } from "../../../shared/api/client";
import { useAuth } from "../../auth/auth.context";
import { HeartHandshake, ShieldCheck, AlertCircle, Clock, CheckCircle2, UserCheck } from "lucide-react";

export default function FamilyStatus() {
  const { session } = useAuth();
  const [status, setStatus] = useState<any>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api.familyStatus(session.token).then(setStatus).catch((err) => setError(err.message));
  }, [session.token]);

  if (error) {
    return (
      <div className="container" style={{ maxWidth: 540 }}>
        <div className="card">
          <div className="error" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="container" style={{ maxWidth: 540 }}>
        <div className="card">
          <div className="loading-container">
            <span className="spinner" />
            <span>Loading loved one's status…</span>
          </div>
        </div>
      </div>
    );
  }

  const isAllClear = status.open_high_severity_alerts === 0;

  return (
    <div className="container" style={{ maxWidth: 540 }}>
      {/* Peace of Mind Hero Card */}
      <div className="card" style={{ padding: "28px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <span className="role-badge" style={{ marginBottom: 6, display: "inline-block" }}>
              Family Care Circle
            </span>
            <h2 style={{ fontSize: 24, margin: 0, color: "var(--text)" }}>{status.elder_name}</h2>
          </div>
          <div
            style={{
              width: 46,
              height: 46,
              borderRadius: "50%",
              background: "var(--primary-light)",
              color: "var(--primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <HeartHandshake size={24} />
          </div>
        </div>

        <div className={`peace-card-hero ${isAllClear ? "good" : "attention"}`}>
          <div className="peace-card-hero-icon">
            {isAllClear ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
          </div>
          <div>
            <div className="peace-card-hero-title">
              {isAllClear ? "All is calm and steady" : "Care team is reviewing updates"}
            </div>
            <div className="peace-card-hero-desc">
              {isAllClear
                ? "Routine check-ins are normal and no urgent behavioral changes are flagged."
                : "Caregivers have been alerted and are currently attending to a pattern shift."}
            </div>
          </div>
        </div>

        {/* Status Metrics List */}
        <div style={{ marginTop: 20 }}>
          <div className="family-meta-row">
            <span className="family-meta-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={16} color="var(--muted)" /> Last check-in
            </span>
            <strong className="family-meta-val">
              {status.last_checkin
                ? new Date(status.last_checkin).toLocaleString(undefined, {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })
                : "No check-ins logged yet"}
            </strong>
          </div>

          <div className="family-meta-row">
            <span className="family-meta-label" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <ShieldCheck size={16} color="var(--muted)" /> Open high-priority alerts
            </span>
            <span
              className="family-meta-val"
              style={{
                color: status.open_high_severity_alerts > 0 ? "var(--high)" : "var(--ok)",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {status.open_high_severity_alerts > 0 ? (
                <span className="severity high">{status.open_high_severity_alerts}</span>
              ) : (
                <span className="severity low" style={{ background: "var(--ok-bg)", color: "var(--ok-text)", borderColor: "var(--ok-border)" }}>
                  None
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Respectful Privacy Boundary Note */}
        <div
          style={{
            marginTop: 22,
            padding: 14,
            background: "#f8fafc",
            borderRadius: 10,
            border: "1px solid #f1f5f9",
            fontSize: 13,
            color: "var(--muted)",
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 600, color: "#334155", marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
            <UserCheck size={15} color="var(--primary)" /> Family Viewer Information
          </div>
          You have read-only access. You'll only see high-priority alerts here — detailed check-in history stays with {status.elder_name}'s caregivers to respect their personal independence and clinical privacy.
        </div>
      </div>
    </div>
  );
}
