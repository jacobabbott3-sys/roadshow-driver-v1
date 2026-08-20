import { ArrowRight, BriefcaseBusiness, CalendarDays, MapPin, Mic2 } from "lucide-react";
import { Link } from "react-router-dom";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { getContracts, statusLabel } from "../lib/driverData";

export function ContractsPage() {
  const query = useAsync(getContracts, []);
  const contracts = query.data ? [...new Map(query.data.map((contract) => [contract.show.id, contract])).values()] : [];
  return <main className="page"><header className="page-header"><div><p className="eyebrow">YOUR WORK</p><h1>Contracts & signings</h1><p>Assignments, schedules, checklists, and completed work.</p></div></header><PageState loading={query.loading} error={query.error} empty={!contracts.length}><div className="contract-list">{contracts.map((contract) => { const signing = contract.show.event_type === "signing"; return <Link className="contract-card" to={`/contracts/${contract.id}`} key={contract.id}><div className="contract-card-icon">{signing ? <Mic2 /> : <BriefcaseBusiness />}</div><div className="contract-card-body"><div className="card-line"><span className={`status status-${contract.status}`}>{signing ? "Signing" : statusLabel(contract.status)}</span><span>{signing ? "Artist appearance" : contract.kind}</span></div><h2>{signing ? contract.show.artist || contract.show.name : contract.show.name}</h2><p><MapPin />{signing ? contract.show.venue_name || contract.show.city : `${contract.show.city}${contract.show.state ? `, ${contract.show.state}` : ""}`}</p><p className="work-date"><CalendarDays />{signing ? `Signing: ${formatDateTime(contract.show.signing_at)}` : `${statusLabel(contract.kind)}: ${formatWorkDate(contract.service_date)}${contract.service_time ? ` at ${formatTime(contract.service_time)}` : ""}`}</p></div><ArrowRight /></Link>; })}</div></PageState></main>;
}
function formatWorkDate(value: string) { return new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" }); }
function formatTime(value: string) { return new Date(`2000-01-01T${value}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }); }
function formatDateTime(value: string | null) { return value ? new Date(value).toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "Not scheduled"; }
