// Payroll (P5-09): each person's salary and its parts, the agency's own deductions, and the monthly run worked out from
// attendance and leave, with payslips. Statutory amounts (PF, ESI, professional tax, TDS) are never assumed: each agency
// enters its own, with the rates its auditor gives it.
import { z } from "zod";

const rupees = z.number().int("Whole rupees").min(0, "Not below zero").max(100_000_000);
const partName = z.string().trim().min(1, "Name it").max(60);
const uniqueNames = (items: { name: string }[]) => new Set(items.map((i) => i.name.toLowerCase())).size === items.length;

export const payrollMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month like 2026-10");

/** A person's monthly salary from a day on, in parts: Basic 20,000; House rent allowance 8,000. */
export const salaryInput = z.object({
  from: z.iso.date("Pick the day it starts"),
  earnings: z
    .array(z.object({ name: partName, amount: rupees }))
    .min(1, "Add at least one part")
    .max(15)
    .refine(uniqueNames, "Each part needs its own name"),
  note: z.string().trim().max(300).optional(),
});
export type SalaryInput = z.input<typeof salaryInput>;

/** How a deduction is worked out. */
export const DEDUCTION_KINDS = ["percent", "fixed", "slabs", "each_person"] as const;
export type DeductionKind = (typeof DEDUCTION_KINDS)[number];
export const DEDUCTION_KIND_LABEL: Record<DeductionKind, string> = {
  percent: "A percentage of the salary",
  fixed: "The same amount each month",
  slabs: "By the month's salary, in slabs",
  each_person: "Entered for each person each month",
};

/** One of the agency's deductions or contributions, as its auditor sets it. */
export const deductionRule = z
  .object({
    name: partName,
    kind: z.enum(DEDUCTION_KINDS, "Choose how it is worked out"),
    /** percent: of these parts of the salary as paid this month (all of it when empty). */
    of: z.array(partName).max(15).default([]),
    percent: z.number().min(0).max(100).optional(),
    /** percent: the amount it is worked out on stops here, when the rule has a ceiling. */
    ceiling: rupees.optional(),
    /** fixed: the amount. */
    amount: rupees.optional(),
    /** slabs: by the month's salary as paid, the first slab it fits (up to null is "anything above"). */
    slabs: z
      .array(z.object({ upTo: rupees.nullable(), amount: rupees }))
      .max(20)
      .default([]),
    /** Only for people whose full monthly salary is at most this, when the rule says so. */
    onlyUpTo: rupees.optional(),
    /** Paid by the agency on top of the salary: shown on the payslip, not taken from it. */
    employer: z.boolean().default(false),
  })
  .superRefine((d, ctx) => {
    if (d.kind === "percent" && d.percent === undefined) ctx.addIssue({ code: "custom", path: ["percent"], message: "Enter the percentage" });
    if (d.kind === "fixed" && d.amount === undefined) ctx.addIssue({ code: "custom", path: ["amount"], message: "Enter the amount" });
    if (d.kind === "slabs" && !d.slabs.length) ctx.addIssue({ code: "custom", path: ["slabs"], message: "Add the slabs" });
  });
export type DeductionRule = z.output<typeof deductionRule>;

/** What a day's pay is: the month's salary over the days in the month, over its working days, or over 30. */
export const DAY_BASES = ["calendar", "working", "thirty"] as const;
export type DayBasis = (typeof DAY_BASES)[number];
export const DAY_BASIS_LABEL: Record<DayBasis, string> = {
  calendar: "The days in the month",
  working: "The working days in the month (without weekly offs and holidays)",
  thirty: "30 days, whatever the month",
};

export const payrollSettingsInput = z.object({
  dayBasis: z.enum(DAY_BASES).default("calendar"),
  /** Late days that count as half a day without pay; none when not set. */
  latesPerHalfDay: z.number().int().min(1).max(31).nullable().default(null),
  deductions: z.array(deductionRule).max(20).refine(uniqueNames, "Each deduction needs its own name"),
});
export type PayrollSettings = z.output<typeof payrollSettingsInput>;
export type PayrollSettingsInput = z.input<typeof payrollSettingsInput>;

export const DEFAULT_PAYROLL: PayrollSettings = { dayBasis: "calendar", latesPerHalfDay: null, deductions: [] };

/** What payroll changes on one payslip while the run is a draft. */
export const payslipChange = z.object({
  /** Bonus, reimbursement (plus) or advance recovered (minus). */
  adjustments: z
    .array(z.object({ name: partName, amount: z.number().int().min(-100_000_000).max(100_000_000) }))
    .max(10)
    .default([]),
  /** Amounts for this month, for deductions entered for each person (such as TDS). */
  entries: z.record(z.string().max(60), rupees).default({}),
  /** Days without pay the attendance does not show (or minus, to forgive some). */
  extraLop: z.number().min(-31).max(31).multipleOf(0.5, "In half days").default(0),
});
export type PayslipChange = z.input<typeof payslipChange>;

export const PAYROLL_STATUSES = ["draft", "locked"] as const;
export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

/** GET /payroll/salaries (one item): each person's salary now, and before. */
export interface SalaryRow {
  user: { id: string; name: string };
  employeeCode: string | null;
  current: { id: string; from: string; earnings: { name: string; amount: number }[]; total: number; note: string | null } | null;
  history: { id: string; from: string; total: number }[];
}

export interface PayslipDays {
  /** What a day's pay is worked out over. */
  basis: number;
  /** Days of the month the person was with the agency, counted the same way. */
  employed: number;
  absent: number;
  halfDays: number;
  unpaidLeave: number;
  lates: number;
  /** Half days without pay for coming in late. */
  latePenalty: number;
  extra: number;
  /** All days without pay. */
  lop: number;
  paid: number;
}

/** One person's payslip. */
export interface PayslipRow {
  id: string;
  month: string;
  status: PayrollStatus;
  user: { id: string; name: string };
  employeeCode: string | null;
  designation: string | null;
  department: string | null;
  bankHint: string | null;
  panHint: string | null;
  uan: string | null;
  days: PayslipDays;
  /** Each part: the month's full amount and what is paid for the days. */
  earnings: { name: string; amount: number; paid: number }[];
  deductions: { name: string; amount: number }[];
  /** Paid by the agency on top. */
  contributions: { name: string; amount: number }[];
  adjustments: { name: string; amount: number }[];
  entries: Record<string, number>;
  extraLop: number;
  gross: number;
  totalDeductions: number;
  net: number;
  netInWords: string;
  notes: string[];
  /** On a single payslip (GET /payslips/:id): the agency as its invoices show it. */
  employer?: { name: string; address: string | null; logo: string | null; brandColor: string | null };
}

/** GET /payroll/runs (one item) and GET /payroll/runs/:month */
export interface PayrollRunRow {
  id: string;
  month: string;
  status: PayrollStatus;
  people: number;
  gross: number;
  deductions: number;
  net: number;
  /** What the agency pays on top of the salaries. */
  contributions: number;
  lockedAt: string | null;
  lockedBy: string | null;
  /** People left out (no salary set for the month) and things worth a look. */
  notes: string[];
  payslips?: PayslipRow[];
}

/** What a payslip is worked out from: the month's salaries, employment, attendance and unpaid leave. */
export interface PayslipBasis {
  month: string;
  settings: PayrollSettings;
  /** Salaries that started by the month's end, oldest first: on each day, the latest that started by then applies. */
  salaries: { from: string; earnings: { name: string; amount: number }[] }[];
  joined: string | null;
  left: string | null;
  /** The month's weekly offs and holidays. */
  offDays: Set<string>;
  /** Each day's attendance, where there is one: present, late, half_day, absent, leave… */
  attendance: Record<string, string>;
  /** Days of approved unpaid leave: 1, or 0.5 for half a day (weekly offs and holidays not included). */
  unpaidLeave: Record<string, number>;
  change: { adjustments: { name: string; amount: number }[]; entries: Record<string, number>; extraLop: number };
}

export type WorkedOutPayslip = Pick<PayslipRow, "days" | "earnings" | "deductions" | "contributions" | "gross" | "totalDeductions" | "net" | "notes">;

const twoPlaces = (n: number) => Math.round(n * 100) / 100;

/**
 * One person's pay for a month (P5-09). Each part of the salary is paid for the days worked: the month's amount over
 * the agency's day basis, times the days with the agency less the days without pay (absent, half days, unpaid leave,
 * lateness by the agency's rule, and any payroll adds). When the salary changed in the month, each is paid for its days.
 * Deductions follow the agency's own rules, worked out on what is paid.
 */
export function workOutPayslip(b: PayslipBasis): WorkedOutPayslip {
  const [y, m] = b.month.split("-").map(Number) as [number, number];
  const inMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates = Array.from({ length: inMonth }, (_, k) => `${b.month}-${String(k + 1).padStart(2, "0")}`);
  const basis = { calendar: inMonth, working: dates.filter((d) => !b.offDays.has(d)).length, thirty: 30 }[b.settings.dayBasis];
  const counts = (d: string) => b.settings.dayBasis !== "working" || !b.offDays.has(d);
  const salaryOn = (d: string) => [...b.salaries].reverse().find((s) => s.from <= d) ?? null;
  const notes: string[] = [];

  type Segment = { salary: PayslipBasis["salaries"][number]; days: number; calendarDays: number; lop: number };
  const segments: Segment[] = [];
  const tally = { absent: 0, halfDays: 0, unpaidLeave: 0, lates: 0 };
  let recorded = 0;
  for (const d of dates) {
    if ((b.joined && d < b.joined) || (b.left && d > b.left)) continue;
    const salary = salaryOn(d);
    if (!salary) continue;
    let seg = segments.at(-1);
    if (seg?.salary !== salary) segments.push((seg = { salary, days: 0, calendarDays: 0, lop: 0 }));
    seg.calendarDays += 1;
    if (counts(d)) seg.days += 1;
    const status = b.attendance[d];
    if (status) recorded += 1;
    let lop = 0;
    if (b.unpaidLeave[d]) tally.unpaidLeave += lop = b.unpaidLeave[d];
    else if (status === "absent") tally.absent += lop = 1;
    else if (status === "half_day") {
      tally.halfDays += 1;
      lop = 0.5;
    }
    if (status === "late") tally.lates += 1;
    seg.lop += lop;
  }
  if (b.settings.dayBasis === "thirty") {
    // A whole month is 30 days; part of a month is its days, up to 30, shared between the salaries it had.
    const calendar = segments.reduce((s, x) => s + x.calendarDays, 0);
    const days = calendar === inMonth ? 30 : Math.min(30, calendar);
    for (const s of segments) s.days = (days * s.calendarDays) / calendar;
  }
  const latePenalty = b.settings.latesPerHalfDay ? Math.floor(tally.lates / b.settings.latesPerHalfDay) * 0.5 : 0;
  const last = segments.at(-1);
  if (last) last.lop += latePenalty + b.change.extraLop;
  if (segments.length > 1) notes.push(`The salary changed on ${segments[1]!.salary.from}; each is paid for its days.`);
  if (segments.length && !recorded) notes.push("No attendance this month: paid for every day unless you add days without pay.");

  // Each part: the full monthly amount (from the latest salary) and what is paid for the days.
  const parts = new Map<string, { name: string; amount: number; paid: number }>();
  for (const s of segments) {
    const factor = Math.max(0, s.days - s.lop) / basis;
    for (const e of s.salary.earnings) {
      const p = parts.get(e.name.toLowerCase()) ?? { name: e.name, amount: 0, paid: 0 };
      p.paid += e.amount * factor;
      parts.set(e.name.toLowerCase(), p);
    }
  }
  for (const e of last?.salary.earnings ?? []) parts.get(e.name.toLowerCase())!.amount = e.amount;
  const earnings = [...parts.values()].map((p) => ({ ...p, paid: Math.round(p.paid) }));
  const gross = earnings.reduce((s, e) => s + e.paid, 0);
  const fullMonth = (last?.salary.earnings ?? []).reduce((s, e) => s + e.amount, 0);

  const deductions: { name: string; amount: number }[] = [];
  const contributions: { name: string; amount: number }[] = [];
  for (const r of gross > 0 ? b.settings.deductions : []) {
    if (r.onlyUpTo !== undefined && fullMonth > r.onlyUpTo) continue;
    let amount = 0;
    if (r.kind === "percent") {
      const of = r.of.map((n) => n.toLowerCase());
      const missing = r.of.filter((n) => !parts.has(n.toLowerCase()));
      if (missing.length) notes.push(`${r.name} is worked out on ${missing.join(", ")}, which this salary does not have.`);
      let base = of.length ? earnings.filter((e) => of.includes(e.name.toLowerCase())).reduce((s, e) => s + e.paid, 0) : gross;
      if (r.ceiling !== undefined) base = Math.min(base, r.ceiling);
      amount = Math.round((base * (r.percent ?? 0)) / 100);
    } else if (r.kind === "fixed") amount = r.amount ?? 0;
    else if (r.kind === "slabs") {
      const slab = [...r.slabs].sort((a, c) => (a.upTo ?? Infinity) - (c.upTo ?? Infinity)).find((s) => s.upTo === null || gross <= s.upTo);
      amount = slab?.amount ?? 0;
    } else amount = b.change.entries[r.name] ?? 0;
    if (amount > 0) (r.employer ? contributions : deductions).push({ name: r.name, amount });
  }
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);
  const net = gross - totalDeductions + b.change.adjustments.reduce((s, a) => s + a.amount, 0);
  if (net < 0) notes.push("Net pay is below zero.");

  const employed = twoPlaces(segments.reduce((s, x) => s + x.days, 0));
  const lop = twoPlaces(tally.absent + tally.halfDays * 0.5 + tally.unpaidLeave + latePenalty + b.change.extraLop);
  return {
    days: { basis, employed, ...tally, latePenalty, extra: b.change.extraLop, lop, paid: Math.max(0, twoPlaces(employed - lop)) },
    earnings,
    deductions,
    contributions,
    gross,
    totalDeductions,
    net,
    notes,
  };
}
