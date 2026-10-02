// Goals (P5-13): from the company to each department to each person, each with its measure, target and S.M.A.R.T.
// wording, figures the app knows filled in, check-ins marked breakthrough or breakdown, and the revenue cascade —
// the year's target worked back through the agency's own ratios to the deals, proposals, leads and capacity it needs.
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const day = z.iso.date("Pick the day");

export const GOAL_LEVELS = ["company", "department", "person"] as const;
export type GoalLevel = (typeof GOAL_LEVELS)[number];
export const GOAL_LEVEL_LABEL: Record<GoalLevel, string> = { company: "Company", department: "Department", person: "Person" };

export const GOAL_TYPES = ["financial", "functional", "learning", "operational"] as const;
export type GoalType = (typeof GOAL_TYPES)[number];
export const GOAL_TYPE_LABEL: Record<GoalType, string> = { financial: "Financial", functional: "Functional", learning: "Learning", operational: "Operational" };

export const GOAL_UNITS = ["inr", "pct", "count", "hours", "days"] as const;
export type GoalUnit = (typeof GOAL_UNITS)[number];
export const GOAL_UNIT_LABEL: Record<GoalUnit, string> = { inr: "Rupees", pct: "Percent", count: "Count", hours: "Hours", days: "Days" };

/** The STOP rhythm a goal is reviewed in. */
export const GOAL_CADENCES = ["strategic", "tactical", "operational"] as const;
export type GoalCadence = (typeof GOAL_CADENCES)[number];
export const GOAL_CADENCE_LABEL: Record<GoalCadence, string> = { strategic: "Strategic", tactical: "Tactical", operational: "Operational" };

/** Figures the app knows, from the goal's start to today, so a goal can follow them by itself. */
export const GOAL_METRICS = ["invoiced", "collected", "contracted_monthly", "clients_won", "proposals_sent", "leads", "videos_approved", "headcount"] as const;
export type GoalMetric = (typeof GOAL_METRICS)[number];
export const GOAL_METRIC_LABEL: Record<GoalMetric, { label: string; unit: GoalUnit }> = {
  invoiced: { label: "Invoiced, before GST", unit: "inr" },
  collected: { label: "Money collected", unit: "inr" },
  contracted_monthly: { label: "Running agreements' monthly fees, now", unit: "inr" },
  clients_won: { label: "Proposals accepted (clients won)", unit: "count" },
  proposals_sent: { label: "Proposals sent", unit: "count" },
  leads: { label: "New leads", unit: "count" },
  videos_approved: { label: "Videos the client approved", unit: "count" },
  headcount: { label: "People in the team, now", unit: "count" },
};

export const smartInput = z.object({
  specific: text(500).default(""),
  measurable: text(500).default(""),
  achievable: text(500).default(""),
  relevant: text(500).default(""),
  timeBound: text(500).default(""),
});

export const goalInput = z
  .object({
    parentId: z.uuid().nullable().default(null),
    level: z.enum(GOAL_LEVELS),
    title: text(200).min(3, "Say what the goal is"),
    departmentId: z.uuid().nullable().default(null),
    type: z.enum(GOAL_TYPES).default("functional"),
    ownerIds: z.array(z.string().min(1).max(64)).max(10).default([]),
    /** What is measured, in words. */
    measure: text(200).default(""),
    unit: z.enum(GOAL_UNITS).default("count"),
    baseline: z.number().min(-1e12).max(1e12).default(0),
    target: z.number().min(-1e12).max(1e12),
    /** Entered by hand when the goal does not follow a figure the app knows. */
    actual: z.number().min(-1e12).max(1e12).default(0),
    metric: z.enum(GOAL_METRICS).nullable().default(null),
    startDate: day,
    dueDate: day,
    cadence: z.enum(GOAL_CADENCES).default("tactical"),
    smart: smartInput.default({ specific: "", measurable: "", achievable: "", relevant: "", timeBound: "" }),
  })
  .refine((g) => g.dueDate > g.startDate, { path: ["dueDate"], message: "After the start" })
  .refine((g) => g.target !== g.baseline, { path: ["target"], message: "Different from where it starts" })
  .refine((g) => g.level === "company" || !!g.parentId, { path: ["parentId"], message: "Choose the goal it serves" });
export type GoalInput = z.input<typeof goalInput>;

export const CHECK_IN_KINDS = ["update", "breakthrough", "breakdown"] as const;
export type CheckInKind = (typeof CHECK_IN_KINDS)[number];
export const CHECK_IN_LABEL: Record<CheckInKind, string> = { update: "Update", breakthrough: "Breakthrough", breakdown: "Breakdown" };

export const checkInInput = z.object({
  kind: z.enum(CHECK_IN_KINDS).default("update"),
  note: text(1000).min(2, "Say what happened"),
  /** A new figure, for a goal entered by hand. */
  value: z.number().min(-1e12).max(1e12).optional(),
});
export type CheckInInput = z.input<typeof checkInInput>;

export const GOAL_STATUSES = ["on_track", "at_risk", "off_track", "done"] as const;
export type GoalStatus = (typeof GOAL_STATUSES)[number];
export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = { on_track: "On track", at_risk: "At risk", off_track: "Off track", done: "Done" };

export const goalSettingsInput = z.object({
  /** Progress as a share of where it should be by now: at least this is on track… */
  onTrack: z.number().min(0.5).max(1).default(0.95),
  /** …at least this is at risk; below is off track. */
  atRisk: z.number().min(0.1).max(1).default(0.8),
  /** The month the financial year starts in (4 = April). */
  yearStarts: z.number().int().min(1).max(12).default(4),
});
export type GoalSettings = z.output<typeof goalSettingsInput>;
export const DEFAULT_GOAL_SETTINGS: GoalSettings = goalSettingsInput.parse({});

/** How far from the baseline to the target (0 to 1, and beyond when it is passed). */
export function goalProgress(g: { baseline: number; target: number; actual: number }) {
  return (g.actual - g.baseline) / (g.target - g.baseline);
}

/** Where it should be by today, if it moves evenly from the start to the due day. */
export function expectedProgress(g: { startDate: string; dueDate: string }, today: string) {
  const a = Date.parse(g.startDate);
  const b = Date.parse(g.dueDate);
  const t = Date.parse(today);
  return Math.min(1, Math.max(0, (t - a) / (b - a)));
}

export function goalStatus(
  g: { baseline: number; target: number; actual: number; startDate: string; dueDate: string },
  today: string,
  s: GoalSettings,
): GoalStatus {
  const p = goalProgress(g);
  if (p >= 1) return "done";
  const expected = expectedProgress(g, today);
  // Too early to judge in the first twentieth of its time.
  if (expected < 0.05) return "on_track";
  const ratio = p / expected;
  return ratio >= s.onTrack ? "on_track" : ratio >= s.atRisk ? "at_risk" : "off_track";
}

// ─── The revenue cascade ──────────────────────────────────────────────

export const cascadeInputs = z.object({
  /** The year's revenue target. */
  revenueTarget: z.number().min(0).max(1e11),
  /** Running agreements' fees for a year. */
  baseBook: z.number().min(0).max(1e11),
  /** Share of the book that renews. */
  retention: z.number().min(0).max(1),
  /** Share lost during the year to clients leaving early or paying less. */
  churn: z.number().min(0).max(1),
  /** A new client's fees for a year. */
  avgDeal: z.number().min(1).max(1e10),
  /** Proposals accepted out of those decided. */
  winRate: z.number().min(0.01).max(1),
  /** Leads that get a proposal. */
  proposalRate: z.number().min(0.01).max(1),
  /** What a lead costs in advertising. */
  costPerLead: z.number().min(0).max(1e6),
  /** Capacity: editors, their productive hours a month, editing hours a video, videos a month for a new client. */
  editors: z.number().int().min(0).max(500),
  productiveHours: z.number().min(1).max(400),
  hoursPerVideo: z.number().min(0.1).max(200),
  videosPerClient: z.number().min(0).max(500),
  /** Videos a month promised to the clients there are now. */
  currentLoad: z.number().min(0).max(100000),
});
export type CascadeInputs = z.output<typeof cascadeInputs>;

/** The year's target worked back: what the book keeps, what new sales must bring, and the deals, proposals, leads, ad spend and editing capacity that takes. */
export function cascade(v: CascadeInputs) {
  const kept = v.baseBook * Math.max(0, v.retention - v.churn);
  const newNeeded = Math.max(0, v.revenueTarget - kept);
  const deals = Math.ceil(newNeeded / v.avgDeal);
  const proposals = Math.ceil(deals / v.winRate);
  const leads = Math.ceil(proposals / v.proposalRate);
  const required = Math.round(v.currentLoad * Math.max(0, v.retention - v.churn) + deals * v.videosPerClient);
  const capacity = Math.floor((v.editors * v.productiveHours) / v.hoursPerVideo);
  const hires = Math.max(0, Math.ceil(((required - capacity) * v.hoursPerVideo) / v.productiveHours));
  return {
    kept: Math.round(kept),
    newNeeded: Math.round(newNeeded),
    deals,
    proposals,
    leads,
    leadsPerMonth: Math.ceil(leads / 12),
    adBudget: Math.round(leads * v.costPerLead),
    requiredVideos: required,
    capacity,
    utilisation: capacity ? Math.round((required / capacity) * 100) : null,
    hires,
  };
}

// ─── Rows ─────────────────────────────────────────────────────────────

export interface GoalRow {
  id: string;
  parentId: string | null;
  level: GoalLevel;
  title: string;
  department: { id: string; name: string } | null;
  type: GoalType;
  owners: { id: string; name: string }[];
  measure: string;
  unit: GoalUnit;
  baseline: number;
  target: number;
  actual: number;
  metric: GoalMetric | null;
  startDate: string;
  dueDate: string;
  cadence: GoalCadence;
  smart: z.output<typeof smartInput>;
  progress: number;
  expected: number;
  status: GoalStatus;
  checkIns: { id: string; at: string; by: string; kind: CheckInKind; note: string; value: number | null }[];
}

/** GET /goals/cascade: the inputs as the agency's own history has them, and as last saved. */
export interface CascadeView {
  history: CascadeInputs;
  /** How each historic figure was found, in words. */
  basis: Partial<Record<keyof CascadeInputs, string>>;
  saved: CascadeInputs | null;
}
