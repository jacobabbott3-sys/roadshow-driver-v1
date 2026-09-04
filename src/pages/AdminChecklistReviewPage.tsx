import {
  Check,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  RotateCcw,
  UserRound,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useParams } from "react-router-dom";
import { AdminHeader } from "../components/AdminNav";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import {
  finalizeChecklistReview,
  getChecklistReview,
  reviewChecklistItem,
  setContractBonusResult,
} from "../lib/adminData";
import { dateRange, statusLabel } from "../lib/driverData";

export function AdminChecklistReviewPage() {
  const { contractId = "" } = useParams();
  const review = useAsync(
    () => getChecklistReview(contractId),
    [contractId],
  );
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const contract = review.data?.contract;
  const items =
    review.data?.checklist.sections.flatMap((section) => section.items) || [];
  const approved = items.filter(
    (item) => item.response?.review_status === "approved",
  ).length;
  const denied = items.filter(
    (item) => item.response?.review_status === "denied",
  ).length;
  const pending = items.length - approved - denied;
  const canReview = ["submitted", "under_review"].includes(
    contract?.status || "",
  );
  const reviewApproved = [
    "approved",
    "bonus_earned",
    "bonus_not_earned",
  ].includes(contract?.status || "");

  async function decide(itemId: string, status: "approved" | "denied") {
    const note = notes[itemId] ?? "";
    if (status === "denied" && !note.trim()) {
      setMessage("Add a correction note before denying an item.");
      return;
    }
    setBusy(itemId);
    setMessage("");
    try {
      await reviewChecklistItem(contractId, itemId, status, note);
      await review.refresh();
      setMessage(status === "approved" ? "Item approved." : "Item denied.");
    } catch (error) {
      setMessage(errorMessage(error, "Unable to save the review."));
    } finally {
      setBusy("");
    }
  }

  async function finishReview() {
    setBusy("finish");
    setMessage("");
    try {
      const result = await finalizeChecklistReview(contractId);
      await review.refresh();
      setMessage(
        result === "approved"
          ? "Checklist approved. This review is now saved in Review history."
          : "Checklist returned to the driver. Denied items were reopened for correction.",
      );
    } catch (error) {
      setMessage(errorMessage(error, "Unable to finish the review."));
    } finally {
      setBusy("");
    }
  }
  async function setBonus(earned: boolean) {
    setBusy("bonus");
    setMessage("");
    try {
      await setContractBonusResult(contractId, earned);
      await review.refresh();
      setMessage(earned ? "Bonus marked as earned." : "Bonus marked as not earned.");
    } catch (error) {
      setMessage(errorMessage(error, "Unable to save bonus result."));
    } finally { setBusy(""); }
  }

  return (
    <main className="page">
      <AdminHeader
        eyebrow="CHECKLIST REVIEW"
        title={contract?.show.name || "Review checklist"}
        description="Review the driver's complete submission item by item."
        backTo="/admin/checklists"
        backLabel="Back to checklists"
      />
      <PageState
        loading={review.loading}
        error={review.error}
        empty={!review.data}
      >
        {review.data && contract && (
          <>
            <section className="review-overview">
              <div>
                <span className={`status status-${contract.status}`}>
                  {statusLabel(contract.status)}
                </span>
                <h2>
                  {statusLabel(contract.kind)} · {dateRange(contract.show)}
                </h2>
                <p>
                  <UserRound />
                  {contract.driver?.full_name || "Unassigned driver"}
                </p>
                {contract.submitted_at && (
                  <p>
                    <Clock3 /> Submitted{" "}
                    {new Date(contract.submitted_at).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="review-counts">
                <span>
                  <CheckCircle2 /> <strong>{approved}</strong> approved
                </span>
                <span>
                  <XCircle /> <strong>{denied}</strong> denied
                </span>
                <span>
                  <ClipboardCheck /> <strong>{pending}</strong> remaining
                </span>
              </div>
            </section>

            {message && <p className="notice">{message}</p>}

            {!items.length ? (
              <section className="admin-section inline-empty">
                This contract does not have checklist items.
              </section>
            ) : (
              review.data.checklist.sections.map((section) => (
                <section className="review-section" key={section.id}>
                  <div className="review-section-title">
                    <div>
                      <p className="eyebrow">SECTION</p>
                      <h2>{section.title}</h2>
                    </div>
                    <span>
                      {
                        section.items.filter((item) =>
                          ["approved", "denied"].includes(
                            item.response?.review_status || "",
                          ),
                        ).length
                      }
                      /{section.items.length} reviewed
                    </span>
                  </div>
                  <div className="review-item-list">
                    {section.items.map((item) => {
                      const decision = item.response?.review_status;
                      const note =
                        notes[item.id] ?? item.response?.review_note ?? "";
                      return (
                        <article
                          className={`review-item ${decision || "pending"}`}
                          key={item.id}
                        >
                          <div className="review-item-result">
                            {item.response?.completed ? (
                              <CheckCircle2 />
                            ) : (
                              <XCircle />
                            )}
                            <div>
                              <h3>{item.title}</h3>
                              <span>
                                Driver marked this item{" "}
                                {item.response?.completed
                                  ? "complete"
                                  : "incomplete"}
                              </span>
                              {item.instructions && <p>{item.instructions}</p>}
                              {item.response?.note && (
                                <p>
                                  <strong>Driver note:</strong>{" "}
                                  {item.response.note}
                                </p>
                              )}
                            </div>
                            {decision && (
                              <span className={`review-decision ${decision}`}>
                                {decision === "approved" ? <Check /> : <X />}
                                {decision === "approved"
                                  ? "Approved"
                                  : "Needs changes"}
                              </span>
                            )}
                          </div>

                          {canReview ? (
                            <div className="review-item-controls">
                              <label>
                                Review note (required for Needs changes)
                                <textarea
                                  value={note}
                                  onChange={(event) =>
                                    setNotes({
                                      ...notes,
                                      [item.id]: event.target.value,
                                    })
                                  }
                                  placeholder="Explain a correction or leave an optional approval note…"
                                />
                              </label>
                              <div>
                                <button
                                  className="review-deny"
                                  disabled={busy === item.id}
                                  onClick={() => void decide(item.id, "denied")}
                                >
                                  <RotateCcw /> Needs changes
                                </button>
                                <button
                                  className="review-approve"
                                  disabled={
                                    busy === item.id ||
                                    !item.response?.completed
                                  }
                                  onClick={() =>
                                    void decide(item.id, "approved")
                                  }
                                >
                                  <Check /> Approve item
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="review-history-note">
                              {decision ? (
                                <>
                                  <strong>
                                    {decision === "approved"
                                      ? "Approved"
                                      : "Returned for changes"}
                                  </strong>
                                  {item.response?.review_note && (
                                    <p>{item.response.review_note}</p>
                                  )}
                                  <small>
                                    {item.response?.reviewer?.full_name ||
                                      contract.reviewer?.full_name ||
                                      "Administrator"}
                                    {item.response?.reviewed_at &&
                                      ` · ${new Date(
                                        item.response.reviewed_at,
                                      ).toLocaleString()}`}
                                  </small>
                                </>
                              ) : (
                                <span>Not individually reviewed</span>
                              )}
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            )}

            {canReview ? (
              <section className="finish-review-panel">
                <div>
                  <p className="eyebrow">FINAL DECISION</p>
                  <h2>
                    {pending
                      ? `${pending} item${pending === 1 ? "" : "s"} left to review`
                      : denied
                        ? `Return ${denied} item${denied === 1 ? "" : "s"} for correction`
                        : "Approve the completed checklist"}
                  </h2>
                  <p>
                    {denied
                      ? "Only denied items will reopen for the driver. Approved decisions remain saved."
                      : "The checklist will be marked approved after every item is approved."}
                  </p>
                </div>
                <button
                  className={`button ${denied ? "danger" : "primary"}`}
                  disabled={pending > 0 || busy === "finish"}
                  onClick={() => void finishReview()}
                >
                  {denied ? <RotateCcw /> : <CheckCircle2 />}
                  {busy === "finish"
                    ? "Saving review…"
                    : denied
                      ? "Return checklist to driver"
                      : "Approve checklist"}
                </button>
              </section>
            ) : (
              <>
              <section
                className={`review-complete-banner ${reviewApproved ? "approved" : "returned"}`}
              >
                {reviewApproved ? (
                  <CheckCircle2 />
                ) : (
                  <RotateCcw />
                )}
                <div>
                  <h2>
                    {reviewApproved
                      ? "Checklist approved"
                      : "Checklist returned to the driver"}
                  </h2>
                  <p>{contract.admin_note}</p>
                  {contract.reviewed_at && (
                    <small>
                      Reviewed by{" "}
                      {contract.reviewer?.full_name || "Administrator"} ·{" "}
                      {new Date(contract.reviewed_at).toLocaleString()}
                    </small>
                  )}
                </div>
              </section>
              {reviewApproved && contract.bonus_pay != null && (
                <section className="finish-review-panel bonus-decision">
                  <div><p className="eyebrow">BONUS RESULT</p><h2>Potential bonus: ${contract.bonus_pay.toLocaleString()}</h2><p>Record whether the approved contract earned its potential bonus.</p></div>
                  <div><button className="button danger" disabled={busy === "bonus"} onClick={() => void setBonus(false)}><X /> Not earned</button><button className="button primary" disabled={busy === "bonus"} onClick={() => void setBonus(true)}><Check /> Bonus earned</button></div>
                </section>
              )}
              </>
            )}
          </>
        )}
      </PageState>
    </main>
  );
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") return error.message;
  return fallback;
}
