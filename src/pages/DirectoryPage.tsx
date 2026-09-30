import { Phone, ShieldCheck, UserRound } from "lucide-react";
import { BackButton } from "../components/BackButton";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { getDirectory } from "../lib/driverData";
import { useState } from "react";
import { ListSearch } from "../components/ListSearch";
import { matchesListSearch } from "../lib/listControls";

export function DirectoryPage() {
  const directory = useAsync(getDirectory, []);
  const [search, setSearch] = useState("");
  const people = directory.data?.filter((person) => matchesListSearch(search, person.full_name, person.role, person.role === "admin" ? "administrator" : "driver", person.phone)) || [];
  return (
    <main className="page">
      <BackButton to="/resources" label="Back to resources" />
      <header className="page-header"><div><p className="eyebrow">TEAM RESOURCE</p><h1>Driver directory</h1><p>Contact active drivers and administrators.</p></div></header>
      <ListSearch value={search} onChange={setSearch} placeholder="Search names, roles, or phone numbers" label="Search directory" resultCount={people.length} />
      <PageState loading={directory.loading} error={directory.error} empty={!directory.data?.length}>
        {!people.length ? <div className="inline-empty">No team members match “{search}”.</div> : <div className="directory-grid">
          {people.map((person) => (
            <article className="directory-card" key={person.id}>
              <span>{person.role === "admin" ? <ShieldCheck /> : <UserRound />}</span>
              <div><h2>{person.full_name || "Unnamed team member"}</h2><small>{person.role === "admin" ? "Administrator" : "Driver"}</small></div>
              {person.phone ? <a href={`tel:${person.phone}`}><Phone /> {person.phone}</a> : <p>No phone number listed</p>}
            </article>
          ))}
        </div>}
      </PageState>
    </main>
  );
}
