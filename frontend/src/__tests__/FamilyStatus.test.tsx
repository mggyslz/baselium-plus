import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { api } from "../shared/api/client";

const session = { token: "family-token", account_id: 3, user_id: 4, email: "family@test.com", role: "family" as const };

vi.mock("../features/auth/auth.context", () => ({
  useAuth: () => ({ session, login: vi.fn(), logout: vi.fn() }),
}));

import FamilyStatus from "../features/family/pages/FamilyStatusPage";

describe("FamilyStatus", () => {
  beforeEach(() => {
    vi.spyOn(api, "familyStatus").mockResolvedValue({
      elder_name: "Ana Rivera",
      last_checkin: "2026-08-30T10:00:00Z",
      open_high_severity_alerts: 1,
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("shows only the restricted status summary, not check-in or alert details", async () => {
    render(<FamilyStatus />);
    expect(await screen.findByText("Ana Rivera")).toBeInTheDocument();
    expect(screen.getByText(/read-only access/i)).toBeInTheDocument();
    expect(screen.getByText("Open high-priority alerts")).toBeInTheDocument();
    expect(screen.queryByText(/Trend \(last 30 check-ins\)/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Alert history/i)).not.toBeInTheDocument();
  });
});
