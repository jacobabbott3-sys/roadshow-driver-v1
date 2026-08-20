import { ArrowDown, ArrowUp, BriefcaseBusiness, ClipboardCheck, PackageOpen, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
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
type DraftSection = { title: string; items: { title: string; photo_required: boolean }[] };
type AsyncQuery<T> = { data: T | null; loading: boolean; error: string; refresh: () => Promise<void> };
const initialSections: DraftSection[] = [{ title: "Load Truck", items: [{ title: "", photo_required: false }] }];
function move<T>(items: T[], from: number, to: number) { if (to < 0 || to >= items.length) return items; const next = [...items]; const [item] = next.splice(from, 1); next.splice(to, 0, item); return next; }

export function AdminTemplatesPage() {
  const contractTemplates = useAsync(getContractTemplates, []);
  const checklistTemplates = useAsync(getTemplates, []);
  const toolbagTemplates = useAsync(getToolbagTemplates, []);
  const [tab, setTab] = useState<Tab>("contract");
  const [message, setMessage] = useState("");

  return (
    <main className="page">
      <AdminHeader eyebrow="REUSABLE CONTENT" title="Templates" description="Manage contract terms, checklists, and toolbag inventories in one place." />
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
  const blank = { id: "", name: "", kind: "setup" as "setup" | "teardown", contract_pay: "", bonus_pay: "", terms: "", active: true };
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function save(event: FormEvent) { event.preventDefault(); setBusy(true); try { await saveContractTemplate({ id: form.id || undefined, name: form.name, kind: form.kind, contract_pay: form.contract_pay ? Number(form.contract_pay) : null, bonus_pay: form.bonus_pay ? Number(form.bonus_pay) : null, terms: form.terms || null, active: form.active }); setForm(blank); setOpen(false); await query.refresh(); onMessage("Contract template saved."); } catch (error) { onMessage(error instanceof Error ? error.message : "Unable to save template."); } finally { setBusy(false); } }
  return <>
    <div className="admin-actions"><button className="button primary" onClick={() => { setForm(blank); setOpen(!open); }}><Plus /> New contract template</button></div>
    {open && <form className="admin-form" onSubmit={save}><h2>{form.id ? "Edit" : "New"} contract template</h2><div className="form-grid"><label>Template name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Type<select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value as "setup" | "teardown" })}><option value="setup">Setup</option><option value="teardown">Teardown</option></select></label><label>Contract pay<input type="number" min="0" value={form.contract_pay} onChange={(event) => setForm({ ...form, contract_pay: event.target.value })} /></label><label>Potential bonus<input type="number" min="0" value={form.bonus_pay} onChange={(event) => setForm({ ...form, bonus_pay: event.target.value })} /></label></div><label className="terms-editor">Published terms<textarea required value={form.terms} onChange={(event) => setForm({ ...form, terms: event.target.value })} /></label><label className="checkbox-field"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} /> Active template</label><button className="button primary" disabled={busy}><Save /> Save template</button></form>}
    <section className="admin-section"><h2>Reusable contracts</h2><PageState loading={query.loading} error={query.error} empty={!query.data?.length}>{query.data?.map((template) => <article className="template-row" key={template.id}><BriefcaseBusiness /><div><strong>{template.name}</strong><span>{template.kind} · {template.contract_pay == null ? "No pay set" : `$${template.contract_pay.toLocaleString()}`}</span></div><button className="icon-text-button" onClick={() => { setForm({ id: template.id, name: template.name, kind: template.kind, contract_pay: template.contract_pay?.toString() || "", bonus_pay: template.bonus_pay?.toString() || "", terms: template.terms || "", active: template.active }); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /> Edit</button></article>)}</PageState></section>
  </>;
}

function ChecklistTemplates({ query, onMessage }: { query: AsyncQuery<Awaited<ReturnType<typeof getTemplates>>>; onMessage: (value: string) => void }) {
  const [name, setName] = useState(""); const [kind, setKind] = useState<"setup" | "teardown">("setup"); const [sections, setSections] = useState<DraftSection[]>(initialSections); const [editing, setEditing] = useState<string | null>(null); const [open, setOpen] = useState(false);
  function reset() { setName(""); setKind("setup"); setSections(initialSections); setEditing(null); }
  function updateSection(index: number, patch: Partial<DraftSection>) { setSections(sections.map((section, itemIndex) => itemIndex === index ? { ...section, ...patch } : section)); }
  async function save(event: FormEvent) { event.preventDefault(); const clean = sections.map((section) => ({ ...section, items: section.items.filter((item) => item.title.trim()) })); if (editing) await updateTemplate(editing, name, kind, clean); else await createTemplate(name, kind, clean); reset(); setOpen(false); await query.refresh(); onMessage("Checklist template saved."); }
  return <><div className="admin-actions"><button className="button primary" onClick={() => { reset(); setOpen(!open); }}><Plus /> New checklist template</button></div>{open && <form className="admin-form checklist-builder" onSubmit={save}><h2>{editing ? "Edit" : "New"} checklist template</h2><div className="form-grid"><label>Template name<input required value={name} onChange={(event) => setName(event.target.value)} /></label><label>Type<select value={kind} onChange={(event) => setKind(event.target.value as "setup" | "teardown")}><option value="setup">Setup</option><option value="teardown">Teardown</option></select></label></div>{sections.map((section, sectionIndex) => <div className="builder-section" key={sectionIndex}><div className="builder-section-title"><input required value={section.title} onChange={(event) => updateSection(sectionIndex, { title: event.target.value })} placeholder="Section title" /><MoveButtons index={sectionIndex} length={sections.length} onMove={(to) => setSections(move(sections, sectionIndex, to))} />{sections.length > 1 && <button type="button" onClick={() => setSections(sections.filter((_, index) => index !== sectionIndex))}><Trash2 /></button>}</div>{section.items.map((item, itemIndex) => <div className="builder-item" key={itemIndex}><input required value={item.title} onChange={(event) => updateSection(sectionIndex, { items: section.items.map((current, index) => index === itemIndex ? { ...current, title: event.target.value } : current) })} placeholder="Checklist item" /><MoveButtons index={itemIndex} length={section.items.length} onMove={(to) => updateSection(sectionIndex, { items: move(section.items, itemIndex, to) })} />{section.items.length > 1 && <button type="button" onClick={() => updateSection(sectionIndex, { items: section.items.filter((_, index) => index !== itemIndex) })}><Trash2 /></button>}</div>)}<button type="button" className="text-button" onClick={() => updateSection(sectionIndex, { items: [...section.items, { title: "", photo_required: false }] })}>+ Add item</button></div>)}<button type="button" className="text-button" onClick={() => setSections([...sections, { title: "", items: [{ title: "", photo_required: false }] }])}>+ Add section</button><button className="button primary"><Save /> Save template</button></form>}<section className="admin-section"><h2>Reusable checklists</h2><PageState loading={query.loading} error={query.error} empty={!query.data?.length}>{query.data?.map((template) => <article className="template-row" key={template.id}><ClipboardCheck /><div><strong>{template.name}</strong><span>{template.kind} · {template.sections.length} sections</span></div><button className="icon-text-button" onClick={() => { setName(template.name); setKind(template.kind); setSections([...template.sections].sort((a, b) => a.position - b.position).map((section) => ({ title: section.title, items: [...section.items].sort((a, b) => a.position - b.position).map((item) => ({ title: item.title, photo_required: false })) }))); setEditing(template.id); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /> Edit</button></article>)}</PageState></section></>;
}

function ToolbagTemplates({ query, onMessage }: { query: AsyncQuery<Awaited<ReturnType<typeof getToolbagTemplates>>>; onMessage: (value: string) => void }) {
  const blank = { id: "", name: "", items: [{ name: "", quantity: 1 }] }; const [form, setForm] = useState(blank); const [open, setOpen] = useState(false);
  async function save(event: FormEvent) { event.preventDefault(); const items = form.items.filter((item) => item.name.trim()); if (form.id) await updateToolbagTemplate(form.id, form.name, items); else await createToolbagTemplate(form.name, items); setForm(blank); setOpen(false); await query.refresh(); onMessage("Toolbag template saved."); }
  return <><div className="admin-actions"><button className="button primary" onClick={() => { setForm(blank); setOpen(!open); }}><Plus /> New toolbag template</button></div>{open && <form className="admin-form" onSubmit={save}><h2>{form.id ? "Edit" : "New"} toolbag template</h2><label>Template name<input required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>{form.items.map((item, index) => <div className="inventory-form" key={index}><input required value={item.name} placeholder="Item name" onChange={(event) => setForm({ ...form, items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, name: event.target.value } : current) })} /><input required type="number" min="1" value={item.quantity} aria-label="Quantity" onChange={(event) => setForm({ ...form, items: form.items.map((current, itemIndex) => itemIndex === index ? { ...current, quantity: Number(event.target.value) } : current) })} />{form.items.length > 1 && <button type="button" onClick={() => setForm({ ...form, items: form.items.filter((_, itemIndex) => itemIndex !== index) })}><Trash2 /></button>}</div>)}<button type="button" className="text-button" onClick={() => setForm({ ...form, items: [...form.items, { name: "", quantity: 1 }] })}>+ Add item</button><button className="button primary"><Save /> Save template</button></form>}<section className="admin-section"><h2>Reusable toolbags</h2><PageState loading={query.loading} error={query.error} empty={!query.data?.length}>{query.data?.map((template) => <article className="template-row" key={template.id}><PackageOpen /><div><strong>{template.name}</strong><span>{template.items.length} items</span></div><button className="icon-text-button" onClick={() => { setForm({ id: template.id, name: template.name, items: [...template.items].sort((a, b) => a.position - b.position).map((item) => ({ name: item.name, quantity: item.quantity })) }); setOpen(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil /> Edit</button></article>)}</PageState></section></>;
}

function MoveButtons({ index, length, onMove }: { index: number; length: number; onMove: (to: number) => void }) { return <><button type="button" aria-label="Move up" disabled={index === 0} onClick={() => onMove(index - 1)}><ArrowUp /></button><button type="button" aria-label="Move down" disabled={index === length - 1} onClick={() => onMove(index + 1)}><ArrowDown /></button></>; }
