import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import type { AdminAccount, AdminAuditLog, AdminElder, AdminOverview } from "../types";

export default function AdminDashboard() {
  const { session } = useAuth();
  const [overview, setOverview] = useState<AdminOverview>({});
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [elders, setElders] = useState<AdminElder[]>([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [elderQuery, setElderQuery] = useState("");
  const [form, setForm] = useState<{ elder_user_id: number | ""; caregiver_id: number | "" }>({ elder_user_id: "", caregiver_id: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const [o, a, logs, elderRows] = await Promise.all([api.adminOverview(session.token), api.adminAccounts(session.token), api.adminAuditLogs(session.token), api.adminElders(session.token)]);
      setOverview(o); setAccounts(a || []); setAuditLogs(logs || []); setElders(elderRows || []);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { load(); }, []);

  async function assign(e) {
    e.preventDefault(); setError("");
    try {
      await api.adminAssign(session.token, form);
      setMessage("Caregiver assigned successfully."); setForm({ elder_user_id: "", caregiver_id: "" }); load();
    } catch (err) { setError(err.message); }
  }

  const filteredAuditLogs = useMemo(() => {
    const query = auditQuery.trim().toLowerCase();
    return query ? auditLogs.filter((log) => [log.action, log.account_email, log.target_type, log.target_id].join(" ").toLowerCase().includes(query)) : auditLogs;
  }, [auditLogs, auditQuery]);
  const filteredElders = useMemo(() => {
    const query = elderQuery.trim().toLowerCase();
    return query ? elders.filter((elder) => [elder.full_name, elder.user_id, ...elder.caregivers.map((caregiver) => caregiver.full_name)].join(" ").toLowerCase().includes(query)) : elders;
  }, [elders, elderQuery]);

  return <div className="container">
    <div className="card"><h2>System overview</h2><div className="stats-grid">{[["Elders", overview.elder], ["Caregivers", overview.caregiver], ["Family viewers", overview.family], ["Active assignments", overview.assignments], ["Open alerts", overview.open_alerts]].map(([label, value]) => <div className="stat" key={label as string}><strong>{value ?? "–"}</strong><span>{label}</span></div>)}</div></div>
    <div className="management-grid">
      <div className="card"><h2>Assign caregiver to elder</h2><form className="stack" onSubmit={assign}><div><label>Elder user ID</label><input type="number" min="1" required value={form.elder_user_id} onChange={e => setForm({ ...form, elder_user_id: Number(e.target.value) })} /></div><div><label>Caregiver ID</label><input type="number" min="1" required value={form.caregiver_id} onChange={e => setForm({ ...form, caregiver_id: Number(e.target.value) })} /></div><button>Save assignment</button></form></div>
      <div className="card"><h2>Accounts</h2><p className="muted">Latest 200 accounts; use this as the system oversight view.</p><div className="table-scroll"><table><thead><tr><th>ID</th><th>Email</th><th>Role</th><th>Status</th></tr></thead><tbody>{accounts.map(a => <tr key={a.account_id}><td>{a.account_id}</td><td>{a.email}</td><td>{a.Role}</td><td>{a.active ? "Active" : "Inactive"}</td></tr>)}</tbody></table></div></div>
    </div>
    <section className="card elder-view-card" aria-labelledby="elder-view-title">
      <div className="spread audit-heading"><div><h2 id="elder-view-title">Elder view</h2><p className="muted">Seven-day activity statistics and active caregiver partnerships for every elder.</p></div><button className="secondary" onClick={load}>Refresh</button></div>
      <label htmlFor="elder-search">Search elder or caregiver partner</label>
      <input id="elder-search" className="audit-search" value={elderQuery} onChange={(e) => setElderQuery(e.target.value)} placeholder="Search by name, ID, or caregiver" />
      <p className="muted audit-result-count">Showing {filteredElders.length} of {elders.length} elders</p>
      <div className="table-scroll"><table><thead><tr><th>Elder</th><th>Last check-in</th><th>Check-ins</th><th>7-day averages</th><th>Open alerts</th><th>Caregiver partners</th></tr></thead><tbody>{filteredElders.map((elder) => <tr key={elder.user_id}><td><strong>{elder.full_name}</strong><div className="muted">ID #{elder.user_id}</div></td><td className="muted">{elder.last_checkin ? new Date(elder.last_checkin).toLocaleString() : "Never"}</td><td>{elder.checkins_last_7_days} <span className="muted">in 7d</span><div className="muted">{elder.total_checkins} total</div></td><td>{elder.avg_mood_last_7_days !== undefined ? <><div>Mood {elder.avg_mood_last_7_days.toFixed(1)}</div><div>Activity {elder.avg_activity_last_7_days?.toFixed(1) ?? "–"}</div></> : <span className="muted">No data yet</span>}</td><td>{elder.open_alert_count > 0 ? <span className="admin-alert-count">{elder.open_alert_count} open</span> : <span className="muted">None</span>}</td><td>{elder.caregivers.length ? <div className="partner-list">{elder.caregivers.map((caregiver) => <span className="partner-tag" key={caregiver.caregiver_id}>{caregiver.full_name}</span>)}</div> : <span className="muted">Unassigned</span>}</td></tr>)}</tbody></table></div>
      {filteredElders.length === 0 && <div className="empty-state">No elders match that search.</div>}
    </section>
    <section className="card audit-log-card" aria-labelledby="audit-log-title">
      <div className="spread audit-heading"><div><h2 id="audit-log-title">Audit log</h2><p className="muted">Most recent 200 recorded system actions. Viewing this log is recorded.</p></div><button className="secondary" onClick={load}>Refresh</button></div>
      <label htmlFor="audit-search">Search actions, accounts, or targets</label>
      <input id="audit-search" className="audit-search" value={auditQuery} onChange={(e) => setAuditQuery(e.target.value)} placeholder="e.g. acknowledge, jane@example.com, health_note" />
      <p className="muted audit-result-count">Showing {filteredAuditLogs.length} of {auditLogs.length} entries</p>
      <div className="table-scroll"><table><thead><tr><th>When</th><th>Account</th><th>Action</th><th>Target</th></tr></thead><tbody>{filteredAuditLogs.map((log) => <tr key={log.log_id}><td className="muted"><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time></td><td>{log.account_email || "System"}</td><td><code className="audit-action">{log.action}</code></td><td className="muted">{log.target_type ? `${log.target_type}${log.target_id ? ` #${log.target_id}` : ""}` : "–"}</td></tr>)}</tbody></table></div>
      {filteredAuditLogs.length === 0 && <div className="empty-state">No audit log entries match that search.</div>}
    </section>
    {error && <div className="error">{error}</div>}{message && <div className="success">{message}</div>}
  </div>;
}
