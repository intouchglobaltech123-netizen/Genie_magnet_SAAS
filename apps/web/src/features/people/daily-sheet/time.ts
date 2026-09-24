export function toMin(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t ?? "");
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/** Minutes between start and end, or null if incomplete/invalid. */
export function spanMinutes(start: string, end: string): number | null {
  const a = toMin(start);
  const b = toMin(end);
  if (a === null || b === null || b <= a) return null;
  return b - a;
}

export function hhmm(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function clock12(t: string) {
  const v = toMin(t);
  if (v === null) return "—";
  const h = Math.floor(v / 60);
  const m = v % 60;
  const ap = h >= 12 ? "PM" : "AM";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${ap}`;
}

/** Stamp an action on the sheet's date with the current wall-clock time. */
export function stampFor(dateIso: string) {
  const d = new Date();
  return `${dateIso}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:00`;
}

export function stampLabel(iso?: string) {
  if (!iso) return "";
  const [date, time] = iso.split("T");
  const d = new Date(`${date}T00:00:00`);
  return `${d.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${clock12((time ?? "").slice(0, 5))}`;
}

export function shiftDate(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function dayLabel(iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("en-IN", opts);
}

export const isSunday = (iso: string) => new Date(`${iso}T00:00:00`).getDay() === 0;
