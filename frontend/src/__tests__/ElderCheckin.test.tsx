import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { api } from "../shared/api/client";

// Mock useAuth before importing ElderCheckin
const mockSession = {
  token: "test-elder-token",
  account_id: 1,
  user_id: 1,
  email: "elder@test.com",
  role: "elder" as const,
  full_name: "Elder Test",
};

vi.mock("../features/auth/auth.context", () => ({
  useAuth: () => ({
    session: mockSession,
    login: vi.fn(),
    logout: vi.fn(),
  }),
}));

import ElderCheckin from "../features/elder/pages/ElderCheckinPage";

let checkinHistorySpy: ReturnType<typeof vi.spyOn>;
let submitCheckinSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  checkinHistorySpy = vi.spyOn(api, "checkinHistory").mockResolvedValue([
    {
      checkin_id: 1,
      checkin_time: "2026-08-29T10:00:00Z",
      mood: 4,
      activity_level: 3,
      notes: "Had a nice walk",
    },
  ]);
  submitCheckinSpy = vi.spyOn(api, "submitCheckin").mockResolvedValue({
    anomalies_raised: [],
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("ElderCheckin", () => {
  it("renders rating options and toggleable check-in history", async () => {
    render(<ElderCheckin />);
    expect(screen.getByText("How are you feeling today?")).toBeInTheDocument();

    // Check rating options exist
    expect(screen.getByRole("radio", { name: "4 - Good" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "3 - Moderate" })).toBeInTheDocument();

    // Collapsible history should be collapsed by default
    expect(screen.queryByText("Had a nice walk")).not.toBeInTheDocument();

    // Toggle history section open
    const historyToggle = screen.getByRole("button", { name: /Your recent check-ins/i });
    await userEvent.click(historyToggle);

    expect(await screen.findByText("Had a nice walk")).toBeInTheDocument();
  });

  it("allows selecting mood and activity rating options and submitting check-in", async () => {
    render(<ElderCheckin />);

    // Select Great mood (5) and Active activity (4)
    const moodGreatBtn = screen.getByRole("radio", { name: "5 - Great" });
    const activityActiveBtn = screen.getByRole("radio", { name: "4 - Active" });

    await userEvent.click(moodGreatBtn);
    await userEvent.click(activityActiveBtn);

    expect(moodGreatBtn).toHaveAttribute("aria-checked", "true");
    expect(activityActiveBtn).toHaveAttribute("aria-checked", "true");

    // Add note and submit
    const noteInput = screen.getByLabelText(/Anything you'd like to share?/i);
    await userEvent.type(noteInput, "Feeling energetic today!");

    const submitBtn = screen.getByRole("button", { name: "Submit Check-in" });
    await userEvent.click(submitBtn);

    expect(submitCheckinSpy).toHaveBeenCalledWith(mockSession.token, {
      mood: 5,
      activity_level: 4,
      notes: "Feeling energetic today!",
    });

    expect(await screen.findByText(/Check-in saved successfully!/i)).toBeInTheDocument();
  });

  it("handles submission error gracefully", async () => {
    submitCheckinSpy.mockRejectedValue(new Error("Network error submitting check-in"));
    render(<ElderCheckin />);

    const submitBtn = screen.getByRole("button", { name: "Submit Check-in" });
    await userEvent.click(submitBtn);

    expect(await screen.findByText("Network error submitting check-in")).toBeInTheDocument();
  });
});
