// Performance and learning (P5-11): each role's KRAs and the month's scorecard (with figures the app knows filled in),
// the A/B player rating, the leaderboard, learning paths and the skill matrix — all the agency's own.
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
export const performanceMonth = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month like 2026-10");

/** Figures the app works out for a person's month, so nobody types them in. */
export const KRA_METRICS = ["videos_approved", "on_time", "qc_first_pass", "revisions", "shoots_closed", "hours_logged", "attendance"] as const;
export type KraMetric = (typeof KRA_METRICS)[number];
export const KRA_METRIC_LABEL: Record<KraMetric, { label: string; unit: string; lowerIsBetter?: boolean }> = {
  videos_approved: { label: "Videos the client approved (as editor)", unit: "" },
  on_time: { label: "Approved on or before the due day", unit: "%" },
  qc_first_pass: { label: "Passed the quality check first time", unit: "%" },
  revisions: { label: "Client revision rounds per approved video", unit: "", lowerIsBetter: true },
  shoots_closed: { label: "Shoots done (camera or director)", unit: "" },
  hours_logged: { label: "Hours logged on videos and shoots", unit: " h" },
  attendance: { label: "Working days present", unit: "%" },
};

export const kraInput = z.object({
  /** Kept the same when the KRA is renamed, so months compare. */
  key: z.string().min(1).max(40),
  name: text(120).min(2, "Name the KRA"),
  /** How it is measured, in words. */
  measure: text(300).default(""),
  unit: text(10).default(""),
  target: z.number().min(0).max(1_000_000),
  /** Out of 100 across the template. */
  weight: z.number().min(0).max(100),
  lowerIsBetter: z.boolean().default(false),
  /** Filled in by the app from this figure; otherwise the reviewer enters it. */
  metric: z.enum(KRA_METRICS).nullable().default(null),
});
export type Kra = z.output<typeof kraInput>;

export const kraTemplateInput = z
  .object({
    name: text(120).min(2, "Name the template, e.g. Video Editor"),
    kras: z.array(kraInput).min(1, "Add at least one KRA").max(15),
    /** A quality gate: when this KRA's figure is below the threshold, the score is capped. */
    gate: z
      .object({ key: z.string().max(40), threshold: z.number().min(0), cap: z.number().min(0).max(100) })
      .nullable()
      .default(null),
  })
  .refine((t) => Math.round(t.kras.reduce((s, k) => s + k.weight, 0)) === 100, { path: ["kras"], message: "The weights add up to 100" })
  .refine((t) => !t.gate || t.kras.some((k) => k.key === t.gate!.key), { path: ["gate"], message: "Choose one of the KRAs" });
export type KraTemplateInput = z.input<typeof kraTemplateInput>;

/** A KRA in a month's scorecard: its target then, and what was achieved. */
export interface KraLine extends Kra {
  actual: number | null;
  /** Filled in by the app. */
  auto: boolean;
  /** Share of the target achieved, 0 to 1. */
  achieved: number | null;
}

/** How much of a KRA's target was achieved (0 to 1); a lower-is-better KRA counts the target over the actual. */
export function achievedOf(k: { target: number; lowerIsBetter: boolean; actual: number | null }) {
  if (k.actual === null) return null;
  if (k.lowerIsBetter) return k.actual <= 0 ? 1 : Math.min(1, k.target / k.actual);
  return k.target <= 0 ? 1 : Math.min(1, k.actual / k.target);
}

/** The month's score out of 100: each KRA's achievement times its weight; the quality gate caps it. */
export function compositeOf(kras: { key: string; weight: number; target: number; lowerIsBetter: boolean; actual: number | null }[], gate: Gate | null) {
  const raw = Math.round(kras.reduce((s, k) => s + (achievedOf(k) ?? 0) * k.weight, 0) * 10) / 10;
  const g = gate && kras.find((k) => k.key === gate.key);
  const gated = !!g && g.actual !== null && g.actual < gate!.threshold;
  return { raw, score: gated ? Math.min(raw, gate!.cap) : raw, gated };
}
export type Gate = { key: string; threshold: number; cap: number };

export const scorecardLines = z.object({
  /** What was achieved, KRA by KRA (by key), for those the app does not fill in — or to correct one with a note. */
  actuals: z.record(z.string().max(40), z.number().min(0).max(1_000_000).nullable()),
  note: text(2000).default(""),
});

/** A–C, by competence (skill, knowledge) and commitment (self image, motive, trait). */
export const PLAYER_TRAITS = ["skill", "knowledge", "selfImage", "motive", "trait"] as const;
export type PlayerTrait = (typeof PLAYER_TRAITS)[number];
export const PLAYER_TRAIT_LABEL: Record<PlayerTrait, string> = {
  skill: "Skill",
  knowledge: "Knowledge",
  selfImage: "Self image",
  motive: "Motive",
  trait: "Trait",
};
export type Player = "A" | "B_competence" | "B_commitment" | "C";
export const PLAYER_LABEL: Record<Player, { label: string; means: string; action: string }> = {
  A: { label: "A player", means: "Strong on competence and commitment", action: "Keep, stretch, give ownership" },
  B_competence: { label: "B · competence", means: "Skilled, commitment below the bar", action: "Coach on ownership and motivation" },
  B_commitment: { label: "B · commitment", means: "Committed, skill or knowledge below the bar", action: "Train: a learning path and a mentor" },
  C: { label: "C player", means: "Below the bar on both", action: "An improvement plan" },
};

export const performanceSettingsInput = z.object({
  /** A: every rating at least this, or the total at least `aTotal`; competence and commitment each need this too. */
  bar: z.number().int().min(1).max(5).default(4),
  aTotal: z.number().int().min(5).max(25).default(20),
  /** Who sees the leaderboard: managers and HR, or everyone. */
  leaderboard: z.enum(["managers", "everyone"]).default("managers"),
  /** Whether people see their own A–C rating. */
  showOwnRating: z.boolean().default(false),
});
export type PerformanceSettings = z.output<typeof performanceSettingsInput>;
export const DEFAULT_PERFORMANCE: PerformanceSettings = performanceSettingsInput.parse({});

export function playerOf(r: Record<PlayerTrait, number>, s: PerformanceSettings): Player {
  const values = PLAYER_TRAITS.map((k) => r[k]);
  const total = values.reduce((a, b) => a + b, 0);
  const competence = r.skill >= s.bar && r.knowledge >= s.bar;
  const commitment = r.selfImage >= s.bar && r.motive >= s.bar && r.trait >= s.bar;
  if (values.every((v) => v >= s.bar) || total >= s.aTotal) return "A";
  if (competence && !commitment) return "B_competence";
  if (commitment && !competence) return "B_commitment";
  return "C";
}

const rating = z.number().int().min(1, "Rate 1 to 5").max(5, "Rate 1 to 5");
export const playerRatingInput = z.object({
  month: performanceMonth,
  ratings: z.object(Object.fromEntries(PLAYER_TRAITS.map((k) => [k, rating])) as Record<PlayerTrait, typeof rating>),
  note: text(1000).default(""),
});
export type PlayerRatingInput = z.input<typeof playerRatingInput>;

// ─── Learning ─────────────────────────────────────────────────────────

export const learningPathInput = z.object({
  title: text(120).min(2, "Name the path"),
  /** Who it is for, e.g. Video Editor. */
  forRole: text(120).default(""),
  description: text(1000).default(""),
  ownerId: z.string().max(64).nullable().default(null),
  modules: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        title: text(160).min(2, "Name the module"),
        hours: z.number().min(0).max(200).default(1),
        /** Where it is: a course, a video, a document. */
        link: z.url("Enter a full link, starting https://").or(z.literal("")).default(""),
      }),
    )
    .min(1, "Add at least one module")
    .max(40),
});
export type LearningPathInput = z.input<typeof learningPathInput>;

export const SKILL_LEVELS = [0, 1, 2, 3, 4] as const;
export const SKILL_LEVEL_LABEL = ["Not yet", "Learning", "Can do with help", "Can do alone", "Can teach"] as const;

// ─── Rows ─────────────────────────────────────────────────────────────

export interface KraTemplateRow {
  id: string;
  name: string;
  kras: Kra[];
  gate: Gate | null;
  people: { id: string; name: string }[];
}

/** GET /performance/team (one item): a person the signed-in reviewer looks after, and their month. */
export interface TeamMemberRow {
  user: { id: string; name: string };
  designation: string | null;
  template: { id: string; name: string } | null;
  scorecard: { id: string; status: "draft" | "shared"; score: number } | null;
  player: Player | null;
}

export interface MonthScorecardRow {
  id: string;
  month: string;
  user: { id: string; name: string };
  template: string;
  kras: KraLine[];
  gate: Gate | null;
  raw: number;
  score: number;
  gated: boolean;
  status: "draft" | "shared";
  reviewer: { id: string; name: string } | null;
  note: string;
  /** What the person said about it. */
  reply: string | null;
  sharedAt: string | null;
}

export interface LeaderboardRow {
  rank: number;
  user: { id: string; name: string };
  template: string;
  score: number;
  /** The change from the month before, when there was a score. */
  change: number | null;
}

export interface PlayerRatingRow {
  user: { id: string; name: string };
  month: string;
  ratings: Record<PlayerTrait, number>;
  player: Player;
  note: string;
  ratedBy: string | null;
}

export interface LearningPathRow {
  id: string;
  title: string;
  forRole: string;
  description: string;
  owner: { id: string; name: string } | null;
  modules: { key: string; title: string; hours: number; link: string }[];
  hours: number;
  assigned: number;
  completed: number;
}

export interface LearningAssignmentRow {
  id: string;
  user: { id: string; name: string };
  path: { id: string; title: string };
  done: string[];
  progress: number;
  assignedAt: string;
  completedAt: string | null;
}

export interface SkillMatrix {
  skills: { id: string; name: string; group: string }[];
  people: { id: string; name: string; levels: Record<string, number> }[];
}
