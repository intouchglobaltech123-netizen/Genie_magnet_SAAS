import { employees } from "@/lib/mock/core";
import { lopDays } from "@/lib/mock/people";
import type { Person } from "@/lib/types";

export const PAY_PERIOD = { label: "September 2026", short: "Sep 2026", days: 30, payDate: "2026-09-30" } as const;

/** Statutory placeholders — to be confirmed with the auditor before go-live. */
export const STATUTORY = {
  pfRate: 0.12,
  pfCap: 1800,
  esiRate: 0.0075,
  esiEmployerRate: 0.0325,
  esiCeiling: 21000,
  ptMonthly: 208, // Tamil Nadu PT is half-yearly (~₹1,250 / 6 months); monthly placeholder
  stdDeduction: 75000,
} as const;

/** Masked identifiers (last digits only). Mirrors the HR profile records. */
const ids: Record<string, { pan: string; bank: string; bankName: string; uan: string }> = {
  "p-jana": { pan: "11K", bank: "0931", bankName: "Karur Vysya Bank", uan: "1011" },
  "p-ashwin": { pan: "55M", bank: "2210", bankName: "Indian Bank", uan: "1012" },
  "p-priya": { pan: "73P", bank: "6618", bankName: "HDFC Bank", uan: "1013" },
  "p-karthik": { pan: "48Q", bank: "1044", bankName: "State Bank of India", uan: "1014" },
  "p-vignesh": { pan: "33L", bank: "7752", bankName: "Canara Bank", uan: "1015" },
  "p-divya": { pan: "80D", bank: "4409", bankName: "ICICI Bank", uan: "1016" },
  "p-surya": { pan: "22S", bank: "8830", bankName: "City Union Bank", uan: "1017" },
  "p-meena": { pan: "66R", bank: "3127", bankName: "Axis Bank", uan: "1018" },
  "p-harini": { pan: "91H", bank: "5561", bankName: "Karur Vysya Bank", uan: "1019" },
  "p-naveen": { pan: "04N", bank: "9904", bankName: "Indian Overseas Bank", uan: "1020" },
};

export interface PayrollRow {
  person: Person;
  empId: string;
  panMasked: string;
  bankMasked: string;
  uanMasked: string;
  ctc: number;
  basic: number;
  hra: number;
  special: number;
  employerPf: number;
  gross: number;
  lopDays: number;
  paidDays: number;
  lop: number;
  pf: number;
  esi: number;
  pt: number;
  tds: number;
  deductions: number;
  net: number;
  employerCost: number;
}

/** New-regime slab estimate (FY 2026-27 placeholder) incl. 87A rebate and 4% cess. */
export function estimateMonthlyTds(monthlyGross: number) {
  const taxable = monthlyGross * 12 - STATUTORY.stdDeduction;
  if (taxable <= 1_200_000) return 0;
  const slabs: [number, number][] = [
    [400_000, 0],
    [800_000, 0.05],
    [1_200_000, 0.1],
    [1_600_000, 0.15],
    [2_000_000, 0.2],
    [2_400_000, 0.25],
    [Infinity, 0.3],
  ];
  let tax = 0;
  let prev = 0;
  for (const [upto, rate] of slabs) {
    if (taxable > prev) tax += (Math.min(taxable, upto) - prev) * rate;
    prev = upto;
  }
  return Math.round((tax * 1.04) / 12);
}

export function computeRow(person: Person, index: number): PayrollRow {
  const ctc = person.monthlyCtc ?? 0;
  const basic = Math.round(ctc * 0.5);
  const hra = Math.round(ctc * 0.2);
  const employerPf = Math.min(Math.round(basic * STATUTORY.pfRate), STATUTORY.pfCap);
  const special = ctc - basic - hra - employerPf;
  const gross = basic + hra + special;
  const lopD = lopDays(person.id);
  const lop = Math.round((gross / PAY_PERIOD.days) * lopD);
  const pf = Math.min(Math.round(basic * STATUTORY.pfRate), STATUTORY.pfCap);
  const esi = gross <= STATUTORY.esiCeiling ? Math.round(gross * STATUTORY.esiRate) : 0;
  const pt = STATUTORY.ptMonthly;
  const tds = estimateMonthlyTds(gross);
  const deductions = lop + pf + esi + pt + tds;
  const employerEsi = gross <= STATUTORY.esiCeiling ? Math.round(gross * STATUTORY.esiEmployerRate) : 0;
  const s = ids[person.id] ?? { pan: "00X", bank: "0000", bankName: "State Bank of India", uan: "1000" };
  return {
    person,
    empId: `GM-${String(index + 1).padStart(3, "0")}`,
    panMasked: `XXXXX${s.pan.slice(0, 2)}XX${s.pan.slice(2)}`,
    bankMasked: `${s.bankName} · XXXXXX${s.bank}`,
    uanMasked: `XXXXXXXX${s.uan}`,
    ctc,
    basic,
    hra,
    special,
    employerPf,
    gross,
    lopDays: lopD,
    paidDays: PAY_PERIOD.days - lopD,
    lop,
    pf,
    esi,
    pt,
    tds,
    deductions,
    net: gross - deductions,
    employerCost: ctc + employerEsi,
  };
}

export const payrollRows: PayrollRow[] = employees.map(computeRow);

export const payrollTotals = payrollRows.reduce(
  (t, r) => ({
    ctc: t.ctc + r.ctc,
    gross: t.gross + r.gross,
    lop: t.lop + r.lop,
    pf: t.pf + r.pf,
    esi: t.esi + r.esi,
    pt: t.pt + r.pt,
    tds: t.tds + r.tds,
    net: t.net + r.net,
    employerCost: t.employerCost + r.employerCost,
    lopDays: t.lopDays + r.lopDays,
  }),
  { ctc: 0, gross: 0, lop: 0, pf: 0, esi: 0, pt: 0, tds: 0, net: 0, employerCost: 0, lopDays: 0 },
);

export const RUN_STEPS = [
  { key: "locked", label: "Inputs locked", detail: "Attendance & LOP frozen", action: "Lock inputs", who: "Harini Selvam" },
  { key: "calculated", label: "Calculated", detail: "Gross, LOP & statutory computed", action: "Run calculation", who: "System" },
  { key: "approved", label: "Approved by Janarthanan", detail: "Founder sign-off", action: "Approve payroll", who: "Janarthanan" },
  { key: "released", label: "Payslips released", detail: "Emailed & on employee portal", action: "Release payslips", who: "Harini Selvam" },
] as const;
