import { BookOpen } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { getResources } from "../lib/driverData";
import { supabase } from "../lib/supabase";

export function RedFolderPage() {
  const resources = useAsync(getResources, []);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const items = useMemo(
    () =>
      resources.data?.filter((resource) => resource.kind === "handbook") || [],
    [resources.data],
  );

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
      <header className="page-header">
        <div>
          <p className="eyebrow">REFERENCE LIBRARY</p>
          <h1>Red Folder</h1>
          <p>Pictures, documents, and published operating guides.</p>
        </div>
      </header>
      <PageState
        loading={resources.loading}
        error={resources.error}
        empty={!items.length}
      >
        <div className="red-folder-grid">
          {items.map((item) => (
            <article key={item.id}>
              {urls[item.id] && <img src={urls[item.id]} alt={item.title} />}
              <BookOpen />
              <h2>{item.title}</h2>
              {item.content && <p>{item.content}</p>}
            </article>
          ))}
        </div>
      </PageState>
    </main>
  );
}
