import {
  ClipboardCheck,
  Eye,
  FileClock,
  MessageSquareText,
  Store as TentTree,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AdminHeader } from "../components/AdminNav";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { getDashboardStats, getReviews } from "../lib/adminData";
import { dateRange, statusLabel } from "../lib/driverData";

export function AdminPage() {
  const stats = useAsync(getDashboardStats, []);
  const reviews = useAsync(getReviews, []);
  return (
    <main className="page">
      <AdminHeader
        eyebrow="ADMIN WORKSPACE"
        title="Operations overview"
        description="Shows, drivers, and work waiting for your attention."
      />
      <PageState loading={stats.loading} error={stats.error}>
        <div className="stats admin-stats">
          <Link to="/admin/shows">
            <TentTree />
            <strong>{stats.data?.shows}</strong>
            <span>Upcoming shows</span>
          </Link>
          <article>
            <FileClock />
            <strong>{stats.data?.unsigned}</strong>
            <span>Awaiting signature</span>
          </article>
          <article>
            <ClipboardCheck />
            <strong>{stats.data?.reviews}</strong>
            <span>Awaiting review</span>
          </article>
          <Link to="/admin/users">
            <UsersRound />
            <strong>{stats.data?.drivers}</strong>
            <span>Active drivers</span>
          </Link>
          <Link to="/admin/operations">
            <MessageSquareText />
            <strong>{stats.data?.feedback}</strong>
            <span>New feedback</span>
          </Link>
        </div>
      </PageState>
      <section className="admin-section">
        <div className="section-row">
          <div>
            <p className="eyebrow">ACTION NEEDED</p>
            <h2>Checklist reviews</h2>
          </div>
          <Link to="/admin/checklists">View all checklists →</Link>
        </div>
        <PageState loading={reviews.loading} error={reviews.error}>
          {!reviews.data?.length ? (
            <div className="inline-empty">
              No checklists are waiting for review.
            </div>
          ) : (
            reviews.data.map((review) => (
              <article className="review-row" key={review.id}>
                <div>
                  <strong>
                    {review.show.name} · {statusLabel(review.kind)}
                  </strong>
                  <span>
                    {review.driver?.full_name || "Unassigned"} ·{" "}
                    {dateRange(review.show)}
                  </span>
                </div>
                <div>
                  <Link
                    className="review-open-button"
                    to={`/admin/checklists/${review.id}`}
                  >
                    <Eye /> Review checklist
                  </Link>
                </div>
              </article>
            ))
          )}
        </PageState>
      </section>
    </main>
  );
}
