import {
  ClipboardCheck,
  FlaskConical,
  Eye,
  FileClock,
  MessageSquareText,
  PenLine,
  Store as TentTree,
  UsersRound,
  RotateCcw,
} from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminHeader } from "../components/AdminNav";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { getBetaTestShow, getDashboardStats, getReviews, resetBetaTestShow } from "../lib/adminData";
import { dateRange, statusLabel } from "../lib/driverData";
import { release } from "../lib/release";
import { useAuth } from "../context/AuthContext";

export function AdminPage() {
  const { user } = useAuth();
  const stats = useAsync(getDashboardStats, []);
  const reviews = useAsync(getReviews, []);
  const testShow = useAsync(() => getBetaTestShow(user!.id), [user?.id]);
  const [testBusy, setTestBusy] = useState(false);
  const [testMessage, setTestMessage] = useState("");

  async function resetTestShow() {
    if (testShow.data && !window.confirm("Reset the Beta Test Show? This clears its checklist progress, reviews, signatures, bonus result, availability, and submitted photo records.")) return;
    setTestBusy(true);
    setTestMessage("");
    try {
      await resetBetaTestShow();
      await Promise.all([testShow.refresh(), stats.refresh(), reviews.refresh()]);
      setTestMessage(testShow.data ? "Beta Test Show reset and ready." : "Beta Test Show created and assigned to you.");
    } catch (error) {
      setTestMessage(error instanceof Error ? error.message : "Unable to prepare the Beta Test Show.");
    } finally {
      setTestBusy(false);
    }
  }
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
          <Link to="/admin/signings">
            <PenLine />
            <strong>{stats.data?.signings}</strong>
            <span>Upcoming signings</span>
          </Link>
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
      {release.channel === "beta" && (
        <section className="beta-test-panel">
          <div className="beta-test-icon"><FlaskConical /></div>
          <div>
            <p className="eyebrow">BETA TESTING SANDBOX</p>
            <h2>{testShow.data ? testShow.data.name : "Create a resettable Test Show"}</h2>
            <p>Assigned only to you for testing contracts, signatures, checklists, reviews, notifications, photos, and bonuses. It is hidden from public builds.</p>
            {(testMessage || testShow.error) && <p className="notice">{testMessage || testShow.error}</p>}
          </div>
          <div className="beta-test-actions">
            {testShow.data?.contract_id && <Link className="button secondary" to={`/contracts/${testShow.data.contract_id}`}>Open test contract →</Link>}
            <button className="button primary" disabled={testBusy || testShow.loading} onClick={() => void resetTestShow()}>
              {testShow.data ? <RotateCcw /> : <FlaskConical />}
              {testBusy ? "Preparing…" : testShow.data ? "Reset Test Show" : "Create Test Show"}
            </button>
          </div>
        </section>
      )}
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
