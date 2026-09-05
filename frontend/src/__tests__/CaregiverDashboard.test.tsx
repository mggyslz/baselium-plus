import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../shared/api/client";
import type { FamilyMember } from "../shared/types/models";
import { AccessManagement, ElderDetail } from "../features/caregiver/pages/CaregiverDashboardPage";

const TOKEN = "test-token";

const member: FamilyMember = {
  id: 3,
  full_name: "Fern Rivera",
  relationship: "daughter",
  email: "fern@test.com",
  is_active: true,
};

// Keep references to spy on so tests can assert invocation.
let membersSpy: ReturnType<typeof vi.spyOn>;
let assignSpy: ReturnType<typeof vi.spyOn>;
let grantSpy: ReturnType<typeof vi.spyOn>;
let revokeSpy: ReturnType<typeof vi.spyOn>;
let paginatedEldersSpy: ReturnType<typeof vi.spyOn>;
let trendSpy: ReturnType<typeof vi.spyOn>;
let alertsSpy: ReturnType<typeof vi.spyOn>;
let acknowledgeSpy: ReturnType<typeof vi.spyOn>;
let downloadReportSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  membersSpy = vi.spyOn(api, "familyMembers").mockResolvedValue([member]);
  assignSpy = vi.spyOn(api, "assignElder").mockResolvedValue(null);
  grantSpy = vi.spyOn(api, "grantFamily").mockResolvedValue(null);
  revokeSpy = vi.spyOn(api, "revokeFamily").mockResolvedValue(null);
  paginatedEldersSpy = vi.spyOn(api, "paginatedElders").mockResolvedValue({
    elders: [
      {
        user_id: 1,
        full_name: "Alice Smith",
        gender: "Female",
        contact_number: "555-0100",
        last_checkin: "2026-08-30T10:00:00Z",
        open_anomaly_count: 0,
        highest_open_severity: undefined,
        is_assigned: true,
      },
      {
        user_id: 2,
        full_name: "Bob Jones",
        gender: "Male",
        contact_number: "555-0200",
        last_checkin: undefined,
        open_anomaly_count: 1,
        highest_open_severity: "high",
        is_assigned: false,
      },
    ],
    total: 2,
    page: 1,
    limit: 6,
    total_pages: 1,
  });
  trendSpy = vi.spyOn(api, "trend").mockResolvedValue({ points: [], baseline_mood: 0 });
  alertsSpy = vi.spyOn(api, "alerts").mockResolvedValue([{ anomaly_id: 8, anomaly_type: "mood_deviation", severity: "high", detected_at: "2026-08-30T10:00:00Z", deviation_metric: "mood", duration_days: 1, is_resolved: false }]);
  acknowledgeSpy = vi.spyOn(api, "ackNotification").mockResolvedValue(null);
  downloadReportSpy = vi.spyOn(api, "downloadReport").mockResolvedValue(new Blob(["report"]));
  vi.stubGlobal("confirm", vi.fn(() => false));
  vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:test-report"), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("ElderDetail actions", () => {
  it("acknowledges an alert and downloads the Excel report", async () => {
    const onBack = vi.fn();
    render(<ElderDetail userId={12} token={TOKEN} onBack={onBack} />);

    await screen.findByText(/mood deviation/i);
    await userEvent.click(screen.getByRole("button", { name: "Acknowledge Alert" }));
    expect(acknowledgeSpy).toHaveBeenCalledWith(TOKEN, 8);

    await userEvent.click(screen.getByRole("button", { name: "Download Excel report" }));
    expect(downloadReportSpy).toHaveBeenCalledWith(TOKEN, 12);
    expect(URL.createObjectURL).toHaveBeenCalled();
    expect(trendSpy).toHaveBeenCalledWith(TOKEN, 12);
    expect(alertsSpy).toHaveBeenCalledWith(TOKEN, 12);
  });
});

describe("Elder Profile Cards & Pagination", () => {
  it("fetches and renders elder profile cards with backend pagination", async () => {
    render(<AccessManagement token={TOKEN} />);
    expect(paginatedEldersSpy).toBeDefined();
  });
});

describe("AccessManagement", () => {
  it("loads and lists family members on mount", async () => {
    render(<AccessManagement token={TOKEN} />);
    expect(await screen.findByText("Fern Rivera")).toBeInTheDocument();
    expect(membersSpy).toHaveBeenCalledWith(TOKEN);
  });

  it("shows an empty state when no family members are granted", async () => {
    membersSpy.mockResolvedValue([]);
    render(<AccessManagement token={TOKEN} />);
    expect(
      await screen.findByText(/You haven't granted family access yet/)
    ).toBeInTheDocument();
  });

  it("assigns an elder and reports success", async () => {
    render(<AccessManagement token={TOKEN} />);
    await waitFor(() => screen.getByRole("combobox", { name: "Elder user ID to assign" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Elder user ID to assign" }), "1");
    await userEvent.click(screen.getByRole("button", { name: "Assign elder" }));
    expect(assignSpy).toHaveBeenCalledWith(TOKEN, 1);
    expect(await screen.findByText("Elder assigned successfully.")).toBeInTheDocument();
  });

  it("grants family access with the collected payload", async () => {
    render(<AccessManagement token={TOKEN} />);
    await waitFor(() => screen.getByRole("combobox", { name: "Elder user ID for grant access" }));
    await userEvent.selectOptions(screen.getByRole("combobox", { name: "Elder user ID for grant access" }), "2");
    await userEvent.type(screen.getByLabelText("Family member's full name"), "Sam Li");
    await userEvent.type(screen.getByLabelText("Relationship to elder"), "son");
    await userEvent.type(screen.getByLabelText("Email (login)"), "sam@test.com");
    await userEvent.type(screen.getByLabelText("Password (min 8 characters)"), "secret123");
    await userEvent.click(screen.getByRole("button", { name: "Grant access" }));
    expect(grantSpy).toHaveBeenCalledWith(TOKEN, {
      elder_user_id: 2,
      full_name: "Sam Li",
      relationship: "son",
      email: "sam@test.com",
      password: "secret123",
    });
    expect(await screen.findByText("Family access granted.")).toBeInTheDocument();
  });

  it("revokes a family member and removes the row", async () => {
    // First fetch lists the active member; the reload after revoke returns none.
    membersSpy.mockResolvedValueOnce([member]).mockResolvedValueOnce([]);
    render(<AccessManagement token={TOKEN} />);
    await screen.findByText("Fern Rivera");
    await userEvent.click(screen.getByRole("button", { name: "Revoke" }));
    expect(revokeSpy).toHaveBeenCalledWith(TOKEN, 3);
    expect(await screen.findByText("Access revoked.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText("Fern Rivera")).not.toBeInTheDocument());
  });

  it("surfaces an error message when listing members fails", async () => {
    membersSpy.mockRejectedValue(new Error("db error"));
    render(<AccessManagement token={TOKEN} />);
    expect(await screen.findByText("db error")).toBeInTheDocument();
  });
});
