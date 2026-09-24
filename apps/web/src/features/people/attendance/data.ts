import type { AttendanceCode, TodayPunch } from "@/lib/mock/people";

export const SHIFT_START = "09:30";
export const DEVICE = "Hikvision DS-K1T341 (Appakudal office)";

export const codeMeta: Record<AttendanceCode, { label: string; cls: string }> = {
  P: { label: "Present", cls: "bg-success-soft text-success" },
  L: { label: "Leave", cls: "bg-info-soft text-info" },
  A: { label: "Absent", cls: "bg-danger-soft text-danger" },
  H: { label: "Holiday", cls: "bg-gold-soft text-gold" },
  WO: { label: "Weekly off", cls: "bg-muted text-muted-foreground" },
  HD: { label: "Half day", cls: "bg-warning-soft text-warning" },
};

export const statusMeta: Record<TodayPunch["status"], { label: string; tone: "success" | "warning" | "danger" | "info" | "accent" }> = {
  present: { label: "Present", tone: "success" },
  late: { label: "Late", tone: "warning" },
  absent: { label: "Absent", tone: "danger" },
  "on-leave": { label: "On leave", tone: "info" },
  "on-shoot": { label: "On shoot", tone: "accent" },
};

/** Extra context shown on today's board. */
export const todayNotes: Record<string, string> = {
  "p-vignesh": "Kaveri testimonial recce, Chennai · punched via site sheet",
  "p-surya": "17 min late · 2nd late mark this month",
  "p-naveen": "Sick leave 25–26 Sep (approved)",
};

export const syncHistory = [
  { at: "Today, 09:48 AM", source: "Hikvision biometric", records: 8, by: "Auto-sync (every 15 min)" },
  { at: "Today, 08:15 AM", source: "Excel import", records: 1, by: "Harini Selvam · shoot_sheet_25sep.xlsx" },
  { at: "Yesterday, 07:02 PM", source: "Hikvision biometric", records: 18, by: "Auto-sync (every 15 min)" },
];
