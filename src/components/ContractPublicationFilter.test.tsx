import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ContractPublicationFilter } from "./ContractPublicationFilter";

describe("ContractPublicationFilter", () => {
  it("offers all, published, and not published filters", () => {
    const onChange = vi.fn();
    render(<ContractPublicationFilter value="all" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(screen.getByRole("button", { name: "Published" }));
    expect(onChange).toHaveBeenCalledWith("published");
    fireEvent.click(screen.getByRole("button", { name: "Not published" }));
    expect(onChange).toHaveBeenCalledWith("not_published");
  });
});
