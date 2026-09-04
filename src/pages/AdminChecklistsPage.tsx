import { Eye, History } from "lucide-react";
import { Link } from "react-router-dom";
import { AdminHeader } from "../components/AdminNav";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { getReviewHistory, getReviews } from "../lib/adminData";
import { dateRange, statusLabel } from "../lib/driverData";

export function AdminChecklistsPage() {
  const reviews = useAsync(getReviews, []);
  const history = useAsync(getReviewHistory, []);
  return (
    <main className="page">
      <AdminHeader eyebrow="WORKFLOWS" title="Checklist reviews" description="Review submitted show checklists. Reusable checklist builders are now under Templates." backTo="/admin" />
      <section className="admin-section"><div className="section-row"><div><p className="eyebrow">SUBMISSIONS</p><h2>Awaiting review</h2></div></div><PageState loading={reviews.loading} error={reviews.error}>{!reviews.data?.length ? <div className="inline-empty">No driver submissions are waiting.</div> : reviews.data.map((review) => <article className="review-row" key={review.id}><div><strong>{review.show.name} · {review.kind}</strong><span>{review.driver?.full_name || "Unassigned"}</span></div><Link className="review-open-button" to={`/admin/checklists/${review.id}`}><Eye /> Review full checklist</Link></article>)}</PageState></section>
      <section className="admin-section"><div className="section-row"><div><p className="eyebrow">HISTORY</p><h2>Reviewed checklists</h2></div><History /></div><PageState loading={history.loading} error={history.error}>{!history.data?.length ? <div className="inline-empty">Completed reviews will remain available here.</div> : history.data.map((review) => <article className="review-row review-history-row" key={review.id}><div><strong>{review.show.name} · {statusLabel(review.kind)}</strong><span>{review.driver?.full_name || "Unassigned"} · {dateRange(review.show)}</span><small>Reviewed by {review.reviewer?.full_name || "Administrator"} · {new Date(review.reviewed_at).toLocaleString()}</small></div><div><span className={`status status-${review.status}`}>{["approved", "bonus_earned", "bonus_not_earned"].includes(review.status) ? "Approved" : "Returned"}</span><Link className="review-open-button" to={`/admin/checklists/${review.id}`}><Eye /> View review</Link></div></article>)}</PageState></section>
    </main>
  );
}
