import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useMutationFeedback } from "./useMutationFeedback";

describe("useMutationFeedback", () => {
  it("moves through saving and saved with custom success text", async () => {
    let resolve!: (value: string) => void;
    const action = vi.fn(() => new Promise<string>((done) => { resolve = done; }));
    const { result } = renderHook(() => useMutationFeedback());
    let promise!: Promise<string>;
    act(() => { promise = result.current.run(action, { successMessage: "Show saved." }); });
    expect(result.current.state).toBe("saving");
    await act(async () => { resolve("ok"); await promise; });
    expect(result.current.state).toBe("saved");
    expect(result.current.message).toBe("Show saved.");
  });

  it("converts failures, safely retries the latest retryable action, and clears stale messages", async () => {
    const action = vi.fn().mockRejectedValueOnce({ message: "Connection lost" }).mockResolvedValueOnce("ok");
    const { result } = renderHook(() => useMutationFeedback());
    await act(async () => { await expect(result.current.run(action)).rejects.toEqual({ message: "Connection lost" }); });
    expect(result.current.state).toBe("failed");
    expect(result.current.message).toBe("Connection lost");
    await act(async () => { await result.current.retry(); });
    expect(action).toHaveBeenCalledTimes(2);
    expect(result.current.state).toBe("saved");
    act(() => result.current.clear());
    expect(result.current.state).toBe("idle");
    expect(result.current.message).toBe("");
  });

  it("does not retain a retry for non-retryable actions", async () => {
    const action = vi.fn().mockRejectedValue(new Error("Invalid form"));
    const { result } = renderHook(() => useMutationFeedback());
    await act(async () => { await expect(result.current.run(action, { retryable: false })).rejects.toThrow("Invalid form"); });
    expect(result.current.state).toBe("failed");
    await act(async () => { await result.current.retry(); });
    expect(action).toHaveBeenCalledTimes(1);
  });
});
