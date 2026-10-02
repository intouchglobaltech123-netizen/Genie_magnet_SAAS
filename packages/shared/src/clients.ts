// Clients and contacts (P1-18) and agreements (P1-19).
import { z } from "zod";
import { BUSINESS_STAGES, FITMENT_QUADRANTS, PLATFORMS } from "./enums.js";
import { gstin, gstinState, STATE_CODES } from "./gst.js";
import { contactInput, deliverableInput, rupees } from "./schemas.js";

/** Text that can be cleared: an empty value is stored as null. */
const clearable = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => v || null)
    .nullable();

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => v || undefined)
    .optional();

/** The GSTIN's first two digits are its state: a different state on the same client is a mistake. */
export const gstinStateMismatch = (g: string | null | undefined, state: string | null | undefined) => !!g && !!state && gstinState(g) !== state;

/** Editing a client: only what is sent changes; empty text clears a field. */
export const clientUpdate = z
  .object({
    name: z.string().trim().min(2, "Enter the client's name (at least 2 characters)").max(160, "Keep the name under 160 characters"),
    code: z
      .string()
      .trim()
      .regex(/^[A-Z]{2,4}$/, "2–4 capital letters, used in video codes (e.g. KVR)"),
    industry: clearable(120),
    city: clearable(80),
    stage: z.enum(BUSINESS_STAGES).nullable(),
    fitment: z.enum(FITMENT_QUADRANTS).nullable(),
    whatsappGroupUrl: z
      .union([z.literal(""), z.url("Paste the group's invite link, e.g. https://chat.whatsapp.com/…")])
      .transform((v) => v || null)
      .nullable(),
    /** The team member who looks after the client. */
    accountOwnerId: z.string().max(64).nullable(),
    /** Name on invoices, when it differs from the client's name. */
    legalName: clearable(200),
    gstin: z
      .union([z.literal(""), gstin])
      .transform((v) => v || null)
      .nullable(),
    /** GST state code (see INDIAN_STATES): decides CGST + SGST or IGST on invoices. */
    state: z.enum(STATE_CODES).nullable(),
    billingAddress: clearable(500),
    notes: clearable(2000),
  })
  .partial()
  .superRefine((v, ctx) => {
    if (gstinStateMismatch(v.gstin, v.state)) ctx.addIssue({ code: "custom", path: ["state"], message: "The GSTIN is registered in another state" });
  });
export type ClientUpdate = z.input<typeof clientUpdate>;

export const contactUpdate = contactInput.partial().extend({
  title: clearable(120).optional(),
  email: z
    .union([z.literal(""), z.email("Enter a valid email address")])
    .transform((v) => v || null)
    .nullable()
    .optional(),
});
export type ContactUpdate = z.input<typeof contactUpdate>;

// ─── Agreements ───────────────────────────────────────────────────────

/** draft → (signed off) active ⇄ paused → ended. Renewal is a new agreement that follows the old one. */
export const AGREEMENT_STATUSES = ["draft", "active", "paused", "ended"] as const;
export type AgreementStatus = (typeof AGREEMENT_STATUSES)[number];

/** Days before the end that an agreement shows as due for renewal (each agency can change it). */
export const DEFAULT_RENEWAL_NOTICE_DAYS = 45;

/** An agreement's terms. Made from a package (copied, so later package changes never alter it) or written out. */
export const agreementInput = z.object({
  /** The package its terms were copied from, if any. */
  packageId: z.uuid().optional(),
  title: z.string().trim().min(2, "Give the agreement a title").max(160, "Keep it under 160 characters"),
  startDate: z.iso.date("Pick the start date"),
  months: z.number().int("Whole months only").min(1, "At least 1 month").max(60, "At most 60 months"),
  monthlyFee: rupees,
  billing: z.string().trim().min(1, "How is it billed? e.g. Monthly advance").max(60),
  revisionsPerDeliverable: z.number().int().min(0).max(10, "At most 10 revisions"),
  shootDays: z.number().int().min(0).max(31, "At most 31 shoot days"),
  deliverables: z.array(deliverableInput).min(1, "Add at least one deliverable").max(20, "At most 20 deliverables"),
  platforms: z.array(z.enum(PLATFORMS)).default([]),
  notes: optionalText(2000),
});
export type AgreementInput = z.input<typeof agreementInput>;

/** A draft's terms can change until it is signed off; a signed agreement changes only by renewing it. */
export const agreementUpdate = agreementInput.partial();
export type AgreementUpdate = z.input<typeof agreementUpdate>;

/** Renewing: a new draft that starts the day after this one ends (unless said), on the same terms unless changed. */
export const agreementRenewal = z.object({
  startDate: z.iso.date("Pick the start date").optional(),
  months: z.number().int().min(1, "At least 1 month").max(60, "At most 60 months"),
  monthlyFee: rupees.optional(),
});
export type AgreementRenewal = z.input<typeof agreementRenewal>;

export const agreementPause = z.object({ note: optionalText(500) });
export const agreementEnding = z.object({
  note: z.string().trim().min(2, "Say why it ends").max(500),
  /** Ends early on this date; when left out it ends today, or on its end date if that is earlier. */
  endDate: z.iso.date("Pick a date").optional(),
});
export type AgreementEnding = z.input<typeof agreementEnding>;

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The last day of an agreement that starts on `start` and runs `months` months: the day before the same date that many
 * months later (1 Nov + 12 → 31 Oct). A date the later month does not have counts as its last day (31 Jan + 1 → 27 Feb).
 */
export function agreementEndDate(start: string, months: number) {
  const s = utc(start);
  const y = s.getUTCFullYear();
  const m = s.getUTCMonth() + months;
  const lastDay = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return iso(new Date(Date.UTC(y, m, Math.min(s.getUTCDate(), lastDay) - 1)));
}

/** Whole months from start to end (the inverse of agreementEndDate, rounded). */
export function agreementMonths(start: string, end: string) {
  const s = utc(start);
  const e = utc(end);
  e.setUTCDate(e.getUTCDate() + 1);
  return Math.max(1, Math.round((e.getUTCFullYear() - s.getUTCFullYear()) * 12 + (e.getUTCMonth() - s.getUTCMonth()) + (e.getUTCDate() - s.getUTCDate()) / 30));
}

/** The day after a date. */
export const dayAfter = (d: string) => {
  const x = utc(d);
  x.setUTCDate(x.getUTCDate() + 1);
  return iso(x);
};

/** Days from `today` to `date` (negative when it has passed). */
export const daysUntil = (date: string, today: string) => Math.round((utc(date).getTime() - utc(today).getTime()) / 86_400_000);
