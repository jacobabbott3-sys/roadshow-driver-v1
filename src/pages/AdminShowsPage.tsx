import {
  BriefcaseBusiness,
  CalendarPlus,
  MapPin,
  Pencil,
  Store,
  Trash2,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { AdminHeader } from "../components/AdminNav";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import {
  adminSignContract,
  createShow,
  deleteShow,
  getDrivers,
  getShowsAdmin,
  getTemplates,
  saveShowContract,
  updateShow,
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
  contract_id: string;
  kind: "setup" | "teardown";
  service_date: string;
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
  contract_id: "",
  kind: "setup",
  service_date: "",
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
    drivers = useAsync(getDrivers, []),
    templates = useAsync(getTemplates, []);
  const draft = savedDraft(),
    [form, setForm] = useState<FormState>(draft?.form || blank),
    [open, setOpen] = useState(Boolean(draft)),
    [editing, setEditing] = useState<string | null>(draft?.editing || null),
    [deleting, setDeleting] = useState<AdminShow | null>(null),
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
      contract_id: contract?.id || "",
      kind: contract?.kind || "setup",
      service_date: contract?.service_date || "",
      driver_ids:
        contract?.contract_drivers?.map((d) => d.driver_id) ||
        (contract?.driver_id ? [contract.driver_id] : []),
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
        meals_included: form.meals_included,
        lodging_included: form.lodging_included,
      };
      const showId = editing || (await createShow(showInput));
      if (editing) await updateShow(editing, showInput);
      const contractId = await saveShowContract({
        id: form.contract_id || undefined,
        show_id: showId,
        driver_ids: form.driver_ids,
        kind: form.kind,
        service_date: form.service_date,
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
            <label className="checkbox-field">
              <input
                type="checkbox"
                checked={form.meals_included}
                onChange={(e) =>
                  setForm({ ...form, meals_included: e.target.checked })
                }
              />
              Meals included
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
          <div className="form-divider">
            <p className="eyebrow">CONTRACT</p>
            <h2>Contract details</h2>
          </div>
          <div className="form-grid">
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
          <fieldset className="driver-selector">
            <legend>Assigned drivers</legend>
            <p>
              The first selected driver is the lead. Additional drivers are
              marked as trainees.
            </p>
            <div>
              {drivers.data
                ?.filter((d) => d.is_active)
                .map((d) => (
                  <label key={d.id}>
                    <input
                      type="checkbox"
                      checked={form.driver_ids.includes(d.id)}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          driver_ids: e.target.checked
                            ? [...form.driver_ids, d.id]
                            : form.driver_ids.filter((id) => id !== d.id),
                        })
                      }
                    />
                    <span>{d.full_name || "Unnamed user"}</span>
                    {form.driver_ids.indexOf(d.id) > 0 && (
                      <small>Trainee</small>
                    )}
                  </label>
                ))}
            </div>
          </fieldset>
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
        loading={shows.loading || drivers.loading || templates.loading}
        error={shows.error || drivers.error || templates.error}
        empty={!shows.data?.length}
      >
        <div className="admin-show-list">
          {shows.data?.map((show) => {
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
                        {formatWorkDate(contract.service_date)} ·{" "}
                        {statusLabel(contract.status)}
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
