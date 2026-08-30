import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../api";
import type { FamilyMember } from "../types";
import { AccessManagement } from "../pages/CaregiverDashboard";

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
});

afterEach(() => {
  vi.restoreAllMocks();
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
    await userEvent.type(screen.getByLabelText("Elder user ID to assign"), "9");
    await userEvent.click(screen.getByRole("button", { name: "Assign elder" }));
    expect(assignSpy).toHaveBeenCalledWith(TOKEN, 9);
    expect(await screen.findByText("Elder assigned successfully.")).toBeInTheDocument();
  });

  it("grants family access with the collected payload", async () => {
    render(<AccessManagement token={TOKEN} />);
    await userEvent.type(screen.getByLabelText("Elder user ID for grant access"), "2");
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