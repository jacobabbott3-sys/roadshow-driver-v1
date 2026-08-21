import { ArrowLeft, ArrowRight, Clock3, MapPin, PenLine } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { Contract, getContracts, getShowLinks } from "../lib/driverData";

export function SigningGroupPage() {
  const { showId = "" } = useParams();
  const query = useAsync(async () => {
    const [contracts, links] = await Promise.all([getContracts(), getShowLinks()]);
    const byShow = new Map(contracts.filter((contract) => contract.show.event_type === "signing").map((contract) => [contract.show.id, contract]));
    const neighbors = new Map<string, string[]>();
    for (const link of links) {
      neighbors.set(link.show_id, [...(neighbors.get(link.show_id) || []), link.linked_show_id]);
      neighbors.set(link.linked_show_id, [...(neighbors.get(link.linked_show_id) || []), link.show_id]);
    }
    const queue = [showId];
    const seen = new Set<string>();
    const group: Contract[] = [];
    while (queue.length) {
      const id = queue.shift()!;
      if (seen.has(id)) continue;
      seen.add(id);
      const contract = byShow.get(id);
      if (contract) group.push(contract);
      for (const neighbor of neighbors.get(id) || []) if (!seen.has(neighbor)) queue.push(neighbor);
    }
    return group.sort((a, b) => (a.show.signing_at || a.show.starts_on).localeCompare(b.show.signing_at || b.show.starts_on));
  }, [showId]);
  const title = query.data?.map((contract) => contract.show.artist || contract.show.name).join(" & ") || "Linked signings";

  return (
    <main className="page">
      <Link className="back-link" to="/contracts"><ArrowLeft /> Back to contracts</Link>
      <header className="page-header"><div><p className="eyebrow">LINKED SIGNINGS</p><h1>{title}</h1><p>These appearances are grouped together. Select one to see its full details and checklist.</p></div></header>
      <PageState loading={query.loading} error={query.error} empty={!query.data?.length}>
        <div className="contract-list signing-group-list">
          {query.data?.map((contract) => (
            <Link className="contract-card" to={`/contracts/${contract.id}`} key={contract.id}>
              <div className="contract-card-icon"><PenLine /></div>
              <div className="contract-card-body">
                <span className={`status status-${contract.status}`}>Signing</span>
                <h2>{contract.show.artist || contract.show.name}</h2>
                <p><Clock3 /> Setup: {formatDateTime(contract.show.setup_at)}</p>
                <p><Clock3 /> Signing: {formatDateTime(contract.show.signing_at)}</p>
                <p><MapPin />{contract.show.venue_name || contract.show.city}</p>
              </div>
              <ArrowRight />
            </Link>
          ))}
        </div>
      </PageState>
    </main>
  );
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled";
}
