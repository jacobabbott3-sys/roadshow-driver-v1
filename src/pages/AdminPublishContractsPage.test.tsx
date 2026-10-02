import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublishableOpportunity } from "../types";
import { AdminPublishContractsPage } from "./AdminPublishContractsPage";

const publish = vi.fn();
const opportunities: PublishableOpportunity[] = [
  {
    opportunity_id: "group-a",
    show_ids: ["show-a", "show-b"],
    title: "Artist A & Artist B",
    event_type: "signing",
    location: "Grand Hall",
    work_at: "2026-11-10T18:00:00Z",
    contract_kind: "setup",
    contract_pay: 500,
    bonus_pay: 100,
  },
  {
    opportunity_id: "show-c",
    show_ids: ["show-c"],
    title: "Denver Holiday Show",
    event_type: "show",
    location: "Convention Center",
    work_at: "2026-12-01T08:00:00Z",
    contract_kind: "setup",
    contract_pay: 700,
    bonus_pay: 150,
  },
];

vi.mock("../lib/availabilityData", () => ({
  getPublishableOpportunities: vi.fn(async () => opportunities),
  getPublishedAvailability: vi.fn(async () => []),
  publishContractBatch: (...args: unknown[]) => publish(...args),
  withdrawReleaseItem: vi.fn(async () => undefined),
}));

describe("Publish Contracts workspace", () => {
  beforeEach(() => publish.mockReset().mockResolvedValue("batch-new"));

  it("selects a linked signing as one contract and publishes unique show ids", async () => {
    render(<MemoryRouter><AdminPublishContractsPage /></MemoryRouter>);

    const linked = await screen.findByRole("checkbox", { name: /Artist A & Artist B/i });
    fireEvent.click(linked);
    expect(screen.getByText("1 contract selected")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("checkbox", { name: /Select all/i }));
    expect(screen.getByText("2 contracts selected")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Publish selected/i }));

    const dialog = screen.getByRole("dialog", { name: /Publish 2 contracts/i });
    expect(dialog).toHaveTextContent("Artist A & Artist B");
    expect(dialog).toHaveTextContent("$500.00");
    expect(dialog).toHaveTextContent("Potential bonus: $100.00");

    fireEvent.click(screen.getByRole("button", { name: "Publish batch" }));
    await waitFor(() => expect(publish).toHaveBeenCalledWith(["show-a", "show-b", "show-c"]));
  });

  it("keeps the selection when publication fails", async () => {
    publish.mockRejectedValueOnce(new Error("Connection lost"));
    render(<MemoryRouter><AdminPublishContractsPage /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("checkbox", { name: /Artist A & Artist B/i }));
    fireEvent.click(screen.getByRole("button", { name: /Publish selected/i }));
    fireEvent.click(screen.getByRole("button", { name: "Publish batch" }));
    expect(await screen.findByText("Connection lost")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: /Artist A & Artist B/i })).toBeChecked();
  });
});
