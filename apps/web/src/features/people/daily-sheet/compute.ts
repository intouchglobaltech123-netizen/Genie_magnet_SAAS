import { leaveRequests } from "@/lib/mock/people";
import { TODAY } from "@/lib/mock/core";
import { CUTOFF, SHIFT_MINUTES } from "./config";
import type { DaySheet } from "./seed";
import { spanMinutes, toMin } from "./time";

export function summarise(sheet: DaySheet | undefined) {
  const rows = sheet?.rows ?? [];
  let total = 0;
  let productive = 0;
  let completed = 0;
  let pending = 0;
  for (const r of rows) {
    const m = spanMinutes(r.start, r.end) ?? 0;
    total += m;
    if (r.productive) productive += m;
    if (r.status === "Completed") completed++;
    else pending++;
  }
  const errors = (sheet?.counters.errors ?? 0) + (sheet?.counters.serverIssues ?? 0);
  return {
    total,
    productive,
    nonProductive: total - productive,
    completed,
    pending,
    errors,
    rows: rows.length,
    gap: SHIFT_MINUTES - total,
  };
}

export interface Issue {
  rowId?: string;
  text: string;
}

export function validate(sheet: DaySheet | undefined): Issue[] {
  const issues: Issue[] = [];
  if (!sheet || sheet.rows.length === 0) return [{ text: "Add at least one task row" }];
  sheet.rows.forEach((r, i) => {
    if (!r.videoId && !r.task.trim()) issues.push({ rowId: r.id, text: `Row ${i + 1}: add a Video ID or task name` });
    if (spanMinutes(r.start, r.end) === null) issues.push({ rowId: r.id, text: `Row ${i + 1}: start/end time is incomplete` });
    if (r.status === "Pending" && !r.delayReason.trim()) issues.push({ rowId: r.id, text: `Row ${i + 1}: pending — give a delay reason` });
  });
  const { gap } = summarise(sheet);
  if (Math.abs(gap) > 30 && !sheet.dayReason.trim())
    issues.push({ text: gap > 0 ? "Short of the 8h shift — fill the delay / extra time reason" : "Over 8h — fill the delay / extra time reason" });
  return issues;
}

export type SubmissionStatus = "Submitted" | "Late" | "Pending" | "Missed" | "On leave" | "Holiday" | "Upcoming";

export function onLeave(personId: string, date: string) {
  return leaveRequests.some((l) => l.personId === personId && l.status === "approved" && date >= l.from && date <= l.to);
}

export function statusOf(personId: string, date: string, sheet: DaySheet | undefined): SubmissionStatus {
  if (onLeave(personId, date)) return "On leave";
  if (date > TODAY) return "Upcoming";
  if (sheet?.submittedAt) {
    const t = toMin(sheet.submittedAt.slice(11, 16)) ?? 0;
    return t > (toMin(CUTOFF) ?? 0) ? "Late" : "Submitted";
  }
  return date < TODAY ? "Missed" : "Pending";
}
