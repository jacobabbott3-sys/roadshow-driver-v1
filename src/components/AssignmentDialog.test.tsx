import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AvailabilityResponsePerson } from "../types";
import { AssignmentDialog } from "./AssignmentDialog";

const loadResponses = vi.fn();
const replaceAssignments = vi.fn();
const people: AvailabilityResponsePerson[] = [
  person("alex", "Alex Available", "available", "2026-10-02T15:00:00Z", 1),
  person("blair", "Blair Available", "available", "2026-10-02T15:04:00Z", 2),
  person("casey", "Casey Unavailable", "unavailable", "2026-10-02T15:05:00Z", null),
  person("devon", "Devon No Response", null, null, null),
];

vi.mock("../lib/availabilityData", () => ({
  getReleaseResponses: (...args: unknown[]) => loadResponses(...args),
  replaceOpportunityAssignments: (...args: unknown[]) => replaceAssignments(...args),
}));

vi.mock("../lib/adminData", () => ({ getTeamMembers: vi.fn(async () => []) }));

describe("AssignmentDialog", () => {
  beforeEach(() => {
    loadResponses.mockReset().mockResolvedValue(people);
    replaceAssignments.mockReset().mockResolvedValue(undefined);
  });

  it("shows ordered response ranks and response times", async () => {
    renderDialog();
    const rows = await screen.findAllByTestId(/assignment-person-/);
    expect(rows.map((row) => within(row).getByRole("strong").textContent)).toEqual([
      "Alex Available", "Blair Available", "Casey Unavailable", "Devon No Response",
    ]);
    expect(rows[0]).toHaveTextContent("1st to respond");
    expect(rows[1]).toHaveTextContent("2nd to respond");
    expect(rows[0]).toHaveTextContent("Responded");
    expect(rows[2]).toHaveTextContent("Unavailable");
    expect(rows[3]).toHaveTextContent("No response");
  });

  it("supports a mixed internal and external team, rejects duplicates, and removes names", async () => {
    const onSaved = vi.fn();
    renderDialog({ onSaved });
    fireEvent.click(await screen.findByRole("checkbox", { name: /Alex Available/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Devon No Response/ }));
    const input = screen.getByLabelText("Outside driver name");
    fireEvent.change(input, { target: { value: "Outside Driver" } });
    fireEvent.click(screen.getByRole("button", { name: "Add outside driver" }));
    expect(screen.getByText("Outside Driver")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "outside driver" } });
    fireEvent.click(screen.getByRole("button", { name: "Add outside driver" }));
    expect(screen.getByRole("alert")).toHaveTextContent("already added");
    fireEvent.click(screen.getByRole("button", { name: "Remove Outside Driver" }));
    expect(screen.queryByText("Outside Driver")).not.toBeInTheDocument();

    fireEvent.change(input, { target: { value: "Outside Driver" } });
    fireEvent.click(screen.getByRole("button", { name: "Add outside driver" }));
    fireEvent.click(screen.getByRole("button", { name: "Save assignments" }));
    await waitFor(() => expect(replaceAssignments).toHaveBeenCalledWith({
      releaseItemId: "release-1",
      showIds: ["show-1", "show-2"],
      driverIds: ["alex", "devon"],
      externalNames: ["Outside Driver"],
    }));
    expect(onSaved).toHaveBeenCalled();
  });

  it("preserves selections after a network failure and refreshes stale assignments", async () => {
    replaceAssignments.mockRejectedValueOnce(new Error("Network failed"));
    renderDialog();
    const checkbox = await screen.findByRole("checkbox", { name: /Blair Available/ });
    fireEvent.click(checkbox);
    fireEvent.click(screen.getByRole("button", { name: "Save assignments" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Network failed");
    expect(screen.getByRole("checkbox", { name: /Blair Available/ })).toBeChecked();

    replaceAssignments.mockRejectedValueOnce(new Error("This opportunity has already been assigned"));
    fireEvent.click(screen.getByRole("button", { name: "Save assignments" }));
    await waitFor(() => expect(loadResponses).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole("alert")).toHaveTextContent("changed while you were viewing it");
  });
});

function renderDialog(overrides: Partial<React.ComponentProps<typeof AssignmentDialog>> = {}) {
  return render(<AssignmentDialog
    releaseItemId="release-1"
    showIds={["show-1", "show-2"]}
    title="Linked signings"
    onSaved={vi.fn()}
    onClose={vi.fn()}
    {...overrides}
  />);
}

function person(
  profile_id: string,
  full_name: string,
  response_status: AvailabilityResponsePerson["response_status"],
  responded_at: string | null,
  response_rank: number | null,
): AvailabilityResponsePerson {
  return {
    profile_id,
    full_name,
    role: "driver",
    phone: null,
    response_status,
    responded_at,
    available_at: response_status === "available" ? responded_at : null,
    response_rank,
    assigned: false,
  };
}
