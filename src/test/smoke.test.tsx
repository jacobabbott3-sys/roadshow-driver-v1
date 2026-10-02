import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

function TestCard() {
  return <section aria-label="Test card">Beta 5A UI tests are ready.</section>;
}

describe("UI test setup", () => {
  it("renders React components with accessible jest-dom assertions", () => {
    render(<TestCard />);
    expect(screen.getByRole("region", { name: "Test card" })).toHaveTextContent(
      "Beta 5A UI tests are ready.",
    );
  });
});
