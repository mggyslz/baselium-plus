import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";
import { api } from "../../../shared/api/client";
import { useAuth } from "../../auth/auth.context";
import { useNavigate } from "react-router-dom";
import type { PaginatedEldersResponse } from "../../../shared/types/models";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquare,
  RefreshCw,
  UserCheck,
  Bell,
  KeyRound,
  LogOut,
  Menu,
  X,
  HeartPulse,
  Download,
  Sliders,
  ChevronLeft,
  LayoutGrid,
  ListFilter,
  ShieldAlert,
  Phone,
  ClipboardCheck,
} from "lucide-react";

function SeverityBadge({ severity }: { severity: string }) {
  const s = severity?.toLowerCase() || "low";
  return (
    <span className={`severity ${s}`}>
      <AlertTriangle size={12} style={{ marginRight: 2, verticalAlign: "middle" }} />
      {s}
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

  useEffect(() => {
    loadNotes();
  }, [token, userId]);

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
          <h2>Care team health notes</h2>
          <p className="muted">Shared clinical and observational updates among assigned caregivers.</p>
        </div>
        <span className="notes-count">
          {notes.length} {notes.length === 1 ? "note" : "notes"}
        </span>
      </div>
      <form className="health-note-form" onSubmit={saveNote}>
        <label htmlFor="health-note">Add a caregiver note</label>
        <textarea
          id="health-note"
          rows={3}
          maxLength={2000}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Record an observation, family update, or follow-up recommendation…"
        />
        <div className="note-form-footer">
          <span className="muted" style={{ fontSize: 12 }}>
            {draft.length > 1800 ? `${2000 - draft.length} characters left` : ""}
          </span>
          <button type="submit" disabled={isSaving || !draft.trim()}>
            {isSaving ? "Saving…" : "Save note"}
          </button>
        </div>
      </form>
      {error && <div className="error">{error}</div>}
      {isLoading ? (
        <LoadingSpinner label="Loading health notes…" />
      ) : (
        <div className="notes-list" aria-live="polite">
          {notes.length === 0 ? (
            <div className="empty-state">No notes documented yet. Share the first care observation above.</div>
          ) : (
            notes.map((note) => (
              <article className="health-note" key={note.note_id}>
                <div className="spread">
                  <strong style={{ color: "var(--text)" }}>{note.caregiver_name}</strong>
                  <time className="muted" dateTime={note.created_at} style={{ fontSize: 12 }}>
                    {new Date(note.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </time>
                </div>
                <p>{note.note_text}</p>
              </article>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function ActionableAlertCard({
  alert,
  onAck,
  onReview,
  onLogIntervention,
  readOnly = false,
}: {
  alert: any;
  onAck: (id: number) => void;
  onReview: (id: number, status: "reviewed" | "false_positive") => void;
  onLogIntervention?: (anomalyId: number, actionType: string, note: string) => Promise<void>;
  readOnly?: boolean;
}) {
  const isResolved = alert.is_resolved;
  const severityClass = alert.severity?.toLowerCase() || "low";
  const elderNote = alert.notes || alert.context_note;

  const [showIntervention, setShowIntervention] = useState(false);
  const [actionType, setActionType] = useState("Phone Call Check-in");
  const [actionNote, setActionNote] = useState("");
  const [isSavingAction, setIsSavingAction] = useState(false);

  const humanType = alert.anomaly_type ? alert.anomaly_type.replace(/_/g, " ") : "Pattern Change";

  async function handleConfirmIntervention(e: React.FormEvent) {
    e.preventDefault();
    if (!onLogIntervention) return;
    setIsSavingAction(true);
    try {
      await onLogIntervention(alert.anomaly_id, actionType, actionNote);
      setShowIntervention(false);
      setActionNote("");
    } finally {
      setIsSavingAction(false);
    }
  }

  return (
    <div className={`alert-card ${severityClass} ${isResolved ? "resolved" : ""}`}>
      <div className="alert-card-header">
        <div className="alert-type-title">
          <AlertTriangle size={18} color={severityClass === "high" ? "var(--high)" : "var(--primary)"} />
          <span>{humanType}</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <SeverityBadge severity={alert.severity || "low"} />
          {alert.trend_direction && (
            <span className={`trend-tag ${alert.trend_direction}`}>{alert.trend_direction}</span>
          )}
        </div>
      </div>

      <div className="muted" style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
        <Clock size={14} />
        Detected:{" "}
        {new Date(alert.detected_at).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })}
        {alert.duration_days && ` · Duration: ${alert.duration_days} day(s)`}
      </div>

      {elderNote && (
        <div className="alert-elder-note">
          <MessageSquare size={16} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <strong>Senior's Note:</strong> "{elderNote}"
          </div>
        </div>
      )}

      {!readOnly && (
        <>
          <div className="alert-card-actions">
            {isResolved ? (
              <span
                style={{
                  color: "var(--ok)",
                  fontSize: 13,
                  fontWeight: 600,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <CheckCircle2 size={16} /> Acknowledged
              </span>
            ) : (
              <>
                <button
                  className="secondary"
                  style={{ background: "var(--primary)", color: "white", borderColor: "var(--primary)" }}
                  onClick={() => onAck(alert.anomaly_id)}
                >
                  <UserCheck size={14} /> Acknowledge Alert
                </button>
                {onLogIntervention && (
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setShowIntervention(!showIntervention)}
                    style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
                  >
                    <ClipboardCheck size={14} color="var(--primary)" />
                    {showIntervention ? "Cancel Action" : "Log Action Taken"}
                  </button>
                )}
              </>
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

          {showIntervention && (
            <form
              onSubmit={handleConfirmIntervention}
              style={{
                marginTop: 12,
                padding: 14,
                background: "#f8fafc",
                border: "1px solid var(--border)",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text)" }}>
                Record Clinical Action Taken:
              </div>
              <select
                value={actionType}
                onChange={(e) => setActionType(e.target.value)}
                style={{ padding: "8px 12px", fontSize: 13 }}
              >
                <option value="Phone Call Check-in">Phone Call Check-in</option>
                <option value="In-Person Wellness Visit">In-Person Wellness Visit</option>
                <option value="Contacted Primary Physician">Contacted Primary Physician</option>
                <option value="Contacted Family Member">Contacted Family Member</option>
                <option value="Medication / Routine Review">Medication / Routine Review</option>
                <option value="Routine Check (Resolved)">Routine Check (Resolved)</option>
              </select>
              <textarea
                rows={2}
                placeholder="Optional intervention notes (e.g. Spoke with daughter; elder reports feeling better after hydration)..."
                value={actionNote}
                onChange={(e) => setActionNote(e.target.value)}
                style={{ fontSize: 13, padding: 10 }}
              />
              <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setShowIntervention(false)}
                  style={{ padding: "6px 12px", fontSize: 13 }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAction}
                  style={{ padding: "6px 14px", fontSize: 13 }}
                >
                  {isSavingAction ? "Recording…" : "Save Action & Resolve Alert"}
                </button>
              </div>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export function ElderDetail({
  userId,
  onBack,
  token,
  readOnly = false,
}: {
  userId: number;
  onBack: () => void;
  token: string;
  readOnly?: boolean;
}) {
  const [trend, setTrend] = useState<any>(null);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [elderProfile, setElderProfile] = useState<any>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  async function load() {
    try {
      setIsLoading(true);
      setError("");
      const [t, a, eldersData] = await Promise.all([
        api.trend(token, userId),
        api.alerts(token, userId),
        api.paginatedElders(token, 1, 100).catch(() => null),
      ]);
      setTrend(t);
      setAlerts(a || []);
      if (eldersData && eldersData.elders) {
        const found = eldersData.elders.find((e: any) => e.user_id === userId);
        if (found) setElderProfile(found);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load elder details.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [userId]);

  async function ack(anomalyId: number) {
    try {
      await api.ackNotification(token, anomalyId);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function review(anomalyId: number, status: "reviewed" | "false_positive") {
    try {
      await api.reviewAlert(token, anomalyId, status);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function logIntervention(anomalyId: number, actionType: string, note: string) {
    try {
      await api.ackNotification(token, anomalyId);
      const text = `[Action Taken: ${actionType}] ${note.trim() ? note.trim() : "Intervention logged by caregiver."}`;
      await api.createHealthNote(token, userId, text);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function resetBaseline() {
    if (
      !window.confirm(
        "Recalibrate routine baseline for this senior? New check-ins will establish a fresh pattern over the next 7 days."
      )
    )
      return;
    try {
      await api.resetBaseline(token, userId);
      load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function downloadReport() {
    try {
      const blob = await api.downloadReport(token, userId);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `baselium-report-${userId}.xlsx`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
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
      <div className="spread" style={{ marginBottom: 14 }}>
        <button className="link-btn" onClick={onBack} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
          <ChevronLeft size={16} /> Back to triage
        </button>
        <div>
          {!readOnly && (
            <div className="row" style={{ gap: 8 }}>
              <button className="secondary" onClick={downloadReport}>
                <Download size={14} /> Download Excel report
              </button>
              <button className="secondary" onClick={resetBaseline}>
                <Sliders size={14} /> Recalibrate alerts
              </button>
            </div>
          )}
        </div>
      </div>

      {elderProfile && (
        <div className="card" style={{ padding: "16px 20px", marginBottom: 16 }}>
          <div className="spread" style={{ flexWrap: "wrap", gap: 12 }}>
            <div className="row" style={{ gap: 12 }}>
              <div className="elder-avatar" style={{ width: 44, height: 44, fontSize: 16 }}>
                {elderProfile.full_name ? elderProfile.full_name.substring(0, 2).toUpperCase() : "S"}
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  {elderProfile.full_name}
                </h3>
                <span className="muted" style={{ fontSize: 13 }}>
                  {elderProfile.gender ? `${elderProfile.gender} · ` : ""}
                  Contact: {elderProfile.contact_number || "No contact listed"}
                </span>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              {elderProfile.contact_number && (
                <a
                  href={`tel:${elderProfile.contact_number}`}
                  className="button secondary"
                  style={{
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  <Phone size={14} color="var(--primary)" /> Call Senior
                </a>
              )}
              <span className="role-badge" style={{ padding: "5px 10px", fontSize: 12 }}>
                {elderProfile.is_assigned ? "Assigned Senior" : "Facility Resident"}
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button className="secondary" onClick={load}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="card">
          <LoadingSpinner label="Loading senior metrics and trend chart…" />
        </div>
      ) : (
        <>
          <div className="card">
            <h2>Trend (last 30 check-ins)</h2>
            <p className="muted">Visualizes daily self-reported mood and activity levels.</p>
            {trend && chartData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="time" fontSize={12} stroke="#94a3b8" />
                  <YAxis domain={[0, 5]} fontSize={12} stroke="#94a3b8" ticks={[1, 2, 3, 4, 5]} />
                  <Tooltip
                    formatter={(value: any, name: any) => {
                      const num = Number(value);
                      const labels: Record<string, Record<number, string>> = {
                        mood: { 1: "Very Low", 2: "Low", 3: "Okay", 4: "Good", 5: "Great" },
                        activity: { 1: "Resting", 2: "Light Walk", 3: "Moderate", 4: "Active", 5: "Very Active" },
                      };
                      const str = labels[name]?.[num] ? ` (${labels[name][num]})` : "";
                      return [`${num}/5${str}`, name === "mood" ? "Mood" : "Activity"];
                    }}
                  />
                  <Legend />
                  {trend.baseline_mood > 0 && (
                    <ReferenceLine
                      y={trend.baseline_mood}
                      stroke="#93c5fd"
                      strokeDasharray="4 4"
                      label={{ value: "Typical Mood Baseline", fontSize: 11, fill: "#0284c7" }}
                    />
                  )}
                  <Line type="monotone" dataKey="mood" stroke="#0284c7" strokeWidth={2.5} dot={{ r: 3 }} name="mood" />
                  <Line type="monotone" dataKey="activity" stroke="#16a34a" strokeWidth={2.5} dot={{ r: 3 }} name="activity" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="empty-state">Not enough check-ins logged yet to chart trends.</div>
            )}
          </div>

          <div className="card">
            <h2>Alert history & actionable anomalies</h2>
            <p className="muted">System-detected shifts from the senior's routine baseline.</p>
            {alerts.length === 0 && (
              <div className="empty-state">No behavioral pattern shifts currently detected for this senior.</div>
            )}
            {alerts.length > 0 && (
              <div className="alert-card-grid">
                {alerts.map((a) => (
                  <ActionableAlertCard
                    key={a.anomaly_id}
                    alert={a}
                    onAck={ack}
                    onReview={review}
                    onLogIntervention={logIntervention}
                    readOnly={readOnly}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {!readOnly && <HealthNotes userId={userId} token={token} />}
    </div>
  );
}

export function ElderProfileCardsView({
  token,
  onSelectElder,
  onAssignElder,
  allowAssignment = true,
}: {
  token: string;
  onSelectElder: (userId: number) => void;
  onAssignElder?: () => void;
  allowAssignment?: boolean;
}) {
  const [data, setData] = useState<PaginatedEldersResponse | null>(null);
  const [page, setPage] = useState(1);
  const [limit] = useState(6);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [assigningId, setAssigningId] = useState<number | null>(null);

  async function loadElders(p: number) {
    try {
      setIsLoading(true);
      setError("");
      const res = await api.paginatedElders(token, p, limit);
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load elders list.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadElders(page);
  }, [token, page]);

  async function handleAssign(elderId: number) {
    try {
      setAssigningId(elderId);
      await api.assignElder(token, elderId);
      await loadElders(page);
      if (onAssignElder) onAssignElder();
    } catch (err: any) {
      setError(err.message || "Failed to assign elder.");
    } finally {
      setAssigningId(null);
    }
  }

  return (
    <div className="card">
      <div className="spread" style={{ marginBottom: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18 }}>Senior Directory & Profiles</h2>
          <p className="muted" style={{ margin: "4px 0 0", fontSize: 13 }}>
            Select a senior's profile to view longitudinal trend charts and clinical alerts.
          </p>
        </div>
        {data && (
          <span className="muted" style={{ fontSize: 13, fontWeight: 500 }}>
            {data.total} {data.total === 1 ? "senior" : "seniors"} total
          </span>
        )}
      </div>

      {error && <div className="error" style={{ marginBottom: 12 }}>{error}</div>}

      {isLoading ? (
        <LoadingSpinner label="Loading senior profiles…" />
      ) : !data || data.elders.length === 0 ? (
        <div className="empty-state">No seniors registered in the system yet.</div>
      ) : (
        <>
          <div className="elder-cards-grid">
            {data.elders.map((elder) => {
              const initials =
                elder.full_name
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .substring(0, 2)
                  .toUpperCase() || "S";

              return (
                <div className="elder-profile-card" key={elder.user_id}>
                  <div>
                    <div className="elder-card-header">
                      <div className="elder-avatar" aria-hidden="true">
                        {initials}
                      </div>
                      <div className="elder-card-meta">
                        <h3 className="elder-card-name" title={elder.full_name}>
                          {elder.full_name}
                        </h3>
                        <span className="elder-card-id">Senior ID #{elder.user_id}</span>
                      </div>
                    </div>

                    <div className="elder-card-body" style={{ marginTop: 14 }}>
                      <div className="elder-card-row">
                        <span className="muted">Last Check-in</span>
                        <strong>
                          {elder.last_checkin
                            ? new Date(elder.last_checkin).toLocaleString(undefined, {
                                dateStyle: "short",
                                timeStyle: "short",
                              })
                            : "No check-ins"}
                        </strong>
                      </div>
                      <div className="elder-card-row">
                        <span className="muted">Alert Status</span>
                        {elder.highest_open_severity ? (
                          <SeverityBadge severity={elder.highest_open_severity} />
                        ) : (
                          <span style={{ color: "var(--ok)", fontWeight: 600, fontSize: 12 }}>Normal</span>
                        )}
                      </div>
                      <div className="elder-card-row">
                        <span className="muted">Caregiver Status</span>
                        {elder.is_assigned ? (
                          <span style={{ color: "var(--primary)", fontWeight: 600, fontSize: 12 }}>
                            Assigned to you
                          </span>
                        ) : (
                          <span className="muted" style={{ fontSize: 12 }}>
                            Unassigned
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="elder-card-footer">
                    {elder.is_assigned || !allowAssignment ? (
                      <button type="button" onClick={() => onSelectElder(elder.user_id)}>
                        Select Profile
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="secondary"
                        disabled={assigningId === elder.user_id}
                        onClick={() => handleAssign(elder.user_id)}
                      >
                        {assigningId === elder.user_id ? "Assigning…" : "Assign to Me"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="pagination-bar">
            <span className="pagination-info">
              Page {data.page} of {data.total_pages || 1}
            </span>
            <div className="pagination-controls">
              <button
                type="button"
                className="pagination-btn"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                ← Previous
              </button>
              <button
                type="button"
                className="pagination-btn"
                disabled={page >= data.total_pages || isLoading}
                onClick={() => setPage((prev) => prev + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function AccessManagement({ token }: { token: string }) {
  const [assignForm, setAssignForm] = useState({ elder_user_id: "" });
  const [grantForm, setGrantForm] = useState({
    elder_user_id: "",
    full_name: "",
    relationship: "",
    email: "",
    password: "",
  });
  const [members, setMembers] = useState<any[]>([]);
  const [eldersList, setEldersList] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [granting, setGranting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function loadData() {
    try {
      setIsLoading(true);
      const [membersData, eldersData] = await Promise.all([
        api.familyMembers(token),
        api.paginatedElders(token, 1, 100),
      ]);
      setMembers(membersData || []);
      setEldersList(eldersData?.elders || []);
    } catch (err: any) {
      setError(err.message || "Failed to load data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [token]);

  async function assign(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setAssigning(true);
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
    setError("");
    setSuccess("");
    setGranting(true);
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
      loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGranting(false);
    }
  }

  async function revoke(familyId: number) {
    setError("");
    setSuccess("");
    try {
      await api.revokeFamily(token, familyId);
      setSuccess("Access revoked.");
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="management-grid">
        <div className="card">
          <h2>Assign a senior to yourself</h2>
          <p className="muted">Add a senior to your active triage dashboard.</p>
          <form className="stack" onSubmit={assign}>
            <div>
              <label htmlFor="assign-elder-id">Senior name</label>
              <select
                id="assign-elder-id"
                required
                aria-label="Elder user ID to assign"
                value={assignForm.elder_user_id}
                onChange={(e) => setAssignForm({ ...assignForm, elder_user_id: e.target.value })}
              >
                <option value="" disabled>
                  Select a senior
                </option>
                {eldersList.map((e) => (
                  <option key={e.user_id} value={e.user_id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>
            <button disabled={assigning}>{assigning ? "Assigning…" : "Assign elder"}</button>
          </form>
        </div>

        <div className="card">
          <h2>Grant family access</h2>
          <p className="muted">Create an invitation-only family viewer account for a senior.</p>
          <form className="stack" onSubmit={grant}>
            <div>
              <label htmlFor="grant-elder-id">Senior</label>
              <select
                id="grant-elder-id"
                required
                aria-label="Elder user ID for grant access"
                value={grantForm.elder_user_id}
                onChange={(e) => setGrantForm({ ...grantForm, elder_user_id: e.target.value })}
              >
                <option value="" disabled>
                  Select a senior
                </option>
                {eldersList.map((e) => (
                  <option key={e.user_id} value={e.user_id}>
                    {e.full_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="grant-name">Family member's full name</label>
              <input
                id="grant-name"
                required
                aria-label="Family member's full name"
                value={grantForm.full_name}
                onChange={(e) => setGrantForm({ ...grantForm, full_name: e.target.value })}
                placeholder="e.g. Eleanor Vance"
              />
            </div>
            <div>
              <label htmlFor="grant-rel">Relationship to elder</label>
              <input
                id="grant-rel"
                aria-label="Relationship to elder"
                value={grantForm.relationship}
                onChange={(e) => setGrantForm({ ...grantForm, relationship: e.target.value })}
                placeholder="e.g. daughter, spouse"
              />
            </div>
            <div>
              <label htmlFor="grant-email">Email (login)</label>
              <input
                id="grant-email"
                type="email"
                required
                aria-label="Email (login)"
                value={grantForm.email}
                onChange={(e) => setGrantForm({ ...grantForm, email: e.target.value })}
                placeholder="family@example.com"
              />
            </div>
            <div>
              <label htmlFor="grant-pw">Password (min 8 characters)</label>
              <input
                id="grant-pw"
                type="password"
                required
                minLength={8}
                aria-label="Password (min 8 characters)"
                value={grantForm.password}
                onChange={(e) => setGrantForm({ ...grantForm, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <button type="submit" disabled={granting}>
              {granting ? "Granting…" : "Grant access"}
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2>Family members you've granted access</h2>
        <p className="muted">Active family viewers permitted to see coarse status summaries.</p>
        {isLoading ? (
          <LoadingSpinner label="Loading granted family members…" />
        ) : members.length === 0 ? (
          <div className="empty-state">
            You haven't granted family access yet. Family members can be added with the form above.
          </div>
        ) : (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Relationship</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <strong>{m.full_name}</strong>
                    </td>
                    <td className="muted">{m.relationship || "—"}</td>
                    <td className="muted">{m.email}</td>
                    <td>
                      {m.is_active ? (
                        <span style={{ color: "var(--ok)", fontWeight: 600 }}>Active</span>
                      ) : (
                        <span className="muted">Revoked</span>
                      )}
                    </td>
                    <td>
                      {m.is_active && (
                        <button className="secondary" onClick={() => revoke(m.id)}>
                          Revoke
                        </button>
                      )}
                    </td>
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
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState("triage");
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [triage, setTriage] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isLoadingTriage, setIsLoadingTriage] = useState(true);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

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
        } catch {
          /* Ignore malformed live events */
        }
      };
      socket.onclose = () => {
        if (!closed) reconnectTimer = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [session.token]);

  const unreadCount = notifications.filter((n) => !n.IsRead).length;
  const urgentTriageItems = triage.filter((t) => t.open_anomaly_count > 0);

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
            <HeartPulse size={24} color="var(--primary)" />
            Baselium+
            <span className="sidebar-brand-badge">Caregiver</span>
          </div>
        </div>

        <nav className="sidebar-nav" role="tablist">
          <button
            role="tab"
            aria-selected={tab === "triage"}
            className={`sidebar-item ${tab === "triage" ? "active" : ""}`}
            onClick={() => {
              setTab("triage");
              setSelectedUser(null);
              setMobileOpen(false);
            }}
          >
            <UserCheck size={18} />
            <span>Assigned Seniors</span>
          </button>

          <button
            role="tab"
            aria-selected={tab === "notifications"}
            className={`sidebar-item ${tab === "notifications" ? "active" : ""}`}
            onClick={() => {
              setTab("notifications");
              setSelectedUser(null);
              setMobileOpen(false);
            }}
          >
            <Bell size={18} />
            <span>Notifications</span>
            {unreadCount > 0 && <span className="sidebar-badge">{unreadCount}</span>}
          </button>

          <button
            role="tab"
            aria-selected={tab === "access"}
            className={`sidebar-item ${tab === "access" ? "active" : ""}`}
            onClick={() => {
              setTab("access");
              setSelectedUser(null);
              setMobileOpen(false);
            }}
          >
            <KeyRound size={18} />
            <span>Access Management</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">{(session.full_name || session.email || "C")[0].toUpperCase()}</div>
            <div className="user-info">
              <span className="user-name">{session.full_name || session.email}</span>
              <span className="user-role">Caregiver Account</span>
            </div>
          </div>
          <button className="btn-logout" onClick={handleLogout}>
            <LogOut size={16} /> Log Out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <main className="main-workspace">
        <header className="workspace-topbar">
          <div className="workspace-title">
            <h1>
              {selectedUser
                ? "Senior Detail & Metrics"
                : tab === "triage"
                ? "My Assigned Seniors"
                : tab === "notifications"
                ? "Notifications & Alerts"
                : "Access Management"}
            </h1>
            <p className="workspace-subtitle">
              {selectedUser
                ? "Review trend charts, alert history, and health notes"
                : tab === "triage"
                ? "Seniors sorted by active alerts"
                : tab === "notifications"
                ? "Recent alerts and updates"
                : "Assign seniors and grant family member access"}
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
              <button
                className="secondary"
                onClick={() => {
                  loadTriage();
                  loadNotifications();
                }}
              >
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}

          {selectedUser ? (
            <ElderDetail
              userId={selectedUser}
              token={session.token}
              onBack={() => {
                setSelectedUser(null);
                loadTriage();
                loadNotifications();
              }}
            />
          ) : (
            <>
              {tab === "triage" && (
                <>
                  {/* Top Urgent Alert Shelf */}
                  {urgentTriageItems.length > 0 && (
                    <div className="triage-alert-shelf">
                      <div className="triage-shelf-header">
                        <div className="triage-shelf-title">
                          <ShieldAlert size={20} />
                          <span>Immediate Attention Required ({urgentTriageItems.length})</span>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
                        {urgentTriageItems.map((item) => (
                          <div
                            key={item.user_id}
                            style={{
                              background: "white",
                              padding: "12px 14px",
                              borderRadius: 8,
                              border: "1px solid #fde68a",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <div>
                              <strong style={{ fontSize: 14 }}>{item.full_name}</strong>
                              <div style={{ fontSize: 12, color: "var(--high)", fontWeight: 600, marginTop: 2 }}>
                                {item.open_anomaly_count} active alert{item.open_anomaly_count > 1 ? "s" : ""}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => setSelectedUser(item.user_id)}
                              style={{ padding: "6px 12px", fontSize: 12 }}
                            >
                              Review
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* View Mode Toggle Bar */}
                  <div className="view-toggle-bar">
                    <h2 style={{ fontSize: 17, margin: 0, fontWeight: 600 }}>Senior Care Roster</h2>
                    <div className="segmented-toggle" role="group" aria-label="View format">
                      <button
                        type="button"
                        className={viewMode === "cards" ? "active" : ""}
                        onClick={() => setViewMode("cards")}
                        title="Card Directory View"
                      >
                        <LayoutGrid size={14} style={{ marginRight: 4 }} /> Grid
                      </button>
                      <button
                        type="button"
                        className={viewMode === "table" ? "active" : ""}
                        onClick={() => setViewMode("table")}
                        title="Triage Priority Table View"
                      >
                        <ListFilter size={14} style={{ marginRight: 4 }} /> Priority Table
                      </button>
                    </div>
                  </div>

                  {viewMode === "cards" ? (
                    <ElderProfileCardsView
                      token={session.token}
                      onSelectElder={(id) => setSelectedUser(id)}
                      onAssignElder={() => loadTriage()}
                    />
                  ) : (
                    <div className="card">
                      <h2>Your assigned seniors, highest priority first</h2>
                      <p className="muted">Sorted dynamically by open alerts and severity.</p>
                      {isLoadingTriage ? (
                        <LoadingSpinner label="Loading assigned seniors..." />
                      ) : triage.length === 0 ? (
                        <div className="empty-state">
                          No seniors assigned to you yet. Switch to the Grid view to assign seniors to your roster.
                        </div>
                      ) : (
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Senior</th>
                                <th>Last check-in</th>
                                <th>Open alerts</th>
                                <th>Highest severity</th>
                                <th></th>
                              </tr>
                            </thead>
                            <tbody>
                              {triage.map((t) => (
                                <tr key={t.user_id}>
                                  <td>
                                    <strong>{t.full_name}</strong>
                                  </td>
                                  <td className="muted">
                                    {t.last_checkin
                                      ? new Date(t.last_checkin).toLocaleString(undefined, {
                                          dateStyle: "short",
                                          timeStyle: "short",
                                        })
                                      : "Never"}
                                  </td>
                                  <td>
                                    {t.open_anomaly_count > 0 ? (
                                      <span style={{ color: "var(--high)", fontWeight: 700 }}>
                                        {t.open_anomaly_count}
                                      </span>
                                    ) : (
                                      <span className="muted">0</span>
                                    )}
                                  </td>
                                  <td>
                                    {t.highest_open_severity ? (
                                      <SeverityBadge severity={t.highest_open_severity} />
                                    ) : (
                                      <span className="muted">—</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: "right" }}>
                                    <button
                                      type="button"
                                      className="secondary"
                                      onClick={() => setSelectedUser(t.user_id)}
                                      style={{ padding: "6px 12px", fontSize: 13 }}
                                    >
                                      View Details
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {tab === "notifications" && (
                <div className="card">
                  <h2>Recent notifications</h2>
                  <p className="muted">Real-time alerts and care team updates dispatched across the system.</p>
                  {isLoadingNotifs ? (
                    <LoadingSpinner label="Loading notifications..." />
                  ) : notifications.length === 0 ? (
                    <div className="empty-state">
                      No notifications yet. All assigned seniors are currently within expected routine baselines.
                    </div>
                  ) : (
                    <div className="table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>When</th>
                            <th>Message</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {notifications.map((n) => (
                            <tr key={n.NotificationID}>
                              <td className="muted" style={{ whiteSpace: "nowrap" }}>
                                {new Date(n.SentAt).toLocaleString(undefined, {
                                  dateStyle: "short",
                                  timeStyle: "short",
                                })}
                              </td>
                              <td>{n.Message}</td>
                              <td>
                                {n.AcknowledgedAt ? (
                                  <span style={{ color: "var(--ok)", fontWeight: 600 }}>Acknowledged</span>
                                ) : (
                                  <span className="severity high" style={{ fontSize: 11 }}>
                                    Unread
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {tab === "access" && <AccessManagement token={session.token} />}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
