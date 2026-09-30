import { BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { getResources } from "../lib/driverData";
import { supabase } from "../lib/supabase";
import { ImageViewer } from "../components/ImageViewer";
import { BackButton } from "../components/BackButton";
import { ListSearch } from "../components/ListSearch";
import { matchesListSearch } from "../lib/listControls";

export function RedFolderPage() {
  const resources = useAsync(getResources, []);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");
  const items = useMemo(
    () =>
      resources.data?.filter((resource) => resource.kind === "handbook") || [],
    [resources.data],
  );
  const visibleItems = items.filter((item) => matchesListSearch(search, item.title, item.content));

  useEffect(() => {
    void Promise.all(
      items
        .filter((item) => item.file_path)
        .map(async (item) => {
          const { data } = await supabase.storage
            .from("resources")
            .createSignedUrl(item.file_path!, 3600);
          return [item.id, data?.signedUrl || ""] as const;
        }),
    ).then((entries) => setUrls(Object.fromEntries(entries)));
  }, [items]);

  return (
    <main className="page">
      <BackButton to="/resources" label="Back to resources" />
      <header className="page-header">
        <div>
          <p className="eyebrow">REFERENCE LIBRARY</p>
          <h1>Red Folder</h1>
          <p>Pictures, documents, and published operating guides.</p>
        </div>
      </header>
      <ListSearch value={search} onChange={setSearch} placeholder="Search titles or guide content" label="Search Red Folder" resultCount={visibleItems.length} />
      <PageState
        loading={resources.loading}
        error={resources.error}
        empty={!items.length}
      >
        {!visibleItems.length ? <div className="inline-empty">No Red Folder items match “{search}”.</div> : <div className="red-folder-grid">
          {visibleItems.map((item) => (
            <article key={item.id}>
              {urls[item.id] && <ImageViewer src={urls[item.id]} alt={item.title} />}
              <BookOpen />
              <h2>{item.title}</h2>
              {item.content && <p>{item.content}</p>}
            </article>
          ))}
        </div>}
      </PageState>
    </main>
  );
}
