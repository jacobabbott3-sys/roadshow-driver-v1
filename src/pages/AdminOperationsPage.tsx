import {
  BookOpen,
  HelpCircle,
  Image,
  MessageSquareText,
  PackageOpen,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { AdminHeader } from "../components/AdminNav";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import {
  addToolbagItem,
  applyToolbagTemplate,
  createToolbag,
  deleteResource,
  deleteToolbagItem,
  getAdminResources,
  getTeamMembers,
  getFeedback,
  getToolbags,
  getToolbagTemplates,
  saveResource,
  updateToolbag,
  updateToolbagItem,
} from "../lib/adminData";
import { supabase } from "../lib/supabase";
export function AdminOperationsPage() {
  const resources = useAsync(getAdminResources, []),
    feedback = useAsync(getFeedback, []),
    toolbags = useAsync(getToolbags, []),
    toolbagTemplates = useAsync(getToolbagTemplates, []),
    teamMembers = useAsync(getTeamMembers, []);
  const blankResource = {
      id: "",
      title: "",
      kind: "faq" as "faq" | "handbook" | "link",
      content: "",
      file_path: null as string | null,
      position: 0,
      published: true,
    };
  const [resource, setResource] = useState(blankResource),
    [resourceFile, setResourceFile] = useState<File | null>(null),
    [removeResourceFile, setRemoveResourceFile] = useState(false),
    [bag, setBag] = useState({ number: "", driver: "" }),
    [bagEdit, setBagEdit] = useState({ number: "", driver: "" }),
    [openBag, setOpenBag] = useState<string | null>(null),
    [item, setItem] = useState({ name: "", quantity: 1 }),
    [editingItem, setEditingItem] = useState<string | null>(null),
    [message, setMessage] = useState("");
  async function submitResource(e: FormEvent) {
    e.preventDefault();
    setMessage("");
    let file_path = resource.kind !== "handbook" || removeResourceFile ? null : resource.file_path;
    let uploadedPath: string | null = null;
    if (resourceFile) {
      uploadedPath = `red-folder/${crypto.randomUUID()}-${resourceFile.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from("resources")
        .upload(uploadedPath, resourceFile);
      if (uploadError) {
        setMessage(uploadError.message);
        return;
      }
      file_path = uploadedPath;
    }
    try {
      await saveResource({
        id: resource.id || undefined,
        title: resource.title,
        kind: resource.kind,
        content: resource.content,
        file_path,
        position: resource.position,
        published: resource.published,
      });
      if (resource.file_path && resource.file_path !== file_path) {
        await supabase.storage.from("resources").remove([resource.file_path]);
      }
      setMessage(resource.id ? "Resource updated." : "Resource saved.");
      setResource(blankResource);
      setResourceFile(null);
      setRemoveResourceFile(false);
      await resources.refresh();
    } catch (error) {
      if (uploadedPath) await supabase.storage.from("resources").remove([uploadedPath]);
      setMessage(error instanceof Error ? error.message : "Unable to save resource.");
    }
  }
  async function removeResource(id: string, filePath: string | null) {
    if (!window.confirm("Delete this resource? Drivers will no longer be able to view it.")) return;
    try {
      await deleteResource(id);
      if (filePath) await supabase.storage.from("resources").remove([filePath]);
      if (resource.id === id) setResource(blankResource);
      await resources.refresh();
      setMessage("Resource deleted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete resource.");
    }
  }
  async function addBag(e: FormEvent) {
    e.preventDefault();
    try {
      await createToolbag(bag.number, bag.driver || null);
      setBag({ number: "", driver: "" });
      await toolbags.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Unable to add toolbag.");
    }
  }
  async function saveItem(e: FormEvent) {
    e.preventDefault();
    if (!openBag) return;
    if (editingItem)
      await updateToolbagItem(editingItem, item.name, item.quantity);
    else await addToolbagItem(openBag, item.name, item.quantity);
    setItem({ name: "", quantity: 1 });
    setEditingItem(null);
    await toolbags.refresh();
  }
  async function removeItem(id: string) {
    await deleteToolbagItem(id);
    await toolbags.refresh();
  }
  return (
    <main className="page">
      <AdminHeader
        eyebrow="OPERATIONS"
        title="Resources & toolbags"
        description="Publish driver guidance, review feedback, and manage every toolbag item."
      />
      {message && <div className="notice">{message}</div>}
      <div className="operations-grid">
        <section className="admin-section">
          <h2>
            <BookOpen /> {resource.id ? "Edit resource" : "Publish resource"}
          </h2>
          <form className="stack-form" onSubmit={submitResource}>
            <label>
              Type
              <select
                value={resource.kind}
                onChange={(e) => {
                  setResource({ ...resource, kind: e.target.value as "faq" | "handbook" | "link" });
                  setResourceFile(null);
                }}
              >
                <option value="faq">FAQ</option>
                <option value="handbook">Red Folder</option>
                {resource.kind === "link" && <option value="link">Legacy link</option>}
              </select>
            </label>
            <label>
              Title
              <input
                required
                value={resource.title}
                onChange={(e) =>
                  setResource({ ...resource, title: e.target.value })
                }
              />
            </label>
            <label>
              Content
              <textarea
                required
                value={resource.content}
                onChange={(e) =>
                  setResource({ ...resource, content: e.target.value })
                }
              />
            </label>
            {resource.kind === "handbook" && (
              <>
                <label>
                  {resource.file_path ? "Replace picture (optional)" : "Picture (optional)"}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => { setResourceFile(e.target.files?.[0] || null); setRemoveResourceFile(false); }}
                  />
                </label>
                {resource.file_path && <label className="checkbox-field"><input type="checkbox" checked={removeResourceFile} onChange={(e) => { setRemoveResourceFile(e.target.checked); if (e.target.checked) setResourceFile(null); }} /> Remove current picture</label>}
              </>
            )}
            <label>
              Display order
              <input type="number" min="0" value={resource.position} onChange={(e) => setResource({ ...resource, position: Number(e.target.value) })} />
            </label>
            <label className="checkbox-field"><input type="checkbox" checked={resource.published} onChange={(e) => setResource({ ...resource, published: e.target.checked })} /> Published for drivers</label>
            <button className="button primary">
              {resource.id ? <Save /> : <Plus />} {resource.id ? "Save changes" : "Save resource"}
            </button>
            {resource.id && <button type="button" className="button secondary" onClick={() => { setResource(blankResource); setResourceFile(null); setRemoveResourceFile(false); }}>Cancel editing</button>}
          </form>
          <PageState loading={resources.loading} error={resources.error}>
            {resources.data?.map((r) => (
              <div className="simple-row resource-admin-row" key={r.id}>
                {r.kind === "faq" ? <HelpCircle /> : <Image />}
                <span><strong>{r.title}</strong><small>{r.published ? "Published" : "Draft"} · Order {r.position}{r.file_path ? " · Picture attached" : ""}</small></span>
                <button className="icon-text-button" onClick={() => { setResource({ id: r.id, title: r.title, kind: r.kind, content: r.content || "", file_path: r.file_path, position: r.position, published: r.published }); setResourceFile(null); setRemoveResourceFile(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /> Edit</button>
                <button className="icon-text-button delete-action" onClick={() => void removeResource(r.id, r.file_path)}><Trash2 /> Delete</button>
              </div>
            ))}
          </PageState>
        </section>
        <section className="admin-section">
          <h2>
            <PackageOpen /> Toolbags
          </h2>
          <form className="stack-form" onSubmit={addBag}>
            <label>
              Toolbag number
              <input
                required
                value={bag.number}
                onChange={(e) => setBag({ ...bag, number: e.target.value })}
                placeholder="27"
              />
            </label>
            <label>
              Assign to
              <select
                value={bag.driver}
                onChange={(e) => setBag({ ...bag, driver: e.target.value })}
              >
                <option value="">Unassigned</option>
                {teamMembers.data?.map((member) => (
                  <option value={member.id} key={member.id}>
                    {member.full_name}
                    {member.role === "admin" ? " (Admin)" : ""}
                  </option>
                ))}
              </select>
            </label>
            <button className="button primary">
              <Plus /> Add toolbag
            </button>
          </form>
          <PageState loading={toolbags.loading} error={toolbags.error}>
            {toolbags.data?.map((t) => (
              <div className="toolbag-editor" key={t.id}>
                <button
                  className="simple-row toolbag-toggle"
                  onClick={() => {
                    setOpenBag(openBag === t.id ? null : t.id);
                    setBagEdit({ number: t.number, driver: t.assigned_to || "" });
                    setEditingItem(null);
                    setItem({ name: "", quantity: 1 });
                  }}
                >
                  <PackageOpen />
                  <span>
                    <strong>Toolbag #{t.number}</strong>
                    <small>
                      {t.driver?.full_name || "Unassigned"}
                      {t.driver?.role === "admin" ? " (Admin)" : ""} ·{" "}
                      {t.items?.length || 0} items
                    </small>
                  </span>
                  <Pencil />
                </button>
                {openBag === t.id && (
                  <div className="toolbag-items">
                    <form className="toolbag-settings" onSubmit={async (e) => { e.preventDefault(); try { await updateToolbag(t.id, bagEdit.number, bagEdit.driver || null); await toolbags.refresh(); setMessage("Toolbag updated."); } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to update toolbag."); } }}>
                      <label>Toolbag number<input required value={bagEdit.number} onChange={(e) => setBagEdit({ ...bagEdit, number: e.target.value })} /></label>
                      <label>
                        Assigned team member
                        <select value={bagEdit.driver} onChange={(e) => setBagEdit({ ...bagEdit, driver: e.target.value })}>
                          <option value="">Unassigned</option>
                          {teamMembers.data?.map((member) => <option value={member.id} key={member.id}>{member.full_name}{member.role === "admin" ? " (Admin)" : ""}</option>)}
                        </select>
                      </label>
                      <button className="button secondary"><Save /> Save toolbag details</button>
                    </form>
                    <label>
                      Fill from template
                      <select
                        defaultValue=""
                        onChange={async (e) => {
                          if (!e.target.value) return;
                          await applyToolbagTemplate(t.id, e.target.value);
                          await toolbags.refresh();
                          e.target.value = "";
                        }}
                      >
                        <option value="">Choose template…</option>
                        {toolbagTemplates.data?.map((template) => (
                          <option value={template.id} key={template.id}>
                            {template.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {t.items?.map((i) => (
                      <div className="inventory-row" key={i.id}>
                        <span>
                          <strong>{i.name}</strong>
                          <small>Quantity: {i.quantity}</small>
                        </span>
                        <button
                          onClick={() => {
                            setEditingItem(i.id);
                            setItem({ name: i.name, quantity: i.quantity });
                          }}
                        >
                          <Pencil />
                        </button>
                        <button onClick={() => void removeItem(i.id)}>
                          <Trash2 />
                        </button>
                      </div>
                    ))}
                    <form className="inventory-form" onSubmit={saveItem}>
                      <input
                        required
                        placeholder="Item name"
                        value={item.name}
                        onChange={(e) =>
                          setItem({ ...item, name: e.target.value })
                        }
                      />
                      <input
                        required
                        type="number"
                        min="1"
                        aria-label="Quantity"
                        placeholder="Quantity"
                        value={item.quantity}
                        onChange={(e) =>
                          setItem({ ...item, quantity: Number(e.target.value) })
                        }
                      />
                      <button className="button primary">
                        {editingItem ? (
                          <>
                            <Save /> Save
                          </>
                        ) : (
                          <>
                            <Plus /> Add item
                          </>
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </PageState>
        </section>
      </div>
      <section className="admin-section">
        <div className="section-row">
          <div>
            <p className="eyebrow">DRIVER INPUT</p>
            <h2>Feedback</h2>
          </div>
        </div>
        <PageState loading={feedback.loading} error={feedback.error}>
          {!feedback.data?.length ? (
            <div className="inline-empty">No feedback submitted yet.</div>
          ) : (
            feedback.data.map((f) => (
              <article className="feedback-row" key={f.id}>
                <MessageSquareText />
                <div>
                  <strong>
                    {f.profile?.full_name || "Driver"} · {f.category}
                  </strong>
                  <p>{f.message}</p>
                  <small>{new Date(f.created_at).toLocaleString()}</small>
                </div>
                <span className="status">{f.status}</span>
              </article>
            ))
          )}
        </PageState>
      </section>
    </main>
  );
}
