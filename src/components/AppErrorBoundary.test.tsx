import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./AppErrorBoundary";

let shouldThrow = true;
function FlakyChild() {
  if (shouldThrow) throw new Error("Render exploded");
  return <p>Recovered content</p>;
}

describe("AppErrorBoundary", () => {
  beforeEach(() => {
    shouldThrow = true;
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("renders recovery controls and remounts children on Try Again", () => {
    render(<AppErrorBoundary><FlakyChild /></AppErrorBoundary>);
    expect(screen.getByRole("heading", { name: "The app hit a roadblock" })).toBeInTheDocument();
    shouldThrow = false;
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }));
    expect(screen.getByText("Recovered content")).toBeInTheDocument();
  });

  it("uses the reload action from Reload App", () => {
    const reload = vi.fn();
    render(<AppErrorBoundary reload={reload}><FlakyChild /></AppErrorBoundary>);
    fireEvent.click(screen.getByRole("button", { name: "Reload App" }));
    expect(reload).toHaveBeenCalledOnce();
  });
});
