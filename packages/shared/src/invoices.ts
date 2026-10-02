// Invoice settings and basic GST invoices (P1-20). Money is whole rupees, like everywhere else in the product.
import { z } from "zod";
import { gstin, STATE_CODES } from "./gst.js";
import { rupees } from "./schemas.js";

/** Optional text: empty clears it. */
const clearable = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => v || null)
    .nullish();

/** GST rates in use for services. */
export const GST_RATES = [0, 5, 12, 18, 28] as const;
export const gstRate = z.literal(GST_RATES, "Choose a GST rate: 0, 5, 12, 18 or 28%");

/** A service the agency invoices for, with its SAC code and GST rate. */
export const invoiceService = z.object({
  name: z.string().trim().min(2, "Name the service").max(80, "Keep it under 80 characters"),
  sac: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "4 to 8 digits, e.g. 998361"),
  rate: gstRate,
});
export type InvoiceService = z.infer<typeof invoiceService>;

/** Starting point for a new agency; the codes are examples to check with the agency's accountant. */
export const DEFAULT_INVOICE_SERVICES: InvoiceService[] = [{ name: "Digital marketing and content services", sac: "998361", rate: 18 }];

/**
 * Invoice numbers: the running number is written with zeros for its width ({0000} → 0042), and can be combined with
 * the financial year ({FY} → 26-27), the year ({YYYY}, {YY}) and the month ({MM}). Numbering starts again at 1 each
 * financial year when the format has {FY}.
 */
export const NUMBER_TOKENS = ["{FY}", "{YYYY}", "{YY}", "{MM}", "{0000}"] as const;
export const numberFormat = z
  .string()
  .trim()
  .min(3)
  .max(40, "Keep it under 40 characters")
  .refine((f) => /\{0+\}/.test(f), "Include the running number, e.g. {0000}")
  .refine((f) => !/[^A-Za-z0-9/{}\-_.]/.test(f.replace(/\{(FY|YYYY|YY|MM|0+)\}/g, "")), "Use letters, digits and / - _ . only");

export const invoiceSettingsInput = z
  .object({
    /** The name on invoices (the registered business name). */
    legalName: z.string().trim().min(2, "Enter the registered business name").max(200),
    gstin: z
      .union([z.literal(""), gstin])
      .transform((v) => v || null)
      .nullable(),
    /** Registered state (GST state code): decides CGST + SGST or IGST. */
    state: z.enum(STATE_CODES, "Choose the state you are registered in"),
    address: z.string().trim().min(5, "Enter the address printed on invoices").max(500),
    services: z.array(invoiceService).min(1, "Add at least one service").max(20),
    numberFormat,
    /** The number the next invoice gets — e.g. to carry on from another system. Left out, numbering carries on. */
    nextNumber: z.number().int("Whole numbers only").min(1, "From 1").max(9_999_999).optional(),
    paymentTermsDays: z.number().int("Whole days only").min(0).max(120, "At most 120 days"),
    bankName: clearable(120),
    accountName: clearable(120),
    accountNumber: z
      .string()
      .trim()
      .regex(/^(\d{6,20})?$/, "6 to 20 digits")
      .transform((v) => v || null)
      .nullish(),
    ifsc: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^([A-Z]{4}0[A-Z0-9]{6})?$/, "11 characters, e.g. SBIN0001234")
      .transform((v) => v || null)
      .nullish(),
    upiId: z
      .string()
      .trim()
      .regex(/^([\w.-]{2,}@[a-zA-Z]{2,})?$/, "e.g. agency@okbank")
      .transform((v) => v || null)
      .nullish(),
    /** Printed at the bottom of every invoice. */
    footer: clearable(500),
  })
  .superRefine((v, ctx) => {
    if (v.gstin && v.gstin.slice(0, 2) !== v.state) ctx.addIssue({ code: "custom", path: ["state"], message: "The GSTIN is registered in another state" });
  });
export type InvoiceSettingsInput = z.input<typeof invoiceSettingsInput>;

// ─── Invoices ─────────────────────────────────────────────────────────

export const INVOICE_STATUSES = ["draft", "sent", "paid", "cancelled"] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export const invoiceLine = z.object({
  description: z.string().trim().min(2, "Describe the line").max(300, "Keep it under 300 characters"),
  sac: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, "4 to 8 digits"),
  quantity: z.number().int("Whole numbers only").min(1, "At least 1").max(10_000),
  /** Price of one, in whole rupees, before GST. */
  rate: rupees.max(100_000_000),
  taxRate: gstRate,
});
export type InvoiceLine = z.infer<typeof invoiceLine>;

export const invoiceInput = z.object({
  clientId: z.uuid("Choose the client"),
  /** The agreement it bills, if any. */
  agreementId: z.uuid().optional(),
  /** The month it bills (YYYY-MM), for agreement invoices. */
  period: z
    .string()
    .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick the month")
    .optional(),
  lines: z.array(invoiceLine).min(1, "Add at least one line").max(50),
  notes: z.string().trim().max(1000).optional(),
});
export type InvoiceInput = z.input<typeof invoiceInput>;

export const invoiceUpdate = invoiceInput.omit({ clientId: true, agreementId: true }).partial();
export type InvoiceUpdate = z.input<typeof invoiceUpdate>;

/** A draft for one month of an agreement. */
export const agreementInvoiceInput = z.object({ period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick the month") });

export const invoiceIssue = z.object({
  /** The invoice date; today when left out. */
  issueDate: z.iso.date("Pick the date").optional(),
});
export const invoicePayment = z.object({
  paidOn: z.iso.date("Pick the date"),
  /** e.g. the UPI or bank reference. */
  note: z
    .string()
    .trim()
    .max(300)
    .transform((v) => v || undefined)
    .optional(),
});
export type InvoicePayment = z.input<typeof invoicePayment>;
export const invoiceCancel = z.object({ reason: z.string().trim().min(2, "Say why it is cancelled").max(300) });

// ─── Numbers, tax and words ───────────────────────────────────────────

/** Indian financial year of a date (April to March): 2026-10-02 → { start: 2026, label: "2026-27", short: "26-27" }. */
export function financialYear(date: string) {
  const [y, m] = date.split("-").map(Number) as [number, number];
  const start = m >= 4 ? y : y - 1;
  const end = String((start + 1) % 100).padStart(2, "0");
  return { start, label: `${start}-${end}`, short: `${String(start % 100).padStart(2, "0")}-${end}` };
}

/** The invoice number for the `seq`th invoice issued on `date`. */
export function formatInvoiceNumber(format: string, seq: number, date: string) {
  const [y, m] = date.split("-") as [string, string];
  return format
    .replace(/\{FY\}/g, financialYear(date).short)
    .replace(/\{YYYY\}/g, y)
    .replace(/\{YY\}/g, y.slice(2))
    .replace(/\{MM\}/g, m)
    .replace(/\{(0+)\}/g, (_, zeros: string) => String(seq).padStart(zeros.length, "0"));
}

/** Numbering restarts each financial year when the number shows the year; otherwise it runs on. */
export const numberSeries = (format: string, date: string) => (format.includes("{FY}") ? financialYear(date).label : "all");

export interface InvoiceTotals {
  /** Before GST. */
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  /** Each line's amount (quantity × rate). */
  amounts: number[];
}

/**
 * GST on the lines. Within the agency's registered state the tax is split equally into CGST and SGST; for a client in
 * another state (or outside India) it is IGST. An agency without a GSTIN charges no GST. Rounded to whole rupees per line.
 */
export function invoiceTotals(lines: Pick<InvoiceLine, "quantity" | "rate" | "taxRate">[], o: { intraState: boolean; registered: boolean }): InvoiceTotals {
  const amounts = lines.map((l) => l.quantity * l.rate);
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (o.registered) {
    lines.forEach((l, i) => {
      if (o.intraState) {
        const half = Math.round((amounts[i]! * l.taxRate) / 200);
        cgst += half;
        sgst += half;
      } else igst += Math.round((amounts[i]! * l.taxRate) / 100);
    });
  }
  const taxable = amounts.reduce((n, a) => n + a, 0);
  return { taxable, cgst, sgst, igst, total: taxable + cgst + sgst + igst, amounts };
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function belowHundred(n: number) {
  return n < 20 ? ONES[n]! : `${TENS[Math.floor(n / 10)]}${n % 10 ? `-${ONES[n % 10]!.toLowerCase()}` : ""}`;
}

function belowThousand(n: number) {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return [h ? `${ONES[h]} hundred` : "", rest ? belowHundred(rest) : ""].filter(Boolean).join(" and ");
}

/** Whole rupees in words, the Indian way (lakh, crore): 85000 → "Rupees eighty-five thousand only". */
export function rupeesInWords(amount: number) {
  if (amount === 0) return "Rupees zero only";
  const parts: string[] = [];
  let n = Math.floor(amount);
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (crore) parts.push(`${crore >= 1000 ? rupeesInWords(crore).replace(/^Rupees | only$/g, "") : belowThousand(crore)} crore`);
  if (lakh) parts.push(`${belowHundred(lakh)} lakh`);
  if (thousand) parts.push(`${belowHundred(thousand)} thousand`);
  if (n) parts.push(belowThousand(n));
  const words = parts.join(" ").toLowerCase();
  return `Rupees ${words} only`;
}
