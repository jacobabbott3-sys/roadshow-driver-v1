import { Phone, ShieldCheck, UserRound } from "lucide-react";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { getDirectory } from "../lib/driverData";

export function DirectoryPage() {
  const directory = useAsync(getDirectory, []);
  return (
    <main className="page">
      <header className="page-header"><div><p className="eyebrow">TEAM RESOURCE</p><h1>Driver directory</h1><p>Contact active drivers and administrators.</p></div></header>
      <PageState loading={directory.loading} error={directory.error} empty={!directory.data?.length}>
        <div className="directory-grid">
          {directory.data?.map((person) => (
            <article className="directory-card" key={person.id}>
              <span>{person.role === "admin" ? <ShieldCheck /> : <UserRound />}</span>
              <div><h2>{person.full_name || "Unnamed team member"}</h2><small>{person.role === "admin" ? "Administrator" : "Driver"}</small></div>
              {person.phone ? <a href={`tel:${person.phone}`}><Phone /> {person.phone}</a> : <p>No phone number listed</p>}
            </article>
          ))}
        </div>
      </PageState>
    </main>
  );
}
