import {
  BriefcaseBusiness,
  CalendarPlus,
  MapPin,
  Pencil,
  Store,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AdminHeader } from "../components/AdminNav";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import {
  adminSignContract,
  createShow,
  deleteShow,
  getContractTemplates,
  getShowAvailabilityAdmin,
  getShowsAdmin,
  getTemplates,
  saveShowContract,
  updateShow,
  updateContractAssignments,
  type AdminAvailabilityPerson,
  type AdminShow,
} from "../lib/adminData";
import { dateRange, statusLabel } from "../lib/driverData";

type FormState = {
  name: string;
  starts_on: string;
  ends_on: string;
  city: string;
  state: string;
  address: string;
  bin_count: string;
  meals_included: boolean;
  lodging_included: boolean;
  per_diem: string;
  lodging_name: string;
  lodging_address: string;
  lodging_phone: string;
  lodging_confirmation: string;
  lodging_check_in: string;
  lodging_check_out: string;
  lodging_notes: string;
  contract_id: string;
  contract_template_id: string;
  kind: "setup" | "teardown";
  service_date: string;
  service_time: string;
  driver_ids: string[];
  template_id: string;
  contract_pay: string;
  bonus_pay: string;
  terms: string;
  admin_signature_name: string;
};
const blank: FormState = {
  name: "",
  starts_on: "",
  ends_on: "",
  city: "",
  state: "",
  address: "",
  bin_count: "",
  meals_included: false,
  lodging_included: false,
  per_diem: "",
  lodging_name: "",
  lodging_address: "",
  lodging_phone: "",
  lodging_confirmation: "",
  lodging_check_in: "",
  lodging_check_out: "",
  lodging_notes: "",
  contract_id: "",
  contract_template_id: "",
  kind: "setup",
  service_date: "",
  service_time: "",
  driver_ids: [],
  template_id: "",
  contract_pay: "",
  bonus_pay: "",
  terms: "",
  admin_signature_name: "",
};
const draftKey = "roadshow-admin-show-draft";
function savedDraft() {
  try {
    return JSON.parse(localStorage.getItem(draftKey) || "null") as {
      form: FormState;
      editing: string | null;
    } | null;
  } catch {
    return null;
  }
}

export function AdminShowsPage() {
  const shows = useAsync(getShowsAdmin, []),
    templates = useAsync(getTemplates, []),
    contractTemplates = useAsync(getContractTemplates, []);
  const draft = savedDraft(),
    [form, setForm] = useState<FormState>(draft?.form || blank),
    [open, setOpen] = useState(Boolean(draft)),
    [editing, setEditing] = useState<string | null>(draft?.editing || null),
    [deleting, setDeleting] = useState<AdminShow | null>(null),
    [assigning, setAssigning] = useState<AdminShow | null>(null),
    [availabilityPeople, setAvailabilityPeople] = useState<AdminAvailabilityPerson[]>([]),
    [assignmentIds, setAssignmentIds] = useState<string[]>([]),
    [assignmentLoading, setAssignmentLoading] = useState(false),
    [autofillSource, setAutofillSource] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (open) localStorage.setItem(draftKey, JSON.stringify({ form, editing }));
  }, [form, editing, open]);
  function closeForm() {
    setOpen(false);
    setEditing(null);
    setForm(blank);
    localStorage.removeItem(draftKey);
  }
  function startNew() {
    setEditing(null);
    setForm(blank);
    setOpen(true);
    setAutofillSource("");
  }
  function applyPastShow(showId: string) {
    setAutofillSource(showId);
    const source = pastShows.find((show) => show.id === showId);
    if (!source) return;
    const contract = source.contracts[0];
    setForm({
      ...blank,
      name: source.name,
      city: source.city,
      state: source.state || "",
      address: source.address || "",
      bin_count: source.bin_count?.toString() || "",
      lodging_included: source.lodging_included,
      per_diem: source.per_diem?.toString() || "",
      lodging_name: source.lodging_name || "",
      lodging_address: source.lodging_address || "",
      lodging_phone: source.lodging_phone || "",
      lodging_confirmation: "",
      lodging_notes: source.lodging_notes || "",
      kind: contract?.kind || "setup",
      template_id: contract?.contract_checklists?.[0]?.template_id || "",
      terms: contract?.terms || "",
    });
  }
  async function openAssignments(show: AdminShow) {
    const contract = show.contracts[0];
    if (!contract) return;
    setAssigning(show);
    setAssignmentLoading(true);
    try {
      const people = await getShowAvailabilityAdmin(show.id, contract.id);
      setAvailabilityPeople(people);
      setAssignmentIds(people.filter((person) => person.assigned).map((person) => person.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load availability.");
      setAssigning(null);
    } finally { setAssignmentLoading(false); }
  }
  async function saveAssignments() {
    const contract = assigning?.contracts[0];
    if (!contract) return;
    setAssignmentLoading(true);
    try {
      await updateContractAssignments(contract.id, assignmentIds);
      await shows.refresh();
      setMessage("Assignments updated.");
      setAssigning(null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save assignments.");
    } finally { setAssignmentLoading(false); }
  }
  function loadEdit(show: AdminShow) {
    const contract = show.contracts[0];
    const assignedTemplate = show.show_checklist_templates?.find(
      (assignment) => assignment.kind === contract?.kind,
    )?.template_id;
    setEditing(show.id);
    setOpen(true);
    setForm({
      name: show.name,
      starts_on: show.starts_on,
      ends_on: show.ends_on,
      city: show.city,
      state: show.state || "",
      address: show.address || "",
      bin_count: show.bin_count?.toString() || "",
      meals_included: show.meals_included,
      lodging_included: show.lodging_included,
      per_diem: show.per_diem?.toString() || "",
      lodging_name: show.lodging_name || "",
      lodging_address: show.lodging_address || "",
      lodging_phone: show.lodging_phone || "",
      lodging_confirmation: show.lodging_confirmation || "",
      lodging_check_in: show.lodging_check_in || "",
      lodging_check_out: show.lodging_check_out || "",
      lodging_notes: show.lodging_notes || "",
      contract_id: contract?.id || "",
      contract_template_id: "",
      kind: contract?.kind || "setup",
      service_date: contract?.service_date || "",
      service_time: contract?.service_time?.slice(0, 5) || "",
      driver_ids: contract?.driver_id
        ? [
            contract.driver_id,
            ...(contract.contract_drivers || [])
              .map((assignment) => assignment.driver_id)
              .filter((id) => id !== contract.driver_id),
          ]
        : contract?.contract_drivers?.map((assignment) => assignment.driver_id) ||
          [],
      template_id:
        contract?.contract_checklists?.[0]?.template_id ||
        assignedTemplate ||
        "",
      contract_pay: contract?.contract_pay?.toString() || "",
      bonus_pay: contract?.bonus_pay?.toString() || "",
      terms: contract?.terms || "",
      admin_signature_name: contract?.admin_signature_name || "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function changeKind(kind: "setup" | "teardown") {
    if (kind === form.kind) return;
    setForm({
      ...form,
      kind,
      contract_template_id: "",
      template_id: "",
      service_date:
        kind === "setup" && form.starts_on
          ? previousDay(form.starts_on)
          : kind === "teardown"
            ? form.ends_on
            : "",
    });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const showInput = {
        name: form.name,
        starts_on: form.starts_on,
        ends_on: form.ends_on,
        city: form.city,
        state: form.state || null,
        address: form.address || null,
        bin_count: form.bin_count ? Number(form.bin_count) : null,
        meals_included: false,
        lodging_included: form.lodging_included,
        event_type: "show" as const,
        per_diem: form.per_diem ? Number(form.per_diem) : null,
        lodging_name: form.lodging_included ? form.lodging_name || null : null,
        lodging_address: form.lodging_included ? form.lodging_address || null : null,
        lodging_phone: form.lodging_included ? form.lodging_phone || null : null,
        lodging_confirmation: form.lodging_included ? form.lodging_confirmation || null : null,
        lodging_check_in: form.lodging_included ? form.lodging_check_in || null : null,
        lodging_check_out: form.lodging_included ? form.lodging_check_out || null : null,
        lodging_notes: form.lodging_included ? form.lodging_notes || null : null,
      };
      const showId = editing || (await createShow(showInput));
      if (editing) await updateShow(editing, showInput);
      const contractId = await saveShowContract({
        id: form.contract_id || undefined,
        show_id: showId,
        driver_ids: form.driver_ids,
        kind: form.kind,
        service_date: form.service_date,
        service_time: form.service_time || null,
        contract_pay: form.contract_pay ? Number(form.contract_pay) : null,
        bonus_pay: form.bonus_pay ? Number(form.bonus_pay) : null,
        terms: form.terms || null,
        template_id: form.template_id,
      });
      if (form.admin_signature_name.trim())
        await adminSignContract(contractId, form.admin_signature_name.trim());
      closeForm();
      setMessage("Show and contract saved.");
      await shows.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to save show.");
    } finally {
      setBusy(false);
    }
  }
  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      await deleteShow(deleting.id);
      setDeleting(null);
      if (editing === deleting.id) {
        setOpen(false);
        setEditing(null);
        setForm(blank);
      }
      setMessage("Show deleted.");
      await shows.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to delete show.");
    } finally {
      setBusy(false);
    }
  }
  const matchingTemplates =
    templates.data?.filter((t) => t.kind === form.kind) || [];
  const regularShows = shows.data?.filter((show) => show.event_type !== "signing") || [];
  const pastShows = regularShows
    .filter((show) => show.ends_on < new Date().toISOString().slice(0, 10))
    .sort((a, b) => b.ends_on.localeCompare(a.ends_on));
  return (
    <main className="page">
      <AdminHeader
        eyebrow="SCHEDULING"
        title="Shows & contracts"
        description="Manage each indoor show and its setup or teardown contract in one place."
      />
      <div className="admin-actions">
        <button className="button primary" onClick={startNew}>
          <CalendarPlus /> Create show
        </button>
      </div>
      {message && <div className="notice">{message}</div>}
      {open && (
        <form className="admin-form unified-show-form" onSubmit={save}>
          <div className="section-row">
            <div>
              <p className="eyebrow">{editing ? "EDIT SHOW" : "NEW SHOW"}</p>
              <h2>Show information</h2>
            </div>
            <button type="button" className="text-button" onClick={closeForm}>
              Cancel
            </button>
          </div>
          {!editing && <label className="past-show-autofill">Autofill from a past show<select value={autofillSource} onChange={(event) => applyPastShow(event.target.value)}><option value="">Start with blank details</option>{pastShows.map((show) => <option key={show.id} value={show.id}>{show.name} · {show.city}{show.state ? `, ${show.state}` : ""}</option>)}</select><small>Copies venue, lodging, checklist, and contract terms. Dates, pay, bonus, and assignments stay blank.</small></label>}
          <div className="form-grid">
            <label>
              Show name
              <input
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label>
              City
              <input
                required
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </label>
            <label>
              State
              <input
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
              />
            </label>
            <label>
              Address
              <input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </label>
            <label>
              Show start date
              <input
                type="date"
                required
                value={form.starts_on}
                onChange={(e) =>
                  setForm({
                    ...form,
                    starts_on: e.target.value,
                    service_date:
                      form.service_date || previousDay(e.target.value),
                  })
                }
              />
            </label>
            <label>
              Show end date
              <input
                type="date"
                required
                value={form.ends_on}
                onChange={(e) => setForm({ ...form, ends_on: e.target.value })}
              />
            </label>
            <label>
              Number of bins
              <input
                type="number"
                min="0"
                value={form.bin_count}
                onChange={(e) =>
                  setForm({ ...form, bin_count: e.target.value })
                }
              />
            </label>
            <label>
              Per diem amount
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.per_diem}
                onChange={(e) => setForm({ ...form, per_diem: e.target.value })}
                placeholder="0.00"
              />
            </label>
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.lodging_included}
                onChange={(e) =>
                  setForm({ ...form, lodging_included: e.target.checked })
                }
              />
              Lodging included
            </label>
          </div>
          {form.lodging_included && (
            <div className="lodging-details">
              <p className="eyebrow">LODGING DETAILS</p>
              <div className="form-grid">
                <label>Hotel / property<input value={form.lodging_name} onChange={(e) => setForm({ ...form, lodging_name: e.target.value })} /></label>
                <label>Phone number<input type="tel" value={form.lodging_phone} onChange={(e) => setForm({ ...form, lodging_phone: e.target.value })} /></label>
                <label className="wide-field">Address<input value={form.lodging_address} onChange={(e) => setForm({ ...form, lodging_address: e.target.value })} /></label>
                <label>Confirmation number<input value={form.lodging_confirmation} onChange={(e) => setForm({ ...form, lodging_confirmation: e.target.value })} /></label>
                <label>Check-in<input type="date" value={form.lodging_check_in} onChange={(e) => setForm({ ...form, lodging_check_in: e.target.value })} /></label>
                <label>Check-out<input type="date" value={form.lodging_check_out} onChange={(e) => setForm({ ...form, lodging_check_out: e.target.value })} /></label>
              </div>
              <label className="terms-editor">Lodging notes<textarea value={form.lodging_notes} onChange={(e) => setForm({ ...form, lodging_notes: e.target.value })} placeholder="Rooming instructions, parking, check-in details…" /></label>
            </div>
          )}
          <div className="form-divider">
            <p className="eyebrow">CONTRACT</p>
            <h2>Contract details</h2>
          </div>
          <div className="form-grid">
            <label>
              Reusable contract template
              <select
                value={form.contract_template_id}
                onChange={(e) => {
                  const selected = contractTemplates.data?.find((template) => template.id === e.target.value);
                  setForm(selected ? { ...form, contract_template_id: selected.id, kind: selected.kind, terms: selected.terms || "", template_id: selected.kind === form.kind ? form.template_id : "" } : { ...form, contract_template_id: "" });
                }}
              >
                <option value="">Start without a template</option>
                {contractTemplates.data?.filter((template) => template.active).map((template) => <option value={template.id} key={template.id}>{template.name}</option>)}
              </select>
            </label>
            <label>
              Contract type
              <select
                value={form.kind}
                onChange={(e) =>
                  changeKind(e.target.value as "setup" | "teardown")
                }
              >
                <option value="setup">Setup</option>
                <option value="teardown">Teardown</option>
              </select>
            </label>
            <label>
              {form.kind === "setup" ? "Setup date" : "Teardown date"}
              <input
                type="date"
                required
                value={form.service_date}
                onChange={(e) =>
                  setForm({ ...form, service_date: e.target.value })
                }
              />
            </label>
            <label>
              {form.kind === "setup" ? "Setup time" : "Teardown time"}
              <input type="time" value={form.service_time} onChange={(e) => setForm({ ...form, service_time: e.target.value })} />
            </label>
            <label>
              {statusLabel(form.kind)} checklist
              <select
                required
                value={form.template_id}
                onChange={(e) =>
                  setForm({ ...form, template_id: e.target.value })
                }
              >
                <option value="">Choose checklist…</option>
                {matchingTemplates.map((t) => (
                  <option value={t.id} key={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Contract pay
              <input
                type="number"
                min="0"
                value={form.contract_pay}
                onChange={(e) =>
                  setForm({ ...form, contract_pay: e.target.value })
                }
              />
            </label>
            <label>
              Potential bonus
              <input
                type="number"
                min="0"
                value={form.bonus_pay}
                onChange={(e) =>
                  setForm({ ...form, bonus_pay: e.target.value })
                }
              />
            </label>
          </div>
          <label className="terms-editor">
            Published contract terms
            <textarea
              required
              value={form.terms}
              onChange={(e) => setForm({ ...form, terms: e.target.value })}
              placeholder="Terms the driver must review before signing…"
            />
          </label>
          <label className="terms-editor">
            Admin signature
            <input
              value={form.admin_signature_name}
              onChange={(e) =>
                setForm({ ...form, admin_signature_name: e.target.value })
              }
              placeholder="Admin's full legal name"
            />
            <small>
              The driver can begin work after their signature; the admin
              signature can be added before or afterward.
            </small>
          </label>
          <button className="button primary" disabled={busy}>
            {busy ? "Saving…" : "Save show and contract"}
          </button>
        </form>
      )}
      <PageState
        loading={shows.loading || templates.loading || contractTemplates.loading}
        error={shows.error || templates.error || contractTemplates.error}
        empty={!regularShows.length}
      >
        <div className="admin-show-list">
          {regularShows.map((show) => {
            const contract = show.contracts[0];
            return (
              <article className="admin-show-card" key={show.id}>
                <div className="admin-show-head">
                  <span className="show-booth-icon">
                    <Store />
                  </span>
                  <div>
                    <h2>{show.name}</h2>
                    <p>
                      <MapPin />
                      {show.city}
                      {show.state ? `, ${show.state}` : ""} · {dateRange(show)}
                    </p>
                  </div>
                  <div className="show-card-actions">
                    <button onClick={() => void openAssignments(show)} disabled={!contract}>
                      <UsersRound /> Assign user(s)
                    </button>
                    <button onClick={() => loadEdit(show)}>
                      <Pencil /> Edit
                    </button>
                    <button
                      className="delete-action"
                      onClick={() => setDeleting(show)}
                    >
                      <Trash2 /> Delete
                    </button>
                  </div>
                </div>
                {contract ? (
                  <div className="contract-summary">
                    <BriefcaseBusiness />
                    <span>
                      <strong>{statusLabel(contract.kind)} contract</strong>
                      <small>
                        {formatWorkDate(contract.service_date)}{contract.service_time ? ` at ${formatTime(contract.service_time)}` : ""} ·{" "}
                        {statusLabel(contract.status)}
                      </small>
                      <small>
                        {contract.contract_drivers.length
                          ? `Assigned: ${contract.contract_drivers
                              .map((assignment) => {
                                const person = assignment.driver;
                                return `${person?.full_name || "Unnamed user"}${person?.role === "admin" ? " (Admin)" : ""}`;
                              })
                              .join(", ")}`
                          : "No team members assigned"}
                      </small>
                    </span>
                  </div>
                ) : (
                  <p className="muted">No contract configured.</p>
                )}
              </article>
            );
          })}
        </div>
      </PageState>
      {assigning && <div className="modal-backdrop"><section className="assignment-modal" role="dialog" aria-modal="true"><div className="section-row"><div><p className="eyebrow">TEAM AVAILABILITY</p><h2>Assign user(s) · {assigning.name}</h2><p>Select the lead first. Availability responses are shown beside every active user.</p></div><button className="text-button" onClick={() => setAssigning(null)}>Close</button></div>{assignmentLoading && !availabilityPeople.length ? <p className="muted">Loading availability…</p> : <div className="assignment-availability-list">{availabilityPeople.map((person) => { const index = assignmentIds.indexOf(person.id); return <label key={person.id}><input type="checkbox" checked={index >= 0} onChange={(event) => setAssignmentIds(event.target.checked ? [...assignmentIds, person.id] : assignmentIds.filter((id) => id !== person.id))} /><span><strong>{person.full_name || "Unnamed user"}</strong><small>{person.role === "admin" ? "Admin" : "Driver"}{index === 0 ? " · Lead" : index > 0 ? " · Trainee" : ""}</small></span><em className={`availability-response ${person.availability_status || "pending"}`}>{person.availability_status === "available" ? "Available" : person.availability_status === "unavailable" ? "Unavailable" : person.availability_status === "assigned" ? "Assigned" : "No response"}</em></label>; })}</div>}<button className="button primary" disabled={assignmentLoading} onClick={() => void saveAssignments()}>{assignmentLoading ? "Saving…" : "Save assignments"}</button></section></div>}
      {deleting && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-show-title"
          >
            <span className="danger-icon">
              <Trash2 />
            </span>
            <h2 id="delete-show-title">Delete {deleting.name}?</h2>
            <p>
              This permanently removes the show, its contract, checklist
              progress, and uploaded photos. This cannot be undone.
            </p>
            <div>
              <button onClick={() => setDeleting(null)} disabled={busy}>
                Cancel
              </button>
              <button
                className="confirm-delete"
                onClick={() => void confirmDelete()}
                disabled={busy}
              >
                {busy ? "Deleting…" : "Delete show"}
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
function previousDay(value: string) {
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return date.toISOString().slice(0, 10);
}
function formatWorkDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function formatTime(value: string) {
  return new Date(`2000-01-01T${value}`).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}
