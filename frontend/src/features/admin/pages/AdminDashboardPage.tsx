import { useEffect, useMemo, useState } from "react";
import { api } from "../../../shared/api/client";
import { useAuth } from "../../auth/auth.context";
import { useNavigate } from "react-router-dom";
import { ElderDetail, ElderProfileCardsView } from "../../elder-profiles/components/ElderProfileViews";
import type { AdminAccount, AdminAuditLog, AdminElder, AdminOverview } from "../../../shared/types/models";
import {
  BarChart3,
  Users,
  HeartPulse,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  RefreshCw,
  Search,
  UserPlus,
  Download,
  KeyRound,
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
  const [form, setForm] = useState<{ elder_user_id: number | ""; caregiver_id: number | "" }>({
    elder_user_id: "",
    caregiver_id: "",
  });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<number | null>(null);

  const [resetModal, setResetModal] = useState<{ isOpen: boolean; accountId: number; email: string }>({
    isOpen: false,
    accountId: 0,
    email: "",
  });
  const [newPassword, setNewPassword] = useState("");
  const [isSubmittingReset, setIsSubmittingReset] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<number | null>(null);

  async function handleToggleActive(accountId: number) {
    try {
      setActionLoadingId(accountId);
      setError("");
      setMessage("");
      const res = await api.adminToggleActive(session.token, accountId);
      setAccounts((prev) =>
        prev.map((a) => (a.account_id === accountId ? { ...a, active: res.is_active } : a))
      );
      setMessage(`Account #${accountId} status updated to ${res.is_active ? "Active" : "Deactivated"}.`);
    } catch (err: any) {
      setError(err.message || "Failed to toggle account active status.");
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    try {
      setIsSubmittingReset(true);
      setError("");
      await api.adminResetPassword(session.token, resetModal.accountId, newPassword);
      setMessage(`Password successfully reset for ${resetModal.email}.`);
      setResetModal({ isOpen: false, accountId: 0, email: "" });
      setNewPassword("");
    } catch (err: any) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setIsSubmittingReset(false);
    }
  }

  function exportAuditCSV() {
    const rows = [
      ["Log ID", "Date & Time", "Account Email", "Action", "Target Type", "Target ID"],
      ...filteredAuditLogs.map((log) => [
        log.log_id,
        new Date(log.created_at).toISOString(),
        log.account_email || "System",
        log.action,
        log.target_type || "",
        log.target_id ?? "",
      ]),
    ];
    const csvContent =
      "data:text/csv;charset=utf-8," +
      rows
        .map((e) => e.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(","))
        .join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `baselium-audit-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

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

  useEffect(() => {
    load();
  }, []);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await api.adminAssign(session.token, form);
      setMessage("Caregiver assigned successfully.");
      setForm({ elder_user_id: "", caregiver_id: "" });
      load();
    } catch (err: any) {
      setError(err.message);
    }
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
            onClick={() => {
              setTab("overview");
              setMobileOpen(false);
            }}
          >
            <BarChart3 size={18} />
            <span>System Overview</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === "accounts"}
            className={`sidebar-item ${tab === "accounts" ? "active" : ""}`}
            onClick={() => {
              setTab("accounts");
              setMobileOpen(false);
            }}
          >
            <Users size={18} />
            <span>Accounts & Assign</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === "elders"}
            className={`sidebar-item ${tab === "elders" ? "active" : ""}`}
            onClick={() => {
              setTab("elders");
              setMobileOpen(false);
            }}
          >
            <HeartPulse size={18} />
            <span>Senior Monitoring</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === "audit"}
            className={`sidebar-item ${tab === "audit" ? "active" : ""}`}
            onClick={() => {
              setTab("audit");
              setMobileOpen(false);
            }}
          >
            <ShieldCheck size={18} />
            <span>System History</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === "profiles"}
            className={`sidebar-item ${tab === "profiles" ? "active" : ""}`}
            onClick={() => {
              setTab("profiles");
              setSelectedProfile(null);
              setMobileOpen(false);
            }}
          >
            <HeartPulse size={18} />
            <span>Senior Directory</span>
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
              {selectedProfile
                ? "Senior Profile"
                : tab === "overview"
                ? "System Overview"
                : tab === "accounts"
                ? "Account Management & Assignments"
                : tab === "elders"
                ? "Senior Monitoring & Care Partners"
                : tab === "profiles"
                ? "Senior Directory"
                : "System History & Audit"}
            </h1>
            <p className="workspace-subtitle">
              {selectedProfile
                ? "View longitudinal trends and alert history for administrative oversight"
                : tab === "overview"
                ? "Platform-wide health metrics and user role breakdown"
                : tab === "accounts"
                ? "Manage platform accounts and administrative elder-caregiver linkages"
                : tab === "elders"
                ? "Seven-day check-in activity and caregiver partnerships"
                : tab === "profiles"
                ? "Browse all registered senior profiles"
                : "System actions and compliance access logs"}
            </p>
          </div>
          <button
            className="mobile-nav-toggle"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle Navigation"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </header>

        <div className="container" style={{ paddingTop: 20 }}>
          {error && (
            <div className="error-banner">
              <span>{error}</span>
              <button className="secondary" onClick={load}>
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}
          {message && (
            <div className="success" style={{ marginBottom: 14 }}>
              {message}
            </div>
          )}

          {selectedProfile ? (
            <ElderDetail
              userId={selectedProfile}
              token={session.token}
              readOnly
              onBack={() => setSelectedProfile(null)}
            />
          ) : isLoading ? (
            <div className="card">
              <LoadingSpinner label="Loading system administration data…" />
            </div>
          ) : (
            <>
              {tab === "overview" && (
                <div className="card">
                  <h2>System overview statistics</h2>
                  <p className="muted">Key platform adoption and operational health metrics.</p>
                  <div className="stats-grid" style={{ marginTop: 16 }}>
                    {[
                      ["Senior Accounts", overview.elder, "var(--primary)"],
                      ["Caregivers", overview.caregiver, "#0284c7"],
                      ["Family Viewers", overview.family, "#0d9488"],
                      ["Active Assignments", overview.assignments, "var(--ok)"],
                      ["Open Alerts", overview.open_alerts, "var(--high)"],
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
                    <h2>
                      <UserPlus size={18} style={{ marginRight: 6, verticalAlign: "middle" }} />
                      Assign caregiver to senior
                    </h2>
                    <p className="muted">Establish a primary caregiving assignment link.</p>
                    <form className="stack" onSubmit={assign}>
                      <div>
                        <label htmlFor="admin-elder-id">Senior</label>
                        <select
                          id="admin-elder-id"
                          required
                          value={form.elder_user_id}
                          onChange={(e) => setForm({ ...form, elder_user_id: Number(e.target.value) })}
                        >
                          <option value="" disabled>
                            Select a senior
                          </option>
                          {elders.map((e) => (
                            <option key={e.user_id} value={e.user_id}>
                              {e.full_name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label htmlFor="admin-caregiver-id">Caregiver</label>
                        <select
                          id="admin-caregiver-id"
                          required
                          value={form.caregiver_id}
                          onChange={(e) => setForm({ ...form, caregiver_id: Number(e.target.value) })}
                        >
                          <option value="" disabled>
                            Select a caregiver
                          </option>
                          {accounts
                            .filter((a) => a.Role === "caregiver" || (a as any).role === "caregiver")
                            .map((a) => (
                              <option key={a.account_id} value={a.account_id}>
                                {a.email}
                              </option>
                            ))}
                        </select>
                      </div>
                      <button type="submit">Save assignment</button>
                    </form>
                  </div>

                  <div className="card">
                    <h2>Platform accounts</h2>
                    <p className="muted">Registered user accounts across all roles.</p>
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>Account</th>
                            <th>Role</th>
                            <th>Status</th>
                            <th style={{ textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {accounts.map((a) => (
                            <tr key={a.account_id}>
                              <td>
                                <strong style={{ color: "var(--text)" }}>{a.email}</strong>
                              </td>
                              <td>
                                <span className="role-badge">{a.Role || (a as any).role || "—"}</span>
                              </td>
                              <td>
                                {a.active ? (
                                  <span style={{ color: "var(--ok)", fontWeight: 600, fontSize: 13 }}>Active</span>
                                ) : (
                                  <span className="muted">Inactive</span>
                                )}
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                                  <button
                                    type="button"
                                    className="secondary"
                                    disabled={actionLoadingId === a.account_id || a.account_id === session.account_id}
                                    onClick={() => handleToggleActive(a.account_id)}
                                    style={{ padding: "4px 8px", fontSize: 12 }}
                                    title={a.account_id === session.account_id ? "Cannot deactivate own admin account" : ""}
                                  >
                                    {a.active ? "Deactivate" : "Activate"}
                                  </button>
                                  <button
                                    type="button"
                                    className="secondary"
                                    onClick={() => {
                                      setResetModal({ isOpen: true, accountId: a.account_id, email: a.email });
                                      setNewPassword("");
                                    }}
                                    style={{ padding: "4px 8px", fontSize: 12, display: "inline-flex", alignItems: "center", gap: 4 }}
                                  >
                                    <KeyRound size={12} /> Reset PW
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {resetModal.isOpen && (
                      <div
                        style={{
                          position: "fixed",
                          inset: 0,
                          backgroundColor: "rgba(15, 23, 42, 0.5)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          zIndex: 100,
                          padding: 16,
                        }}
                      >
                        <div className="card" style={{ maxWidth: 400, width: "100%", margin: 0 }}>
                          <h3 style={{ marginTop: 0, fontSize: 18 }}>Reset Password</h3>
                          <p className="muted" style={{ fontSize: 13 }}>
                            Enter a new password for <strong>{resetModal.email}</strong>.
                          </p>
                          <form onSubmit={handleResetPassword} className="stack" style={{ gap: 14 }}>
                            <div>
                              <label htmlFor="new-admin-pw">New Password (min 8 characters)</label>
                              <input
                                id="new-admin-pw"
                                type="password"
                                required
                                minLength={8}
                                placeholder="••••••••"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                              />
                            </div>
                            <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => setResetModal({ isOpen: false, accountId: 0, email: "" })}
                              >
                                Cancel
                              </button>
                              <button type="submit" disabled={isSubmittingReset}>
                                {isSubmittingReset ? "Resetting…" : "Confirm Password"}
                              </button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {tab === "elders" && (
                <section className="card elder-view-card" aria-labelledby="elder-view-title">
                  <div className="spread audit-heading">
                    <div>
                      <h2 id="elder-view-title">Senior activity monitoring</h2>
                      <p className="muted">Seven-day check-in adherence and active caregiver assignments.</p>
                    </div>
                    <button className="secondary" onClick={load}>
                      <RefreshCw size={14} /> Refresh
                    </button>
                  </div>
                  <div style={{ marginTop: 14, marginBottom: 16 }}>
                    <label htmlFor="elder-search">Search senior or caregiver partner</label>
                    <div className="input-icon-wrapper">
                      <span className="input-icon-prefix">
                        <Search size={16} />
                      </span>
                      <input
                        id="elder-search"
                        className="input-with-prefix"
                        value={elderQuery}
                        onChange={(e) => setElderQuery(e.target.value)}
                        placeholder="Search by name or assigned caregiver..."
                      />
                    </div>
                    <p className="muted audit-result-count" style={{ marginTop: 8 }}>
                      Showing {filteredElders.length} of {elders.length} seniors
                    </p>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Senior</th>
                          <th>Last check-in</th>
                          <th>Check-ins</th>
                          <th>7-day averages</th>
                          <th>Open alerts</th>
                          <th>Caregivers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredElders.map((elder) => (
                          <tr key={elder.user_id}>
                            <td>
                              <strong>{elder.full_name}</strong>
                            </td>
                            <td className="muted">
                              {elder.last_checkin
                                ? new Date(elder.last_checkin).toLocaleString(undefined, {
                                    dateStyle: "short",
                                    timeStyle: "short",
                                  })
                                : "Never"}
                            </td>
                            <td>
                              <strong>{elder.checkins_last_7_days}</strong>{" "}
                              <span className="muted">in 7d</span>
                              <div className="muted" style={{ fontSize: 12 }}>
                                {elder.total_checkins} total
                              </div>
                            </td>
                            <td>
                              {elder.avg_mood_last_7_days != null ? (
                                <div style={{ fontSize: 13 }}>
                                  <div>Mood: {elder.avg_mood_last_7_days.toFixed(1)}/5</div>
                                  <div className="muted">
                                    Activity: {elder.avg_activity_last_7_days?.toFixed(1) ?? "–"}/5
                                  </div>
                                </div>
                              ) : (
                                <span className="muted">No data yet</span>
                              )}
                            </td>
                            <td>
                              {elder.open_alert_count > 0 ? (
                                <span className="severity high" style={{ fontSize: 12 }}>
                                  {elder.open_alert_count} open
                                </span>
                              ) : (
                                <span style={{ color: "var(--ok)", fontSize: 13 }}>None</span>
                              )}
                            </td>
                            <td>
                              {elder.caregivers && elder.caregivers.length > 0 ? (
                                <div className="partner-list">
                                  {elder.caregivers.map((c) => (
                                    <span className="partner-tag" key={c.caregiver_id}>
                                      {c.full_name}
                                    </span>
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
                  {filteredElders.length === 0 && (
                    <div className="empty-state">No seniors match that search query.</div>
                  )}
                </section>
              )}

              {tab === "profiles" && (
                <ElderProfileCardsView
                  token={session.token}
                  allowAssignment={false}
                  onSelectElder={setSelectedProfile}
                />
              )}

              {tab === "audit" && (
                <section className="card audit-log-card" aria-labelledby="audit-log-title">
                  <div className="spread audit-heading">
                    <div>
                      <h2 id="audit-log-title">Audit log explorer</h2>
                      <p className="muted">Recorded system actions for security, compliance, and clinical governance.</p>
                    </div>
                    <div className="row" style={{ gap: 8 }}>
                      <button className="secondary" onClick={exportAuditCSV} title="Export filtered audit logs as CSV">
                        <Download size={14} /> Export CSV
                      </button>
                      <button className="secondary" onClick={load}>
                        <RefreshCw size={14} /> Refresh
                      </button>
                    </div>
                  </div>
                  <div style={{ marginTop: 14, marginBottom: 16 }}>
                    <label htmlFor="audit-search">Search actions, accounts, or targets</label>
                    <div className="input-icon-wrapper">
                      <span className="input-icon-prefix">
                        <Search size={16} />
                      </span>
                      <input
                        id="audit-search"
                        className="input-with-prefix"
                        value={auditQuery}
                        onChange={(e) => setAuditQuery(e.target.value)}
                        placeholder="e.g. acknowledge, user@example.com, health_note"
                      />
                    </div>
                    <p className="muted audit-result-count" style={{ marginTop: 8 }}>
                      Showing {filteredAuditLogs.length} of {auditLogs.length} entries
                    </p>
                  </div>
                  <div className="table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>When</th>
                          <th>Account</th>
                          <th>Action</th>
                          <th>Target</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAuditLogs.map((log) => (
                          <tr key={log.log_id}>
                            <td className="muted" style={{ whiteSpace: "nowrap" }}>
                              <time dateTime={log.created_at}>
                                {new Date(log.created_at).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </time>
                            </td>
                            <td>
                              <strong>{log.account_email || "System"}</strong>
                            </td>
                            <td>
                              <span className="audit-action">{log.action.replace(/_/g, " ")}</span>
                            </td>
                            <td className="muted">
                              {log.target_type ? `${log.target_type}${log.target_id ? ` #${log.target_id}` : ""}` : "–"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredAuditLogs.length === 0 && (
                    <div className="empty-state">No audit log entries match that search query.</div>
                  )}
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </div>
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
