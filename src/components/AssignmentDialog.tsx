import { Plus, RefreshCw, UserRoundPlus, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { getTeamMembers } from "../lib/adminData";
import { getReleaseResponses, replaceOpportunityAssignments } from "../lib/availabilityData";
import type { AvailabilityResponsePerson } from "../types";

type AssignmentDialogProps = {
  releaseItemId: string | null;
  showIds: string[];
  title: string;
  initialAssigneeIds?: string[];
  initialExternalNames?: string[];
  onSaved: () => void | Promise<void>;
  onClose: () => void;
};

export function AssignmentDialog({
  releaseItemId,
  showIds,
  title,
  initialAssigneeIds = [],
  initialExternalNames = [],
  onSaved,
  onClose,
}: AssignmentDialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const [people, setPeople] = useState<AvailabilityResponsePerson[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [externalNames, setExternalNames] = useState<string[]>(initialExternalNames);
  const [externalInput, setExternalInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    previousFocus.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    void loadPeople(true);
    return () => previousFocus.current?.focus();
    // The dialog reloads only when it targets a different published item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [releaseItemId]);

  async function loadPeople(resetSelection: boolean) {
    setLoading(true);
    try {
      const loaded = releaseItemId
        ? await getReleaseResponses(releaseItemId)
        : (await getTeamMembers()).map((person) => ({
            profile_id: person.id,
            full_name: person.full_name,
            role: person.role,
            phone: person.phone,
            response_status: null,
            responded_at: null,
            available_at: null,
            response_rank: null,
            assigned: initialAssigneeIds.includes(person.id),
          } satisfies AvailabilityResponsePerson));
      setPeople(loaded);
      if (resetSelection) {
        const loadedAssigned = loaded.filter((person) => person.assigned).map((person) => person.profile_id);
        setSelected(loadedAssigned.length ? loadedAssigned : initialAssigneeIds);
        setExternalNames(initialExternalNames);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load team availability.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(profileId: string, checked: boolean) {
    setSelected((current) => checked
      ? [...current.filter((id) => id !== profileId), profileId]
      : current.filter((id) => id !== profileId));
  }

  function addExternal() {
    const name = externalInput.trim();
    if (!name) return;
    if (name.length > 120) {
      setMessage("Outside driver names must be 120 characters or fewer.");
      return;
    }
    if (externalNames.some((existing) => existing.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      setMessage("That outside driver is already added.");
      return;
    }
    setExternalNames((current) => [...current, name]);
    setExternalInput("");
    setMessage("");
  }

  async function save() {
    setSaving(true);
    setMessage("");
    try {
      await replaceOpportunityAssignments({
        releaseItemId,
        showIds,
        driverIds: selected,
        externalNames,
      });
      await onSaved();
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Unable to save assignments.";
      if (/already been assigned|withdrawn|no longer matches|no longer open/i.test(detail)) {
        await loadPeople(true);
        setMessage("This opportunity changed while you were viewing it. The latest assignments and responses are shown.");
      } else {
        setMessage(detail);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), [href], select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])",
    ) || [])];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="assignment-modal assignment-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="assignment-dialog-title"
        ref={dialogRef}
        tabIndex={-1}
        onKeyDown={handleKeys}
      >
        <div className="section-row">
          <div><p className="eyebrow">FINAL ASSIGNMENT</p><h2 id="assignment-dialog-title">Assign user(s) · {title}</h2><p>Available responses are ordered by response time. The first selected app user is the lead.</p></div>
          <button className="text-button" onClick={onClose} aria-label="Close assignment dialog"><X /> Close</button>
        </div>
        {message && <p className="error" role="alert">{message}</p>}
        {loading ? <p className="muted">Loading team availability…</p> : (
          <div className="assignment-availability-list">
            {people.map((person) => {
              const index = selected.indexOf(person.profile_id);
              return (
                <label key={person.profile_id} data-testid={`assignment-person-${person.profile_id}`}>
                  <input type="checkbox" checked={index >= 0} onChange={(event) => toggle(person.profile_id, event.target.checked)} />
                  <span>
                    <strong>{person.full_name || "Unnamed user"}</strong>
                    <small>{person.role === "admin" ? "Admin" : "Driver"}{index === 0 ? " · Lead" : index > 0 ? " · Team" : ""}</small>
                  </span>
                  <span className="assignment-response-detail">
                    <em className={`availability-response ${person.response_status || "pending"}`}>{responseLabel(person)}</em>
                    {person.responded_at && <small>Responded {formatResponseTime(person.responded_at)}</small>}
                  </span>
                </label>
              );
            })}
          </div>
        )}
        <section className="external-assignment-section">
          <div><UserRoundPlus /><span><strong>Outside drivers</strong><small>Names only. They will not receive an account or appear in the directory.</small></span></div>
          <div className="external-assignment-form">
            <label><span className="sr-only">Outside driver name</span><input aria-label="Outside driver name" maxLength={120} value={externalInput} onChange={(event) => setExternalInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addExternal(); } }} placeholder="Driver name" /></label>
            <button type="button" className="button secondary" onClick={addExternal}><Plus /> Add outside driver</button>
          </div>
          {externalNames.length > 0 && <div className="external-name-list">{externalNames.map((name) => <span key={name}><b>{name}</b><small>External</small><button type="button" onClick={() => setExternalNames((current) => current.filter((item) => item !== name))} aria-label={`Remove ${name}`}><X /></button></span>)}</div>}
        </section>
        <div className="assignment-dialog-actions">
          <button type="button" className="button secondary" disabled={loading || saving} onClick={() => void loadPeople(true)}><RefreshCw /> Refresh responses</button>
          <button type="button" className="button primary" disabled={loading || saving} onClick={() => void save()}>{saving ? "Saving…" : "Save assignments"}</button>
        </div>
      </section>
    </div>
  );
}

function responseLabel(person: AvailabilityResponsePerson) {
  if (person.response_status === "available") return person.response_rank ? `${ordinal(person.response_rank)} to respond` : "Available";
  if (person.response_status === "unavailable") return "Unavailable";
  return "No response";
}

function ordinal(value: number) {
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  return `${value}${value % 10 === 1 ? "st" : value % 10 === 2 ? "nd" : value % 10 === 3 ? "rd" : "th"}`;
}

function formatResponseTime(value: string) {
  return new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
