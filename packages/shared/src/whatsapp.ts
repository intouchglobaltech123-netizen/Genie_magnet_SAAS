// WhatsApp (P3-07, P3-08): what the app sends, the wording each agency has approved in WhatsApp Manager, and the
// details it enters to connect its own number.
import { z } from "zod";

export interface WhatsAppPurpose {
  label: string;
  /** What fills {{1}}, {{2}}… in order. */
  variables: string[];
  /** Quick-reply buttons, in order. */
  buttons: string[];
  /** Suggested wording to create in WhatsApp Manager (category Utility). */
  suggested: string;
  /** Suggested template name. */
  name: string;
}

export const WHATSAPP_PURPOSES = {
  approval_request: {
    label: "A script or video is ready for the client's approval",
    variables: ["The contact's first name", "What is ready (e.g. the script for “Millet dosa”)", "Their portal link"],
    buttons: ["Approve", "Request changes"],
    suggested: "Hello {{1}}, {{2}} is ready for your approval. See it here: {{3}}",
    name: "approval_request",
  },
  onboarding_reminder: {
    label: "A reminder to finish the onboarding questions",
    variables: ["The contact's first name", "Your agency's name", "Their onboarding link"],
    buttons: [],
    suggested: "Hello {{1}}, a reminder from {{2}} to finish your onboarding questions. It takes a few minutes: {{3}}",
    name: "onboarding_reminder",
  },
  video_published: {
    label: "A video is live",
    variables: ["The contact's first name", "The video", "Where it is live", "The post's link"],
    buttons: [],
    suggested: "Hello {{1}}, {{2}} is now live on {{3}}: {{4}}",
    name: "video_published",
  },
  invoice_issued: {
    label: "An invoice is ready",
    variables: ["The contact's first name", "The invoice number", "The amount", "When it is due", "Their portal link"],
    buttons: [],
    suggested: "Hello {{1}}, invoice {{2}} for {{3}} is ready, due {{4}}. See it here: {{5}}",
    name: "invoice_issued",
  },
  report_ready: {
    label: "The month's report is ready",
    variables: ["The contact's first name", "The month", "Their portal link"],
    buttons: [],
    suggested: "Hello {{1}}, your report for {{2}} is ready: {{3}}",
    name: "report_ready",
  },
} as const satisfies Record<string, WhatsAppPurpose>;
export type WhatsAppPurposeKey = keyof typeof WHATSAPP_PURPOSES;
export const WHATSAPP_PURPOSE_KEYS = Object.keys(WHATSAPP_PURPOSES) as [WhatsAppPurposeKey, ...WhatsAppPurposeKey[]];

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, e.g. 21:00");

/** The details from Meta's WhatsApp Manager. The token and app secret may be left empty to keep the saved ones. */
export const whatsappConnectionInput = z.object({
  phoneNumberId: z
    .string()
    .trim()
    .regex(/^\d{5,30}$/, "The phone number ID is a long number from WhatsApp Manager → API setup"),
  businessId: z
    .string()
    .trim()
    .regex(/^\d{5,30}$/, "The WhatsApp Business account ID is a long number")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  accessToken: z
    .string()
    .trim()
    .min(20, "Paste the permanent access token")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  appSecret: z
    .string()
    .trim()
    .min(16, "Paste the app secret from your Meta app's settings")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  quietFrom: hhmm.default("21:00"),
  quietTo: hhmm.default("08:00"),
});
export type WhatsAppConnectionInput = z.input<typeof whatsappConnectionInput>;

export const whatsappTemplateInput = z.object({
  purpose: z.enum(WHATSAPP_PURPOSE_KEYS),
  name: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{1,512}$/, "Use the template's name exactly as in WhatsApp Manager (small letters, numbers and _)"),
  language: z
    .string()
    .trim()
    .regex(/^[a-z]{2,3}(_[A-Z]{2})?$/, "A language code such as en, en_US or ta")
    .default("en"),
  active: z.boolean().default(true),
});
export type WhatsAppTemplateInput = z.input<typeof whatsappTemplateInput>;

export const whatsappOptIn = z.object({
  optIn: z.boolean(),
  /** How they agreed, e.g. "Said yes on the call". */
  source: z.string().trim().max(200).optional(),
});

export const whatsappTest = z.object({ phone: z.string().trim().min(8, "Enter a phone number with its country code") });

/** A phone number as WhatsApp wants it: digits with the country code (India when only ten digits are given). */
export function waNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "").replace(/^0+/, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

/** The first name, for a friendly greeting. */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;
