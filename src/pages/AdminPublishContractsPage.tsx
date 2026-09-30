import { BellRing, CalendarDays, Check, CircleDollarSign, Search, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { AdminHeader } from "../components/AdminNav";
import { PageState } from "../components/PageState";
import { SortButton } from "../components/SortButton";
import { useAsync } from "../hooks/useAsync";
import {
  getPublishableOpportunities,
  getPublishedAvailability,
  publishContractBatch,
  withdrawReleaseItem,
} from "../lib/availabilityData";
import { availabilityOpportunityTitle } from "../lib/availabilityModel";
import type { SortMode } from "../lib/listControls";
import type { PublishableOpportunity } from "../types";

export function AdminPublishContractsPage() {
  const publishable = useAsync(getPublishableOpportunities, []);
  const batches = useAsync(getPublishedAvailability, []);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("date");
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const visible = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase();
    const matches = (publishable.data || []).filter((item) => !normalized || [
      item.title,
      item.location,
      item.work_at,
      item.event_type,
      item.contract_kind,
    ].some((value) => value?.toLocaleLowerCase().includes(normalized)));
    return [...matches].sort((left, right) => sort === "alpha"
      ? left.title.localeCompare(right.title) || left.work_at.localeCompare(right.work_at)
      : left.work_at.localeCompare(right.work_at) || left.title.localeCompare(right.title));
  }, [publishable.data, search, sort]);
  const selectedItems = (publishable.data || []).filter((item) => selected.includes(item.opportunity_id));
  const allVisibleSelected = visible.length > 0 && visible.every((item) => selected.includes(item.opportunity_id));

  function toggle(item: PublishableOpportunity, checked: boolean) {
    setSelected((current) => checked
      ? [...new Set([...current, item.opportunity_id])]
      : current.filter((id) => id !== item.opportunity_id));
  }

  function toggleAll(checked: boolean) {
    const visibleIds = visible.map((item) => item.opportunity_id);
    setSelected((current) => checked
      ? [...new Set([...current, ...visibleIds])]
      : current.filter((id) => !visibleIds.includes(id)));
  }

  async function publish() {
    setBusy(true);
    setMessage("");
    try {
      const showIds = [...new Set(selectedItems.flatMap((item) => item.show_ids))];
      await publishContractBatch(showIds);
      setSelected([]);
      setConfirming(false);
      setMessage(`${selectedItems.length} ${selectedItems.length === 1 ? "opportunity" : "opportunities"} published.`);
      await Promise.all([publishable.refresh(), batches.refresh()]);
    } catch (error) {
      setConfirming(false);
      setMessage(error instanceof Error ? error.message : "Unable to publish this batch.");
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(itemId: string) {
    setBusy(true);
    setMessage("");
    try {
      await withdrawReleaseItem(itemId);
      setMessage("Opportunity withdrawn.");
      await Promise.all([publishable.refresh(), batches.refresh()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to withdraw this opportunity.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page publish-contracts-page">
      <AdminHeader
        eyebrow="TEAM SCHEDULING"
        title="Publish Contracts"
        description="Release hidden contracts as one batch and notify the active team once."
        backTo="/admin/shows"
        backLabel="Back to Shows & contracts"
      />
      {message && <p className="notice" role="status">{message}</p>}
      <section className="admin-section publish-workspace">
        <div className="section-row">
          <div><p className="eyebrow">HIDDEN WORK</p><h2>Choose contracts to publish</h2></div>
          <span className="selection-count">{selected.length} {selected.length === 1 ? "opportunity" : "opportunities"} selected</span>
        </div>
        <div className="list-toolbar publish-toolbar">
          <label className="list-search"><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search shows, artists, venues, or dates" aria-label="Search contracts to publish" /></label>
          <SortButton value={sort} onChange={setSort} />
        </div>
        <label className="publish-select-all">
          <input type="checkbox" checked={allVisibleSelected} onChange={(event) => toggleAll(event.target.checked)} />
          <span>Select all visible contracts</span>
        </label>
        <PageState loading={publishable.loading} error={publishable.error} empty={!visible.length}>
          <div className="publish-opportunity-list">
            {visible.map((item) => (
              <label className={`publish-opportunity-card ${selected.includes(item.opportunity_id) ? "selected" : ""}`} key={item.opportunity_id}>
                <input type="checkbox" checked={selected.includes(item.opportunity_id)} onChange={(event) => toggle(item, event.target.checked)} aria-label={item.title} />
                <span className="publish-check"><Check /></span>
                <span className="publish-opportunity-main">
                  <strong>{item.title}</strong>
                  <small>{item.location || "Location not set"} · {item.event_type === "signing" ? `${item.show_ids.length} linked signings` : capitalize(item.contract_kind)}</small>
                  <small><CalendarDays /> {formatDateTime(item.work_at)}</small>
                </span>
                <span className="publish-pay"><CircleDollarSign /> {money(item.contract_pay)}<small>Potential bonus: {money(item.bonus_pay)}</small></span>
              </label>
            ))}
          </div>
        </PageState>
        <button className="button primary publish-selected-button" disabled={!selectedItems.length || busy} onClick={() => setConfirming(true)}><Send /> Publish selected ({selectedItems.length})</button>
      </section>

      <section className="admin-section recent-release-batches">
        <div className="section-row"><div><p className="eyebrow">RECENT BATCHES</p><h2>Published contracts</h2></div><BellRing /></div>
        <PageState loading={batches.loading} error={batches.error} empty={!batches.data?.length}>
          {batches.data?.map((batch) => (
            <article className="release-batch-card" key={batch.id || "assigned-work"}>
              <header><strong>{batch.id ? `Published ${new Date(batch.released_at).toLocaleString()}` : "Assigned work"}</strong><span>{batch.opportunities.filter((item) => item.status === "assigned").length}/{batch.opportunities.length} assigned</span></header>
              {batch.opportunities.map((item) => <div key={item.id}><span><b>{availabilityOpportunityTitle(item)}</b><small className={`status status-${item.status}`}>{capitalize(item.status)}</small></span>{item.status === "open" && <button className="text-button" disabled={busy} onClick={() => void withdraw(item.id)}><X /> Withdraw</button>}</div>)}
            </article>
          ))}
        </PageState>
      </section>

      {confirming && (
        <div className="modal-backdrop">
          <section className="confirm-modal publish-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="publish-confirm-title">
            <BellRing />
            <h2 id="publish-confirm-title">Publish {selectedItems.length} {selectedItems.length === 1 ? "opportunity" : "opportunities"}?</h2>
            <p>Every active driver and administrator will receive one notification for this batch.</p>
            <div className="publish-confirm-list">{selectedItems.map((item) => <div key={item.opportunity_id}><strong>{item.title}</strong><span>{formatDateTime(item.work_at)} · {money(item.contract_pay)}</span><small>Potential bonus: {money(item.bonus_pay)}</small></div>)}</div>
            <div><button disabled={busy} onClick={() => setConfirming(false)}>Cancel</button><button className="button primary" disabled={busy} onClick={() => void publish()}>{busy ? "Publishing…" : "Publish batch"}</button></div>
          </section>
        </div>
      )}
    </main>
  );
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
function money(value: number | null) { return value == null ? "Not set" : value.toLocaleString(undefined, { style: "currency", currency: "USD" }); }
function capitalize(value: string) { return value.charAt(0).toUpperCase() + value.slice(1); }
