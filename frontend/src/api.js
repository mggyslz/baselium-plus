const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

async function request(path, { method = "GET", body, token, params } = {}) {
  let url = BASE_URL + path;
  if (params) {
    const qs = new URLSearchParams(params).toString();
    url += "?" + qs;
  }
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = "Bearer " + token;

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((data && data.error) || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  signup: (payload) => request("/api/auth/signup", { method: "POST", body: payload }),
  login: (payload) => request("/api/auth/login", { method: "POST", body: payload }),
  submitCheckin: (token, payload) => request("/api/checkins", { method: "POST", body: payload, token }),
  checkinHistory: (token, userId) => request("/api/checkins", { token, params: userId ? { user_id: userId } : undefined }),
  triage: (token) => request("/api/dashboard/triage", { token }),
  trend: (token, userId) => request("/api/dashboard/trend", { token, params: { user_id: userId } }),
  alerts: (token, userId) => request("/api/dashboard/alerts", { token, params: { user_id: userId } }),
  notifications: (token) => request("/api/notifications", { token }),
  ackNotification: (token, anomalyId) => request("/api/notifications/ack", { method: "POST", body: { anomaly_id: anomalyId }, token }),
  familyStatus: (token) => request("/api/family/status", { token }),
  revokeFamily: (token, familyId) => request("/api/family/revoke", { method: "POST", body: { family_id: familyId }, token }),
  assignElder: (token, elderUserId) => request("/api/caregiver/assign", { method: "POST", body: { elder_user_id: Number(elderUserId) }, token }),
  grantFamily: (token, payload) => request("/api/family/grant", { method: "POST", body: payload, token }),
  adminOverview: (token) => request("/api/admin/overview", { token }),
  adminAccounts: (token) => request("/api/admin/accounts", { token }),
  adminAssign: (token, payload) => request("/api/admin/assign", { method: "POST", body: payload, token }),
};
