import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { api } from "../api";
import { useAuth } from "../AuthContext";

function SeverityBadge({ severity }) {
  return <span className={`severity ${severity}`}>{severity}</span>;
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

  const chartData = trend
    ? [...trend.points].reverse().map((p) => ({
        time: new Date(p.time).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        mood: p.mood,
        activity: p.activity,
      }))
    : [];

  return (
    <div>
      <button className="link-btn" onClick={onBack}>&larr; Back to triage</button>
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
    </div>
  );
}
