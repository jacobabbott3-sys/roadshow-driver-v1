import { useCallback, useRef, useState } from "react";

export type MutationState = "idle" | "saving" | "saved" | "failed";
export type MutationOptions = { successMessage?: string; retryable?: boolean };

export function useMutationFeedback() {
  const [state, setState] = useState<MutationState>("idle");
  const [message, setMessage] = useState("");
  const latest = useRef<{ action: () => Promise<unknown>; options: MutationOptions } | null>(null);

  const run = useCallback(async <T,>(action: () => Promise<T>, options: MutationOptions = {}): Promise<T> => {
    setState("saving");
    setMessage("");
    latest.current = options.retryable === false ? null : { action, options };
    try {
      const result = await action();
      setState("saved");
      setMessage(options.successMessage || "Saved.");
      return result;
    } catch (error) {
      setState("failed");
      setMessage(toMutationMessage(error));
      throw error;
    }
  }, []);

  const retry = useCallback(async () => {
    if (!latest.current) return undefined;
    const { action, options } = latest.current;
    return run(action, options);
  }, [run]);

  const clear = useCallback(() => {
    setState("idle");
    setMessage("");
  }, []);

  return { state, message, run, retry, clear };
}

export function toMutationMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "object" && error && "message" in error && typeof error.message === "string" && error.message.trim()) return error.message;
  return "Something went wrong. Please try again.";
}
