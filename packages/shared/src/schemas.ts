import { z } from "zod";
import { BUSINESS_STAGES, FITMENT_QUADRANTS, PLATFORMS, QUESTION_TYPES, SECTION_WHEN } from "./enums.js";

/** Money is stored as whole rupees (INR). Paise are not used anywhere in the product. */
export const rupees = z.number().int().nonnegative();

export const id = z.uuid();

export const pagination = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type Pagination = z.infer<typeof pagination>;

const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ]{10,16}$/, "Enter a phone number with country code, e.g. +91 98400 11001");

export const contactInput = z.object({
  name: z.string().trim().min(1, "Enter the contact's name").max(120, "Keep the name under 120 characters"),
  title: z.string().trim().max(120).optional(),
  email: z.email("Enter a valid email address").optional(),
  phone,
  approver: z.boolean().default(false),
});
export type ContactInput = z.infer<typeof contactInput>;

export const clientInput = z.object({
  name: z.string().trim().min(2, "Enter the client's name (at least 2 characters)").max(160, "Keep the name under 160 characters"),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,4}$/, "2–4 capital letters, used in video codes (e.g. KVR)"),
  industry: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  stage: z.enum(BUSINESS_STAGES).optional(),
  fitment: z.enum(FITMENT_QUADRANTS).optional(),
  whatsappGroupUrl: z.url().optional(),
  contacts: z.array(contactInput).min(1, "Add at least one contact person"),
});
export type ClientInput = z.infer<typeof clientInput>;

/** Kinds of deliverable, so quotas can count videos and posts separately. */
export const DELIVERABLE_KINDS = ["video", "post", "story", "other"] as const;
export type DeliverableKind = (typeof DELIVERABLE_KINDS)[number];

export const deliverableInput = z.object({
  name: z.string().trim().min(1, "Name the deliverable, e.g. Reels").max(60, "Keep it under 60 characters"),
  perMonth: z.number().int("Whole numbers only").min(1, "At least 1 a month").max(500, "At most 500 a month"),
  kind: z.enum(DELIVERABLE_KINDS).default("video"),
});
export type DeliverableInput = z.infer<typeof deliverableInput>;

/** Common billing terms; an agency can type its own. */
export const BILLING_TERMS = ["Monthly advance", "Monthly arrears", "50% advance", "Quarterly advance"] as const;

export const packageInput = z.object({
  name: z.string().trim().min(2, "Name the package (at least 2 characters)").max(120, "Keep the name under 120 characters"),
  description: z.string().trim().max(500, "Keep it under 500 characters").optional(),
  monthlyFee: rupees,
  deliverables: z.array(deliverableInput).min(1, "Add at least one deliverable").max(20, "At most 20 deliverables"),
  shootDays: z.number().int().min(0).max(31, "At most 31 shoot days"),
  revisionsPerDeliverable: z.number().int().min(0).max(10, "At most 10 revisions"),
  platforms: z.array(z.enum(PLATFORMS)).default([]),
  billing: z.string().trim().max(60).optional(),
});
export type PackageInput = z.infer<typeof packageInput>;

/** Videos and posts (with stories) a month, from the deliverables — kept on the package for quotas and reports. */
export function packageTotals(deliverables: { perMonth: number; kind: DeliverableKind }[]) {
  return {
    videosPerMonth: deliverables.filter((d) => d.kind === "video").reduce((n, d) => n + d.perMonth, 0),
    postsPerMonth: deliverables.filter((d) => d.kind === "post" || d.kind === "story").reduce((n, d) => n + d.perMonth, 0),
  };
}

/** Starting points a new agency can add with one click and then change (Growth OS examples). */
export const EXAMPLE_PACKAGES: PackageInput[] = [
  {
    name: "Starter Reels",
    description: "Short videos for one platform.",
    monthlyFee: 25000,
    deliverables: [{ name: "Reels", perMonth: 8, kind: "video" }],
    shootDays: 1,
    revisionsPerDeliverable: 2,
    platforms: ["instagram"],
    billing: "Monthly advance",
  },
  {
    name: "Growth Video Pack",
    description: "Reels, long-form videos and ad creatives.",
    monthlyFee: 85000,
    deliverables: [
      { name: "Reels", perMonth: 8, kind: "video" },
      { name: "Long-form videos", perMonth: 2, kind: "video" },
      { name: "Ad creatives", perMonth: 2, kind: "video" },
    ],
    shootDays: 2,
    revisionsPerDeliverable: 2,
    platforms: ["instagram", "youtube", "facebook"],
    billing: "Monthly advance",
  },
  {
    name: "Social Media Management",
    description: "Content plus posting and community on the client's pages.",
    monthlyFee: 65000,
    deliverables: [
      { name: "Reels", perMonth: 10, kind: "video" },
      { name: "Static posts", perMonth: 12, kind: "post" },
      { name: "Stories", perMonth: 20, kind: "story" },
    ],
    shootDays: 1,
    revisionsPerDeliverable: 2,
    platforms: ["instagram", "facebook"],
    billing: "Monthly advance",
  },
];

/** Languages an agency can use with its clients (questionnaires, messages). */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "ta", label: "Tamil" },
  { code: "hi", label: "Hindi" },
  { code: "te", label: "Telugu" },
  { code: "kn", label: "Kannada" },
  { code: "ml", label: "Malayalam" },
  { code: "mr", label: "Marathi" },
  { code: "bn", label: "Bengali" },
  { code: "gu", label: "Gujarati" },
] as const;
export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code) as [string, ...string[]];

/** Settings → Agency profile. Every field is optional on save; only what is sent changes. Empty text clears a field. */
export const agencyProfileInput = z
  .object({
    name: z.string().trim().min(2, "Enter the agency's name (at least 2 characters)").max(120, "Keep the name under 120 characters"),
    /** A small PNG, JPEG or WebP as a data URL (the web app resizes it before sending). */
    logo: z
      .string()
      .regex(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/, "Use a PNG, JPEG or WebP image")
      .max(300_000, "The logo is too large — use a smaller image")
      .nullable(),
    brandColor: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, "Pick a colour like #1E3A8A")
      .nullable(),
    businessStage: z.enum(BUSINESS_STAGES).nullable(),
    phone: z
      .string()
      .trim()
      .regex(/^(\+?[0-9 ]{10,16})?$/, "Enter a phone number with country code, e.g. +91 98400 11001")
      .transform((v) => v || null)
      .nullable(),
    email: z
      .union([z.literal(""), z.email("Enter a valid email address")])
      .transform((v) => v || null)
      .nullable(),
    website: z
      .union([z.literal(""), z.url("Enter the full address, e.g. https://example.com")])
      .transform((v) => v || null)
      .nullable(),
    city: z
      .string()
      .trim()
      .max(80, "Keep it under 80 characters")
      .transform((v) => v || null)
      .nullable(),
    windowDays: z.number().int("Whole days only").min(1, "At least 1 day").max(60, "At most 60 days"),
    reminderDays: z.array(z.number().int().min(1, "Reminders start from day 1").max(59)).max(5, "At most 5 reminders"),
    languages: z.array(z.enum(LANGUAGE_CODES)).min(1, "Choose at least one language"),
  })
  .partial()
  .superRefine((v, ctx) => {
    if (v.reminderDays && v.windowDays && v.reminderDays.some((d) => d >= v.windowDays!)) {
      ctx.addIssue({ code: "custom", path: ["reminderDays"], message: "Reminders must come before the end of the window" });
    }
  })
  .transform((v) => (v.reminderDays ? { ...v, reminderDays: [...new Set(v.reminderDays)].sort((a, b) => a - b) } : v));
export type AgencyProfileInput = z.infer<typeof agencyProfileInput>;

export const questionSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  label: z.string().min(3),
  type: z.enum(QUESTION_TYPES),
  options: z.array(z.string()).optional(),
  /** Field the answer is written to, e.g. "client.stage" — mapping is validated by the engine. */
  mapsTo: z.string().optional(),
  showIf: z.object({ key: z.string(), includes: z.string() }).optional(),
});

export const sectionSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/),
  title: z.string().min(2),
  when: z.enum(SECTION_WHEN),
  questions: z.array(questionSchema).min(1),
});

export const questionnaireTemplateSchema = z.object({
  kind: z.enum(["client", "agency"]),
  version: z.string().regex(/^\d+\.\d+$/),
  windowDays: z.number().int().min(1).max(30).default(7),
  sections: z.array(sectionSchema).min(1),
});
export type QuestionnaireTemplate = z.infer<typeof questionnaireTemplateSchema>;

/** One answer as submitted: text, list or table rows. Validated against its question type server-side. */
export const answerValue = z.union([z.string().max(10_000), z.array(z.string().max(500)).max(50), z.array(z.record(z.string(), z.string().max(500))).max(100)]);
export type AnswerValue = z.infer<typeof answerValue>;

/** Audit log filters (P1-03): per record (entity + entityId), per person, per date range; newest first. */
export const auditQuery = z.object({
  entity: z.string().trim().max(40).optional(),
  entityId: z.string().trim().max(64).optional(),
  actorId: z.string().trim().max(64).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
export type AuditQuery = z.infer<typeof auditQuery>;
