// The sales pipeline (P1-14) and activities (P1-15). Each agency edits its own open stages; Won and Lost are fixed.
import { z } from "zod";

export const STAGE_KINDS = ["open", "won", "lost"] as const;
export type StageKind = (typeof STAGE_KINDS)[number];

export interface StageDefinition {
  key: string;
  name: string;
  kind: StageKind;
  /** Chance of winning at this stage, 0–100 (weighted pipeline). */
  probability: number;
}

/** Growth OS starting pipeline, copied into each new agency. */
export const DEFAULT_PIPELINE_STAGES: StageDefinition[] = [
  { key: "new", name: "New", kind: "open", probability: 5 },
  { key: "contacted", name: "Contacted", kind: "open", probability: 10 },
  { key: "qualified", name: "Qualified", kind: "open", probability: 25 },
  { key: "discovery", name: "Discovery", kind: "open", probability: 40 },
  { key: "proposal", name: "Proposal", kind: "open", probability: 55 },
  { key: "negotiation", name: "Negotiation", kind: "open", probability: 75 },
  { key: "won", name: "Won", kind: "won", probability: 100 },
  { key: "lost", name: "Lost", kind: "lost", probability: 0 },
];

/**
 * Settings → Pipeline: the open stages in order. A stage that keeps its `key` is renamed in place; one without a key
 * is new; one left out is removed (only when no lead is in it). Won and Lost are not part of this list.
 */
export const pipelineInput = z.object({
  stages: z
    .array(
      z.object({
        key: z.string().max(60).optional(),
        name: z.string().trim().min(1, "Name the stage").max(40, "Keep it under 40 characters"),
        probability: z.number().int().min(0, "0 to 99").max(99, "0 to 99 — only Won is 100"),
      }),
    )
    .min(1, "Keep at least one open stage")
    .max(12, "At most 12 open stages"),
});
export type PipelineInput = z.infer<typeof pipelineInput>;

/** Where leads come from; an agency can type its own. */
export const LEAD_SOURCES = ["Referral", "Instagram", "Meta Ads", "Google Ads", "Website", "WhatsApp", "BNI", "Event", "Walk-in", "Cold call"] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep it under ${max} characters`)
    .transform((v) => v || undefined)
    .optional();

export const leadInput = z.object({
  name: z.string().trim().min(2, "Enter the person's name (at least 2 characters)").max(120),
  company: optionalText(160),
  phone: z
    .string()
    .trim()
    .regex(/^(\+?[0-9 ]{10,16})?$/, "Enter a phone number with country code, e.g. +91 98400 11001")
    .transform((v) => v || undefined)
    .optional(),
  email: z
    .union([z.literal(""), z.email("Enter a valid email address")])
    .transform((v) => v || undefined)
    .optional(),
  source: z.string().trim().min(1, "Where did this lead come from?").max(60),
  /** Stage key; the first open stage when left out. */
  stage: z.string().max(60).optional(),
  /** Expected monthly value in whole rupees. */
  value: z.number().int("Whole rupees only").min(0).max(100_000_000).default(0),
  /** Who follows it up (a team member's id); the person adding it when left out. */
  ownerId: z.string().max(64).optional(),
  nextFollowUp: z.iso.date("Pick a date").optional(),
  notes: optionalText(2000),
});
export type LeadInput = z.input<typeof leadInput>;

export const leadUpdate = leadInput.partial().extend({
  nextFollowUp: z.iso.date("Pick a date").nullable().optional(),
  lostReason: optionalText(300),
});
export type LeadUpdate = z.input<typeof leadUpdate>;

export const ACTIVITY_KINDS = ["call", "meeting", "whatsapp", "email", "note"] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];

export const activityInput = z.object({
  kind: z.enum(ACTIVITY_KINDS),
  summary: z.string().trim().min(2, "Say what happened").max(2000),
  outcome: optionalText(300),
  /** When it happened (ISO date-time); now when left out. */
  at: z.iso.datetime({ offset: true }).optional(),
  /** Sets the lead's next follow-up at the same time. */
  nextFollowUp: z.iso.date("Pick a date").optional(),
});
export type ActivityInput = z.input<typeof activityInput>;

// ─── Proposals and winning the deal (P1-16, P1-17) ────────────────────

export const PROPOSAL_STATUSES = ["pending_approval", "approved", "rejected", "sent", "accepted", "declined"] as const;
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

/** Fee a month after a discount, in whole rupees. */
export const discountedFee = (listFee: number, discountPercent: number) => Math.round((listFee * (100 - discountPercent)) / 100);

export const proposalInput = z.object({
  packageId: z.uuid("Choose a package"),
  discountPercent: z.number().int("Whole percent only").min(0).max(90, "At most 90%"),
  months: z.number().int().min(1, "At least 1 month").max(60, "At most 60 months"),
  notes: optionalText(1000),
});
export type ProposalInput = z.input<typeof proposalInput>;

export const proposalApproval = z.object({ note: optionalText(500) });
export const proposalRejection = z.object({ note: z.string().trim().min(2, "Say why, so the salesperson knows what to change").max(500) });
export const proposalAnswer = z.object({ accepted: z.boolean(), note: optionalText(500) });
export type ProposalAnswer = z.input<typeof proposalAnswer>;
