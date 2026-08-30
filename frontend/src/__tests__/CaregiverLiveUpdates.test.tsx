import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { api } from "../shared/api/client";

const session = { token: "caregiver-token", account_id: 2, user_id: 5, email: "caregiver@test.com", role: "caregiver" as const, full_name: "Caregiver Test" };
let latestSocket: FakeWebSocket | undefined;

class FakeWebSocket {
  onmessage: ((event: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(_url: string) { latestSocket = this; }
  close() {}
}

vi.mock("../features/auth/auth.context", () => ({
  useAuth: () => ({ session, logout: vi.fn() }),
}));

import CaregiverDashboard from "../features/caregiver/pages/CaregiverDashboardPage";

describe("CaregiverDashboard live updates", () => {
  beforeEach(() => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    vi.spyOn(api, "triage").mockResolvedValue([{
      user_id: 11,
      full_name: "Ana Rivera",
      last_checkin: "2026-08-30T10:00:00Z",
      open_anomaly_count: 1,
      highest_open_severity: "high",
    }]);
    vi.spyOn(api, "notifications").mockResolvedValue([]);
    vi.spyOn(api, "paginatedElders").mockResolvedValue({ elders: [], total: 0, page: 1, limit: 6, total_pages: 1 });
  });

  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it("reloads triage and notifications when a live notification arrives", async () => {
    const triageSpy = vi.spyOn(api, "triage");
    const notificationsSpy = vi.spyOn(api, "notifications");
    render(<MemoryRouter><CaregiverDashboard /></MemoryRouter>);
    await waitFor(() => expect(latestSocket).toBeDefined());
    expect(await screen.findByText("Ana Rivera")).toBeInTheDocument();

    latestSocket!.onmessage?.({ data: JSON.stringify({ type: "notification" }) } as MessageEvent);
    await waitFor(() => {
      expect(triageSpy).toHaveBeenCalledTimes(2);
      expect(notificationsSpy).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByText(/Triage & Assigned Elders/i)).toBeInTheDocument();
  });
});
