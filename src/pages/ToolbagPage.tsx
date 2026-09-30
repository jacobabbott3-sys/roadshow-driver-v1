import { Wrench } from "lucide-react";
import { useState } from "react";
import { BackButton } from "../components/BackButton";
import { ListSearch } from "../components/ListSearch";
import { PageState } from "../components/PageState";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { getMyToolbag } from "../lib/driverData";
import { matchesListSearch } from "../lib/listControls";

export function ToolbagPage() {
  const { user } = useAuth();
  const query = useAsync(() => getMyToolbag(user!.id), [user?.id]);
  const [search, setSearch] = useState("");
  const items = query.data?.items.filter((item) => matchesListSearch(search, item.name, String(item.quantity))).sort((a, b) => a.position - b.position) || [];
  return <main className="page">
    <BackButton to="/resources" label="Back to resources" />
    <header className="page-header"><div><p className="eyebrow">INVENTORY</p><h1>{query.data ? `Toolbag #${query.data.number}` : "My Toolbag"}</h1><p>Everything assigned to your kit.</p></div></header>
    <ListSearch value={search} onChange={setSearch} placeholder="Search items or quantities" label="Search my toolbag" resultCount={items.length} />
    <PageState loading={query.loading} error={query.error} empty={!query.data}>
      {!items.length ? <div className="inline-empty">No toolbag items match “{search}”.</div> : <section className="resource-section toolbag-page-list"><Wrench /><h2>Assigned items</h2>{items.map((item) => <div key={item.id}><strong>{item.name}</strong><span>Qty {item.quantity}</span></div>)}</section>}
    </PageState>
  </main>;
}
