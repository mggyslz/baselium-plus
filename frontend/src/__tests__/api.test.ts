import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "../api";

// Mock global fetch so no network is touched. Each test controls the response.
function mockFetch(status: number, body: unknown) {
  const resp = {
    ok: status >= 200 && status < 300,
    status,
    json: async () => (typeof body === "string" ? null : body),
  } as unknown as Response;
  globalThis.fetch = vi.fn().mockResolvedValue(resp);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("api.request", () => {
  it("builds a GET URL with query params and sends an auth header", async () => {
    mockFetch(200, [{ id: 1, full_name: "A", email: "a@b.c", is_active: true }]);
    const rows = await api.familyMembers("tok123");
    expect(rows).toHaveLength(1);
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:8080/api/family/members");
    expect(init.method ?? "GET").toBe("GET");
    expect(init.headers).toMatchObject({ "Content-Type": "application/json", Authorization: "Bearer tok123" });
  });

  it("appends query string params", async () => {
    mockFetch(200, [{ checkin_id: 7, checkin_time: "t", mood: 4, activity_level: 4 }]);
    await api.checkinHistory("t", 42);
    const url = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(url).toContain("user_id=42");
  });

  it("returns null on a 204", async () => {
    mockFetch(204, "");
    const result = await api.revokeFamily("t", 5);
    expect(result).toBeNull();
  });

  it("throws the server's error message on a 4xx", async () => {
    mockFetch(400, { error: "valid elder_user_id required" });
    await expect(api.assignElder("t", 0)).rejects.toThrow("valid elder_user_id required");
  });

  it("throws a fallback message when the body is not JSON", async () => {
    mockFetch(500, "oops");
    await expect(api.triage("t")).rejects.toThrow("Request failed (500)");
  });

  it("sends a JSON POST body", async () => {
    mockFetch(200, { anomalies_raised: [] });
    await api.submitCheckin("t", { mood: 1, activity_level: 1 });
    const init = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(String(init.body)).toContain('"mood":1');
  });
});