import { CalendarDays, Check, CircleDollarSign, Clock3, PenLine, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PageState } from "../components/PageState";
import { ListSearch } from "../components/ListSearch";
import { SortButton } from "../components/SortButton";
import { useAsync } from "../hooks/useAsync";
import { getPublishedAvailability, setReleaseResponse } from "../lib/availabilityData";
import {
  availabilityOpportunityDate,
  availabilityOpportunityTitle,
  filterOpportunities,
  sortOpportunities,
} from "../lib/availabilityModel";
import type { SortMode } from "../lib/listControls";
import type { AvailabilityBatch, AvailabilityOpportunity, AvailabilityShow } from "../types";

export function AvailabilityPage() {
  const availability = useAsync(getPublishedAvailability, []);
  const [searchParams] = useSearchParams();
  const targetBatch = searchParams.get("batch");
  const targetRef = useRef<HTMLElement>(null);
  const [saving, setSaving] = useState("");
  const [actionError, setActionError] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>("date");

  const batches = useMemo(() => (availability.data || []).map((batch) => ({
    ...batch,
    opportunities: sortOpportunities(filterOpportunities(batch.opportunities, query), sort),
  })).filter((batch) => batch.opportunities.length), [availability.data, query, sort]);
  const resultCount = batches.reduce((total, batch) => total + batch.opportunities.length, 0);

  useEffect(() => {
    if (targetBatch && targetRef.current?.scrollIntoView) targetRef.current.scrollIntoView({ block: "center" });
  }, [targetBatch, availability.loading]);

  async function choose(opportunity: AvailabilityOpportunity, status: "available" | "unavailable") {
    if (opportunity.shows.length > 1) {
      const accepted = window.confirm(
        `${status === "available" ? "Mark yourself available" : "Mark yourself unavailable"} for all ${opportunity.shows.length} linked signings? This response applies to the whole group.`,
      );
      if (!accepted) return;
    }
    setSaving(opportunity.id);
    setActionError("");
    try {
      await setReleaseResponse(opportunity.id, status);
      await availability.refresh();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Unable to save your response.");
      await availability.refresh();
    } finally {
      setSaving("");
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div><p className="eyebrow">PLAN AHEAD</p><h1>Availability</h1><p>Published contract batches appear here. Your administrator always makes the final assignment.</p></div>
      </header>
      {actionError && <p className="error" role="alert">{actionError} The contract may have closed; the list has been refreshed.</p>}
      <PageState loading={availability.loading} error={availability.error} empty={!availability.data?.length}>
        <div className="list-toolbar availability-toolbar">
          <ListSearch value={query} onChange={setQuery} placeholder="Search shows, artists, venues, or cities" label="Search availability" resultCount={resultCount} />
          <SortButton value={sort} onChange={setSort} />
        </div>
        {!batches.length ? (
          <section className="empty-state compact"><h2>No matching contracts</h2><p>Try a different search.</p></section>
        ) : (
          <div className="availability-batches">
            {batches.map((batch, index) => {
              const targeted = batch.id === targetBatch;
              const key = batch.id || "assigned-work";
              return (
                <section
                  className={`availability-batch${targeted ? " targeted" : ""}`}
                  data-testid={`availability-batch-${key}`}
                  key={key}
                  ref={targeted ? targetRef : undefined}
                >
                  <header className="availability-batch-header">
                    <div>
                      <p className="eyebrow">{batch.id === null ? "CONFIRMED" : `BATCH ${batches.filter((item) => item.id !== null).length - index}`}</p>
                      <h2>{batchHeading(batch, index)}</h2>
                    </div>
                    <small>{batch.id === null ? "Direct and confirmed assignments" : formatReleasedAt(batch.released_at)}</small>
                  </header>
                  <div className="availability-list">
                    {batch.opportunities.map((opportunity) => (
                      <AvailabilityCard key={opportunity.id} opportunity={opportunity} saving={saving === opportunity.id} onChoose={choose} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </PageState>
    </main>
  );
}

function AvailabilityCard({ opportunity, saving, onChoose }: {
  opportunity: AvailabilityOpportunity;
  saving: boolean;
  onChoose: (opportunity: AvailabilityOpportunity, status: "available" | "unavailable") => Promise<void>;
}) {
  const first = opportunity.shows[0];
  const linked = opportunity.shows.length > 1;
  const signing = opportunity.shows.some((show) => show.event_type === "signing");
  const title = availabilityOpportunityTitle(opportunity);
  const date = availabilityOpportunityDate(opportunity);
  const detailPath = linked ? `/signing-groups/${first.id}` : `/contracts/${first.contract_id}`;
  const pay = sumMoney(opportunity.shows, "contract_pay");
  const bonus = sumMoney(opportunity.shows, "bonus_pay");

  return (
    <article className={`availability-card availability-card-${opportunity.status}`} data-testid={`availability-opportunity-${opportunity.id}`}>
      <div className="calendar-box">
        {signing ? <PenLine aria-hidden="true" /> : <CalendarDays aria-hidden="true" />}
        <strong>{date ? localDate(date).getDate() : "—"}</strong>
      </div>
      <div className="availability-details">
        <div className="availability-title-row">
          <h3><Link className="availability-title-link" to={detailPath}>{title}</Link></h3>
          {linked && <span className="status">{opportunity.shows.length} linked signings</span>}
        </div>
        <p>{locationLine(first)} · {dateRange(opportunity.shows)}</p>
        <div className="availability-contract-meta">
          <span><Clock3 aria-hidden="true" /> {workLabel(first, date)}</span>
          <span><CircleDollarSign aria-hidden="true" /> Pay: {money(pay)}</span>
          {bonus !== null && <span>Potential bonus: {money(bonus)}</span>}
        </div>
      </div>
      {opportunity.status === "assigned" || opportunity.assignees.length ? (
        <div className="assigned-team">
          <span className="status status-approved"><UsersRound aria-hidden="true" /> Assigned</span>
          <strong>{opportunity.assignees.map((person) => person.full_name).join(", ") || "Team confirmed"}</strong>
        </div>
      ) : opportunity.status === "withdrawn" ? (
        <div className="assigned-team"><span className="status">Closed</span><small>This contract is no longer accepting responses.</small></div>
      ) : (
        <div className="availability-actions" aria-label={`Availability response for ${title}`}>
          <button className={opportunity.response_status === "available" ? "selected yes" : "yes"} disabled={saving} onClick={() => void onChoose(opportunity, "available")}><Check aria-hidden="true" /> Available</button>
          <button className={opportunity.response_status === "unavailable" ? "selected no" : "no"} disabled={saving} onClick={() => void onChoose(opportunity, "unavailable")}><X aria-hidden="true" /> Unavailable</button>
        </div>
      )}
    </article>
  );
}

function batchHeading(batch: AvailabilityBatch, index: number) {
  if (batch.id === null) return "Assigned work";
  return index === 0 ? "Latest release" : `Released ${new Date(batch.released_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
}

function formatReleasedAt(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function locationLine(show: AvailabilityShow) {
  return [show.venue_name, show.city, show.state].filter(Boolean).join(", ") || "Location to come";
}

function dateRange(shows: AvailabilityShow[]) {
  const values = shows.map((show) => show.signing_at || show.service_date || show.starts_on).filter(Boolean).sort();
  if (!values.length) return "Date to come";
  const first = localDate(values[0]).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const last = localDate(values.at(-1)!).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return first === last ? first : `${first}–${last}`;
}

function workLabel(show: AvailabilityShow, date: string) {
  const label = show.event_type === "signing" ? "First setup" : `${capitalize(show.contract_kind)} work`;
  return `${label}: ${date ? localDate(date).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: hasTime(date) ? "numeric" : undefined, minute: hasTime(date) ? "2-digit" : undefined }) : "Not scheduled"}`;
}

function localDate(value: string) { return new Date(value.includes("T") ? value : `${value}T12:00:00`); }
function hasTime(value: string) { return value.includes("T"); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function money(value: number | null) { return value == null ? "Not set" : value.toLocaleString(undefined, { style: "currency", currency: "USD" }); }
function sumMoney(shows: AvailabilityShow[], key: "contract_pay" | "bonus_pay") {
  const values = shows.map((show) => show[key]).filter((value): value is number => value !== null);
  return values.length ? values.reduce((total, value) => total + value, 0) : null;
}
