import { ArrowRight, BriefcaseBusiness, CalendarDays, MapPin, PenLine } from "lucide-react";
import { Link } from "react-router-dom";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { Contract, getContracts, getShowLinks, ShowLink, statusLabel } from "../lib/driverData";

type ContractGroup = { id: string; contracts: Contract[] };

export function ContractsPage() {
  const contractsQuery = useAsync(getContracts, []);
  const linksQuery = useAsync(getShowLinks, []);
  const uniqueContracts = contractsQuery.data ? [...new Map(contractsQuery.data.map((contract) => [contract.show.id, contract])).values()] : [];
  const groups = groupContracts(uniqueContracts, linksQuery.data || []);
  const error = contractsQuery.error || linksQuery.error;

  return (
    <main className="page">
      <header className="page-header"><div><p className="eyebrow">YOUR WORK</p><h1>Contracts & signings</h1><p>Assignments, schedules, checklists, and completed work.</p></div></header>
      <PageState loading={contractsQuery.loading || linksQuery.loading} error={error} empty={!groups.length}>
        <div className="contract-list">
          {groups.map((group) => {
            const first = group.contracts[0];
            const signing = first.show.event_type === "signing";
            const linked = signing && group.contracts.length > 1;
            const artists = group.contracts.map((contract) => contract.show.artist || contract.show.name);
            const title = linked ? artists.join(" & ") : signing ? artists[0] : first.show.name;
            const href = linked ? `/signing-groups/${first.show.id}` : `/contracts/${first.id}`;
            const groupStatus = group.contracts.every((contract) => contract.status === first.status) ? statusLabel(first.status) : "In Progress";
            const venue = linked
              ? `${group.contracts.length} linked signings`
              : signing ? first.show.venue_name || first.show.city : `${first.show.city}${first.show.state ? `, ${first.show.state}` : ""}`;
            const workDate = signing
              ? linked ? signingDateRange(group.contracts) : `Signing: ${formatDateTime(first.show.signing_at)}`
              : `${statusLabel(first.kind)}: ${formatWorkDate(first.service_date)}${first.service_time ? ` at ${formatTime(first.service_time)}` : ""}`;

            return (
              <Link className="contract-card" to={href} key={group.id}>
                <div className="contract-card-icon">{signing ? <PenLine /> : <BriefcaseBusiness />}</div>
                <div className="contract-card-body">
                  <div className="card-line"><span className={`status status-${first.status}`}>{signing ? linked ? "Linked signings" : "Signing" : statusLabel(first.status)}</span><span>{signing ? "Artist appearance" : first.kind}</span></div>
                  <h2>{title}</h2>
                  <p><MapPin />{venue}</p>
                  <p className="work-date"><CalendarDays />{workDate}</p>
                  <p className="contract-current-status">Current status: <strong>{groupStatus}</strong></p>
                </div>
                <ArrowRight />
              </Link>
            );
          })}
        </div>
      </PageState>
    </main>
  );
}

function groupContracts(contracts: Contract[], links: ShowLink[]) {
  const byShow = new Map(contracts.map((contract) => [contract.show.id, contract]));
  const neighbors = new Map<string, string[]>();
  for (const link of links) {
    neighbors.set(link.show_id, [...(neighbors.get(link.show_id) || []), link.linked_show_id]);
    neighbors.set(link.linked_show_id, [...(neighbors.get(link.linked_show_id) || []), link.show_id]);
  }
  const seen = new Set<string>();
  const groups: ContractGroup[] = [];
  for (const contract of contracts) {
    if (seen.has(contract.show.id)) continue;
    if (contract.show.event_type !== "signing") {
      seen.add(contract.show.id);
      groups.push({ id: contract.show.id, contracts: [contract] });
      continue;
    }
    const queue = [contract.show.id];
    const linkedContracts: Contract[] = [];
    while (queue.length) {
      const showId = queue.shift()!;
      if (seen.has(showId)) continue;
      seen.add(showId);
      const current = byShow.get(showId);
      if (!current || current.show.event_type !== "signing") continue;
      linkedContracts.push(current);
      for (const neighbor of neighbors.get(showId) || []) if (!seen.has(neighbor) && byShow.has(neighbor)) queue.push(neighbor);
    }
    linkedContracts.sort((a, b) => (a.show.signing_at || a.show.starts_on).localeCompare(b.show.signing_at || b.show.starts_on));
    groups.push({ id: linkedContracts[0]?.show.id || contract.show.id, contracts: linkedContracts.length ? linkedContracts : [contract] });
  }
  return groups;
}

function signingDateRange(contracts: Contract[]) {
  const dates = contracts.map((contract) => contract.show.signing_at || contract.show.starts_on).sort();
  const first = new Date(dates[0]).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const last = new Date(dates.at(-1)!).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return first === last ? first : `${first}–${last}`;
}
function formatWorkDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }
function formatTime(value: string) { return new Date(`2000-01-01T${value}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function formatDateTime(value: string | null) { return value ? new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled"; }
