import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { ListSearch } from "./ListSearch";

function SearchHarness({ initialValue = "", resultCount = 3 }) {
  const [value, setValue] = useState(initialValue);
  return (
    <ListSearch
      value={value}
      onChange={setValue}
      placeholder="Search people"
      label="Search the driver directory"
      resultCount={resultCount}
    />
  );
}

describe("ListSearch", () => {
  it("has an accessible label and announces the result count", () => {
    render(<SearchHarness resultCount={1} />);
    expect(screen.getByRole("searchbox", { name: "Search the driver directory" })).toHaveAttribute("placeholder", "Search people");
    expect(screen.getByRole("status")).toHaveTextContent("1 result");
  });

  it("shows a clear button only when needed and returns focus to the search box", () => {
    render(<SearchHarness initialValue="Alex" />);
    const input = screen.getByRole("searchbox", { name: "Search the driver directory" });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input).toHaveValue("");
    expect(input).toHaveFocus();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("does not render a clear button for an empty value", () => {
    render(<SearchHarness />);
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });
});
