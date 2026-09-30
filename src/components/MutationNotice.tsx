import { CheckCircle2, RotateCcw, X } from "lucide-react";
import type { MutationState } from "../hooks/useMutationFeedback";

export function MutationNotice({ state, message, onRetry, onDismiss }: {
  state: MutationState;
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  if (state === "idle" || state === "saving" || !message) return null;
  return (
    <div className={`mutation-notice ${state}`} role={state === "failed" ? "alert" : "status"}>
      {state === "saved" && <CheckCircle2 aria-hidden="true" />}
      <span>{message}</span>
      {state === "failed" && onRetry && <button type="button" onClick={onRetry}><RotateCcw /> Try again</button>}
      {onDismiss && <button type="button" className="icon-button" onClick={onDismiss} aria-label="Dismiss message"><X /></button>}
    </div>
  );
}
