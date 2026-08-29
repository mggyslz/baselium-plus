import type { AdminAccount, AdminAuditLog, AdminElder, AdminOverview, Alert, ApiErrorResponse, ApiParams, ApiPayload, Checkin, CheckinResult, FamilyMember, FamilyStatusData, HealthNote, Notification, Session, TriageItem, Trend } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

interface RequestOptions { method?: string; body?: ApiPayload; token?: string; params?: ApiParams }
async function request<T>(path: string, { method = "GET", body, token, params }: RequestOptions = {}): Promise<T> {
  let url = BASE_URL + path;
  if (params) {
    const qs = new URLSearchParams(Object.entries(params).map(([key, value]) => [key, String(value)])).toString();
    url += "?" + qs;
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null as T;
  const data = await res.json().catch((): ApiErrorResponse | null => null) as T | ApiErrorResponse | null;
  if (!res.ok) {
    throw new Error((data as ApiErrorResponse | null)?.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export const api = {
  signup: (payload: ApiPayload) => request<Session>("/api/auth/signup", { method: "POST", body: payload }),
  login: (payload: ApiPayload) => request<Session>("/api/auth/login", { method: "POST", body: payload }),
  submitCheckin: (token: string, payload: ApiPayload) => request<CheckinResult>("/api/checkins", { method: "POST", body: payload, token }),
  checkinHistory: (token: string, userId?: number) => request<Checkin[]>("/api/checkins", { token, params: userId ? { user_id: userId } : undefined }),
  triage: (token: string) => request<TriageItem[]>("/api/dashboard/triage", { token }), trend: (token: string, userId: number) => request<Trend>("/api/dashboard/trend", { token, params: { user_id: userId } }), alerts: (token: string, userId: number) => request<Alert[]>("/api/dashboard/alerts", { token, params: { user_id: userId } }), notifications: (token: string) => request<Notification[]>("/api/notifications", { token }),
  ackNotification: (token: string, anomalyId: number) => request<null>("/api/notifications/ack", { method: "POST", body: { anomaly_id: anomalyId }, token }), familyStatus: (token: string) => request<FamilyStatusData>("/api/family/status", { token }), revokeFamily: (token: string, familyId: number) => request<null>("/api/family/revoke", { method: "POST", body: { family_id: familyId }, token }), assignElder: (token: string, elderUserId: number) => request<null>("/api/caregiver/assign", { method: "POST", body: { elder_user_id: Number(elderUserId) }, token }), grantFamily: (token: string, payload: ApiPayload) => request<null>("/api/family/grant", { method: "POST", body: payload, token }), familyMembers: (token: string) => request<FamilyMember[]>("/api/family/members", { token }), adminOverview: (token: string) => request<AdminOverview>("/api/admin/overview", { token }), adminAccounts: (token: string) => request<AdminAccount[]>("/api/admin/accounts", { token }), adminAssign: (token: string, payload: ApiPayload) => request<null>("/api/admin/assign", { method: "POST", body: payload, token }),
  reviewAlert: (token: string, anomalyId: number, status: "reviewed" | "false_positive") => request<null>("/api/notifications/review", { method: "POST", body: { anomaly_id: anomalyId, status }, token }),
  resetBaseline: (token: string, userId: number) => request<null>("/api/dashboard/baseline/reset", { method: "POST", body: { user_id: userId }, token }),
  healthNotes: (token: string, userId: number) => request<HealthNote[]>("/api/health-notes", { token, params: { user_id: userId } }),
  createHealthNote: (token: string, userId: number, note: string) => request<{ note_id: number }>("/api/health-notes", { method: "POST", body: { user_id: userId, note }, token }),
  adminAuditLogs: (token: string) => request<AdminAuditLog[]>("/api/admin/audit-logs", { token }),
  adminElders: (token: string) => request<AdminElder[]>("/api/admin/elders", { token }),
  downloadReport: async (token: string, userId: number) => {
    const res = await fetch(`${BASE_URL}/api/dashboard/report?user_id=${userId}`, { headers: { Authorization: "Bearer " + token } });
    if (!res.ok) throw new Error("Unable to download report");
    return res.blob();
  },
};
