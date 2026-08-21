import { ClipboardCheck, FileStack, LayoutDashboard, MessageCircle, PackageOpen, PenLine, Store, UsersRound } from "lucide-react";
import { NavLink } from "react-router-dom";

const links = [
  ["/admin", "Overview", LayoutDashboard],
  ["/admin/shows", "Shows & contracts", Store],
  ["/admin/signings", "Signings", PenLine],
  ["/admin/templates", "Templates", FileStack],
  ["/admin/checklists", "Reviews", ClipboardCheck],
  ["/admin/users", "Users", UsersRound],
  ["/chat", "Chat", MessageCircle],
  ["/admin/operations", "Resources & toolbags", PackageOpen],
] as const;

export function AdminNav() {
  return <nav className="admin-nav">{links.map(([to, label, Icon]) => <NavLink key={to} end={to === "/admin"} to={to}><Icon />{label}</NavLink>)}</nav>;
}

export function AdminHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <><header className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></header><AdminNav /></>;
}
