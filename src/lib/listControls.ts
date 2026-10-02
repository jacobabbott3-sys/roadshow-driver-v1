export type SortMode = "date" | "alpha";

export function normalizeListText(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase()
    .trim();
}

export function matchesListSearch(query: string, ...values: Array<string | null | undefined>) {
  const normalized = normalizeListText(query);
  if (!normalized) return true;
  return values.some((value) => value ? normalizeListText(value).includes(normalized) : false);
}

export function sortList<T>(
  items: readonly T[],
  mode: SortMode,
  getName: (item: T) => string,
  getDate: (item: T) => string,
) {
  return [...items].sort((left, right) => {
    if (mode === "alpha") {
      return getName(left).localeCompare(getName(right), undefined, { sensitivity: "base" });
    }
    return getDate(left).localeCompare(getDate(right));
  });
}
