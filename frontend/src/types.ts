export type Role = "elder" | "caregiver" | "family" | "admin";

export interface Session {
  token: string;
  role: Role;
  [key: string]: unknown;
}

export interface ApiErrorResponse { error?: string }
export type ApiParams = Record<string, string | number | boolean>;
export type ApiPayload = Record<string, unknown>;

export interface Checkin { checkin_id: number; checkin_time: string; mood: number; activity_level: number; notes?: string }
export interface CheckinResult { anomalies_raised?: unknown[] }
export interface Trend { points: { time: string; mood: number; activity: number }[]; baseline_mood: number }
export interface Alert { anomaly_id: number; detected_at: string; anomaly_type: string; severity: string; deviation_metric: string; deviation_magnitude?: number; duration_days: number; is_resolved: boolean }
export interface TriageItem { user_id: number; full_name: string; last_checkin?: string; open_anomaly_count: number; highest_open_severity?: string }
export interface Notification { NotificationID: number; SentAt: string; Message: string; AcknowledgedAt?: string; IsRead: boolean }
export interface FamilyMember { id: number; full_name: string; relationship?: string; email: string; is_active: boolean }
export interface FamilyStatusData { elder_name: string; last_checkin?: string; open_high_severity_alerts: number }
export interface HealthNote { note_id: number; note_text: string; created_at: string; caregiver_name: string }
export interface AdminOverview { elder?: number; caregiver?: number; family?: number; assignments?: number; open_alerts?: number }
export interface AdminAccount { account_id: number; email: string; Role: string; active: boolean }
export interface AdminAuditLog { log_id: number; account_id?: number; account_email: string; action: string; target_type?: string; target_id?: number; created_at: string }
export interface AdminElder { user_id: number; full_name: string; last_checkin?: string; total_checkins: number; checkins_last_7_days: number; avg_mood_last_7_days?: number; avg_activity_last_7_days?: number; open_alert_count: number; caregivers: { caregiver_id: number; full_name: string }[] }
