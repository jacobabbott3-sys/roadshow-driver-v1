import { BookOpen, Download, ExternalLink, FileText } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { PageState } from "../components/PageState";
import { useAsync } from "../hooks/useAsync";
import { getResources } from "../lib/driverData";
import { supabase } from "../lib/supabase";
import { ImageViewer } from "../components/ImageViewer";
import { BackButton } from "../components/BackButton";
import { ListSearch } from "../components/ListSearch";
import { matchesListSearch } from "../lib/listControls";
import { resourceFileKindFromPath } from "../lib/imageUpload";

export function RedFolderPage() {
  const resources = useAsync(getResources, []);
  const [urls, setUrls] = useState<Record<string, { view: string; download: string }>>({});
  const [fileError, setFileError] = useState("");
  const [search, setSearch] = useState("");
  const items = useMemo(
    () =>
      resources.data?.filter((resource) => resource.kind === "handbook") || [],
    [resources.data],
  );
  const visibleItems = items.filter((item) => matchesListSearch(search, item.title, item.content));

  useEffect(() => {
    let active = true;
    setFileError("");
    void Promise.allSettled(items.filter((item) => item.file_path).map(async (item) => {
      const bucket = supabase.storage.from("resources");
      const { data: viewData, error: viewError } = await bucket.createSignedUrl(item.file_path!, 3600);
      if (viewError) throw viewError;
      const isPdf = item.file_type === "pdf" || resourceFileKindFromPath(item.file_path) === "pdf";
      let download = viewData.signedUrl;
      if (isPdf) {
        const filename = `${item.title.replace(/[^a-zA-Z0-9._-]+/g, "-") || "resource"}.pdf`;
        const { data: downloadData, error: downloadError } = await bucket
          .createSignedUrl(item.file_path!, 3600, { download: filename });
        if (downloadError) throw downloadError;
        download = downloadData.signedUrl;
      }
      return [item.id, { view: viewData.signedUrl, download }] as const;
    })).then((results) => {
      if (!active) return;
      const entries = results.flatMap((result) => result.status === "fulfilled" ? [result.value] : []);
      const failureCount = results.length - entries.length;
      setUrls(Object.fromEntries(entries));
      setFileError(failureCount ? `${failureCount} resource attachment${failureCount === 1 ? "" : "s"} could not be loaded.` : "");
    });
    return () => { active = false; };
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
      {fileError && <div className="notice error">{fileError}</div>}
      <PageState
        loading={resources.loading}
        error={resources.error}
        empty={!items.length}
      >
        {!visibleItems.length ? <div className="inline-empty">No Red Folder items match “{search}”.</div> : <div className="red-folder-grid">
          {visibleItems.map((item) => (
            <article key={item.id}>
              {urls[item.id] && (item.file_type === "pdf" || resourceFileKindFromPath(item.file_path) === "pdf" ? (
                <div className="pdf-resource">
                  <FileText />
                  <strong>PDF document</strong>
                  <div className="pdf-resource-actions">
                    <a className="button primary" href={urls[item.id].view} target="_blank" rel="noreferrer"><ExternalLink /> View PDF</a>
                    <a className="button secondary" href={urls[item.id].download}><Download /> Download PDF</a>
                  </div>
                </div>
              ) : <ImageViewer src={urls[item.id].view} alt={item.title} />)}
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
