import { BriefcaseBusiness, ClipboardCheck, GripVertical, PackageOpen, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useState, type DragEvent, type FormEvent, type KeyboardEvent, type TouchEvent } from "react";
import { AdminHeader } from "../components/AdminNav";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import {
  createTemplate,
  createToolbagTemplate,
  getContractTemplates,
  getTemplates,
  getToolbagTemplates,
  saveContractTemplate,
  updateTemplate,
  updateToolbagTemplate,
} from "../lib/adminData";

type Tab = "contract" | "checklist" | "toolbag";
type DraftItem = { draftId: string; title: string; photo_required: boolean };
type DraftSection = { draftId: string; title: string; items: DraftItem[] };
type ToolbagDraftItem = { draftId: string; name: string; quantity: number };
type AsyncQuery<T> = { data: T | null; loading: boolean; error: string; refresh: () => Promise<void> };

function draftId() { return `${Date.now()}-${Math.random().toString(36).slice(2)}`; }
function newChecklistItem(title = ""): DraftItem { return { draftId: draftId(), title, photo_required: false }; }
function initialSections(): DraftSection[] { return [{ draftId: draftId(), title: "Load Truck", items: [newChecklistItem()] }]; }
function newToolbagItem(name = "", quantity = 1): ToolbagDraftItem { return { draftId: draftId(), name, quantity }; }
function move<T>(items: T[], from: number, to: number) {
  if (from === to || to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function AdminTemplatesPage() {
  const contractTemplates = useAsync(getContractTemplates, []);
  const checklistTemplates = useAsync(getTemplates, []);
  const toolbagTemplates = useAsync(getToolbagTemplates, []);
  const [tab, setTab] = useState<Tab>("contract");
  const [message, setMessage] = useState("");

  return (
    <main className="page">
      <AdminHeader eyebrow="REUSABLE CONTENT" title="Templates" description="Manage contract terms, checklists, and toolbag inventories in one place." backTo="/admin" />
      <div className="template-tabs">
        <button className={tab === "contract" ? "active" : ""} onClick={() => setTab("contract")}><BriefcaseBusiness /> Contracts</button>
        <button className={tab === "checklist" ? "active" : ""} onClick={() => setTab("checklist")}><ClipboardCheck /> Checklists</button>
        <button className={tab === "toolbag" ? "active" : ""} onClick={() => setTab("toolbag")}><PackageOpen /> Toolbags</button>
      </div>
      {message && <p className="notice">{message}</p>}
      {tab === "contract" && <ContractTemplates query={contractTemplates} onMessage={setMessage} />}
      {tab === "checklist" && <ChecklistTemplates query={checklistTemplates} onMessage={setMessage} />}
      {tab === "toolbag" && <ToolbagTemplates query={toolbagTemplates} onMessage={setMessage} />}
    </main>
  );
}

function ContractTemplates({ query, onMessage }: { query: AsyncQuery<Awaited<ReturnType<typeof getContractTemplates>>>; onMessage: (value: string) => void }) {
  const blank = { id: "", name: "", kind: "setup" as "setup" | "teardown", terms: "", active: true };
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await saveContractTemplate({ id: form.id || undefined, name: form.name, kind: form.kind, terms: form.terms || null, active: form.active });
      setForm(blank); setOpen(false); await query.refresh(); onMessage("Contract template saved.");
    } catch (error) { onMessage(error instanceof Error ? error.message : "Unable to save template."); }
    finally { setBusy(false); }
  }
  return <>
    <div className="admin-actions"><button className="button primary" onClick={() => { setForm(blank); setOpen(!open); }}><Plus /> New contract template</button></div>
    {open && <form className="admin-form" onSubmit={save}>
      <h2>{form.id ? "Edit" : "New"} contract template</h2>
      <div className="form-grid">
        <label>Template name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Type<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as "setup" | "teardown" })}><option value="setup">Setup</option><option value="teardown">Teardown</option></select></label>
      </div>
      <label className="terms-editor">Published terms<textarea required value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></label>
      <label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active template</label>
      <button className="button primary" disabled={busy}><Save /> Save template</button>
    </form>}
    <section className="admin-section"><h2>Reusable contracts</h2><PageState loading={query.loading} error={query.error} empty={!query.data?.length}>{query.data?.map((template) => <article className="template-row" key={template.id}><BriefcaseBusiness /><div><strong>{template.name}</strong><span>{template.kind} · Terms template</span></div><button className="icon-text-button" onClick={() => { setForm({ id: template.id, name: template.name, kind: template.kind, terms: template.terms || "", active: template.active }); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /> Edit</button></article>)}</PageState></section>
  </>;
}

function ChecklistTemplates({ query, onMessage }: { query: AsyncQuery<Awaited<ReturnType<typeof getTemplates>>>; onMessage: (value: string) => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"setup" | "teardown">("setup");
  const [sections, setSections] = useState<DraftSection[]>(initialSections);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [sectionDrag, setSectionDrag] = useState<{ from: number; over: number } | null>(null);
  const [itemDrag, setItemDrag] = useState<{ section: number; from: number; over: number } | null>(null);

  function reset() { setName(""); setKind("setup"); setSections(initialSections()); setEditing(null); }
  function updateSection(index: number, patch: Partial<DraftSection>) { setSections((current) => current.map((section, itemIndex) => itemIndex === index ? { ...section, ...patch } : section)); }
  function finishSectionDrag() {
    if (sectionDrag) setSections((current) => move(current, sectionDrag.from, sectionDrag.over));
    setSectionDrag(null);
  }
  function finishItemDrag() {
    if (itemDrag) setSections((current) => current.map((section, index) => index === itemDrag.section ? { ...section, items: move(section.items, itemDrag.from, itemDrag.over) } : section));
    setItemDrag(null);
  }
  function sectionTouchMove(event: TouchEvent) {
    event.preventDefault();
    const index = touchIndex(event, "[data-section-drop]", "sectionIndex");
    if (index != null) setSectionDrag((current) => current ? { ...current, over: index } : current);
  }
  function itemTouchMove(event: TouchEvent, sectionIndex: number) {
    event.preventDefault();
    const target = touchElement(event, `[data-item-drop][data-section-index="${sectionIndex}"]`);
    const index = target?.dataset.itemIndex ? Number(target.dataset.itemIndex) : null;
    if (index != null) setItemDrag((current) => current ? { ...current, over: index } : current);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const clean = sections.map((section) => ({ title: section.title, items: section.items.filter((item) => item.title.trim()).map((item) => ({ title: item.title, photo_required: false })) }));
    if (editing) await updateTemplate(editing, name, kind, clean); else await createTemplate(name, kind, clean);
    reset(); setOpen(false); await query.refresh(); onMessage("Checklist template saved.");
  }

  return <>
    <div className="admin-actions"><button className="button primary" onClick={() => { reset(); setOpen(!open); }}><Plus /> New checklist template</button></div>
    {open && <form className="admin-form checklist-builder" onSubmit={save}>
      <h2>{editing ? "Edit" : "New"} checklist template</h2>
      <div className="form-grid"><label>Template name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Type<select value={kind} onChange={(event) => setKind(event.target.value as "setup" | "teardown")}><option value="setup">Setup</option><option value="teardown">Teardown</option></select></label></div>
      <p className="drag-help"><GripVertical /> Drag sections and items by their handles to reorder them.</p>
      {sections.map((section, sectionIndex) => <div
        className={`builder-section draggable-template-row ${sectionDrag?.over === sectionIndex ? "drag-over" : ""}`}
        data-section-drop data-section-index={sectionIndex} key={section.draftId}
        onDragOver={(event) => { event.preventDefault(); setSectionDrag((current) => current ? { ...current, over: sectionIndex } : current); }}
        onDrop={(event) => { event.preventDefault(); finishSectionDrag(); }}
      >
        <div className="builder-section-title">
          <DragHandle label={`Reorder ${section.title || "section"}`} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setSectionDrag({ from: sectionIndex, over: sectionIndex }); }} onDragEnd={() => setSectionDrag(null)} onTouchStart={() => setSectionDrag({ from: sectionIndex, over: sectionIndex })} onTouchMove={sectionTouchMove} onTouchEnd={finishSectionDrag} onKeyMove={(direction) => setSections((current) => move(current, sectionIndex, sectionIndex + direction))} />
          <input required value={section.title} onChange={(event) => updateSection(sectionIndex, { title: event.target.value })} placeholder="Section title" />
          {sections.length > 1 && <button type="button" aria-label={`Delete ${section.title || "section"}`} onClick={() => setSections((current) => current.filter((_, index) => index !== sectionIndex))}><Trash2 /></button>}
        </div>
        {section.items.map((item, itemIndex) => <div
          className={`builder-item draggable-template-row ${itemDrag?.section === sectionIndex && itemDrag.over === itemIndex ? "drag-over" : ""}`}
          data-item-drop data-section-index={sectionIndex} data-item-index={itemIndex} key={item.draftId}
          onDragOver={(event) => { event.preventDefault(); setItemDrag((current) => current?.section === sectionIndex ? { ...current, over: itemIndex } : current); }}
          onDrop={(event) => { event.preventDefault(); finishItemDrag(); }}
        >
          <DragHandle label={`Reorder ${item.title || "checklist item"}`} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setItemDrag({ section: sectionIndex, from: itemIndex, over: itemIndex }); }} onDragEnd={() => setItemDrag(null)} onTouchStart={() => setItemDrag({ section: sectionIndex, from: itemIndex, over: itemIndex })} onTouchMove={(event) => itemTouchMove(event, sectionIndex)} onTouchEnd={finishItemDrag} onKeyMove={(direction) => updateSection(sectionIndex, { items: move(section.items, itemIndex, itemIndex + direction) })} />
          <input required value={item.title} onChange={(event) => updateSection(sectionIndex, { items: section.items.map((current, index) => index === itemIndex ? { ...current, title: event.target.value } : current) })} placeholder="Checklist item" />
          {section.items.length > 1 && <button type="button" aria-label={`Delete ${item.title || "checklist item"}`} onClick={() => updateSection(sectionIndex, { items: section.items.filter((_, index) => index !== itemIndex) })}><Trash2 /></button>}
        </div>)}
        <button type="button" className="text-button" onClick={() => updateSection(sectionIndex, { items: [...section.items, newChecklistItem()] })}>+ Add item</button>
      </div>)}
      <button type="button" className="text-button" onClick={() => setSections((current) => [...current, { draftId: draftId(), title: "", items: [newChecklistItem()] }])}>+ Add section</button>
      <button className="button primary"><Save /> Save template</button>
    </form>}
    <section className="admin-section"><h2>Reusable checklists</h2><PageState loading={query.loading} error={query.error} empty={!query.data?.length}>{query.data?.map((template) => <article className="template-row" key={template.id}><ClipboardCheck /><div><strong>{template.name}</strong><span>{template.kind} · {template.sections.length} sections</span></div><button className="icon-text-button" onClick={() => { setName(template.name); setKind(template.kind); setSections([...template.sections].sort((a, b) => a.position - b.position).map((section) => ({ draftId: draftId(), title: section.title, items: [...section.items].sort((a, b) => a.position - b.position).map((item) => newChecklistItem(item.title)) }))); setEditing(template.id); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /> Edit</button></article>)}</PageState></section>
  </>;
}

function ToolbagTemplates({ query, onMessage }: { query: AsyncQuery<Awaited<ReturnType<typeof getToolbagTemplates>>>; onMessage: (value: string) => void }) {
  const empty = () => ({ id: "", name: "", items: [newToolbagItem()] });
  const [form, setForm] = useState(empty);
  const [open, setOpen] = useState(false);
  const [drag, setDrag] = useState<{ from: number; over: number } | null>(null);
  function finishDrag() { if (drag) setForm((current) => ({ ...current, items: move(current.items, drag.from, drag.over) })); setDrag(null); }
  function touchMove(event: TouchEvent) {
    event.preventDefault();
    const index = touchIndex(event, "[data-toolbag-item-drop]", "itemIndex");
    if (index != null) setDrag((current) => current ? { ...current, over: index } : current);
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    const items = form.items.filter((item) => item.name.trim()).map(({ name, quantity }) => ({ name, quantity }));
    if (form.id) await updateToolbagTemplate(form.id, form.name, items); else await createToolbagTemplate(form.name, items);
    setForm(empty()); setOpen(false); await query.refresh(); onMessage("Toolbag template saved.");
  }
  return <>
    <div className="admin-actions"><button className="button primary" onClick={() => { setForm(empty()); setOpen(!open); }}><Plus /> New toolbag template</button></div>
    {open && <form className="admin-form" onSubmit={save}>
      <h2>{form.id ? "Edit" : "New"} toolbag template</h2>
      <label>Template name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
      <p className="drag-help"><GripVertical /> Drag items by their handles to reorder them.</p>
      {form.items.map((item, index) => <div className={`inventory-form draggable-template-row ${drag?.over === index ? "drag-over" : ""}`} data-toolbag-item-drop data-item-index={index} key={item.draftId} onDragOver={(event) => { event.preventDefault(); setDrag((current) => current ? { ...current, over: index } : current); }} onDrop={(event) => { event.preventDefault(); finishDrag(); }}>
        <DragHandle label={`Reorder ${item.name || "toolbag item"}`} onDragStart={(event) => { event.dataTransfer.effectAllowed = "move"; setDrag({ from: index, over: index }); }} onDragEnd={() => setDrag(null)} onTouchStart={() => setDrag({ from: index, over: index })} onTouchMove={touchMove} onTouchEnd={finishDrag} onKeyMove={(direction) => setForm((current) => ({ ...current, items: move(current.items, index, index + direction) }))} />
        <input required value={item.name} placeholder="Item name" onChange={(event) => setForm({ ...form, items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, name: event.target.value } : current) })} />
        <input required type="number" min="1" value={item.quantity} aria-label="Quantity" onChange={(event) => setForm({ ...form, items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, quantity: Number(event.target.value) } : current) })} />
        {form.items.length > 1 && <button type="button" aria-label={`Delete ${item.name || "toolbag item"}`} onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></button>}
      </div>)}
      <button type="button" className="text-button" onClick={() => setForm({ ...form, items: [...form.items, newToolbagItem()] })}>+ Add item</button>
      <button className="button primary"><Save /> Save template</button>
    </form>}
    <section className="admin-section"><h2>Reusable toolbags</h2><PageState loading={query.loading} error={query.error} empty={!query.data?.length}>{query.data?.map((template) => <article className="template-row" key={template.id}><PackageOpen /><div><strong>{template.name}</strong><span>{template.items.length} items</span></div><button className="icon-text-button" onClick={() => { setForm({ id: template.id, name: template.name, items: [...template.items].sort((a, b) => a.position - b.position).map((item) => newToolbagItem(item.name, item.quantity)) }); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /> Edit</button></article>)}</PageState></section>
  </>;
}

function DragHandle({ label, onDragStart, onDragEnd, onTouchStart, onTouchMove, onTouchEnd, onKeyMove }: {
  label: string;
  onDragStart: (event: DragEvent<HTMLSpanElement>) => void;
  onDragEnd: () => void;
  onTouchStart: () => void;
  onTouchMove: (event: TouchEvent<HTMLSpanElement>) => void;
  onTouchEnd: () => void;
  onKeyMove: (direction: -1 | 1) => void;
}) {
  function keyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    onKeyMove(event.key === "ArrowUp" ? -1 : 1);
  }
  return <span className="drag-handle" role="button" tabIndex={0} aria-label={label} title="Drag to reorder" draggable onDragStart={onDragStart} onDragEnd={onDragEnd} onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} onKeyDown={keyDown}><GripVertical /></span>;
}

function touchElement(event: TouchEvent, selector: string) {
  const touch = event.touches[0];
  return touch ? document.elementFromPoint(touch.clientX, touch.clientY)?.closest<HTMLElement>(selector) || null : null;
}
function touchIndex(event: TouchEvent, selector: string, datasetKey: "sectionIndex" | "itemIndex") {
  const value = touchElement(event, selector)?.dataset[datasetKey];
  return value == null ? null : Number(value);
}
