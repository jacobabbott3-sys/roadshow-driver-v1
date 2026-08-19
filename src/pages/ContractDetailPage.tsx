import {
  Camera,
  Check,
  ChevronDown,
  FileSignature,
  Info,
  MapPin,
  Send,
  Upload,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageState } from "../components/PageState";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import {
  dateRange,
  getChecklist,
  getContract,
  setChecklistItem,
  statusLabel,
  submitChecklist,
  type ChecklistSection,
} from "../lib/driverData";
import { supabase } from "../lib/supabase";
type Tab = "info" | "checklist" | "photos" | "sign";
export function ContractDetailPage() {
  const { id = "" } = useParams(),
    { user } = useAuth(),
    contract = useAsync(() => getContract(id), [id]),
    checklist = useAsync(() => getChecklist(id), [id]);
  const [tab, setTab] = useState<Tab>("info"),
    [busy, setBusy] = useState(""),
    [signature, setSignature] = useState(""),
    [message, setMessage] = useState("");
  const items = useMemo(
      () => checklist.data?.sections.flatMap((s) => s.items) || [],
      [checklist.data],
    ),
    done = items.filter((i) => i.response?.completed).length,
    progress = items.length ? Math.round((done / items.length) * 100) : 0,
    requiredComplete = items
      .filter((item) => item.required)
      .every((item) => item.response?.completed),
    activeSection = checklist.data?.sections.find((section) =>
      section.items.some((item) => !item.response?.completed),
    ),
    currentStatus = ["submitted", "under_review"].includes(
      contract.data?.status || "",
    )
      ? "Submitted for review"
      : contract.data?.status === "approved"
        ? "Approved"
        : activeSection?.title ||
          (items.length ? "Ready to submit" : "Waiting for checklist");
  async function toggle(itemId: string, value: boolean) {
    if (!checklist.data?.id) return;
    setBusy(itemId);
    try {
      await setChecklistItem(checklist.data.id, itemId, value);
      await checklist.refresh();
    } finally {
      setBusy("");
    }
  }
  async function sign() {
    if (!signature.trim()) return;
    setBusy("sign");
    const { error } = await supabase.rpc("sign_my_contract", {
      contract_id: id,
      signer_name: signature.trim(),
    });
    setBusy("");
    if (error) setMessage(error.message);
    else {
      setMessage("Contract signed successfully.");
      await contract.refresh();
    }
  }
  async function submitForReview() {
    setBusy("submit");
    setMessage("");
    try {
      await submitChecklist(id);
      setMessage("Checklist submitted to the admin team for review.");
      await contract.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to submit checklist.",
      );
    } finally {
      setBusy("");
    }
  }
  async function upload(file: File, slot: string) {
    setBusy(slot);
    const path = `${user!.id}/${id}/${crypto.randomUUID()}-${file.name}`;
    const { error } = await supabase.storage
      .from("roadshow-photos")
      .upload(path, file);
    if (!error)
      await supabase.from("photos").insert({
        contract_id: id,
        slot_name: slot,
        storage_path: path,
        uploaded_by: user!.id,
      });
    setMessage(error ? error.message : `${slot} photo uploaded.`);
    setBusy("");
  }
  return (
    <main className="page">
      <PageState
        loading={contract.loading}
        error={contract.error}
        empty={!contract.data}
      >
        {contract.data && (
          <>
            <Link to="/contracts" className="back">
              ← All contracts
            </Link>
            <header className="contract-detail-head">
              <div>
                <span className={`status status-${contract.data.status}`}>
                  {statusLabel(contract.data.status)}
                </span>
                <h1>{contract.data.show.name}</h1>
                <p>
                  <MapPin />
                  {contract.data.show.city}
                  {contract.data.show.state
                    ? `, ${contract.data.show.state}`
                    : ""}{" "}
                  · {dateRange(contract.data.show)}
                </p>
              </div>
              <div className="progress-summary">
                <div
                  className="progress-ring"
                  style={
                    {
                      "--progress": `${progress * 3.6}deg`,
                    } as React.CSSProperties
                  }
                >
                  <span>{progress}%</span>
                </div>
                <small>
                  Current status: <strong>{currentStatus}</strong>
                </small>
              </div>
            </header>
            <div className="contract-tabs">
              {(
                [
                  ["info", Info, "Info"],
                  ["checklist", Check, "Checklist"],
                  ["photos", Camera, "Photos"],
                  ["sign", FileSignature, "Contract"],
                ] as const
              ).map(([key, Icon, label]) => (
                <button
                  className={tab === key ? "active" : ""}
                  onClick={() => setTab(key)}
                  key={key}
                >
                  <Icon />
                  {label}
                </button>
              ))}
            </div>
            {message && <div className="notice">{message}</div>}
            {tab === "info" && (
              <section className="detail-panel">
                <h2>Show information</h2>
                <div className="info-grid">
                  <Field
                    label="Assignment"
                    value={statusLabel(contract.data.kind)}
                  />
                  <Field label="Dates" value={dateRange(contract.data.show)} />
                  <Field
                    label="Location"
                    value={`${contract.data.show.city}${contract.data.show.state ? `, ${contract.data.show.state}` : ""}`}
                  />
                  <Field
                    label="Address"
                    value={
                      contract.data.show.address || "Provided closer to show"
                    }
                  />
                  <Field
                    label="Bins"
                    value={contract.data.show.bin_count?.toString() || "—"}
                  />
                  {contract.data.show.meals_included && (
                    <Field label="Meals" value="Included" />
                  )}
                  {contract.data.show.lodging_included && (
                    <Field label="Lodging" value="Included" />
                  )}
                  <Field
                    label="Contract pay"
                    value={
                      contract.data.contract_pay == null
                        ? "—"
                        : `$${contract.data.contract_pay.toLocaleString()}`
                    }
                  />
                  <Field
                    label="Potential bonus"
                    value={
                      contract.data.bonus_pay == null
                        ? "—"
                        : `$${contract.data.bonus_pay.toLocaleString()}`
                    }
                  />
                </div>
              </section>
            )}
            {tab === "checklist" && (
              <section className="detail-panel">
                <div className="panel-title">
                  <div>
                    <h2>Checklist</h2>
                    <p>
                      {done} of {items.length} tasks complete
                    </p>
                  </div>
                  <strong>{progress}%</strong>
                </div>
                <div className="progress dark">
                  <span style={{ width: `${progress}%` }} />
                </div>
                {!checklist.data?.sections.length ? (
                  <p className="muted">
                    Your admin hasn’t attached a checklist yet.
                  </p>
                ) : (
                  <>
                    {checklist.data.sections.map((section) => (
                      <ChecklistSectionView
                        key={section.id}
                        section={section}
                        busy={busy}
                        onToggle={toggle}
                      />
                    ))}
                    {["submitted", "under_review"].includes(
                      contract.data.status,
                    ) ? (
                      <p className="success review-submitted">
                        <Check /> Submitted for admin review
                      </p>
                    ) : contract.data.status === "approved" ? (
                      <p className="success review-submitted">
                        <Check /> Checklist approved
                      </p>
                    ) : (
                      <div className="review-submit">
                        <button
                          className="button primary"
                          disabled={
                            !requiredComplete ||
                            !contract.data.signed_at ||
                            busy === "submit"
                          }
                          onClick={() => void submitForReview()}
                        >
                          <Send />
                          {busy === "submit"
                            ? "Submitting…"
                            : "Submit checklist for review"}
                        </button>
                        {!requiredComplete && (
                          <small>Complete every required item first.</small>
                        )}
                        {requiredComplete && !contract.data.signed_at && (
                          <small>
                            The lead driver must sign the contract before the
                            checklist can be submitted.
                          </small>
                        )}
                      </div>
                    )}
                  </>
                )}
              </section>
            )}
            {tab === "photos" && (
              <section className="detail-panel">
                <h2>Required photos</h2>
                <p className="muted">
                  Upload a clear view from each side. Photos stay private to
                  your team.
                </p>
                <div className="photo-grid">
                  {["Front", "Back", "Side 1", "Side 2"].map((slot) => (
                    <label className="photo-slot" key={slot}>
                      <Camera />
                      <strong>{slot}</strong>
                      <span>
                        {busy === slot ? "Uploading…" : "Tap to upload"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) =>
                          e.target.files?.[0] &&
                          void upload(e.target.files[0], slot)
                        }
                      />
                      <Upload />
                    </label>
                  ))}
                </div>
              </section>
            )}
            {tab === "sign" && (
              <section className="detail-panel sign-panel">
                <FileSignature />
                <h2>
                  {contract.data.signed_at
                    ? "Contract signed"
                    : "Review and sign contract"}
                </h2>
                <div className="contract-terms">
                  <p className="eyebrow">PUBLISHED TERMS</p>
                  {contract.data.terms ? (
                    <p>{contract.data.terms}</p>
                  ) : (
                    <p className="muted">
                      Contract terms have not been published yet. Contact your
                      administrator before signing.
                    </p>
                  )}
                </div>
                <div className="signature-status-grid">
                  <div className={contract.data.signed_at ? "complete" : ""}>
                    <span>Driver signature</span>
                    <strong>
                      {contract.data.signature_name || "Waiting for driver"}
                    </strong>
                  </div>
                  <div
                    className={contract.data.admin_signed_at ? "complete" : ""}
                  >
                    <span>Admin signature</span>
                    <strong>
                      {contract.data.admin_signature_name ||
                        "Waiting for administrator"}
                    </strong>
                  </div>
                </div>
                {contract.data.signed_at ? (
                  <>
                    <p>
                      Signed by <strong>{contract.data.signature_name}</strong>
                    </p>
                    <p className="success">
                      <Check /> Signed{" "}
                      {new Date(contract.data.signed_at).toLocaleString()}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="muted">
                      Typing your full legal name records your acknowledgement
                      of the published terms above.
                    </p>
                    <label>
                      Full legal name
                      <input
                        value={signature}
                        onChange={(e) => setSignature(e.target.value)}
                        placeholder="Your full name"
                      />
                    </label>
                    <button
                      className="button primary"
                      disabled={
                        !signature.trim() ||
                        busy === "sign" ||
                        !contract.data.terms
                      }
                      onClick={() => void sign()}
                    >
                      {busy === "sign" ? "Signing…" : "Accept terms and sign"}
                    </button>
                  </>
                )}
              </section>
            )}
          </>
        )}
      </PageState>
    </main>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function ChecklistSectionView({
  section,
  busy,
  onToggle,
}: {
  section: ChecklistSection;
  busy: string;
  onToggle: (id: string, value: boolean) => Promise<void>;
}) {
  const [open, setOpen] = useState(true),
    complete = section.items.filter((i) => i.response?.completed).length;
  return (
    <article className="check-section">
      <button className="check-section-head" onClick={() => setOpen(!open)}>
        <span>
          <strong>{section.title}</strong>
          <small>
            {complete} of {section.items.length} complete
          </small>
        </span>
        <ChevronDown className={open ? "rotated" : ""} />
      </button>
      {open && (
        <div>
          {section.items.map((item) => (
            <label className="check-item" key={item.id}>
              <input
                type="checkbox"
                checked={Boolean(item.response?.completed)}
                disabled={busy === item.id}
                onChange={(e) => void onToggle(item.id, e.target.checked)}
              />
              <span className="custom-check">
                <Check />
              </span>
              <span>
                <strong>{item.title}</strong>
                {item.instructions && <small>{item.instructions}</small>}
              </span>
            </label>
          ))}
        </div>
      )}
    </article>
  );
}
