// People (Phase 5, stream A): employee records, attendance and leave. Each agency sets its own rules; nothing about
// working hours, weekly offs or leave allowances is assumed beyond a starting point it can change.
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const optional = (max: number) =>
  z
    .union([z.literal(""), text(max)])
    .transform((v) => v || null)
    .nullish();
const day = z.iso.date("Pick the date");
const optionalDay = z
  .union([z.literal(""), day])
  .transform((v) => v || null)
  .nullish();
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, e.g. 09:30");

export const EMPLOYMENT_TYPES = ["full_time", "part_time", "intern", "freelancer"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: "Full time",
  part_time: "Part time",
  intern: "Intern",
  freelancer: "Freelancer",
};

/** HR's part of an employee record. */
export const employeeInput = z.object({
  employeeCode: optional(40),
  departmentId: z
    .union([z.literal(""), z.uuid()])
    .transform((v) => v || null)
    .nullish(),
  designation: optional(120),
  employmentType: z.enum(EMPLOYMENT_TYPES).default("full_time"),
  joiningDate: optionalDay,
  exitDate: optionalDay,
  phone: optional(30),
  personalEmail: z
    .union([z.literal(""), z.email("Enter a valid email address")])
    .transform((v) => v || null)
    .nullish(),
  dateOfBirth: optionalDay,
  address: optional(500),
  emergencyName: optional(120),
  emergencyPhone: optional(30),
  /** Who they report to (their manager reviews their month); left as it is when not given. */
  managerId: z.string().max(64).nullable().optional(),
  /** The KRAs their month is scored on; left as it is when not given. */
  kraTemplateId: z.uuid().nullable().optional(),
});
export type EmployeeInput = z.input<typeof employeeInput>;

/** Payroll's part: kept encrypted, shown only as the last characters. */
export const employeeBankInput = z.object({
  bankAccount: z
    .string()
    .trim()
    .regex(/^(\d{6,20})?$/, "6 to 20 digits")
    .optional(),
  ifsc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{4}0[A-Z0-9]{6})?$/, "11 characters, e.g. SBIN0001234")
    .optional(),
  pan: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^([A-Z]{5}\d{4}[A-Z])?$/, "10 characters, e.g. ABCDE1234F")
    .optional(),
  uan: optional(20),
  esiNumber: optional(20),
});
export type EmployeeBankInput = z.input<typeof employeeBankInput>;

export const departmentInput = z.object({ name: text(80).min(2, "Name the department"), headId: optional(64) });

/** GET /people (one person) */
export interface EmployeeRow {
  user: { id: string; name: string; email: string };
  role: string | null;
  employeeCode: string | null;
  department: { id: string; name: string } | null;
  designation: string | null;
  employmentType: EmploymentType;
  joiningDate: string | null;
  exitDate: string | null;
  phone: string | null;
  personalEmail: string | null;
  dateOfBirth: string | null;
  address: string | null;
  emergencyName: string | null;
  emergencyPhone: string | null;
  manager: { id: string; name: string } | null;
  kraTemplateId: string | null;
  /** Only for people who may see payroll (and the person themselves): the last characters. */
  bank: { account: string | null; ifsc: string | null; pan: string | null; uan: string | null; esiNumber: string | null } | null;
}

// ─── Attendance (P5-07) ───────────────────────────────────────────────

export const ATTENDANCE_STATUSES = ["present", "late", "half_day", "absent", "leave", "holiday", "weekly_off"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];
export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  half_day: "Half day",
  absent: "Absent",
  leave: "On leave",
  holiday: "Holiday",
  weekly_off: "Weekly off",
};

export const attendanceSettingsInput = z.object({
  workdayStart: time,
  lateAfter: z.number().int().min(0).max(240),
  halfDayBelow: z.number().int().min(0).max(720),
  weeklyOffs: z.array(z.number().int().min(0).max(6)).max(6),
  holidays: z.array(z.object({ date: day, name: text(80).min(1, "Name the holiday") })).max(60),
});
export type AttendanceSettingsInput = z.infer<typeof attendanceSettingsInput>;
export type AttendanceSettings = AttendanceSettingsInput;

/** The status of a day from its first in and last out, by the agency's rules. */
export function dayStatus(s: Pick<AttendanceSettings, "workdayStart" | "lateAfter" | "halfDayBelow">, firstIn: string | null, lastOut: string | null) {
  if (!firstIn) return { status: "absent" as const, minutes: 0 };
  const mins = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
  const minutes = lastOut ? Math.max(0, mins(lastOut) - mins(firstIn)) : 0;
  if (lastOut && minutes < s.halfDayBelow) return { status: "half_day" as const, minutes };
  if (mins(firstIn) > mins(s.workdayStart) + s.lateAfter) return { status: "late" as const, minutes };
  return { status: "present" as const, minutes };
}

/** One person's day from an attendance export, after the importer turned punches into first in and last out. */
export const attendanceImportRow = z.object({
  /** Their employee code, email or name, as in the export. */
  employee: text(120).min(1, "Who is it?"),
  date: day,
  firstIn: time.optional(),
  lastOut: time.optional(),
});
export type AttendanceImportRow = z.input<typeof attendanceImportRow>;

export const attendanceCorrectionInput = z.object({
  date: day,
  firstIn: time.optional(),
  lastOut: time.optional(),
  reason: text(500).min(3, "Say what happened"),
});
export type AttendanceCorrectionInput = z.infer<typeof attendanceCorrectionInput>;

/** GET /attendance?month= : each person's days, and the month in numbers. */
export interface AttendanceMonth {
  month: string;
  /** Days of the month that are weekly offs or holidays (with the holiday's name). */
  offDays: { date: string; name: string | null }[];
  people: {
    user: { id: string; name: string };
    days: Record<string, { status: AttendanceStatus; firstIn: string | null; lastOut: string | null; source: string }>;
    totals: Record<AttendanceStatus, number>;
  }[];
}

export interface AttendanceCorrectionRow {
  id: string;
  user: { id: string; name: string | null };
  date: string;
  firstIn: string | null;
  lastOut: string | null;
  reason: string;
  state: "pending" | "approved" | "rejected";
  note: string | null;
  createdAt: string;
}

// ─── Leave (P5-08) ────────────────────────────────────────────────────

/** Leave every agency starts with; each changes them. */
export const DEFAULT_LEAVE_TYPES = [
  { name: "Casual leave", daysPerYear: 12, paid: true, carryForward: 0 },
  { name: "Sick leave", daysPerYear: 6, paid: true, carryForward: 0 },
  { name: "Unpaid leave", daysPerYear: 0, paid: false, carryForward: 0 },
] as const;

export const leaveTypesInput = z.object({
  types: z
    .array(
      z.object({
        id: z.uuid().optional(),
        name: text(60).min(2, "Name the leave"),
        daysPerYear: z.number().int().min(0).max(366),
        paid: z.boolean(),
        carryForward: z.number().int().min(0).max(366),
        active: z.boolean().default(true),
      }),
    )
    .min(1)
    .max(20),
});

export const leaveRequestInput = z
  .object({
    typeId: z.uuid("Choose the kind of leave"),
    from: day,
    to: day,
    halfDay: z.boolean().default(false),
    reason: text(500).min(3, "Say why"),
  })
  .refine((r) => r.to >= r.from, { path: ["to"], message: "Ends before it starts" })
  .refine((r) => !r.halfDay || r.from === r.to, { path: ["halfDay"], message: "A half day is one day" });
export type LeaveRequestInput = z.input<typeof leaveRequestInput>;

export const leaveDecision = z
  .object({ approved: z.boolean(), note: text(500).optional() })
  .refine((d) => d.approved || !!d.note, { path: ["note"], message: "Say why it is not approved" });

export interface LeaveTypeRow {
  id: string;
  name: string;
  daysPerYear: number;
  paid: boolean;
  carryForward: number;
  active: boolean;
}

export interface LeaveRequestRow {
  id: string;
  user: { id: string; name: string | null };
  type: { id: string; name: string; paid: boolean };
  from: string;
  to: string;
  halfDay: boolean;
  days: number;
  reason: string;
  status: "pending" | "approved" | "rejected" | "cancelled";
  note: string | null;
  decidedBy: string | null;
  /** Work that falls in those days: shoots they crew and videos they edit that are due. */
  clashes: { kind: "shoot" | "video"; label: string; date: string; link: string }[];
  createdAt: string;
}

/** GET /leave/balances (one person) */
export interface LeaveBalanceRow {
  user: { id: string; name: string };
  year: number;
  types: { id: string; name: string; allowance: number | null; carried: number; taken: number; pending: number; left: number | null }[];
}
