import { ChevronLeft, ChevronRight, Download, Minus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { supabase } from "../lib/supabase";

// Bundle the matching worker with the app; no third-party document viewer/CDN.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url,
).toString();
const pdfOptions = {
  isEvalSupported: false,
  useSystemFonts: true,
  cMapUrl: `${import.meta.env.BASE_URL}pdfjs-assets/cmaps/`,
  cMapPacked: true,
  standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs-assets/standard_fonts/`,
  wasmUrl: `${import.meta.env.BASE_URL}pdfjs-assets/wasm/`,
};

export function PdfViewer({ title, filePath, onClose }: {
  title: string; filePath: string; onClose: () => void;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const [urls, setUrls] = useState<{ view: string; download: string } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [width, setWidth] = useState(320);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") { event.preventDefault(); onClose(); }
      if (event.key !== "Tab") return;
      const focusable = Array.from(dialog.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), [tabindex="0"]',
      ) || []);
      const first = focusable[0];
      const last = focusable.at(-1);
      if (event.shiftKey && (document.activeElement === first || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog.current?.contains(document.activeElement))) {
        event.preventDefault(); first?.focus();
      }
    }
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [onClose]);

  useEffect(() => {
    const updateWidth = () => setWidth(Math.max(200, Math.min(1000,
      (stage.current?.clientWidth || window.innerWidth) - 32,
    )));
    updateWidth();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateWidth);
    if (stage.current) observer?.observe(stage.current);
    window.addEventListener("resize", updateWidth);
    return () => { observer?.disconnect(); window.removeEventListener("resize", updateWidth); };
  }, []);

  useEffect(() => {
    let active = true;
    setUrls(null);
    setError("");
    setNumPages(0);
    setPage(1);
    setScale(1);
    async function load() {
      try {
        const bucket = supabase.storage.from("resources");
        // Refresh at open/retry so an old resource card cannot pass an expired URL.
        const view = await bucket.createSignedUrl(filePath, 3600);
        if (view.error || !view.data?.signedUrl) throw new Error("No resource access");
        const filename = `${title.replace(/[^a-zA-Z0-9._-]+/g, "-") || "resource"}.pdf`;
        const download = await bucket.createSignedUrl(filePath, 3600, { download: filename })
          .catch(() => ({ data: null, error: true }));
        if (active) setUrls({ view: view.data.signedUrl,
          download: download.error ? "" : download.data?.signedUrl || "" });
      } catch {
        if (active) setError("Unable to load this PDF. Check your connection and resource access, then try again.");
      }
    }
    void load();
    return () => { active = false; };
  }, [filePath, title, attempt]);

  return createPortal(
    <div ref={dialog} className="pdf-viewer" role="dialog" aria-modal="true" aria-label={title}>
      <header className="pdf-viewer-header">
        <h2>{title}</h2>
        {urls?.download && <a className="button secondary" href={urls.download}><Download /> Download PDF</a>}
        <button ref={closeButton} className="pdf-viewer-close" onClick={onClose} aria-label="Close PDF"><X /></button>
      </header>
      <nav className="pdf-viewer-controls" aria-label="PDF controls">
        <button onClick={() => setPage((value) => value - 1)} disabled={!numPages || page <= 1} aria-label="Previous page"><ChevronLeft /></button>
        <span aria-live="polite">{numPages ? `Page ${page} of ${numPages}` : "Loading PDF…"}</span>
        <button onClick={() => setPage((value) => value + 1)} disabled={!numPages || page >= numPages} aria-label="Next page"><ChevronRight /></button>
        <button onClick={() => setScale((value) => Math.max(0.5, value - 0.25))} disabled={!numPages || scale <= 0.5} aria-label="Zoom out"><Minus /></button>
        <span>{Math.round(scale * 100)}%</span>
        <button onClick={() => setScale((value) => Math.min(3, value + 0.25))} disabled={!numPages || scale >= 3} aria-label="Zoom in"><Plus /></button>
      </nav>
      <div ref={stage} className="pdf-viewer-stage">
        {error ? <div className="pdf-viewer-error"><p role="alert">{error}</p>
          <button className="button primary" onClick={() => setAttempt((value) => value + 1)}>Try again</button>
          <p>You can also download the document when a download link is available.</p>
        </div> : urls ? <Document file={urls.view} options={pdfOptions}
          loading={<p role="status">Loading PDF…</p>}
          onLoadSuccess={({ numPages: count }) => setNumPages(count)}
          onLoadError={() => setError("Unable to display this PDF. Try again to refresh the document link, or download it.")}
          onSourceError={() => setError("Unable to load this PDF. Please try again.")}
        >
          {numPages > 0 && <Page pageNumber={page} width={width} scale={scale}
            loading={<p role="status">Loading page…</p>}
            onLoadError={() => setError("Unable to load this PDF page. Please try again or download it.")}
            onRenderError={() => setError("Unable to display this PDF page. Please try again or download it.")}
          />}
        </Document> : <p role="status">Loading PDF…</p>}
      </div>
    </div>, document.body,
  );
}
