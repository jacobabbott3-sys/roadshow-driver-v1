import { ArrowDownAZ, CalendarDays, Check, ListFilter } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { SortMode } from "../lib/listControls";

export function SortButton({ value, onChange }: { value: SortMode; onChange: (value: SortMode) => void }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function choose(mode: SortMode) {
    onChange(mode);
    setOpen(false);
  }

  return (
    <div className="sort-control" ref={container}>
      <button className="sort-button" type="button" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <ListFilter /> Sort: {value === "date" ? "Date" : "A–Z"}
      </button>
      {open && (
        <div className="sort-menu" role="menu">
          <button type="button" role="menuitemradio" aria-checked={value === "date"} onClick={() => choose("date")}>
            <CalendarDays /><span><strong>Date</strong><small>Earliest first</small></span>{value === "date" && <Check />}
          </button>
          <button type="button" role="menuitemradio" aria-checked={value === "alpha"} onClick={() => choose("alpha")}>
            <ArrowDownAZ /><span><strong>A–Z</strong><small>Alphabetical</small></span>{value === "alpha" && <Check />}
          </button>
        </div>
      )}
    </div>
  );
}
