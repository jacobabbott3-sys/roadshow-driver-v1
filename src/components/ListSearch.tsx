import { Search, X } from "lucide-react";
import { useRef } from "react";

type ListSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label: string;
  resultCount: number;
  className?: string;
};

export function ListSearch({ value, onChange, placeholder, label, resultCount, className = "" }: ListSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  function clear() {
    onChange("");
    inputRef.current?.focus();
  }

  return (
    <div className={`list-search ${className}`.trim()} role="search">
      <Search aria-hidden="true" />
      <label className="sr-only" htmlFor={`${label.replace(/\W+/g, "-").toLocaleLowerCase()}-search`}>{label}</label>
      <input
        ref={inputRef}
        id={`${label.replace(/\W+/g, "-").toLocaleLowerCase()}-search`}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label}
      />
      {value.length > 0 && <button className="list-search-clear" type="button" onClick={clear} aria-label="Clear search"><X aria-hidden="true" /></button>}
      <span className="sr-only" role="status" aria-live="polite">{resultCount} {resultCount === 1 ? "result" : "results"}</span>
    </div>
  );
}
