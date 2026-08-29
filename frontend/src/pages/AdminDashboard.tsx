import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { useAuth } from "../AuthContext";
import { useNavigate } from "react-router-dom";
import type { AdminAccount, AdminAuditLog, AdminElder, AdminOverview } from "../types";
import {
  BarChart3,
  Users,
  HeartPulse,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  RefreshCw,
} from "lucide-react";

export default function AdminDashboard() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [overview, setOverview] = useState<AdminOverview>({});
  const [accounts, setAccounts] = useState<AdminAccount[]>([]);
  const [auditLogs, setAuditLogs] = useState<AdminAuditLog[]>([]);
  const [elders, setElders] = useState<AdminElder[]>([]);
  const [auditQuery, setAuditQuery] = useState("");
  const [elderQuery, setElderQuery] = useState("");
  const [form, setForm] = useState<{ elder_user_id: number | ""; caregiver_id: number | "" }>({ elder_user_id: "", caregiver_id: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function load() {
    try {
      setIsLoading(true);
      setError("");
      const [o, a, logs, elderRows] = await Promise.all([
        api.adminOverview(session.token),
        api.adminAccounts(session.token),
        api.adminAuditLogs(session.token),
        api.adminElders(session.token),
      ]);
      setOverview(o || {});
      setAccounts(a || []);
      setAuditLogs(logs || []);
      setElders(elderRows || []);
    } catch (err: any) {
      setError(err.message || "Failed to load admin dataset.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function assign(e: React.FormEvent) {
    e.preventDefault(); setError(""); setMessage("");
    try {
      await api.adminAssign(session.token, form);
      setMessage("Caregiver assigned successfully."); setForm({ elder_user_id: "", caregiver_id: "" }); load();
    } catch (err: any) { setError(err.message); }
  }

  const filteredAuditLogs = useMemo(() => {
    const query = auditQuery.trim().toLowerCase();
    return query
      ? (auditLogs || []).filter((log) =>
          [log.action, log.account_email, log.target_type, log.target_id].join(" ").toLowerCase().includes(query)
        )
      : auditLogs || [];
  }, [auditLogs, auditQuery]);

  const filteredElders = useMemo(() => {
    const query = elderQuery.trim().toLowerCase();
    return query
      ? (elders || []).filter((elder) =>
          [
            elder.full_name,
            elder.user_id,
            ...((elder.caregivers || []).map((caregiver) => caregiver?.full_name || "")),
          ]
            .join(" ")
            .toLowerCase()
            .includes(query)
        )
      : elders || [];
  }, [elders, elderQuery]);

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="app-sidebar-layout">
      {/* Mobile Backdrop */}
      {mobileOpen && <div className="mobile-overlay" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar Navigation */}
      <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <ShieldCheck size={24} color="var(--primary)" />
            Baselium+
            <span className="sidebar-brand-badge">Admin</span>
          </div>
        </div>

        <nav className="sidebar-nav" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "overview"}
            className={`sidebar-item ${tab === "overview" ? "active" : ""}`}
            onClick={() => { setTab("overview"); setMobileOpen(false); }}
          >
            <BarChart3 size={18} />
            <span>System Overview</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === "accounts"}
            className={`sidebar-item ${tab === "accounts" ? "active" : ""}`}
            onClick={() => { setTab("accounts"); setMobileOpen(false); }}
          >
            <Users size={18} />
            <span>Accounts & Assign</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === "elders"}
            className={`sidebar-item ${tab === "elders" ? "active" : ""}`}
            onClick={() => { setTab("elders"); setMobileOpen(false); }}
          >
            <HeartPulse size={18} />
            <span>Elder Activity View</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === "audit"}
            className={`sidebar-item ${tab === "audit" ? "active" : ""}`}
            onClick={() => { setTab("audit"); setMobileOpen(false); }}
          >
            <ShieldCheck size={18} />
            <span>Audit Log Explorer</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar" style={{ background: "#fef3c7", color: "#92400e" }}>
              {(session.full_name || session.email || "A")[0].toUpperCase()}
            </div>
            <div className="user-info">
              <span className="user-name">{session.full_name || session.email}</span>
              <span className="user-role">Administrator</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <main className="main-workspace">
        <header className="workspace-topbar">
          <div className="workspace-title">
            <h1>
              {tab === "overview" ? "System Overview" : tab === "accounts" ? "Account Management & Assignments" : tab === "elders" ? "Elder Activity & Caregiver Partners" : "Audit Log Explorer"}
            </h1>
            <p className="workspace-subtitle">
              {tab === "overview" ? "System-wide metrics and role breakdown" : tab === "accounts" ? "Manage user accounts and administrative assignments" : tab === "elders" ? "Seven-day check-in activity and caregiver partnerships" : "DPA compliance log auditing and access tracking"}
            </p>
          </div>
          <button className="mobile-nav-toggle" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle Navigation">
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        <div className="container" style={{ paddingTop: 20 }}>
          {error && <div className="error-banner"><span>{error}</span><button className="secondary" onClick={load}><RefreshCw size={14} /> Retry</button></div>}
          {message && <div className="success" style={{ marginBottom: 12 }}>{message}</div>}

          {isLoading ? (
            <div className="card"><div className="loading-container"><span className="spinner" /><span>Loading system data…</span></div></div>
          ) : (
            <>
              {tab === "overview" && (
                <div className="card">
                  <h2>System statistics</h2>
                  <div className="stats-grid" style={{ marginTop: 16 }}>
                    {[
                      ["Elder Accounts", overview.elder, "#2563eb"],
                      ["Caregivers", overview.caregiver, "#0284c7"],
                      ["Family Viewers", overview.family, "#0d9488"],
                      ["Active Assignments", overview.assignments, "#16a34a"],
                      ["Open Alerts", overview.open_alerts, "#dc2626"],
                    ].map(([label, value, color]) => (
                      <div className="stat" key={label as string} style={{ borderLeft: `4px solid ${color}` }}>
                        <strong style={{ color: color as string }}>{value ?? "–"}</strong>
                        <span>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "accounts" && (
                <div className="management-grid">
                  <div className="card">
                    <h2>Assign caregiver to elder</h2>
                    <form className="stack" onSubmit={assign}>
                      <div>
                        <label htmlFor="admin-elder-id">Elder user ID</label>
                        <input id="admin-elder-id" type="number" min="1" required value={form.elder_user_id} onChange={(e) => setForm({ ...form, elder_user_id: Number(e.target.value) })} />
                      </div>
                      <div>
                        <label htmlFor="admin-caregiver-id">Caregiver ID</label>
                        <input id="admin-caregiver-id" type="number" min="1" required value={form.caregiver_id} onChange={(e) => setForm({ ...form, caregiver_id: Number(e.target.value) })} />
                      </div>
                      <button type="submit">Save assignment</button>
                    </form>
                  </div>

                  <div className="card">
                    <h2>System accounts</h2>
                    <p className="muted">Latest 200 accounts registered in the database.</p>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr><th>ID</th><th>Email</th><th>Role</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {accounts.map((a) => (
                            <tr key={a.account_id}>
                              <td>#{a.account_id}</td>
                              <td>{a.email}</td>
                              <td><span className="role-badge">{a.Role || (a as any).role || "—"}</span></td>
                              <td>{a.active ? <span style={{ color: "var(--ok)", fontWeight: 600 }}>Active</span> : <span className="muted">Inactive</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {tab === "elders" && (
                <section className="card elder-view-card" aria-labelledby="elder-view-title">
                  <div className="spread audit-heading">
                    <div>
                      <h2 id="elder-view-title">Elder activity view</h2>
                      <p className="muted">Seven-day check-in trends and active caregiver assignments.</p>
                    </div>
                    <button className="secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label htmlFor="elder-search">Search elder or caregiver partner</label>
                    <input id="elder-search" className="audit-search" value={elderQuery} onChange={(e) => setElderQuery(e.target.value)} placeholder="Search by name, ID, or caregiver..." />
                    <p className="muted audit-result-count">Showing {filteredElders.length} of {elders.length} elders</p>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>Elder</th><th>Last check-in</th><th>Check-ins</th><th>7-day averages</th><th>Open alerts</th><th>Caregivers</th></tr>
                      </thead>
                      <tbody>
                        {filteredElders.map((elder) => (
                          <tr key={elder.user_id}>
                            <td><strong>{elder.full_name}</strong><div className="muted">ID #{elder.user_id}</div></td>
                            <td className="muted">{elder.last_checkin ? new Date(elder.last_checkin).toLocaleString() : "Never"}</td>
                            <td>{elder.checkins_last_7_days} <span className="muted">in 7d</span><div className="muted">{elder.total_checkins} total</div></td>
                            <td>{elder.avg_mood_last_7_days != null ? <><div>Mood: {elder.avg_mood_last_7_days.toFixed(1)}/5</div><div>Activity: {elder.avg_activity_last_7_days?.toFixed(1) ?? "–"}/5</div></> : <span className="muted">No data yet</span>}</td>
                            <td>{elder.open_alert_count > 0 ? <span className="admin-alert-count">{elder.open_alert_count} open</span> : <span className="muted">None</span>}</td>
                            <td>
                              {elder.caregivers && elder.caregivers.length > 0 ? (
                                <div className="partner-list">
                                  {elder.caregivers.map((c) => (
                                    <span className="partner-tag" key={c.caregiver_id}>{c.full_name}</span>
                                  ))}
                                </div>
                              ) : (
                                <span className="muted">Unassigned</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredElders.length === 0 && <div className="empty-state">No elders match that search query.</div>}
                </section>
              )}

              {tab === "audit" && (
                <section className="card audit-log-card" aria-labelledby="audit-log-title">
                  <div className="spread audit-heading">
                    <div>
                      <h2 id="audit-log-title">Audit log explorer</h2>
                      <p className="muted">Recorded system actions for security and compliance audit compliance.</p>
                    </div>
                    <button className="secondary" onClick={load}><RefreshCw size={14} /> Refresh</button>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label htmlFor="audit-search">Search actions, accounts, or targets</label>
                    <input id="audit-search" className="audit-search" value={auditQuery} onChange={(e) => setAuditQuery(e.target.value)} placeholder="e.g. acknowledge, user@example.com, health_note" />
                    <p className="muted audit-result-count">Showing {filteredAuditLogs.length} of {auditLogs.length} entries</p>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr><th>When</th><th>Account</th><th>Action</th><th>Target</th></tr>
                      </thead>
                      <tbody>
                        {filteredAuditLogs.map((log) => (
                          <tr key={log.log_id}>
                            <td className="muted"><time dateTime={log.created_at}>{new Date(log.created_at).toLocaleString()}</time></td>
                            <td>{log.account_email || "System"}</td>
                            <td><code className="audit-action">{log.action}</code></td>
                            <td className="muted">{log.target_type ? `${log.target_type}${log.target_id ? ` #${log.target_id}` : ""}` : "–"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredAuditLogs.length === 0 && <div className="empty-state">No audit log entries match that search query.</div>}
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
