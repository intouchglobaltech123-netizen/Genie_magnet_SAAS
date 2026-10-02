// Genie Assistant (Phase 4, ADR 0008). Rules are plain code over the agency's own data: they find what has slipped
// and raise an insight for whoever should act. Each agency switches rules on or off and sets their thresholds.
import { z } from "zod";
import type { AreaKey } from "./permissions.js";

export interface GenieRuleDefinition {
  label: string;
  /** What it looks for, in the agency's words. */
  description: string;
  threshold: { label: string; default: number; min: number; max: number; unit: string };
  /** People with at least this access to the area see its insights (only their own when their role is limited to its own work). */
  area: AreaKey;
  level: "view" | "edit" | "approve";
}

export const GENIE_RULES = {
  video_stuck: {
    label: "Video stuck",
    description: "A video has stayed in one step — shot, editing, the quality check or a revision — for too long.",
    threshold: { label: "Days in one step", default: 3, min: 1, max: 30, unit: "days" },
    area: "production",
    level: "view",
  },
  revision_loop: {
    label: "Revision loop",
    description: "A video has used more revisions than its agreement allows.",
    threshold: { label: "Revisions over the allowance before it shows", default: 0, min: 0, max: 5, unit: "revisions" },
    area: "production",
    level: "view",
  },
  client_waiting: {
    label: "Client waiting",
    description: "A topic list, script or video has waited on the client for too long.",
    threshold: { label: "Days waiting", default: 2, min: 1, max: 30, unit: "days" },
    area: "clients",
    level: "edit",
  },
  behind_quota: {
    label: "Behind quota",
    description: "From this day of the month, a client's month is more than half short of what was promised.",
    threshold: { label: "From day of the month", default: 15, min: 1, max: 28, unit: "day" },
    area: "production",
    level: "view",
  },
  report_due: {
    label: "Report due",
    description: "Last month's report for a client with a running agreement is not released yet.",
    threshold: { label: "By day of the month", default: 5, min: 1, max: 28, unit: "day" },
    area: "reports",
    level: "edit",
  },
  invoice_overdue: {
    label: "Invoice overdue",
    description: "An issued invoice is past its due date and not paid.",
    threshold: { label: "Days past due", default: 1, min: 0, max: 90, unit: "days" },
    area: "invoices",
    level: "view",
  },
  editor_load: {
    label: "Editor load",
    description: "An editor has more videos in hand than they can take.",
    threshold: { label: "Videos in hand", default: 8, min: 2, max: 50, unit: "videos" },
    area: "production",
    level: "approve",
  },
  shoot_readiness: {
    label: "Shoot readiness",
    description: "A shoot is coming up without a camera person, or its kit is not packed the day before.",
    threshold: { label: "Days before the shoot", default: 2, min: 1, max: 14, unit: "days" },
    area: "production",
    level: "view",
  },
  client_health: {
    label: "Client health",
    description: "A client's health score has dropped below this.",
    threshold: { label: "Health below", default: 60, min: 10, max: 95, unit: "score" },
    area: "clients",
    level: "edit",
  },
  onboarding_incomplete: {
    label: "Onboarding incomplete",
    description: "A client's onboarding is still not finished this many days after its window ended.",
    threshold: { label: "Days after the window", default: 0, min: 0, max: 30, unit: "days" },
    area: "onboarding",
    level: "view",
  },
} as const satisfies Record<string, GenieRuleDefinition>;

export type GenieRuleKey = keyof typeof GENIE_RULES;
export const GENIE_RULE_KEYS = Object.keys(GENIE_RULES) as [GenieRuleKey, ...GenieRuleKey[]];

export const INSIGHT_SEVERITIES = ["info", "warning", "critical"] as const;
export type InsightSeverity = (typeof INSIGHT_SEVERITIES)[number];

/** Open until someone marks it done or dismisses it; resolved by itself when the rule no longer finds it. */
export const INSIGHT_STATUSES = ["open", "done", "dismissed", "resolved"] as const;
export type InsightStatus = (typeof INSIGHT_STATUSES)[number];

export interface GenieRuleSetting {
  enabled: boolean;
  threshold: number;
}

/** Each rule as the agency set it, with the defaults for anything it has not changed. */
export function genieRuleSettings(saved: Partial<Record<string, Partial<GenieRuleSetting>>> | null | undefined): Record<GenieRuleKey, GenieRuleSetting> {
  return Object.fromEntries(
    GENIE_RULE_KEYS.map((k) => {
      const s = saved?.[k] ?? {};
      const t = GENIE_RULES[k].threshold;
      const threshold = typeof s.threshold === "number" && s.threshold >= t.min && s.threshold <= t.max ? s.threshold : t.default;
      return [k, { enabled: s.enabled ?? true, threshold }];
    }),
  ) as Record<GenieRuleKey, GenieRuleSetting>;
}

export const genieRulesInput = z.object({
  rules: z.partialRecord(z.enum(GENIE_RULE_KEYS), z.object({ enabled: z.boolean(), threshold: z.number().int("Whole numbers only").min(0).max(365) })),
});
export type GenieRulesInput = z.infer<typeof genieRulesInput>;

export const insightDecisionInput = z.object({ status: z.enum(["done", "dismissed", "open"]) });

/** GET /genie/settings */
export interface GenieSettings {
  rules: Record<GenieRuleKey, GenieRuleSetting>;
  /** When the rules last looked at the agency's data. */
  lastRunAt: string | null;
  ai: {
    /** Switched on by the agency. */
    enabled: boolean;
    /** Rupees a month. */
    monthlyBudget: number;
    retentionDays: number;
    /**
     * "claude" on a server with our Anthropic key; "stand-in" on development and test servers (drafts are made up, so
     * screens can be tried); "off" on a real server without the key yet.
     */
    source: "claude" | "stand-in" | "off";
    /** Rupees so far this month. */
    spentThisMonth: number;
  };
}

/** GET /genie/insights (one item) */
export interface InsightRow {
  id: string;
  rule: GenieRuleKey;
  severity: InsightSeverity;
  title: string;
  body: string | null;
  link: string | null;
  client: { id: string; name: string; code: string } | null;
  owner: { id: string; name: string | null } | null;
  status: InsightStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
}

// ─── Drafts (P4-05 to P4-07) ─────────────────────────────────────────

/** What Genie Assistant drafts: a WhatsApp nudge to a client, a caption for an approved video, content ideas, a report's summary. */
export const DRAFT_KINDS = ["nudge", "caption", "ideas", "report_summary"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];
export const DRAFT_KIND_LABEL: Record<DraftKind, string> = {
  nudge: "WhatsApp nudge",
  caption: "Caption",
  ideas: "Content ideas",
  report_summary: "Report summary",
};

/** The shapes the model writes (kept simple for structured output); the app checks lengths when a person approves. */
export const nudgeDraft = z.object({ message: z.string() });
export const captionDraft = z.object({ caption: z.string(), hashtags: z.array(z.string()), thumbnailText: z.string() });
export const ideasDraft = z.object({ ideas: z.array(z.object({ title: z.string(), pillar: z.string(), format: z.string(), why: z.string() })) });
export const reportSummaryDraft = z.object({ note: z.string() });
export type NudgeDraft = z.infer<typeof nudgeDraft>;
export type CaptionDraft = z.infer<typeof captionDraft>;
export type IdeasDraft = z.infer<typeof ideasDraft>;
export type ReportSummaryDraft = z.infer<typeof reportSummaryDraft>;
export type DraftOutput = NudgeDraft | CaptionDraft | IdeasDraft | ReportSummaryDraft;

/** What a person may approve, after their edits. */
export const DRAFT_FINAL: Record<DraftKind, z.ZodType> = {
  nudge: z.object({ message: z.string().trim().min(1, "Write the message").max(1000, "Keep it under 1,000 characters") }),
  caption: z.object({
    caption: z.string().trim().min(1, "Write the caption").max(2200, "Instagram allows 2,200 characters"),
    hashtags: z
      .array(
        z
          .string()
          .trim()
          .regex(/^#?[\p{L}\p{N}_]+$/u, "One word per hashtag")
          .max(60),
      )
      .max(30, "At most 30 hashtags"),
    thumbnailText: z.string().trim().max(80, "Keep it under 80 characters"),
  }),
  ideas: z.object({
    ideas: z
      .array(
        z.object({
          title: z.string().trim().min(2).max(160),
          pillar: z.string().trim().max(60),
          format: z.string().trim().max(40),
          why: z.string().trim().max(400),
        }),
      )
      .min(1, "Keep at least one idea")
      .max(10),
  }),
  report_summary: z.object({ note: z.string().trim().min(1, "Write the summary").max(2000, "Keep it under 2,000 characters") }),
};

const notes = z.string().trim().max(500, "Keep it under 500 characters").optional();
export const draftRequest = z.discriminatedUnion("kind", [
  /** About an insight (to whoever should act, or the client when it is about their side), or simply to a client. */
  z.object({ kind: z.literal("nudge"), insightId: z.uuid().optional(), clientId: z.uuid().optional(), contactId: z.uuid().optional(), notes }),
  z.object({ kind: z.literal("caption"), videoId: z.uuid(), platform: z.string().max(20).optional(), notes }),
  z.object({
    kind: z.literal("ideas"),
    clientId: z.uuid(),
    month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick the month"),
    count: z.number().int().min(1).max(8).default(5),
    notes,
  }),
  z.object({ kind: z.literal("report_summary"), reportId: z.uuid(), notes }),
]);
export type DraftRequest = z.input<typeof draftRequest>;

export const draftDecision = z.object({
  status: z.enum(["approved", "rejected"]),
  /** The draft as the person left it; the model's version when not given. */
  final: z.record(z.string(), z.unknown()).optional(),
});

export const aiSettingsInput = z.object({
  aiEnabled: z.boolean().optional(),
  monthlyBudget: z.number().int("Whole rupees").min(0).max(10_000_000).optional(),
  retentionDays: z.number().int().min(7, "At least 7 days").max(730, "At most 2 years").optional(),
});
export type AiSettingsInput = z.infer<typeof aiSettingsInput>;

/** GET /genie/drafts (one item) and the result of drafting. */
export interface DraftRow {
  id: string;
  kind: DraftKind;
  status: "draft" | "approved" | "rejected";
  entity: string;
  entityId: string;
  client: { id: string; name: string } | null;
  output: DraftOutput;
  final: DraftOutput | null;
  editedPct: number | null;
  /** "stand-in" when the model is not switched on for this server. */
  source: "claude" | "stand-in";
  createdBy: { id: string; name: string | null } | null;
  createdAt: string;
  decidedAt: string | null;
}

/** GET /genie/usage: this month's AI usage against the agency's budget. */
export interface AiUsageSummary {
  month: string;
  /** Rupees. */
  spent: number;
  budget: number;
  calls: number;
  byFeature: { feature: string; calls: number; spent: number }[];
  byPerson: { name: string | null; calls: number; spent: number }[];
  /** Drafts decided this month: approved as written, approved with edits, rejected. */
  drafts: { approved: number; edited: number; rejected: number };
  /** Per kind of draft: how many were approved (as written or edited) out of those decided, against the target. */
  byKind: { kind: DraftKind; decided: number; approved: number; rate: number }[];
  /** The approval rate drafts should reach (P4-11). */
  target: number;
}

// ─── Ask Genie (P4-08) ───────────────────────────────────────────────

export const askInput = z.object({
  question: z.string().trim().min(2, "Ask a question").max(1000, "Keep it under 1,000 characters"),
  /** Carries on an earlier conversation. */
  conversationId: z.uuid().optional(),
});
export type AskInput = z.infer<typeof askInput>;

export interface AskSource {
  label: string;
  /** A page in the app, e.g. /app/production/… */
  href: string;
}

export interface AskMessageRow {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources: AskSource[];
  createdAt: string;
}

/** POST /genie/ask and GET /genie/conversations/:id */
export interface AskConversationRow {
  id: string;
  title: string;
  updatedAt: string;
  messages: AskMessageRow[];
}

// ─── Evaluation (P4-11) ──────────────────────────────────────────────

/** The approval rate Genie Assistant's drafts should reach. */
export const DRAFT_APPROVAL_TARGET = 70;

export const evaluationInput = z.object({ size: z.number().int().min(1).max(10).default(5) });

/** POST /genie/evaluate: captions drafted for posts the agency already published, against the captions it approved. */
export interface GenieEvaluation {
  kind: "caption";
  items: { code: string; title: string; client: string; approved: string; draft: string; match: number }[];
  /** 0 to 100: how much of the approved wording the drafts had, on average. */
  averageMatch: number | null;
  source: "claude" | "stand-in" | "off";
}
