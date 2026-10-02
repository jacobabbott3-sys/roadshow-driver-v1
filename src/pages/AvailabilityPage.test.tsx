import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AvailabilityBatch } from "../types";
import { AvailabilityPage } from "./AvailabilityPage";

let responseStatus: "available" | "unavailable" | null = null;
const respond = vi.fn(async (_itemId: string, status: "available" | "unavailable") => {
  responseStatus = status;
});

const batches = (): AvailabilityBatch[] => [
  {
    id: "batch-new",
    released_at: "2026-10-02T18:00:00Z",
    opportunities: [
      {
        id: "linked-signings",
        batch_id: "batch-new",
        batch_released_at: "2026-10-02T18:00:00Z",
        status: "open",
        response_status: responseStatus,
        responded_at: responseStatus ? "2026-10-02T18:05:00Z" : null,
        available_at: responseStatus === "available" ? "2026-10-02T18:05:00Z" : null,
        assignees: [],
        shows: [
          availabilityShow({ id: "signing-a", name: "Artist A Signing", artist: "Artist A", contract_pay: 250 }),
          availabilityShow({ id: "signing-b", name: "Artist B Signing", artist: "Artist B", contract_pay: 300, setup_at: "2026-11-11T16:00:00Z" }),
        ],
      },
    ],
  },
  {
    id: "batch-old",
    released_at: "2026-09-30T18:00:00Z",
    opportunities: [
      {
        id: "show-old",
        batch_id: "batch-old",
        batch_released_at: "2026-09-30T18:00:00Z",
        status: "assigned",
        response_status: "available",
        responded_at: "2026-09-30T18:05:00Z",
        available_at: "2026-09-30T18:05:00Z",
        assignees: [{ id: "driver-1", full_name: "Jordan Driver", role: "driver", external: false }],
        shows: [availabilityShow({ id: "show-old", name: "Old Assigned Show", event_type: "show", artist: null, contract_pay: 700, bonus_pay: 125 })],
      },
    ],
  },
];

vi.mock("../lib/availabilityData", () => ({
  getPublishedAvailability: vi.fn(async () => batches()),
  setReleaseResponse: (...args: [string, "available" | "unavailable"]) => respond(...args),
}));

describe("Availability batches", () => {
  beforeEach(() => {
    responseStatus = null;
    respond.mockClear();
    vi.spyOn(window, "confirm").mockReturnValue(true);
  });

  it("shows newest batches first, highlights a deep link, and keeps compensation visible", async () => {
    render(<MemoryRouter initialEntries={["/availability?batch=batch-new"]}><AvailabilityPage /></MemoryRouter>);

    const headings = await screen.findAllByRole("heading", { level: 2 });
    expect(headings[0]).toHaveTextContent("Latest release");
    const target = screen.getByTestId("availability-batch-batch-new");
    expect(target).toHaveClass("targeted");
    expect(within(target).getByText("Artist A & Artist B")).toBeInTheDocument();
    expect(within(target).getByText("Pay: $550.00")).toBeInTheDocument();
    expect(screen.getByText("Potential bonus: $125.00")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Draft Show")).not.toBeInTheDocument();
  });

  it("treats linked signings as one all-or-none response and refreshes each change", async () => {
    render(<MemoryRouter><AvailabilityPage /></MemoryRouter>);
    const card = await screen.findByTestId("availability-opportunity-linked-signings");
    expect(within(card).getAllByRole("button", { name: /Available|Unavailable/ })).toHaveLength(2);

    fireEvent.click(within(card).getByRole("button", { name: "Available" }));
    await waitFor(() => expect(respond).toHaveBeenLastCalledWith("linked-signings", "available"));
    await waitFor(() => expect(within(card).getByRole("button", { name: "Available" })).toHaveClass("selected"));

    fireEvent.click(within(card).getByRole("button", { name: "Unavailable" }));
    await waitFor(() => expect(respond).toHaveBeenLastCalledWith("linked-signings", "unavailable"));
    await waitFor(() => expect(within(card).getByRole("button", { name: "Unavailable" })).toHaveClass("selected"));

    fireEvent.click(within(card).getByRole("button", { name: "Available" }));
    await waitFor(() => expect(respond).toHaveBeenLastCalledWith("linked-signings", "available"));
    expect(window.confirm).toHaveBeenCalledTimes(3);
  });

  it("uses contract wording when a search has no matches", async () => {
    render(<MemoryRouter><AvailabilityPage /></MemoryRouter>);
    fireEvent.change(await screen.findByRole("searchbox", { name: "Search availability" }), { target: { value: "missing" } });
    expect(screen.getByRole("heading", { name: "No matching contracts" })).toBeInTheDocument();
    expect(screen.queryByText(/opportunit/i)).not.toBeInTheDocument();
  });
});

function availabilityShow(overrides: Partial<AvailabilityBatch["opportunities"][number]["shows"][number]>) {
  return {
    id: "signing-a",
    name: "Artist A Signing",
    starts_on: "2026-11-10",
    ends_on: "2026-11-10",
    city: "Denver",
    state: "CO",
    address: "100 Main St",
    event_type: "signing" as const,
    artist: "Artist A",
    venue_name: "Grand Hall",
    signing_at: "2026-11-10T18:00:00Z",
    setup_at: "2026-11-10T16:00:00Z",
    is_test: false,
    contract_id: "contract-a",
    contract_kind: "setup" as const,
    service_date: "2026-11-10",
    service_time: "16:00:00",
    contract_pay: 250,
    bonus_pay: null,
    ...overrides,
  };
}
