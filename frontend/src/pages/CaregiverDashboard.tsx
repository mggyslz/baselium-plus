import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  ClockIcon,
  MessageSquareIcon,
  RefreshCwIcon,
  UserCheckIcon,
} from "../components/Icons";

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`severity ${severity}`}>
      <AlertTriangleIcon size={12} style={{ marginRight: 3, verticalAlign: "middle" }} />
      {severity}
    </span>
  );
}

function LoadingSpinner({ label = "Loading data…" }: { label?: string }) {
  return (
    <div className="loading-container" role="status">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function HealthNotes({ userId, token }: { userId: number; token: string }) {
  const [notes, setNotes] = useState<any[]>([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  async function loadNotes() {
    try {
      setError("");
      setIsLoading(true);
      const data = await api.healthNotes(token, userId);
      setNotes(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load health notes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadNotes(); }, [token, userId]);

  async function saveNote(e: React.FormEvent) {
    e.preventDefault();
    const note = draft.trim();
    if (!note) return;
    setIsSaving(true);
    setError("");
    try {
      await api.createHealthNote(token, userId, note);
      setDraft("");
      await loadNotes();
    } catch (err: any) {
      setError(err.message || "Failed to save note.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="card health-notes-card">
      <div className="spread notes-heading">
        <div>
          <h2>Health notes</h2>
          <p className="muted">Care team observations are visible to caregivers assigned to this elder.</p>
        </div>
        <span className="notes-count">{notes.length} {notes.length === 1 ? "note" : "notes"}</span>
      </div>
      <form className="health-note-form" onSubmit={saveNote}>
        <label htmlFor="health-note">Add a caregiver note</label>
        <textarea id="health-note" rows={4} maxLength={2000} value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Record an observation, care update, or follow-up action…" />
        <div className="note-form-footer">
          <span className="muted">{draft.length}/2000</span>
          <button type="submit" disabled={isSaving || !draft.trim()}>{isSaving ? "Saving…" : "Save note"}</button>
        </div>
      </form>
      {error && <div className="error">{error}</div>}
      {isLoading ? (
        <LoadingSpinner label="Loading notes…" />
      ) : (
        <div className="notes-list" aria-live="polite">
          {notes.length === 0 ? <div className="empty-state">No health notes yet. Add the first care observation above.</div> : notes.map((note) => (
            <article className="health-note" key={note.note_id}>
              <div className="spread"><strong>{note.caregiver_name}</strong><time className="muted" dateTime={note.created_at}>{new Date(note.created_at).toLocaleString()}</time></div>
              <p>{note.note_text}</p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionableAlertCard({
  alert,
  onAck,
  onReview,
}: {
  alert: any;
  onAck: (id: string) => void;
  onReview: (id: string, status: string) => void;
}) {
  const isResolved = alert.is_resolved;
  const severityClass = alert.severity?.toLowerCase() || "low";
  const elderNote = alert.notes || alert.context_note;

  return (
    <div className={`alert-card ${severityClass} ${isResolved ? "resolved" : ""}`}>
      <div className="alert-card-header">
        <div className="alert-type-title">
          <AlertTriangleIcon size={18} />
          {alert.anomaly_type ? alert.anomaly_type.replace(/_/g, " ") : "Pattern Change"}
        </div>
        <div className="row" style={{ gap: 8 }}>
          <SeverityBadge severity={alert.severity || "low"} />
          {alert.trend_direction && (
            <span className={`trend-tag ${alert.trend_direction}`}>
              {alert.trend_direction}
            </span>
          )}
        </div>
      </div>

      <div className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
        <ClockIcon size={14} />
        Detected: {new Date(alert.detected_at).toLocaleString()}
        {alert.duration_days && ` · Duration: ${alert.duration_days} day(s)`}
        {alert.deviation_magnitude && ` · Magnitude: ${alert.deviation_magnitude.toFixed(2)} σ`}
      </div>

      {elderNote && (
        <div className="alert-elder-note">
          <MessageSquareIcon size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Elder Note:</strong> "{elderNote}"
          </div>
        </div>
      )}

      <div className="alert-card-actions">
        {isResolved ? (
          <span style={{ color: "var(--ok)", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
            <CheckCircleIcon size={16} /> Acknowledged
          </span>
        ) : (
          <button className="secondary" style={{ background: "var(--primary)", color: "white" }} onClick={() => onAck(alert.anomaly_id)}>
            <UserCheckIcon size={14} /> Acknowledge Alert
          </button>
        )}

        {!alert.review_status && !isResolved && (
          <>
            <button className="secondary" onClick={() => onReview(alert.anomaly_id, "reviewed")}>
              Mark Reviewed
            </button>
            <button className="secondary" onClick={() => onReview(alert.anomaly_id, "false_positive")}>
              Flag False Positive
            </button>
          </>
        )}

        {alert.review_status && alert.review_status !== "open" && (
          <span className="muted" style={{ fontSize: 12 }}>
            Status: <strong>{alert.review_status.replace(/_/g, " ")}</strong>
          </span>
        )}
      </div>
    </div>
  );
}

function ElderDetail({ userId, onBack, token }: { userId: number; onBack: () => void; token: string }) {
  const [trend, setTrend] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    try {
      setIsLoading(true);
      setError("");
      const [t, a] = await Promise.all([
        api.trend(token, userId),
        api.alerts(token, userId),
      ]);
      setTrend(t);
      setAlerts(a || []);
    } catch (err: any) {
      setError(err.message || "Failed to load elder details.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, [userId]);

  async function ack(anomalyId: string) {
    try {
      await api.ackNotification(token, anomalyId);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function review(anomalyId: string, status: string) {
    try { await api.reviewAlert(token, anomalyId, status); load(); } catch (err: any) { setError(err.message); }
  }

  async function resetBaseline() {
    if (!window.confirm("Reset this elder's baseline? New check-ins will begin a fresh seven-day cold-start period.")) return;
    try { await api.resetBaseline(token, userId); load(); } catch (err: any) { setError(err.message); }
  }

  async function downloadReport() {
    try {
      const blob = await api.downloadReport(token, userId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `baselium-report-${userId}.xlsx`; link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) { setError(err.message); }
  }

  const chartData = trend
    ? [...trend.points].reverse().map((p) => ({
        time: new Date(p.time).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        mood: p.mood,
        activity: p.activity,
      }))
    : [];

  return (
    <div>
      <div className="spread">
        <button className="link-btn" onClick={onBack}>&larr; Back to triage</button>
        <div>
          <button className="secondary" onClick={downloadReport}>Download Excel report</button>{" "}
          <button className="secondary" onClick={resetBaseline}>Reset baseline</button>
        </div>
      </div>
      {error && (
        <div className="error-banner" style={{ marginTop: 12 }}>
          <span>{error}</span>
          <button className="secondary" onClick={load}><RefreshCwIcon size={14} /> Retry</button>
        </div>
      )}

      {isLoading ? (
        <div className="card" style={{ marginTop: 12 }}>
          <LoadingSpinner label="Loading elder metrics and trend chart…" />
        </div>
      ) : (
        <>
          <div className="card" style={{ marginTop: 12 }}>
            <h2>Trend (last 30 check-ins)</h2>
            {trend && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                  <XAxis dataKey="time" fontSize={12} />
                  <YAxis domain={[0, 5]} fontSize={12} />
                  <Tooltip />
                  <Legend />
                  {trend.baseline_mood > 0 && (
                    <ReferenceLine y={trend.baseline_mood} stroke="#93c5fd" strokeDasharray="4 4" label={{ value: "mood baseline", fontSize: 10, fill: "#93c5fd" }} />
                  )}
                  <Line type="monotone" dataKey="mood" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="activity" stroke="#16a34a" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">Not enough check-ins logged yet to chart.</div>
            )}
          </div>

          <div className="card">
            <h2>Alert history & actionable anomalies</h2>
            {alerts.length === 0 && <div className="empty-state">No behavioral anomalies detected for this elder.</div>}
            {alerts.length > 0 && (
              <div className="alert-card-grid">
                {alerts.map((a) => (
                  <ActionableAlertCard key={a.anomaly_id} alert={a} onAck={ack} onReview={review} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <HealthNotes userId={userId} token={token} />
    </div>
  );
}

export function AccessManagement({ token }: { token: string }) {
  const [assignForm, setAssignForm] = useState({ elder_user_id: "" });
  const [grantForm, setGrantForm] = useState({ elder_user_id: "", full_name: "", relationship: "", email: "", password: "" });
  const [members, setMembers] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [granting, setGranting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function loadMembers() {
    try {
      setIsLoading(true);
      setMembers((await api.familyMembers(token)) || []);
    } catch (err: any) {
      setError(err.message || "Failed to load family access list.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { loadMembers(); }, [token]);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setAssigning(true);
    try {
      await api.assignElder(token, Number(assignForm.elder_user_id));
      setSuccess("Elder assigned successfully.");
      setAssignForm({ elder_user_id: "" });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAssigning(false);
    }
  }

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSuccess(""); setGranting(true);
    try {
      await api.grantFamily(token, {
        elder_user_id: Number(grantForm.elder_user_id),
        full_name: grantForm.full_name,
        relationship: grantForm.relationship,
        email: grantForm.email,
        password: grantForm.password,
      });
      setSuccess("Family access granted.");
      setGrantForm({ elder_user_id: "", full_name: "", relationship: "", email: "", password: "" });
      loadMembers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGranting(false);
    }
  }

  async function revoke(familyId: number) {
    setError(""); setSuccess("");
    try {
      await api.revokeFamily(token, familyId);
      setSuccess("Access revoked.");
      loadMembers();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="management-grid">
        <div className="card">
          <h2>Assign an elder to yourself</h2>
          <form className="stack" onSubmit={assign}>
            <div>
              <label htmlFor="assign-elder-id">Elder user ID</label>
              <input
                id="assign-elder-id"
                type="number"
                min="1"
                required
                aria-label="Elder user ID to assign"
                value={assignForm.elder_user_id}
                onChange={(e) => setAssignForm({ ...assignForm, elder_user_id: e.target.value })}
              />
            </div>
            <button disabled={assigning}>{assigning ? "Assigning…" : "Assign elder"}</button>
          </form>
        </div>

        <div className="card">
          <h2>Grant family access</h2>
          <form className="stack" onSubmit={grant}>
            <div>
              <label htmlFor="grant-elder-id">Elder user ID</label>
              <input
                id="grant-elder-id"
                type="number"
                min="1"
                required
                aria-label="Elder user ID for grant access"
                value={grantForm.elder_user_id}
                onChange={(e) => setGrantForm({ ...grantForm, elder_user_id: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="grant-name">Family member's full name</label>
              <input id="grant-name" required aria-label="Family member's full name" value={grantForm.full_name} onChange={(e) => setGrantForm({ ...grantForm, full_name: e.target.value })} />
            </div>
            <div>
              <label htmlFor="grant-rel">Relationship to elder</label>
              <input id="grant-rel" aria-label="Relationship to elder" value={grantForm.relationship} onChange={(e) => setGrantForm({ ...grantForm, relationship: e.target.value })} placeholder="e.g. daughter" />
            </div>
            <div>
              <label htmlFor="grant-email">Email (login)</label>
              <input id="grant-email" type="email" required aria-label="Email (login)" value={grantForm.email} onChange={(e) => setGrantForm({ ...grantForm, email: e.target.value })} />
            </div>
            <div>
              <label htmlFor="grant-pw">Password (min 8 characters)</label>
              <input id="grant-pw" type="password" required minLength={8} aria-label="Password (min 8 characters)" value={grantForm.password} onChange={(e) => setGrantForm({ ...grantForm, password: e.target.value })} />
            </div>
            <button type="submit" disabled={granting}>{granting ? "Granting…" : "Grant access"}</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h2>Family members you've granted access</h2>
        {isLoading ? (
          <LoadingSpinner label="Loading granted family members…" />
        ) : members.length === 0 ? (
          <div className="empty-state">You haven't granted family access yet. Family members can be added with the form above.</div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Name</th><th>Relationship</th><th>Email</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>{m.full_name}</td>
                    <td className="muted">{m.relationship || "—"}</td>
                    <td className="muted">{m.email}</td>
                    <td>{m.is_active ? <span style={{ color: "var(--ok)" }}>Active</span> : <span className="muted">Revoked</span>}</td>
                    <td>{m.is_active && <button className="secondary" onClick={() => revoke(m.id)}>Revoke</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {error && <div className="error">{error}</div>}
      {success && <div className="success">{success}</div>}
    </div>
  );
}

export default function CaregiverDashboard() {
  const { session } = useAuth();
  const [tab, setTab] = useState("triage");
  const [triage, setTriage] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isLoadingTriage, setIsLoadingTriage] = useState(true);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(true);

  async function loadTriage() {
    try {
      setIsLoadingTriage(true);
      setError("");
      const data = await api.triage(session.token);
      setTriage(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load triage list.");
    } finally {
      setIsLoadingTriage(false);
    }
  }

  async function loadNotifications() {
    try {
      setIsLoadingNotifs(true);
      const data = await api.notifications(session.token);
      setNotifications(data || []);
    } catch (err: any) {
      setError(err.message || "Failed to load notifications.");
    } finally {
      setIsLoadingNotifs(false);
    }
  }

  useEffect(() => {
    loadTriage();
    loadNotifications();
  }, []);

  useEffect(() => {
    const base = import.meta.env.VITE_API_URL || "http://localhost:8080";
    const wsURL = base.replace(/^http/, "ws") + "/api/notifications/live?token=" + encodeURIComponent(session.token);
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let socket: WebSocket;
    const connect = () => {
      socket = new WebSocket(wsURL);
      socket.onmessage = (event) => {
        try {
          const alert = JSON.parse(event.data);
          if (alert.type === "notification") {
            setError("");
            loadNotifications();
            loadTriage();
          }
        } catch { /* Ignore malformed live events */ }
      };
      socket.onclose = () => {
        if (!closed) reconnectTimer = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => { closed = true; if (reconnectTimer) clearTimeout(reconnectTimer); socket?.close(); };
  }, [session.token]);

  if (selectedUser) {
    return (
      <div className="container">
        <ElderDetail userId={selectedUser} token={session.token} onBack={() => { setSelectedUser(null); loadTriage(); loadNotifications(); }} />
      </div>
    );
  }

  return (
    <div className="container">
      <div className="nav-tabs" role="tablist">
        <button role="tab" aria-selected={tab === "triage"} className={tab === "triage" ? "active" : ""} onClick={() => setTab("triage")}>Triage</button>
        <button role="tab" aria-selected={tab === "notifications"} className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}>
          Notifications {notifications.filter((n) => !n.IsRead).length > 0 && `(${notifications.filter((n) => !n.IsRead).length})`}
        </button>
        <button role="tab" aria-selected={tab === "access"} className={tab === "access" ? "active" : ""} onClick={() => setTab("access")}>Access Management</button>
      </div>

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="secondary" onClick={() => { loadTriage(); loadNotifications(); }}><RefreshCwIcon size={14} /> Retry</button>
        </div>
      )}

      {tab === "triage" && (
        <div className="card">
          <h2>Your elders, worst-first</h2>
          {isLoadingTriage ? (
            <LoadingSpinner label="Loading assigned elders..." />
          ) : triage.length === 0 ? (
            <div className="empty-state">No elders assigned to you yet. Use the Access tab to assign elders.</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>Elder</th><th>Last check-in</th><th>Open alerts</th><th>Highest severity</th><th></th></tr>
                </thead>
                <tbody>
                  {triage.map((t) => (
                    <tr key={t.user_id}>
                      <td><strong>{t.full_name}</strong></td>
                      <td className="muted">{t.last_checkin ? new Date(t.last_checkin).toLocaleString() : "never"}</td>
                      <td>{t.open_anomaly_count}</td>
                      <td>{t.highest_open_severity ? <SeverityBadge severity={t.highest_open_severity} /> : <span className="muted">—</span>}</td>
                      <td><button className="secondary" onClick={() => setSelectedUser(t.user_id)}>View Details</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "notifications" && (
        <div className="card">
          <h2>Recent notifications</h2>
          {isLoadingNotifs ? (
            <LoadingSpinner label="Loading notifications..." />
          ) : notifications.length === 0 ? (
            <div className="empty-state">No notifications yet. All assigned elders are currently within normal baseline patterns.</div>
          ) : (
            <div className="table-scroll">
              <table>
                <thead><tr><th>When</th><th>Message</th><th>Status</th></tr></thead>
                <tbody>
                  {notifications.map((n) => (
                    <tr key={n.NotificationID}>
                      <td className="muted">{new Date(n.SentAt).toLocaleString()}</td>
                      <td>{n.Message}</td>
                      <td>{n.AcknowledgedAt ? <span style={{ color: "var(--ok)", fontWeight: 600 }}>Acked</span> : <span className="muted">Unread</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "access" && <AccessManagement token={session.token} />}
    </div>
  );
}
