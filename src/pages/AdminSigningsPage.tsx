import { BriefcaseBusiness, CalendarPlus, Clock3, Link2, MapPin, PenLine, Pencil, Trash2, UsersRound } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AdminHeader } from "../components/AdminNav";
import { AssignmentDialog } from "../components/AssignmentDialog";
import { PageState } from "../components/PageState";
import { SortButton } from "../components/SortButton";
import { useAsync } from "../hooks/useAsync";
import {
  createShow,
  deleteShow,
  getShowLinks,
  getShowsAdmin,
  getTemplates,
  saveShowContract,
  saveShowLinks,
  updateShow,
  type AdminShow,
} from "../lib/adminData";
import { getPublishedAvailability } from "../lib/availabilityData";
import { sortList, type SortMode } from "../lib/listControls";

type FormState = {
  artist: string;
  signing_at: string;
  setup_at: string;
  location: string;
  city: string;
  state: string;
  address: string;
  contract_id: string;
  template_id: string;
  assignee_ids: string[];
  linked_ids: string[];
};
const blank: FormState = { artist: "", signing_at: "", setup_at: "", location: "", city: "", state: "", address: "", contract_id: "", template_id: "", assignee_ids: [], linked_ids: [] };

export function AdminSigningsPage() {
  const shows = useAsync(getShowsAdmin, []);
  const templates = useAsync(getTemplates, []);
  const links = useAsync(getShowLinks, []);
  const publishedAvailability = useAsync(getPublishedAvailability, []);
  const [sort, setSort] = useState<SortMode>("date");
  const signings = sortList(
    shows.data?.filter((show) => show.event_type === "signing") || [],
    sort,
    (show) => show.artist || show.name,
    (show) => show.signing_at || show.starts_on,
  );
  const [form, setForm] = useState<FormState>(blank);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<AdminShow | null>(null);
  const [assigning, setAssigning] = useState<AdminShow | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function startNew() { setForm(blank); setEditing(null); setOpen(true); }
  function close() { setForm(blank); setEditing(null); setOpen(false); }
  function loadEdit(signing: AdminShow) {
    const contract = signing.contracts[0];
    const linked = (links.data || []).filter((link) => link.show_id === signing.id || link.linked_show_id === signing.id).map((link) => link.show_id === signing.id ? link.linked_show_id : link.show_id);
    setEditing(signing.id);
    setOpen(true);
    setForm({
      artist: signing.artist || signing.name,
      signing_at: toLocalInput(signing.signing_at),
      setup_at: toLocalInput(signing.setup_at),
      location: signing.venue_name || "",
      city: signing.city,
      state: signing.state || "",
      address: signing.address || "",
      contract_id: contract?.id || "",
      template_id: contract?.contract_checklists?.[0]?.template_id || "",
      assignee_ids: contract?.driver_id ? [contract.driver_id, ...(contract.contract_drivers || []).map((item) => item.driver_id).filter((id) => id !== contract.driver_id)] : contract?.contract_drivers?.map((item) => item.driver_id) || [],
      linked_ids: linked,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const signingDate = form.signing_at.slice(0, 10);
      const input = {
        name: `${form.artist} signing`,
        starts_on: signingDate,
        ends_on: signingDate,
        city: form.city,
        state: form.state || null,
        address: form.address || null,
        event_type: "signing" as const,
        artist: form.artist,
        venue_name: form.location,
        signing_at: new Date(form.signing_at).toISOString(),
        setup_at: new Date(form.setup_at).toISOString(),
        bin_count: null,
        meals_included: false,
        lodging_included: false,
        per_diem: null,
      };
      const showId = editing || await createShow(input);
      if (editing) await updateShow(editing, input);
      await saveShowContract({
        id: form.contract_id || undefined,
        show_id: showId,
        driver_ids: form.assignee_ids,
        kind: "setup",
        service_date: signingDate,
        service_time: form.setup_at.slice(11, 16),
        contract_pay: null,
        bonus_pay: null,
        terms: null,
        template_id: form.template_id,
      });
      await saveShowLinks(showId, form.linked_ids);
      close();
      setMessage("Signing saved.");
      await Promise.all([shows.refresh(), links.refresh()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save signing.");
    } finally { setBusy(false); }
  }

  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try { await deleteShow(deleting.id); setDeleting(null); setMessage("Signing deleted."); await shows.refresh(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to delete signing."); }
    finally { setBusy(false); }
  }

  return (
    <main className="page">
      <AdminHeader eyebrow="SCHEDULING" title="Signings" description="Schedule artist signings, assign teams and checklists, and connect related appearances." backTo="/admin" />
      <div className="admin-actions show-list-toolbar"><button className="button primary" onClick={startNew}><CalendarPlus /> Create signing</button><Link className="button secondary" to="/admin/shows/publish"><BriefcaseBusiness /> Publish Contracts</Link><SortButton value={sort} onChange={setSort} /></div>
      {message && <p className="notice">{message}</p>}
      {open && (
        <form className="admin-form unified-show-form" onSubmit={save}>
          <div className="section-row"><div><p className="eyebrow">{editing ? "EDIT SIGNING" : "NEW SIGNING"}</p><h2>Signing information</h2></div><button type="button" className="text-button" onClick={close}>Cancel</button></div>
          <div className="form-grid">
            <label>Artist<input required value={form.artist} onChange={(event) => setForm({ ...form, artist: event.target.value })} /></label>
            <label>Location / venue<input required value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} /></label>
            <label>Signing date and time<input required type="datetime-local" value={form.signing_at} onChange={(event) => setForm({ ...form, signing_at: event.target.value })} /></label>
            <label>Setup date and time<input required type="datetime-local" value={form.setup_at} onChange={(event) => setForm({ ...form, setup_at: event.target.value })} /></label>
            <label>City<input required value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
            <label>State<input value={form.state} onChange={(event) => setForm({ ...form, state: event.target.value })} /></label>
            <label className="wide-field">Street address<input value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
            <label>Checklist (optional)<select value={form.template_id} onChange={(event) => setForm({ ...form, template_id: event.target.value })}><option value="">No checklist</option>{templates.data?.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>
          </div>
          <fieldset className="driver-selector"><legend>Linked signings</legend><p>Connect related signings so the assigned team can move between them easily.</p><div>{signings.filter((signing) => signing.id !== editing).map((signing) => <label key={signing.id}><input type="checkbox" checked={form.linked_ids.includes(signing.id)} onChange={(event) => setForm({ ...form, linked_ids: event.target.checked ? [...form.linked_ids, signing.id] : form.linked_ids.filter((id) => id !== signing.id) })} /><span>{signing.artist || signing.name}</span><small>{formatDateTime(signing.signing_at)}</small></label>)}</div></fieldset>
          <button className="button primary" disabled={busy}>{busy ? "Saving…" : "Save signing"}</button>
        </form>
      )}
      <PageState loading={shows.loading || templates.loading || links.loading} error={shows.error || templates.error || links.error} empty={!signings.length}>
        <div className="admin-show-list">{signings.map((signing) => { const contract = signing.contracts[0]; const linkedCount = (links.data || []).filter((link) => link.show_id === signing.id || link.linked_show_id === signing.id).length; return <article className="admin-show-card" key={signing.id}><div className="admin-show-head"><span className="show-booth-icon"><PenLine /></span><div><h2>{signing.artist || signing.name}</h2><p><MapPin /> {signing.venue_name || signing.address || signing.city}</p></div><div className="show-card-actions"><button onClick={() => setAssigning(signing)} disabled={!contract}><UsersRound /> Assign user(s)</button><button onClick={() => loadEdit(signing)}><Pencil /> Edit</button><button className="delete-action" onClick={() => setDeleting(signing)}><Trash2 /> Delete</button></div></div><div className="contract-summary"><Clock3 /><span><strong>{formatDateTime(signing.signing_at)}</strong><small>Setup: {formatDateTime(signing.setup_at)}</small><small><UsersRound /> {contract?.contract_drivers.length || 0} assigned · <Link2 /> {linkedCount} linked</small></span></div></article>; })}</div>
      </PageState>
      {assigning && <AssignmentDialog
        releaseItemId={findPublishedOpportunity(publishedAvailability.data || [], assigning.id)?.batch_id ? findPublishedOpportunity(publishedAvailability.data || [], assigning.id)!.id : null}
        showIds={findPublishedOpportunity(publishedAvailability.data || [], assigning.id)?.shows.map((show) => show.id) || linkedShowIds(assigning.id, links.data || [])}
        title={findPublishedOpportunity(publishedAvailability.data || [], assigning.id)?.shows.map((show) => show.artist || show.name).join(" & ") || assigning.artist || assigning.name}
        initialAssigneeIds={[...new Set([...(assigning.contracts[0]?.driver_id ? [assigning.contracts[0].driver_id] : []), ...(assigning.contracts[0]?.contract_drivers.map((item) => item.driver_id) || [])])]}
        initialExternalNames={assigning.contracts[0]?.contract_external_assignees.sort((left, right) => left.position - right.position).map((item) => item.display_name) || []}
        onClose={() => setAssigning(null)}
        onSaved={async () => { await Promise.all([shows.refresh(), publishedAvailability.refresh()]); setMessage("Assignments updated."); setAssigning(null); }}
      />}
      {deleting && <div className="modal-backdrop"><section className="confirm-modal" role="dialog" aria-modal="true"><span className="danger-icon"><Trash2 /></span><h2>Delete this signing?</h2><p>This removes its assignments and checklist progress.</p><div><button onClick={() => setDeleting(null)}>Cancel</button><button className="confirm-delete" onClick={() => void remove()} disabled={busy}>{busy ? "Deleting…" : "Delete signing"}</button></div></section></div>}
    </main>
  );
}

function findPublishedOpportunity(batches: import("../types").AvailabilityBatch[], showId: string) {
  return batches.flatMap((batch) => batch.opportunities).find((item) => item.shows.some((show) => show.id === showId));
}
function linkedShowIds(showId: string, links: { show_id: string; linked_show_id: string }[]) {
  const connected = new Set([showId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const link of links) {
      if (connected.has(link.show_id) && !connected.has(link.linked_show_id)) { connected.add(link.linked_show_id); changed = true; }
      if (connected.has(link.linked_show_id) && !connected.has(link.show_id)) { connected.add(link.show_id); changed = true; }
    }
  }
  return [...connected];
}

function toLocalInput(value: string | null) { if (!value) return ""; const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000; return new Date(date.getTime() - offset).toISOString().slice(0, 16); }
function formatDateTime(value: string | null) { return value ? new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled"; }
