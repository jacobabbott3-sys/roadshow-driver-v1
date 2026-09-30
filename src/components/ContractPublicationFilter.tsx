import type { ContractPublicationFilter as FilterValue } from "../lib/availabilityModel";

const choices: { value: FilterValue; label: string }[] = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "not_published", label: "Not published" },
];

export function ContractPublicationFilter({ value, onChange }: {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}) {
  return (
    <div className="contract-publication-filter" role="group" aria-label="Filter contracts by publication status">
      {choices.map((choice) => (
        <button
          key={choice.value}
          type="button"
          aria-pressed={value === choice.value}
          className={value === choice.value ? "active" : ""}
          onClick={() => onChange(choice.value)}
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}
