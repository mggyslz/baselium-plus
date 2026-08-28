import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { api } from "../api";
import { useAuth } from "../AuthContext";

function SeverityBadge({ severity }) {
  return <span className={`severity ${severity}`}>{severity}</span>;
}

function HealthNotes({ userId, token }) {
  const [notes, setNotes] = useState([]);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function loadNotes() {
    try {
      setError("");
      setNotes((await api.healthNotes(token, userId)) || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadNotes(); }, [token, userId]);

  async function saveNote(e) {
    e.preventDefault();
    const note = draft.trim();
    if (!note) return;
    setIsSaving(true);
    setError("");
    try {
      await api.createHealthNote(token, userId, note);
      setDraft("");
      await loadNotes();
    } catch (err) {
      setError(err.message);
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
      <div className="notes-list" aria-live="polite">
        {notes.length === 0 ? <div className="empty-state">No health notes yet. Add the first care observation above.</div> : notes.map((note) => (
          <article className="health-note" key={note.note_id}>
            <div className="spread"><strong>{note.caregiver_name}</strong><time className="muted" dateTime={note.created_at}>{new Date(note.created_at).toLocaleString()}</time></div>
            <p>{note.note_text}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ElderDetail({ userId, onBack, token }) {
  const [trend, setTrend] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [error, setError] = useState("");

  async function load() {
    try {
      const [t, a] = await Promise.all([
        api.trend(token, userId),
        api.alerts(token, userId),
      ]);
      setTrend(t);
      setAlerts(a || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { load(); }, [userId]);

  async function ack(anomalyId) {
    try {
      await api.ackNotification(token, anomalyId);
      load();
    } catch (err) {
      setError(err.message);
    }
  }

  async function downloadReport() {
    try {
      const blob = await api.downloadReport(token, userId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `baselium-report-${userId}.xlsx`; link.click();
      URL.revokeObjectURL(url);
    } catch (err) { setError(err.message); }
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
      <div className="spread"><button className="link-btn" onClick={onBack}>&larr; Back to triage</button><button className="secondary" onClick={downloadReport}>Download Excel report</button></div>
      {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}

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
          <div className="empty-state">Not enough check-ins yet to chart.</div>
        )}
      </div>

      <div className="card">
        <h2>Alert history</h2>
        {alerts.length === 0 && <div className="empty-state">No anomalies detected for this elder.</div>}
        {alerts.length > 0 && (
          <table>
            <thead>
              <tr><th>When</th><th>Type</th><th>Severity</th><th>Detail</th><th>Status</th><th></th></tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.anomaly_id}>
                  <td>{new Date(a.detected_at).toLocaleString()}</td>
                  <td>{a.anomaly_type.replace("_", " ")}</td>
                  <td><SeverityBadge severity={a.severity} /></td>
                  <td className="muted">{a.deviation_metric} · {a.deviation_magnitude?.toFixed?.(2)} · {a.duration_days}d</td>
                  <td>{a.is_resolved ? <span style={{ color: "var(--ok)" }}>Acknowledged</span> : <span className="muted">Open</span>}</td>
                  <td>{!a.is_resolved && <button className="secondary" onClick={() => ack(a.anomaly_id)}>Acknowledge</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <HealthNotes userId={userId} token={token} />
    </div>
  );
}

export function AccessManagement({ token }) {
  const [assignForm, setAssignForm] = useState({ elder_user_id: "" });
  const [grantForm, setGrantForm] = useState({ elder_user_id: "", full_name: "", relationship: "", email: "", password: "" });
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [granting, setGranting] = useState(false);

  async function loadMembers() {
    try {
      setMembers((await api.familyMembers(token)) || []);
    } catch (err) {
      setError(err.message);
    }
  }

  useEffect(() => { loadMembers(); }, [token]);

  async function assign(e) {
    e.preventDefault();
    setError(""); setSuccess(""); setAssigning(true);
    try {
      await api.assignElder(token, Number(assignForm.elder_user_id));
      setSuccess("Elder assigned successfully.");
      setAssignForm({ elder_user_id: "" });
    } catch (err) {
      setError(err.message);
    } finally {
      setAssigning(false);
    }
  }

  async function grant(e) {
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
    } catch (err) {
      setError(err.message);
    } finally {
      setGranting(false);
    }
  }

  async function revoke(familyId) {
    setError(""); setSuccess("");
    try {
      await api.revokeFamily(token, familyId);
      setSuccess("Access revoked.");
      loadMembers();
    } catch (err) {
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
              <label>Elder user ID</label>
              <input
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
              <label>Elder user ID</label>
              <input
                type="number"
                min="1"
                required
                aria-label="Elder user ID for grant access"
                value={grantForm.elder_user_id}
                onChange={(e) => setGrantForm({ ...grantForm, elder_user_id: e.target.value })}
              />
            </div>
            <div>
              <label>Family member's full name</label>
              <input required aria-label="Family member's full name" value={grantForm.full_name} onChange={(e) => setGrantForm({ ...grantForm, full_name: e.target.value })} />
            </div>
            <div>
              <label>Relationship to elder</label>
              <input aria-label="Relationship to elder" value={grantForm.relationship} onChange={(e) => setGrantForm({ ...grantForm, relationship: e.target.value })} placeholder="e.g. daughter" />
            </div>
            <div>
              <label>Email (login)</label>
              <input type="email" required aria-label="Email (login)" value={grantForm.email} onChange={(e) => setGrantForm({ ...grantForm, email: e.target.value })} />
            </div>
            <div>
              <label>Password (min 8 characters)</label>
              <input type="password" required minLength={8} aria-label="Password (min 8 characters)" value={grantForm.password} onChange={(e) => setGrantForm({ ...grantForm, password: e.target.value })} />
            </div>
            <button type="submit" disabled={granting}>{granting ? "Granting…" : "Grant access"}</button>
          </form>
        </div>
      </div>

      <div className="card">
        <h2>Family members you've granted access</h2>
        {members.length === 0 && <div className="empty-state">You haven't granted family access yet. Family members can be added with the form above.</div>}
        {members.length > 0 && (
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
  const [triage, setTriage] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [error, setError] = useState("");

  async function loadTriage() {
    try {
      const data = await api.triage(session.token);
      setTriage(data || []);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadNotifications() {
    try {
      const data = await api.notifications(session.token);
      setNotifications(data || []);
    } catch (err) {
      setError(err.message);
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
        } catch { /* Ignore malformed live events; REST stays authoritative. */ }
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
      <div className="nav-tabs">
        <button className={tab === "triage" ? "active" : ""} onClick={() => setTab("triage")}>Triage</button>
        <button className={tab === "notifications" ? "active" : ""} onClick={() => setTab("notifications")}>
          Notifications {notifications.filter((n) => !n.IsRead).length > 0 && `(${notifications.filter((n) => !n.IsRead).length})`}
        </button>
        <button className={tab === "access" ? "active" : ""} onClick={() => setTab("access")}>Access</button>
      </div>
      {error && <div className="error">{error}</div>}

      {tab === "triage" && (
        <div className="card">
          <h2>Your elders, worst-first</h2>
          {triage.length === 0 && <div className="empty-state">No elders assigned to you yet.</div>}
          {triage.length > 0 && (
            <table>
              <thead>
                <tr><th>Elder</th><th>Last check-in</th><th>Open alerts</th><th>Highest severity</th><th></th></tr>
              </thead>
              <tbody>
                {triage.map((t) => (
                  <tr key={t.user_id}>
                    <td>{t.full_name}</td>
                    <td className="muted">{t.last_checkin ? new Date(t.last_checkin).toLocaleString() : "never"}</td>
                    <td>{t.open_anomaly_count}</td>
                    <td>{t.highest_open_severity ? <SeverityBadge severity={t.highest_open_severity} /> : <span className="muted">—</span>}</td>
                    <td><button className="secondary" onClick={() => setSelectedUser(t.user_id)}>View</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "notifications" && (
        <div className="card">
          <h2>Recent notifications</h2>
          {notifications.length === 0 && <div className="empty-state">No notifications yet.</div>}
          {notifications.length > 0 && (
            <table>
              <thead><tr><th>When</th><th>Message</th><th>Status</th></tr></thead>
              <tbody>
                {notifications.map((n) => (
                  <tr key={n.NotificationID}>
                    <td className="muted">{new Date(n.SentAt).toLocaleString()}</td>
                    <td>{n.Message}</td>
                    <td>{n.AcknowledgedAt ? <span style={{ color: "var(--ok)" }}>Acked</span> : <span className="muted">Unread</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === "access" && <AccessManagement token={session.token} />}
    </div>
  );
}
