import { Maximize2, Minus, Plus, RotateCcw, X } from "lucide-react";
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from "react";
import { createPortal } from "react-dom";

type Point = { x: number; y: number };

export function ImageViewer({ src, alt, className = "" }: { src: string; alt: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const drag = useRef<{ pointerId: number; start: Point; origin: Point } | null>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  function reset() { setScale(1); setOffset({ x: 0, y: 0 }); }
  function changeScale(next: number) {
    const clamped = Math.min(5, Math.max(1, next));
    setScale(clamped);
    if (clamped === 1) setOffset({ x: 0, y: 0 });
  }
  function startDrag(event: PointerEvent<HTMLDivElement>) {
    if (scale === 1) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin: offset };
  }
  function moveDrag(event: PointerEvent<HTMLDivElement>) {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    setOffset({ x: drag.current.origin.x + event.clientX - drag.current.start.x, y: drag.current.origin.y + event.clientY - drag.current.start.y });
  }
  function stopDrag(event: PointerEvent<HTMLDivElement>) {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
  }
  function zoomWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    changeScale(scale + (event.deltaY < 0 ? 0.25 : -0.25));
  }

  return (
    <>
      <button className={`zoomable-image ${className}`} type="button" onClick={() => { reset(); setOpen(true); }} aria-label={`Open ${alt}`}>
        <img src={src} alt={alt} />
        <span><Maximize2 /> View</span>
      </button>
      {open && createPortal(
        <div className="image-viewer" role="dialog" aria-modal="true" aria-label={`Viewing ${alt}`}>
          <div className="image-viewer-toolbar">
            <button onClick={() => changeScale(scale - 0.5)} disabled={scale <= 1} aria-label="Zoom out"><Minus /></button>
            <strong>{Math.round(scale * 100)}%</strong>
            <button onClick={() => changeScale(scale + 0.5)} disabled={scale >= 5} aria-label="Zoom in"><Plus /></button>
            <button onClick={reset} aria-label="Reset view"><RotateCcw /></button>
            <button className="viewer-close" onClick={() => setOpen(false)} aria-label="Close image"><X /></button>
          </div>
          <div className={`image-viewer-stage ${scale > 1 ? "can-pan" : ""}`} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag} onWheel={zoomWheel} onDoubleClick={() => changeScale(scale === 1 ? 2 : 1)}>
            <img src={src} alt={alt} draggable={false} style={{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }} />
          </div>
          <p>Double-click, scroll, or use the controls to zoom. Drag to pan.</p>
        </div>,
        document.body,
      )}
    </>
  );
}
