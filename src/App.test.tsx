import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { lazy, Suspense } from "react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { LoadingScreen } from "./components/LoadingScreen";

describe("route loading", () => {
  it("keeps protected and admin route modules out of the eager entry bundle", () => {
    const source = readFileSync(`${process.cwd()}/src/App.tsx`, "utf8");
    expect(source).toContain("lazy(() => import(\"./pages/HomePage\")");
    expect(source).toContain("lazy(() => import(\"./pages/AdminPage\")");
    expect(source).toContain("<Suspense fallback={<LoadingScreen");
    expect(source).not.toContain('import { AdminPage } from "./pages/AdminPage"');
  });

  it("shows one accessible fallback while a protected route module loads", () => {
    const Pending = lazy(() => new Promise<{ default: React.ComponentType }>(() => undefined));
    render(<Suspense fallback={<LoadingScreen label="Opening screen…" />}><Pending /></Suspense>);
    expect(screen.getByRole("status")).toHaveTextContent("Opening screen…");
  });

  it("sends a failed lazy import to the application recovery screen", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const Failed = lazy(() => Promise.reject(new Error("chunk failed")));
    render(<AppErrorBoundary><Suspense fallback={<LoadingScreen />}><Failed /></Suspense></AppErrorBoundary>);
    expect(await screen.findByRole("alert")).toHaveTextContent("The app hit a roadblock");
  });
});
