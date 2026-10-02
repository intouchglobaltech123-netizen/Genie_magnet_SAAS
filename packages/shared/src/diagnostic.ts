// The business diagnostic (P5-18): the BFA scorecard and founder dependency from the agency questionnaire (and taken
// again over time), the client fitment map and each client's health, the Strategic Road Map, and the scenario planner.
import { z } from "zod";
import { BUSINESS_FUNCTIONS, FITMENT_QUADRANTS, type FitmentQuadrant } from "./enums.js";

const text = (max: number) => z.string().trim().max(max);
const month = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use a month like 2026-10");

// ─── BFA ──────────────────────────────────────────────────────────────

export const BFA_ACTIONS = ["Hire", "Develop", "Delegate", "Outsource", "Do it yourself"] as const;

export const bfaRow = z.object({
  function: text(80).min(1),
  consistent: z.boolean().nullable().default(null),
  ownerDependent: z.boolean().nullable().default(null),
  results: z.enum(["High", "Low"]).nullable().default(null),
  leader: z.boolean().nullable().default(null),
  action: text(40).nullable().default(null),
});
export type BfaRow = z.output<typeof bfaRow>;

export const diagnosticInput = z.object({
  rows: z.array(bfaRow).min(1).max(20),
  challenges: z
    .array(z.object({ function: text(80).min(1), challenge: text(500).default(""), rating: z.number().int().min(0).max(10).nullable().default(null) }))
    .max(20)
    .default([]),
  /** What is working, and what is not. */
  notes: text(4000).default(""),
});
export type DiagnosticInput = z.input<typeof diagnosticInput>;

/** A function's score out of 4: done consistently, not dependent on the owner, high results, a second-line leader. */
export function bfaPoints(r: BfaRow) {
  return (r.consistent ? 1 : 0) + (r.ownerDependent === false ? 1 : 0) + (r.results === "High" ? 1 : 0) + (r.leader ? 1 : 0);
}

/** The scorecard: each function as a percentage, the whole, and how much rests on the founder. */
export function bfaScores(rows: BfaRow[]) {
  const answered = rows.filter((r) => r.consistent !== null || r.ownerDependent !== null || r.results !== null || r.leader !== null);
  const functions = rows.map((r) => ({ function: r.function, points: bfaPoints(r), percent: Math.round((bfaPoints(r) / 4) * 100) }));
  const overall = answered.length ? Math.round((answered.reduce((s, r) => s + bfaPoints(r), 0) / (answered.length * 4)) * 100) : null;
  // On the owner with no second line counts fully; on the owner with a second line, half.
  const dependent = answered.filter((r) => r.ownerDependent !== null);
  const founderDependency = dependent.length
    ? Math.round((dependent.reduce((s, r) => s + (r.ownerDependent ? (r.leader ? 0.5 : 1) : 0), 0) / dependent.length) * 100)
    : null;
  return { functions, overall, founderDependency };
}

// ─── Clients ──────────────────────────────────────────────────────────

/** Where a client sits: return (its monthly fee) against effort (hours a month), each against the agency's median. */
export function fitmentOf(fee: number, hours: number, medianFee: number, medianHours: number): FitmentQuadrant {
  const highReturn = fee >= medianFee;
  const highEffort = hours > medianHours;
  return highReturn ? (highEffort ? "Bread-winning" : "Amazing") : highEffort ? "Dangerous" : "Convenience";
}

export const FITMENT_MEANING: Record<FitmentQuadrant, string> = {
  Amazing: "High return for little effort — keep and grow",
  "Bread-winning": "High return, high effort — keep, and make it easier to serve",
  Convenience: "Little return, little effort — fine while it stays easy",
  Dangerous: "Little return for high effort — reprice or let go",
};
export { FITMENT_QUADRANTS };

export interface HealthParts {
  /** Approved on or before the due day, last 90 days (out of 30). */
  delivery: number;
  /** Revision rounds per approved video (out of 20). */
  revisions: number;
  /** Paying on time (out of 25). */
  payments: number;
  /** The agreement running, due for renewal or paused (out of 15). */
  agreement: number;
  /** Onboarding finished (out of 10). */
  onboarding: number;
}

/** A client's health out of 100, from what the agency already records. */
export function healthOf(f: {
  onTimeShare: number | null;
  revisionsPerVideo: number | null;
  daysOverdue: number;
  agreement: "running" | "renewal_due" | "paused" | "none";
  onboarded: boolean;
}): { score: number; parts: HealthParts } {
  const parts: HealthParts = {
    delivery: Math.round(30 * (f.onTimeShare ?? 1)),
    revisions: f.revisionsPerVideo === null ? 20 : Math.round(20 * Math.max(0, Math.min(1, (3 - f.revisionsPerVideo) / 2))),
    payments: f.daysOverdue <= 0 ? 25 : f.daysOverdue <= 15 ? 15 : f.daysOverdue <= 30 ? 8 : 0,
    agreement: { running: 15, renewal_due: 8, paused: 0, none: 0 }[f.agreement],
    onboarding: f.onboarded ? 10 : 0,
  };
  return { score: Object.values(parts).reduce((s, n) => s + n, 0), parts };
}

// ─── Road map ─────────────────────────────────────────────────────────

export const ROAD_MAP_STATUSES = ["planned", "in_progress", "done", "dropped"] as const;
export type RoadMapStatus = (typeof ROAD_MAP_STATUSES)[number];
export const ROAD_MAP_STATUS_LABEL: Record<RoadMapStatus, string> = { planned: "Planned", in_progress: "Under way", done: "Done", dropped: "Dropped" };

export const roadMapInput = z
  .object({
    function: text(80).min(1, "Choose the function"),
    title: text(200).min(3, "Say what will be done"),
    detail: text(2000).default(""),
    startMonth: month,
    endMonth: month,
    ownerId: z.string().max(64).nullable().default(null),
    status: z.enum(ROAD_MAP_STATUSES).default("planned"),
    /** 1 (low) to 10 (high). */
    priority: z.number().int().min(1).max(10).default(5),
    goalId: z.uuid().nullable().default(null),
  })
  .refine((r) => r.endMonth >= r.startMonth, { path: ["endMonth"], message: "Not before the start" });
export type RoadMapInput = z.input<typeof roadMapInput>;

// ─── Scenarios ────────────────────────────────────────────────────────

export const scenarioInputs = z.object({
  months: z.number().int().min(1).max(36).default(12),
  startClients: z.number().int().min(0).max(10000),
  avgFee: z.number().min(0).max(1e9),
  /** A rise in fees each year, as a share (0.1 = 10%), applied from month 13. */
  feeRise: z.number().min(0).max(2).default(0),
  newClientsPerMonth: z.number().min(0).max(1000),
  /** Share of clients leaving each month. */
  churnPerMonth: z.number().min(0).max(1),
  teamCostPerMonth: z.number().min(0).max(1e10),
  overheadPerMonth: z.number().min(0).max(1e10),
  adSpendPerMonth: z.number().min(0).max(1e10).default(0),
  /** People added along the way: the month they join (1 = the first) and what they cost a month. */
  hires: z
    .array(z.object({ month: z.number().int().min(1).max(36), cost: z.number().min(0).max(1e8) }))
    .max(50)
    .default([]),
});
export type ScenarioInputs = z.output<typeof scenarioInputs>;

export const scenarioInput = z.object({ name: text(120).min(2, "Name the scenario"), inputs: scenarioInputs });
export type ScenarioInput = z.input<typeof scenarioInput>;

/** Month by month: clients, revenue, costs and profit, and the totals. */
export function project(v: ScenarioInputs) {
  const rows: { month: number; clients: number; revenue: number; costs: number; profit: number }[] = [];
  let clients = v.startClients;
  for (let m = 1; m <= v.months; m++) {
    clients = clients * (1 - v.churnPerMonth) + v.newClientsPerMonth;
    const fee = v.avgFee * (1 + v.feeRise) ** Math.floor((m - 1) / 12);
    const hired = v.hires.filter((h) => h.month <= m).reduce((s, h) => s + h.cost, 0);
    const revenue = Math.round(clients * fee);
    const costs = Math.round(v.teamCostPerMonth + hired + v.overheadPerMonth + v.adSpendPerMonth);
    rows.push({ month: m, clients: Math.round(clients * 10) / 10, revenue, costs, profit: revenue - costs });
  }
  const revenue = rows.reduce((s, r) => s + r.revenue, 0);
  const costs = rows.reduce((s, r) => s + r.costs, 0);
  const firstProfitable = rows.find((r) => r.profit > 0)?.month ?? null;
  return { rows, revenue, costs, profit: revenue - costs, margin: revenue ? Math.round(((revenue - costs) / revenue) * 1000) / 10 : null, firstProfitable };
}

// ─── Rows ─────────────────────────────────────────────────────────────

export interface DiagnosticView {
  /** The latest taken; or, before any, what the agency questionnaire says. */
  current: {
    id: string | null;
    takenAt: string | null;
    source: "questionnaire" | "review";
    rows: BfaRow[];
    challenges: z.output<typeof diagnosticInput>["challenges"];
    notes: string;
  } | null;
  scores: ReturnType<typeof bfaScores> | null;
  history: { id: string; takenAt: string; overall: number | null; founderDependency: number | null }[];
  functions: readonly string[];
}

export interface ClientDiagnosticRow {
  client: { id: string; name: string; code: string };
  fee: number;
  hours: number;
  suggested: FitmentQuadrant;
  fitment: FitmentQuadrant | null;
  health: { score: number; parts: HealthParts };
}

export interface RoadMapRow extends Omit<z.output<typeof roadMapInput>, "ownerId" | "goalId"> {
  id: string;
  owner: { id: string; name: string } | null;
  goal: { id: string; title: string } | null;
}

export interface ScenarioRow {
  id: string;
  name: string;
  inputs: ScenarioInputs;
  updatedAt: string;
}

export const DIAGNOSTIC_FUNCTIONS = BUSINESS_FUNCTIONS;
