import { CalendarDays, Check, UsersRound, X } from "lucide-react";
import { useState } from "react";
import { PageState } from "../components/PageState";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { dateRange, getAvailability, setAvailability } from "../lib/driverData";

export function AvailabilityPage() {
  const { user } = useAuth();
  const availability = useAsync(() => getAvailability(user!.id), [user?.id]);
  const [saving, setSaving] = useState("");

  async function choose(showId: string, status: "available" | "unavailable") {
    setSaving(showId);
    await setAvailability(showId, user!.id, status);
    await availability.refresh();
    setSaving("");
  }

  return (
    <main className="page">
      <header className="page-header"><div><p className="eyebrow">PLAN AHEAD</p><h1>Availability</h1><p>Open shows accept availability. Assigned shows show the confirmed team.</p></div></header>
      <PageState loading={availability.loading} error={availability.error} empty={!availability.data?.length}>
        <div className="availability-list">
          {availability.data?.map((row) => (
            <article className="availability-card" key={row.show_id}>
              <div className="calendar-box"><CalendarDays /><strong>{new Date(`${row.show.starts_on}T12:00:00`).getDate()}</strong></div>
              <div><h2>{row.show.name}</h2><p>{dateRange(row.show)} · {row.show.city}{row.show.state ? `, ${row.show.state}` : ""}</p></div>
              {row.assignees.length ? (
                <div className="assigned-team"><span className="status status-approved"><UsersRound /> Assigned</span><strong>{row.assignees.map((person) => person.full_name || "Team member").join(", ")}</strong></div>
              ) : (
                <div className="availability-actions">
                  <button className={row.status === "available" ? "selected yes" : "yes"} disabled={saving === row.show_id} onClick={() => void choose(row.show_id, "available")}><Check /> Available</button>
                  <button className={row.status === "unavailable" ? "selected no" : "no"} disabled={saving === row.show_id} onClick={() => void choose(row.show_id, "unavailable")}><X /> Unavailable</button>
                </div>
              )}
            </article>
          ))}
        </div>
      </PageState>
    </main>
  );
}
