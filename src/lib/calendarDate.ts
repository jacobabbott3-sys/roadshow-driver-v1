export function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error(`Invalid calendar date: ${value}`);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  if (localDateKey(date) !== value) throw new Error(`Invalid calendar date: ${value}`);
  return date;
}

export function compareDateOnly(left: string, right: string) {
  const leftTime = parseDateOnly(left).getTime();
  const rightTime = parseDateOnly(right).getTime();
  return leftTime === rightTime ? 0 : leftTime < rightTime ? -1 : 1;
}
