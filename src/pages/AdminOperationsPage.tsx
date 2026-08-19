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
  createToolbagTemplate,
  createToolbag,
  deleteToolbagItem,
  getTeamMembers,
  getFeedback,
  getToolbags,
  getToolbagTemplates,
  updateToolbag,
  updateToolbagItem,
} from "../lib/adminData";
import { getResources } from "../lib/driverData";
import { supabase } from "../lib/supabase";
export function AdminOperationsPage() {
  const resources = useAsync(getResources, []),
    feedback = useAsync(getFeedback, []),
    toolbags = useAsync(getToolbags, []),
    toolbagTemplates = useAsync(getToolbagTemplates, []),
    teamMembers = useAsync(getTeamMembers, []);
  const [resource, setResource] = useState({
      title: "",
      kind: "faq",
      content: "",
    }),
    [resourceFile, setResourceFile] = useState<File | null>(null),
    [bag, setBag] = useState({ number: "", driver: "" }),
    [openBag, setOpenBag] = useState<string | null>(null),
    [item, setItem] = useState({ name: "", quantity: 1 }),
    [editingItem, setEditingItem] = useState<string | null>(null),
    [template, setTemplate] = useState({
      name: "",
      items: [{ name: "", quantity: 1 }],
    }),
    [message, setMessage] = useState("");
  async function addResource(e: FormEvent) {
    e.preventDefault();
    let file_path: string | null = null;
    if (resourceFile) {
      file_path = `red-folder/${crypto.randomUUID()}-${resourceFile.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage
        .from("resources")
        .upload(file_path, resourceFile);
      if (uploadError) {
        setMessage(uploadError.message);
        return;
      }
    }
    const { error } = await supabase
      .from("resources")
      .insert({ ...resource, file_path, published: true });
    setMessage(error ? error.message : "Resource published.");
    if (!error) {
      setResource({ title: "", kind: "faq", content: "" });
      setResourceFile(null);
      await resources.refresh();
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
  async function saveTemplate(e: FormEvent) {
    e.preventDefault();
    const items = template.items.filter((i) => i.name.trim());
    await createToolbagTemplate(template.name.trim(), items);
    setTemplate({ name: "", items: [{ name: "", quantity: 1 }] });
    setMessage("Toolbag template saved.");
    await toolbagTemplates.refresh();
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
            <BookOpen /> Publish resource
          </h2>
          <form className="stack-form" onSubmit={addResource}>
            <label>
              Type
              <select
                value={resource.kind}
                onChange={(e) => {
                  setResource({ ...resource, kind: e.target.value });
                  setResourceFile(null);
                }}
              >
                <option value="faq">FAQ</option>
                <option value="handbook">Red Folder</option>
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
              <label>
                Picture (optional)
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setResourceFile(e.target.files?.[0] || null)}
                />
              </label>
            )}
            <button className="button primary">
              <Plus /> Publish
            </button>
          </form>
          <PageState loading={resources.loading} error={resources.error}>
            {resources.data?.map((r) => (
              <div className="simple-row" key={r.id}>
                {r.kind === "faq" ? <HelpCircle /> : <Image />}
                <span>{r.title}</span>
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
          <details className="template-editor">
            <summary>Create toolbag template</summary>
            <form className="stack-form" onSubmit={saveTemplate}>
              <label>
                Template name
                <input
                  required
                  value={template.name}
                  onChange={(e) =>
                    setTemplate({ ...template, name: e.target.value })
                  }
                />
              </label>
              {template.items.map((templateItem, index) => (
                <div className="inventory-form" key={index}>
                  <input
                    required
                    placeholder="Item name"
                    value={templateItem.name}
                    onChange={(e) =>
                      setTemplate({
                        ...template,
                        items: template.items.map((value, itemIndex) =>
                          itemIndex === index
                            ? { ...value, name: e.target.value }
                            : value,
                        ),
                      })
                    }
                  />
                  <input
                    required
                    type="number"
                    min="1"
                    aria-label="Quantity"
                    value={templateItem.quantity}
                    onChange={(e) =>
                      setTemplate({
                        ...template,
                        items: template.items.map((value, itemIndex) =>
                          itemIndex === index
                            ? { ...value, quantity: Number(e.target.value) }
                            : value,
                        ),
                      })
                    }
                  />
                  {template.items.length > 1 && (
                    <button
                      type="button"
                      aria-label="Remove template item"
                      onClick={() =>
                        setTemplate({
                          ...template,
                          items: template.items.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
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
                  setTemplate({
                    ...template,
                    items: [...template.items, { name: "", quantity: 1 }],
                  })
                }
              >
                + Add template item
              </button>
              <button className="button primary">
                <Save /> Save template
              </button>
            </form>
          </details>
          <PageState loading={toolbags.loading} error={toolbags.error}>
            {toolbags.data?.map((t) => (
              <div className="toolbag-editor" key={t.id}>
                <button
                  className="simple-row toolbag-toggle"
                  onClick={() => {
                    setOpenBag(openBag === t.id ? null : t.id);
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
                    <label>
                      Assigned team member
                      <select
                        value={t.assigned_to || ""}
                        onChange={async (e) => {
                          await updateToolbag(t.id, e.target.value || null);
                          await toolbags.refresh();
                        }}
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
