import {
  Camera,
  Check,
  ChevronDown,
  FileSignature,
  Info,
  MapPin,
  Send,
  Upload,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PageState } from "../components/PageState";
import { ImageViewer } from "../components/ImageViewer";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import {
  dateRange,
  getChecklist,
  getContract,
  getContractPhotos,
  getLinkedSignings,
  setChecklistItem,
  statusLabel,
  submitChecklist,
  type ContractPhoto,
  type ChecklistSection,
} from "../lib/driverData";
import { supabase } from "../lib/supabase";
type Tab = "info" | "checklist" | "photos" | "sign";
export function ContractDetailPage() {
  const { id = "" } = useParams(),
    { user } = useAuth(),
    contract = useAsync(() => getContract(id), [id]),
    checklist = useAsync(() => getChecklist(id), [id]),
    photos = useAsync(() => getContractPhotos(id), [id]),
    linkedSignings = useAsync(
      () => contract.data?.show.id ? getLinkedSignings(contract.data.show.id) : Promise.resolve([]),
      [contract.data?.show.id],
    );
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
    isSigning = contract.data?.show.event_type === "signing",
    currentStatus = isSigning
      ? progress === 100 && items.length ? "Complete" : activeSection?.title || "Ready"
      : ["submitted", "under_review"].includes(
      contract.data?.status || "",
    )
      ? "Submitted for review"
      : contract.data?.status === "approved"
        ? "Approved"
        : activeSection?.title ||
          (items.length ? "Ready to submit" : "Waiting for checklist"),
    checklistLocked = !isSigning && ["submitted", "under_review", "approved"].includes(contract.data?.status || "");
  const latestPhotos = useMemo(() => {
    const bySlot = new Map<string, ContractPhoto>();
    for (const photo of photos.data || []) if (photo.slot_name && !bySlot.has(photo.slot_name)) bySlot.set(photo.slot_name, photo);
    return bySlot;
  }, [photos.data]);
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
    if (!error) {
      const { error: recordError } = await supabase.from("photos").insert({
        contract_id: id,
        slot_name: slot,
        storage_path: path,
        uploaded_by: user!.id,
      });
      if (recordError) {
        setMessage(recordError.message);
        setBusy("");
        return;
      }
      await photos.refresh();
    }
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
                  {isSigning ? "Signing" : statusLabel(contract.data.status)}
                </span>
                <h1>{contract.data.show.name}</h1>
                <p>
                  <MapPin />
                  {contract.data.show.venue_name || contract.data.show.city}
                  {contract.data.show.state
                    ? `, ${contract.data.show.state}`
                    : ""}{" "}
                  · {isSigning ? formatDateTime(contract.data.show.signing_at) : dateRange(contract.data.show)}
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
                ([
                  ["info", Info, "Info"],
                  ["checklist", Check, "Checklist"],
                  ["photos", Camera, "Photos"],
                  ["sign", FileSignature, "Contract"],
                ] as const).filter(([key]) => !isSigning || key === "info" || key === "checklist")
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
                <h2>{isSigning ? "Signing information" : "Show information"}</h2>
                <div className="info-grid">
                  {isSigning ? <>
                    <Field label="Artist" value={contract.data.show.artist || contract.data.show.name} />
                    <Field label="Signing time" value={formatDateTime(contract.data.show.signing_at)} />
                    <Field label="Setup time" value={formatDateTime(contract.data.show.setup_at)} />
                    <Field label="Location" value={contract.data.show.venue_name || contract.data.show.city} />
                  </> : <>
                    <Field label="Assignment" value={statusLabel(contract.data.kind)} />
                    <Field label="Show dates" value={dateRange(contract.data.show)} />
                    <Field label={`${statusLabel(contract.data.kind)} date and time`} value={`${formatWorkDate(contract.data.service_date)}${contract.data.service_time ? ` at ${formatTime(contract.data.service_time)}` : ""}`} />
                    <Field label="Location" value={`${contract.data.show.city}${contract.data.show.state ? `, ${contract.data.show.state}` : ""}`} />
                  </>}
                  <Field
                    label="Address"
                    value={
                      contract.data.show.address || "Provided closer to show"
                    }
                  />
                  {!isSigning && <Field
                    label="Bins"
                    value={contract.data.show.bin_count?.toString() || "—"}
                  />}
                  {!isSigning && contract.data.show.per_diem != null && <Field label="Per diem" value={`$${contract.data.show.per_diem.toLocaleString()}`} />}
                  {contract.data.show.lodging_included && (
                    <>
                      <Field label="Lodging" value={contract.data.show.lodging_name || "Included"} />
                      <Field label="Lodging address" value={contract.data.show.lodging_address || "—"} />
                      <Field label="Lodging phone" value={contract.data.show.lodging_phone || "—"} />
                      <Field label="Confirmation" value={contract.data.show.lodging_confirmation || "—"} />
                      <Field label="Check-in" value={formatDate(contract.data.show.lodging_check_in)} />
                      <Field label="Check-out" value={formatDate(contract.data.show.lodging_check_out)} />
                    </>
                  )}
                  {!isSigning && <Field
                    label="Contract pay"
                    value={
                      contract.data.contract_pay == null
                        ? "—"
                        : `$${contract.data.contract_pay.toLocaleString()}`
                    }
                  />}
                  {!isSigning && <Field
                    label="Potential bonus"
                    value={
                      contract.data.bonus_pay == null
                        ? "—"
                        : `$${contract.data.bonus_pay.toLocaleString()}`
                    }
                  />}
                </div>
                {contract.data.show.lodging_notes && <p className="detail-note"><strong>Lodging notes:</strong> {contract.data.show.lodging_notes}</p>}
                {isSigning && linkedSignings.data && linkedSignings.data.length > 0 && <div className="linked-signings"><h3>Linked signings</h3>{linkedSignings.data.map((signing) => <div key={signing.id}><strong>{signing.artist || signing.name}</strong><span>{formatDateTime(signing.signing_at)} · {signing.venue_name || signing.city}</span></div>)}</div>}
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
                        locked={checklistLocked}
                        onToggle={toggle}
                      />
                    ))}
                    {isSigning ? (
                      <p className={requiredComplete ? "success review-submitted" : "muted"}>{requiredComplete ? <><Check /> Signing checklist complete—no admin approval is required.</> : "Complete the checklist as the signing progresses."}</p>
                    ) : ["submitted", "under_review"].includes(
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
                  {["Front", "Back", "Side 1", "Side 2"].map((slot) => {
                    const photo = latestPhotos.get(slot);
                    return <div className={`photo-slot ${photo ? "has-photo" : ""}`} key={slot}>
                      {photo ? <ImageViewer src={photo.signed_url} alt={`${slot} view`} /> : <Camera />}
                      <strong>{slot}</strong>
                      <label className="photo-upload-action">
                        <span>{busy === slot ? "Uploading…" : photo ? "Replace photo" : "Tap to upload"}</span>
                        <input type="file" accept="image/*" capture="environment" onChange={(event) => event.target.files?.[0] && void upload(event.target.files[0], slot)} />
                        <Upload />
                      </label>
                    </div>;
                  })}
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
function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }) : "Not scheduled";
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
function formatDate(value: string | null) {
  return value ? new Date(`${value}T12:00:00`).toLocaleDateString() : "—";
}
function ChecklistSectionView({
  section,
  busy,
  locked,
  onToggle,
}: {
  section: ChecklistSection;
  busy: string;
  locked: boolean;
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
                disabled={
                  busy === item.id ||
                  locked ||
                  item.response?.review_status === "approved"
                }
                onChange={(e) => void onToggle(item.id, e.target.checked)}
              />
              <span className="custom-check">
                <Check />
              </span>
              <span>
                <strong>{item.title}</strong>
                {item.instructions && <small>{item.instructions}</small>}
                {item.response?.review_status === "approved" && (
                  <em className="driver-review approved">
                    <Check /> Approved
                  </em>
                )}
                {item.response?.review_status === "denied" && (
                  <em className="driver-review denied">
                    <XCircle /> Needs correction
                    {item.response.review_note && (
                      <small>{item.response.review_note}</small>
                    )}
                  </em>
                )}
              </span>
            </label>
          ))}
        </div>
      )}
    </article>
  );
}
