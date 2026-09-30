import { ChevronDown, HelpCircle } from "lucide-react";
import { useState } from "react";
import { BackButton } from "../components/BackButton";
import { ListSearch } from "../components/ListSearch";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { getResources } from "../lib/driverData";
import { matchesListSearch } from "../lib/listControls";

export function FaqPage() {
  const query = useAsync(getResources, []);
  const [open, setOpen] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const allFaqs = query.data?.filter((resource) => resource.kind === "faq") || [];
  const faqs = allFaqs.filter((resource) => matchesListSearch(search, resource.title, resource.content));
  return <main className="page">
    <BackButton to="/resources" label="Back to resources" />
    <header className="page-header"><div><p className="eyebrow">ANSWERS</p><h1>Frequently asked questions</h1><p>Quick answers for life on the road.</p></div></header>
    <ListSearch value={search} onChange={setSearch} placeholder="Search questions or answers" label="Search frequently asked questions" resultCount={faqs.length} />
    <PageState loading={query.loading} error={query.error} empty={!allFaqs.length}>
      {!faqs.length ? <div className="inline-empty">No questions match “{search}”.</div> : <section className="resource-section">{faqs.map((resource) => <article className="resource-row" key={resource.id}><button onClick={() => setOpen(open === resource.id ? null : resource.id)}><HelpCircle /><strong>{resource.title}</strong><ChevronDown className={open === resource.id ? "rotated" : ""} /></button>{open === resource.id && <p>{resource.content}</p>}</article>)}</section>}
    </PageState>
  </main>;
}
