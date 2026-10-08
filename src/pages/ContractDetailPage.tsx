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
import { Link, useParams, useSearchParams } from "react-router-dom";
import { getContractAcceptanceGate } from "../lib/agreementData";
import { AgreementSigning } from "../components/AgreementSigning";
import { PageState } from "../components/PageState";
import { ImageViewer } from "../components/ImageViewer";
import { BackButton } from "../components/BackButton";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import {
  dateRange,
  getChecklist,
  getContract,
  getContractPhotos,
  getLinkedSigningContracts,
  setChecklistItem,
  statusLabel,
  submitChecklist,
  type ContractPhoto,
  type ChecklistSection,
} from "../lib/driverData";
import { supabase } from "../lib/supabase";
import { launchConfetti } from "../lib/confetti";
import { uploadContractPhoto, type UploadClient } from "../lib/imageUpload";
type Tab = "info" | "checklist" | "photos" | "sign";
export function ContractDetailPage() {
  const { id = "" } = useParams(),
    [searchParams] = useSearchParams(),
    { user,profile } = useAuth(),
    contract = useAsync(() => getContract(id), [id]),
    acceptance = useAsync(()=>getContractAcceptanceGate(id),[id,contract.data?.signed_at]),
    checklist = useAsync(() => getChecklist(id), [id]),
    photos = useAsync(() => getContractPhotos(id), [id]),
    linkedSignings = useAsync(
      () => contract.data?.show.id ? getLinkedSigningContracts(contract.data.show.id) : Promise.resolve([]),
      [contract.data?.show.id],
    );
  const [tab, setTab] = useState<Tab>(searchParams.get("review") === "admin" ? "sign" : "info"),
    [busy, setBusy] = useState(""),
    [uploadProgress, setUploadProgress] = useState<Record<string, number>>({}),
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
  const signingGroupId = searchParams.get("group");
  const linkedGroupId = signingGroupId || contract.data?.show.id || "";
  const latestPhotos = useMemo(() => {
    const bySlot = new Map<string, ContractPhoto>();
    for (const photo of photos.data || []) if (photo.slot_name && !bySlot.has(photo.slot_name)) bySlot.set(photo.slot_name, photo);
    return bySlot;
  }, [photos.data]);
  async function toggle(itemId: string, value: boolean) {
    if (!checklist.data?.id) return;
    const completesChecklist = value && items.length > 0 && !items.find((item) => item.id === itemId)?.response?.completed && done + 1 === items.length;
    setBusy(itemId);
    try {
      await setChecklistItem(checklist.data.id, itemId, value);
      if (completesChecklist) launchConfetti({ pieces: 140, distance: 560 });
      await checklist.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update this checklist item.");
      await checklist.refresh();
    } finally {
      setBusy("");
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
    setMessage("");
    try {
      const result = await uploadContractPhoto({
        contractId: id,
        userId: user!.id,
        slot,
        file,
        onProgress: (percent) => setUploadProgress((current) => ({ ...current, [slot]: percent })),
      }, { client: supabase as unknown as UploadClient });
      await photos.refresh();
      setMessage(`${slot} photo uploaded${result.optimized ? " and optimized for storage" : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to upload this photo. Please try again.");
    } finally {
      setBusy("");
      setUploadProgress((current) => {
        const next = { ...current };
        delete next[slot];
        return next;
      });
    }
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
            <BackButton
              to={isSigning && signingGroupId ? `/signing-groups/${signingGroupId}` : "/contracts"}
              label={isSigning && signingGroupId ? "Back to linked signings" : "Back to contracts"}
            />
            <header className="contract-detail-head">
              <div>
                <span className={`status status-${contract.data.status}`}>
                  {isSigning ? "Signing" : statusLabel(contract.data.status)}
                </span>
                <h1>{contract.data.show.name}</h1>
                {(!contract.data.current_agreement_id || !contract.data.signed_at || !contract.data.admin_signed_at) && <p className="notice">Current agreement acceptance pending. Previous checklist progress is preserved.</p>}
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
                  <AddressField label="Address" address={contract.data.show.address} fallback="Provided closer to show" />
                  {!isSigning && <Field
                    label="Bins"
                    value={contract.data.show.bin_count?.toString() || "—"}
                  />}
                  {!isSigning && contract.data.show.per_diem != null && <Field label="Per diem" value={`$${contract.data.show.per_diem.toLocaleString()}`} />}
                  {contract.data.show.lodging_included && (
                    <>
                      <Field label="Lodging" value={contract.data.show.lodging_name || "Included"} />
                      <AddressField label="Lodging address" address={contract.data.show.lodging_address} />
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
                {isSigning && linkedSignings.data && linkedSignings.data.length > 0 && <div className="linked-signings"><h3>Linked signings</h3>{linkedSignings.data.map((linked) => <Link to={`/contracts/${linked.id}?group=${linkedGroupId}`} key={linked.id}><strong>{linked.show.artist || linked.show.name}</strong><span>{formatDateTime(linked.show.signing_at)} · {linked.show.venue_name || linked.show.city}</span></Link>)}</div>}
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
                            !acceptance.data ||
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
                        {requiredComplete && !acceptance.data && (
                          <small>
                            An assigned driver must accept the current agreement before the
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
                        <span>{busy === slot ? `Uploading… ${uploadProgress[slot] || 0}%` : photo ? "Replace photo" : "Choose or take photo"}</span>
                        <input type="file" accept="image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" disabled={busy === slot} onChange={(event) => { const input = event.currentTarget; const selected = input.files?.[0]; if (selected) void upload(selected, slot).finally(() => { input.value = ""; }); }} />
                        <Upload />
                      </label>
                      {busy === slot && <progress className="photo-upload-progress" max="100" value={uploadProgress[slot] || 0} aria-label={`${slot} upload progress`} />}
                    </div>;
                  })}
                </div>
              </section>
            )}
            {tab === "sign" && <AgreementSigning contractId={id} acceptanceRole={profile?.role === "admin" && searchParams.get("review") === "admin" ? "admin" : "driver"} onSigned={contract.refresh} />}
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
function AddressField({ label, address, fallback = "—" }: { label: string; address: string | null; fallback?: string }) {
  return (
    <div>
      <span>{label}</span>
      {address ? (
        <a className="map-address" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`} target="_blank" rel="noreferrer">
          <MapPin /> {address}
        </a>
      ) : <strong>{fallback}</strong>}
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
