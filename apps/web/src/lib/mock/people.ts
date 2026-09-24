// Shared People & Resources mock data (attendance, leave, holidays).
// Used by /attendance, /payroll (LOP), /calendar, /hr and /daily-sheet.

import { employees } from "@/lib/mock/core";

export type AttendanceCode = "P" | "L" | "A" | "H" | "WO" | "HD";

export interface Holiday {
  date: string;
  name: string;
  kind: "National" | "State (TN)" | "Festival";
}

/** Tamil Nadu holiday list (company calendar 2026, Sep–Dec). */
export const holidays: Holiday[] = [
  { date: "2026-09-14", name: "Vinayakar Chathurthi", kind: "Festival" },
  { date: "2026-10-02", name: "Gandhi Jayanti", kind: "National" },
  { date: "2026-10-20", name: "Ayudha Pooja", kind: "State (TN)" },
  { date: "2026-10-21", name: "Vijaya Dasami", kind: "State (TN)" },
  { date: "2026-11-08", name: "Deepavali", kind: "Festival" },
  { date: "2026-12-25", name: "Christmas", kind: "National" },
];

export const holidayByDate = (iso: string) => holidays.find((h) => h.date === iso);

export type LeaveType = "CL" | "SL" | "EL" | "LOP";

export interface LeaveRequest {
  id: string;
  personId: string;
  type: LeaveType;
  from: string;
  to: string;
  days: number;
  reason: string;
  appliedOn: string;
  status: "pending" | "approved" | "rejected";
  approver?: string;
  decidedOn?: string;
  /** Things this leave collides with (locked shoots, reviews, due dates). */
  conflicts?: { label: string; kind: "shoot" | "review" | "deadline"; locked?: boolean }[];
  exceptionReason?: string;
}

export const leaveRequests: LeaveRequest[] = [
  {
    id: "lv-101",
    personId: "p-naveen",
    type: "SL",
    from: "2026-09-25",
    to: "2026-09-26",
    days: 2,
    reason: "Viral fever — doctor advised 2 days rest (medical certificate uploaded)",
    appliedOn: "2026-09-24",
    status: "approved",
    approver: "Harini Selvam",
    decidedOn: "2026-09-24T12:30:00",
  },
  {
    id: "lv-102",
    personId: "p-surya",
    type: "CL",
    from: "2026-09-30",
    to: "2026-09-30",
    days: 1,
    reason: "Cousin's wedding in Madurai",
    appliedOn: "2026-09-23",
    status: "pending",
    conflicts: [
      { label: "Nova Dental — Testimonial shoot (30 Sep, 11:00) · schedule locked", kind: "shoot", locked: true },
      { label: "KVR-0926-08 & UNR-0926-02 due 30 Sep (Surya is editor)", kind: "deadline" },
    ],
  },
  {
    id: "lv-103",
    personId: "p-meena",
    type: "CL",
    from: "2026-10-06",
    to: "2026-10-07",
    days: 2,
    reason: "Family function — Tirunelveli",
    appliedOn: "2026-09-22",
    status: "pending",
  },
  {
    id: "lv-104",
    personId: "p-vignesh",
    type: "EL",
    from: "2026-10-12",
    to: "2026-10-16",
    days: 5,
    reason: "Annual trip — Kodaikanal",
    appliedOn: "2026-09-10",
    status: "approved",
    approver: "Ashwin",
    decidedOn: "2026-09-11T10:05:00",
  },
  {
    id: "lv-105",
    personId: "p-priya",
    type: "SL",
    from: "2026-09-08",
    to: "2026-09-08",
    days: 1,
    reason: "Migraine",
    appliedOn: "2026-09-08",
    status: "approved",
    approver: "Ashwin",
    decidedOn: "2026-09-08T09:10:00",
  },
];

/** Annual entitlement: CL 12, SL 6, EL 15. */
export const leaveEntitlement = { CL: 12, SL: 6, EL: 15 } as const;

export const leaveBalances: Record<string, { CL: number; SL: number; EL: number }> = {
  "p-jana": { CL: 12, SL: 6, EL: 15 },
  "p-ashwin": { CL: 7, SL: 5, EL: 12 },
  "p-priya": { CL: 6, SL: 3, EL: 11 },
  "p-karthik": { CL: 5, SL: 6, EL: 9 },
  "p-vignesh": { CL: 8, SL: 4, EL: 10 },
  "p-divya": { CL: 4, SL: 5, EL: 13 },
  "p-surya": { CL: 3, SL: 4, EL: 6 },
  "p-meena": { CL: 6, SL: 6, EL: 8 },
  "p-harini": { CL: 9, SL: 6, EL: 5 },
  "p-naveen": { CL: 5, SL: 1, EL: 2 },
};

/** Days in the payroll month (Sep 2026) as ISO dates. */
export const sepDays = Array.from({ length: 30 }, (_, i) => `2026-09-${String(i + 1).padStart(2, "0")}`);

// Deterministic exceptions for the month grid
const exceptions: Record<string, Record<string, AttendanceCode>> = {
  "p-priya": { "2026-09-08": "L" },
  "p-surya": { "2026-09-04": "A", "2026-09-18": "HD" },
  "p-naveen": { "2026-09-11": "A", "2026-09-17": "A", "2026-09-25": "L", "2026-09-26": "L" },
  "p-meena": { "2026-09-22": "HD" },
  "p-vignesh": { "2026-09-02": "L" },
  "p-harini": { "2026-09-29": "L" },
};

/** Attendance for Sep 2026 — up to TODAY (25 Sep); later days are blank (future). */
export function attendanceFor(personId: string): Record<string, AttendanceCode | null> {
  const out: Record<string, AttendanceCode | null> = {};
  for (const d of sepDays) {
    const dow = new Date(`${d}T00:00:00`).getDay();
    const ex = exceptions[personId]?.[d];
    if (dow === 0) out[d] = "WO";
    else if (holidayByDate(d)) out[d] = "H";
    else if (ex) out[d] = ex;
    else if (d > "2026-09-25") out[d] = null;
    else out[d] = "P";
  }
  return out;
}

export const attendanceMonth = Object.fromEntries(employees.map((e) => [e.id, attendanceFor(e.id)]));

/** Loss-of-pay days for Sep 2026 (unapproved absences; half-days count 0.5). */
export function lopDays(personId: string) {
  const row = attendanceMonth[personId] ?? {};
  return Object.values(row).reduce((s: number, c) => s + (c === "A" ? 1 : c === "HD" ? 0.5 : 0), 0);
}

export interface TodayPunch {
  personId: string;
  status: "present" | "late" | "absent" | "on-leave" | "on-shoot";
  inTime?: string;
  outTime?: string;
  source: "Hikvision biometric" | "Excel import" | "Leave module" | "Manual";
}

/** Today's board (25 Sep 2026, shift 9:30 AM). */
export const todayPunches: TodayPunch[] = [
  { personId: "p-jana", status: "present", inTime: "09:05", source: "Hikvision biometric" },
  { personId: "p-ashwin", status: "present", inTime: "09:12", source: "Hikvision biometric" },
  { personId: "p-priya", status: "present", inTime: "09:24", source: "Hikvision biometric" },
  { personId: "p-karthik", status: "present", inTime: "09:18", source: "Hikvision biometric" },
  { personId: "p-vignesh", status: "on-shoot", inTime: "06:40", source: "Excel import" },
  { personId: "p-divya", status: "present", inTime: "09:21", source: "Hikvision biometric" },
  { personId: "p-surya", status: "late", inTime: "09:47", source: "Hikvision biometric" },
  { personId: "p-meena", status: "present", inTime: "09:29", source: "Hikvision biometric" },
  { personId: "p-harini", status: "present", inTime: "09:02", source: "Hikvision biometric" },
  { personId: "p-naveen", status: "on-leave", source: "Leave module" },
];
