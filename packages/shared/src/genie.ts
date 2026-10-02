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
