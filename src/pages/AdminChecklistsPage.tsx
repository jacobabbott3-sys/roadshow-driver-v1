import {
  ArrowDown,
  ArrowUp,
  ClipboardCheck,
  Eye,
  History,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { AdminHeader } from "../components/AdminNav";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import {
  createTemplate,
  getReviewHistory,
  getReviews,
  getTemplates,
  updateTemplate,
} from "../lib/adminData";
import { dateRange, statusLabel } from "../lib/driverData";
type DraftSection = {
  title: string;
  items: { title: string; photo_required: boolean }[];
};
const initial: DraftSection[] = [
  { title: "Load Truck", items: [{ title: "", photo_required: false }] },
];
function move<T>(items: T[], from: number, to: number) {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
export function AdminChecklistsPage() {
  const templates = useAsync(getTemplates, []),
    reviews = useAsync(getReviews, []),
    history = useAsync(getReviewHistory, []);
  const [name, setName] = useState(""),
    [kind, setKind] = useState<"setup" | "teardown">("setup"),
    [sections, setSections] = useState<DraftSection[]>(initial),
    [creating, setCreating] = useState(false),
    [editing, setEditing] = useState<string | null>(null),
    [busy, setBusy] = useState("");
  function updateSection(index: number, patch: Partial<DraftSection>) {
    setSections(sections.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }
  function editTemplate(t: Awaited<ReturnType<typeof getTemplates>>[number]) {
    setName(t.name);
    setKind(t.kind);
    setSections(
      t.sections
        .sort((a, b) => a.position - b.position)
        .map((s) => ({
          title: s.title,
          items: s.items
            .sort((a, b) => a.position - b.position)
            .map((i) => ({ title: i.title, photo_required: i.photo_required })),
        })),
    );
    setEditing(t.id);
    setCreating(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy("create");
    const clean = sections.map((s) => ({
      ...s,
      items: s.items.filter((i) => i.title.trim()),
    }));
    if (editing) await updateTemplate(editing, name, kind, clean);
    else await createTemplate(name, kind, clean);
    setName("");
    setSections(initial);
    setEditing(null);
    setCreating(false);
    await templates.refresh();
    setBusy("");
  }
  return (
    <main className="page">
      <AdminHeader
        eyebrow="WORKFLOWS"
        title="Checklists"
        description="Build and revise reusable setup and teardown instructions."
      />
      <div className="admin-actions">
        <button
          className="button primary"
          onClick={() => {
            setCreating(!creating);
            setEditing(null);
            setName("");
            setSections(initial);
          }}
        >
          <Plus /> New template
        </button>
      </div>
      {creating && (
        <form className="admin-form checklist-builder" onSubmit={save}>
          <h2>{editing ? "Edit checklist template" : "Checklist template"}</h2>
          <div className="form-grid">
            <label>
              Template name
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </label>
            <label>
              Contract type
              <select
                value={kind}
                onChange={(e) =>
                  setKind(e.target.value as "setup" | "teardown")
                }
              >
                <option value="setup">Setup</option>
                <option value="teardown">Teardown</option>
              </select>
            </label>
          </div>
          {sections.map((section, si) => (
            <div className="builder-section" key={si}>
              <div className="builder-section-title">
                <input
                  required
                  value={section.title}
                  onChange={(e) => updateSection(si, { title: e.target.value })}
                  placeholder="Section title"
                />
                <button
                  type="button"
                  aria-label="Move section up"
                  disabled={si === 0}
                  onClick={() => setSections(move(sections, si, si - 1))}
                >
                  <ArrowUp />
                </button>
                <button
                  type="button"
                  aria-label="Move section down"
                  disabled={si === sections.length - 1}
                  onClick={() => setSections(move(sections, si, si + 1))}
                >
                  <ArrowDown />
                </button>
                {sections.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setSections(sections.filter((_, i) => i !== si))
                    }
                  >
                    <Trash2 />
                  </button>
                )}
              </div>
              {section.items.map((item, ii) => (
                <div className="builder-item" key={ii}>
                  <input
                    required
                    value={item.title}
                    onChange={(e) =>
                      updateSection(si, {
                        items: section.items.map((x, i) =>
                          i === ii ? { ...x, title: e.target.value } : x,
                        ),
                      })
                    }
                    placeholder="Checklist item"
                  />
                  <button
                    type="button"
                    aria-label="Move item up"
                    disabled={ii === 0}
                    onClick={() =>
                      updateSection(si, {
                        items: move(section.items, ii, ii - 1),
                      })
                    }
                  >
                    <ArrowUp />
                  </button>
                  <button
                    type="button"
                    aria-label="Move item down"
                    disabled={ii === section.items.length - 1}
                    onClick={() =>
                      updateSection(si, {
                        items: move(section.items, ii, ii + 1),
                      })
                    }
                  >
                    <ArrowDown />
                  </button>
                  {section.items.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        updateSection(si, {
                          items: section.items.filter((_, i) => i !== ii),
                        })
                      }
                    >
                      <Trash2 />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  updateSection(si, {
                    items: [
                      ...section.items,
                      { title: "", photo_required: false },
                    ],
                  })
                }
              >
                + Add item
              </button>
            </div>
          ))}
          <button
            type="button"
            className="text-button"
            onClick={() =>
              setSections([
                ...sections,
                { title: "", items: [{ title: "", photo_required: false }] },
              ])
            }
          >
            + Add section
          </button>
          <button className="button primary" disabled={busy === "create"}>
            {editing ? "Save template changes" : "Save template"}
          </button>
        </form>
      )}
      <section className="admin-section">
        <div className="section-row">
          <div>
            <p className="eyebrow">TEMPLATES</p>
            <h2>Reusable checklists</h2>
          </div>
        </div>
        <PageState loading={templates.loading} error={templates.error}>
          {!templates.data?.length ? (
            <div className="inline-empty">
              Create your first checklist template above.
            </div>
          ) : (
            templates.data.map((t) => (
              <article className="template-row" key={t.id}>
                <ClipboardCheck />
                <div>
                  <strong>{t.name}</strong>
                  <span>
                    {t.kind} · {t.sections?.length || 0} sections
                  </span>
                </div>
                <button
                  className="icon-text-button"
                  onClick={() => editTemplate(t)}
                >
                  <Pencil /> Edit
                </button>
                <span className="status status-approved">
                  {t.active ? "Active" : "Inactive"}
                </span>
              </article>
            ))
          )}
        </PageState>
      </section>
      <section className="admin-section">
        <div className="section-row">
          <div>
            <p className="eyebrow">SUBMISSIONS</p>
            <h2>Awaiting review</h2>
          </div>
        </div>
        <PageState loading={reviews.loading} error={reviews.error}>
          {!reviews.data?.length ? (
            <div className="inline-empty">
              No driver submissions are waiting.
            </div>
          ) : (
            reviews.data.map((r) => (
              <article className="review-row" key={r.id}>
                <div>
                  <strong>
                    {r.show.name} · {r.kind}
                  </strong>
                  <span>{r.driver?.full_name || "Unassigned"}</span>
                </div>
                <div>
                  <Link className="review-open-button" to={`/admin/checklists/${r.id}`}>
                    <Eye /> Review full checklist
                  </Link>
                </div>
              </article>
            ))
          )}
        </PageState>
      </section>
      <section className="admin-section">
        <div className="section-row">
          <div>
            <p className="eyebrow">HISTORY</p>
            <h2>Reviewed checklists</h2>
          </div>
          <History />
        </div>
        <PageState loading={history.loading} error={history.error}>
          {!history.data?.length ? (
            <div className="inline-empty">
              Completed reviews will remain available here.
            </div>
          ) : (
            history.data.map((review) => (
              <article className="review-row review-history-row" key={review.id}>
                <div>
                  <strong>
                    {review.show.name} · {statusLabel(review.kind)}
                  </strong>
                  <span>
                    {review.driver?.full_name || "Unassigned"} ·{" "}
                    {dateRange(review.show)}
                  </span>
                  <small>
                    Reviewed by {review.reviewer?.full_name || "Administrator"}{" "}
                    · {new Date(review.reviewed_at).toLocaleString()}
                  </small>
                </div>
                <div>
                  <span className={`status status-${review.status}`}>
                    {["approved", "bonus_earned", "bonus_not_earned"].includes(
                      review.status,
                    )
                      ? "Approved"
                      : "Returned"}
                  </span>
                  <Link
                    className="review-open-button"
                    to={`/admin/checklists/${review.id}`}
                  >
                    <Eye /> View review
                  </Link>
                </div>
              </article>
            ))
          )}
        </PageState>
      </section>
    </main>
  );
}
