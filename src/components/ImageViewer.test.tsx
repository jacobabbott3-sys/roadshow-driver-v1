import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImageViewer } from "./ImageViewer";

describe("ImageViewer", () => {
  it("allows high-resolution photos to zoom to 1000 percent", () => {
    render(<ImageViewer src="/manifest.jpg" alt="manifest" />);
    fireEvent.click(screen.getByRole("button", { name: "Open manifest" }));
    const zoomIn = screen.getByRole("button", { name: "Zoom in" });
    for (let step = 0; step < 18; step += 1) fireEvent.click(zoomIn);
    expect(screen.getByText("1000%")).toBeInTheDocument();
    expect(zoomIn).toBeDisabled();
  });
});
