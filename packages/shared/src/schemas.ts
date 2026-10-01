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
  name: z.string().trim().min(1).max(120),
  title: z.string().trim().max(120).optional(),
  email: z.email().optional(),
  phone,
  approver: z.boolean().default(false),
});
export type ContactInput = z.infer<typeof contactInput>;

export const clientInput = z.object({
  name: z.string().trim().min(2).max(160),
  code: z
    .string()
    .trim()
    .regex(/^[A-Z]{2,4}$/, "2–4 capital letters, used in video codes (e.g. KVR)"),
  industry: z.string().trim().max(120).optional(),
  city: z.string().trim().max(80).optional(),
  stage: z.enum(BUSINESS_STAGES).optional(),
  fitment: z.enum(FITMENT_QUADRANTS).optional(),
  whatsappGroupUrl: z.url().optional(),
  contacts: z.array(contactInput).min(1),
});
export type ClientInput = z.infer<typeof clientInput>;

export const packageInput = z.object({
  name: z.string().trim().min(2).max(120),
  monthlyFee: rupees,
  videosPerMonth: z.number().int().min(0).max(200),
  postsPerMonth: z.number().int().min(0).max(500),
  shootDays: z.number().int().min(0).max(31),
  revisionsPerDeliverable: z.number().int().min(0).max(10),
  platforms: z.array(z.enum(PLATFORMS)).default([]),
});
export type PackageInput = z.infer<typeof packageInput>;

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
