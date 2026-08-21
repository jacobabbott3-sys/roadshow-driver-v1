import { CalendarDays, Check, CircleDollarSign, Clock3, PenLine, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { PageState } from "../components/PageState";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { AvailabilityRow, dateRange, getAvailability, setAvailabilityMany } from "../lib/driverData";

type AvailabilityGroup = { id: string; rows: AvailabilityRow[] };

export function AvailabilityPage() {
  const { user } = useAuth();
  const availability = useAsync(() => getAvailability(user!.id), [user?.id]);
  const [saving, setSaving] = useState("");
  const groups = groupAvailability(availability.data || []);

  async function choose(group: AvailabilityGroup, status: "available" | "unavailable") {
    const signings = group.rows.filter((row) => row.show.event_type === "signing");
    if (signings.length > 1) {
      const answer = window.confirm(
        `${status === "available" ? "Mark yourself available" : "Mark yourself unavailable"} for all ${signings.length} linked signings? Linked signings must be accepted or declined together.`,
      );
      if (!answer) return;
    }
    setSaving(group.id);
    try {
      await setAvailabilityMany(group.rows.map((row) => row.show_id), user!.id, status);
      await availability.refresh();
    } finally {
      setSaving("");
    }
  }

  return (
    <main className="page">
      <header className="page-header">
        <div><p className="eyebrow">PLAN AHEAD</p><h1>Availability</h1><p>Open shows and signings accept availability. Assigned work shows the confirmed team.</p></div>
      </header>
      <PageState loading={availability.loading} error={availability.error} empty={!groups.length}>
        <div className="availability-list">
          {groups.map((group) => {
            const first = group.rows[0];
            const signing = first.show.event_type === "signing";
            const linked = signing && group.rows.length > 1;
            const title = linked
              ? group.rows.map((row) => row.show.artist || row.show.name).join(" & ")
              : signing ? first.show.artist || first.show.name : first.show.name;
            const status = commonStatus(group.rows);
            const assignees = uniqueAssignees(group.rows);
            const detailPath = linked ? `/signing-groups/${first.show_id}` : undefined;
            const setupDate = signing ? earliestSigningSetup(group.rows) : first.service_date;

            return (
              <article className="availability-card" key={group.id}>
                <div className="calendar-box">
                  {signing ? <PenLine /> : <CalendarDays />}
                  <strong>{setupDate ? new Date(signing ? setupDate : `${setupDate}T12:00:00`).getDate() : "—"}</strong>
                </div>
                <div className="availability-details">
                  {detailPath ? <h2><Link className="availability-title-link" to={detailPath}>{title}</Link></h2> : <h2>{title}</h2>}
                  <p>{signing ? `${group.rows.length} linked signings · ${signingDateRange(group.rows)}` : `${dateRange(first.show)} · ${first.show.city}${first.show.state ? `, ${first.show.state}` : ""}`}</p>
                  <div className="availability-contract-meta">
                    <span><Clock3 /> {signing ? `First setup: ${formatDateTime(setupDate)}` : `${first.contract_kind ? `${capitalize(first.contract_kind)}: ` : "Work date: "}${formatWorkDate(first.service_date, first.service_time)}`}</span>
                    {!signing && <span><CircleDollarSign /> Pay: {money(first.contract_pay)}{first.bonus_pay != null ? ` · Potential bonus: ${money(first.bonus_pay)}` : ""}</span>}
                  </div>
                </div>
                {assignees.length ? (
                  <div className="assigned-team"><span className="status status-approved"><UsersRound /> Assigned</span><strong>{assignees.join(", ")}</strong></div>
                ) : (
                  <div className="availability-actions">
                    <button className={status === "available" ? "selected yes" : "yes"} disabled={saving === group.id} onClick={() => void choose(group, "available")}><Check /> Available</button>
                    <button className={status === "unavailable" ? "selected no" : "no"} disabled={saving === group.id} onClick={() => void choose(group, "unavailable")}><X /> Unavailable</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </PageState>
    </main>
  );
}

function groupAvailability(rows: AvailabilityRow[]) {
  const byId = new Map(rows.map((row) => [row.show_id, row]));
  const seen = new Set<string>();
  const groups: AvailabilityGroup[] = [];
  for (const row of rows) {
    if (seen.has(row.show_id)) continue;
    if (row.show.event_type !== "signing") {
      seen.add(row.show_id);
      groups.push({ id: row.show_id, rows: [row] });
      continue;
    }
    const queue = [row.show_id];
    const linkedRows: AvailabilityRow[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const current = byId.get(id);
      if (!current || current.show.event_type !== "signing") continue;
      linkedRows.push(current);
      current.linked_show_ids.forEach((linkedId) => { if (!seen.has(linkedId) && byId.has(linkedId)) queue.push(linkedId); });
    }
    linkedRows.sort((a, b) => (a.show.signing_at || a.show.starts_on).localeCompare(b.show.signing_at || b.show.starts_on));
    groups.push({ id: linkedRows[0]?.show_id || row.show_id, rows: linkedRows.length ? linkedRows : [row] });
  }
  return groups;
}

function commonStatus(rows: AvailabilityRow[]) {
  const statuses = new Set(rows.map((row) => row.status));
  return statuses.size === 1 ? rows[0].status : "pending";
}
function uniqueAssignees(rows: AvailabilityRow[]) {
  return [...new Set(rows.flatMap((row) => row.assignees.map((person) => person.full_name || "Team member")))];
}
function earliestSigningSetup(rows: AvailabilityRow[]) {
  return rows.map((row) => row.show.setup_at || row.show.signing_at).filter(Boolean).sort()[0] || null;
}
function signingDateRange(rows: AvailabilityRow[]) {
  const dates = rows.map((row) => row.show.signing_at || row.show.starts_on).filter(Boolean).sort();
  if (!dates.length) return "Not scheduled";
  const first = new Date(dates[0]).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const last = new Date(dates.at(-1)!).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return first === last ? first : `${first}–${last}`;
}
function money(value: number | null) { return value == null ? "Not set" : value.toLocaleString(undefined, { style: "currency", currency: "USD" }); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
function formatWorkDate(date: string | null, time: string | null) {
  if (!date) return "Not scheduled";
  const formatted = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
  if (!time) return formatted;
  const formattedTime = new Date(`2000-01-01T${time}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${formatted} at ${formattedTime}`;
}
function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled";
}
