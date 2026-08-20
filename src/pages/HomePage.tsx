import { ArrowRight, BriefcaseBusiness, CalendarDays, FolderOpen, MapPin, MessageCircle, UserRound } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAsync } from "../hooks/useAsync";
import { dateRange, getContracts, statusLabel } from "../lib/driverData";
import { ReleaseBadge } from "../components/ReleaseBadge";

const tiles = [
  ["Contracts", "View assignments", "/contracts", BriefcaseBusiness],
  ["Chat", "Talk with the team", "/chat", MessageCircle],
  ["Availability", "Plan your schedule", "/availability", CalendarDays],
  ["Resources", "Tools and guides", "/resources", FolderOpen],
  ["Profile", "Manage your account", "/profile", UserRound],
] as const;

export function HomePage() {
  const { profile } = useAuth();
  const contracts = useAsync(getContracts, []);
  const first = profile?.full_name?.split(" ")[0] || "there";
  const next = contracts.data?.find((contract) => !["approved", "bonus_earned", "bonus_not_earned"].includes(contract.status));
  const signing = next?.show.event_type === "signing";
  const eventDate = signing && next?.show.signing_at ? new Date(next.show.signing_at) : next ? new Date(`${next.show.starts_on}T12:00:00`) : null;
  return <main className="page"><header className="page-header"><div><p className="eyebrow">ROADSHOW DRIVER</p><h1>Good morning, {first}.</h1><p>Here’s what’s next on your route.</p></div><div className="avatar">{first[0]}</div></header>{next && eventDate ? <section className="show-card"><div className="show-card-top"><div><span className="status-dot" /> NEXT {signing ? "SIGNING" : "SHOW"}</div><span className="date-badge">{eventDate.toLocaleDateString(undefined, { month: "short" }).toUpperCase()}<br /><strong>{eventDate.getDate()}</strong></span></div><h2>{signing ? next.show.artist || next.show.name : next.show.name}</h2><p className="show-meta"><MapPin size={16} />{signing ? next.show.venue_name || next.show.city : `${next.show.city}${next.show.state ? `, ${next.show.state}` : ""}`}<span>•</span>{signing ? eventDate.toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" }) : dateRange(next.show)}</p><div className="progress-label"><strong>{signing ? "Signing" : statusLabel(next.status)}</strong></div><Link to={`/contracts/${next.id}`} className="button light">Continue {signing ? "signing" : "contract"} <ArrowRight size={18} /></Link></section> : <section className="show-card no-show"><p className="eyebrow">YOU'RE ALL CAUGHT UP</p><h2>No active work assigned</h2><p>Check availability or wait for your next assignment.</p><Link to="/availability" className="button light">Update availability <ArrowRight size={18} /></Link></section>}<section><div className="section-heading"><div><p className="eyebrow">QUICK ACCESS</p><h2>Your workspace</h2></div></div><div className="tile-grid">{tiles.map(([title, subtitle, to, Icon]) => <Link to={to} className="tile" key={title}><span className="tile-icon"><Icon size={22} /></span><span><strong>{title}</strong><small>{subtitle}</small></span><ArrowRight size={18} /></Link>)}</div></section><footer className="home-release"><ReleaseBadge /></footer></main>;
}
