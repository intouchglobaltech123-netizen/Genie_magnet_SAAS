/** 1 Nov 2026 (dates are days, read as UTC so they never shift with the computer's time zone). */
export const fmtDate = (d: string) =>
  new Date(`${d.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
