// Goals mock data — Genie Magnet, FY 2026-27 (Apr–Mar). "Today" is 25 Sep 2026.
// The whole goal tree lives in ONE array (GOALS) so the structure can be re-shaped quickly
// once the founder walks us through his exact S.M.A.R.T. / STOP / BT-BD system.

import { TODAY } from "@/lib/mock/core";
import { BUSINESS_ASPIRATION, ytd } from "@/lib/mock/finance";
import { inrCompact } from "@/lib/utils";

const L = 100_000;

// ───────────────────────────── Config ─────────────────────────────

export const GOAL_TYPES = {
  financial: { label: "Financial", tone: "gold" },
  functional: { label: "Functional", tone: "info" },
  learning: { label: "Learning", tone: "accent" },
  operational: { label: "Operational", tone: "neutral" },
} as const;
export type GoalType = keyof typeof GOAL_TYPES;

export const GOAL_DEPARTMENTS = ["Company", "Sales", "Marketing", "Production", "HR", "Finance"] as const;
export type GoalDept = (typeof GOAL_DEPARTMENTS)[number];

/** STOP review cadences */
export const CADENCES = {
  strategic: { label: "Strategic", every: "45-day", next: "2026-10-14" },
  tactical: { label: "Tactical", every: "14-day", next: "2026-10-07" },
  operational: { label: "Operational", every: "Daily", next: "2026-09-26" },
} as const;
export type Cadence = keyof typeof CADENCES;

export const GOAL_STATUS = {
  "on-track": { label: "On track", tone: "success" },
  "at-risk": { label: "At risk", tone: "warning" },
  "off-track": { label: "Off track", tone: "danger" },
} as const;
export type GoalStatus = keyof typeof GOAL_STATUS;

/** Status thresholds: progress ÷ expected progress (time elapsed or planned-to-date) */
export const STATUS_THRESHOLDS = { onTrack: 0.95, atRisk: 0.8 };

export type GoalUnit = "inr" | "pct" | "count" | "hours" | "days";

export interface GoalSource {
  kind: "linked" | "manual";
  /** e.g. "CRM · Won deals" */
  label: string;
  syncedAt?: string; // "2026-09-25T09:10"
  reason?: string;
  /** The connected-record label to fall back to when a manual override is removed */
  linkedLabel?: string;
}

export interface GoalAudit {
  at: string;
  by: string;
  text: string;
}

export type CheckInKind = "update" | "breakthrough" | "breakdown";

export interface CheckIn {
  id: string;
  date: string;
  by: string; // person id
  kind: CheckInKind;
  note: string;
  value?: number;
}

export interface Smart {
  specific: string;
  measurable: string;
  achievable: string;
  relevant: string;
  timeBound: string;
}

export interface Goal {
  id: string;
  parentId: string | null;
  level: "company" | "department" | "individual";
  title: string;
  department: GoalDept;
  type: GoalType;
  ownerIds: string[];
  ownerNote?: string;
  metric: string;
  unit: GoalUnit;
  baseline: number;
  target: number;
  actual: number;
  /** Planned value by today when the plan is not linear (e.g. back-loaded revenue). */
  expectedNow?: number;
  startDate: string;
  dueDate: string;
  cadence: Cadence;
  source: GoalSource;
  smart: Smart;
  checkIns: CheckIn[];
  audit: GoalAudit[];
}

// ───────────────────────────── Helpers ─────────────────────────────

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Deterministic formatter (no timezone surprises): "2026-09-25T09:10" → "25 Sep, 09:10" */
export function fmtStamp(s: string, withYear = false) {
  const [d, t] = s.split("T");
  const [y, m, day] = d!.split("-");
  const date = `${Number(day)} ${MONTHS[Number(m) - 1]}${withYear ? ` ${y}` : ""}`;
  return t ? `${date}, ${t.slice(0, 5)}` : date;
}

export function nowStamp() {
  const n = new Date();
  return `${TODAY}T${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function dayNum(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y!, m! - 1, d!) / 86_400_000;
}

export function daysLeft(g: Goal) {
  return dayNum(g.dueDate) - dayNum(TODAY);
}

export function fmtValue(v: number, unit: GoalUnit) {
  switch (unit) {
    case "inr":
      return inrCompact(v);
    case "pct":
      return `${Number(v.toFixed(1))}%`;
    case "hours":
      return `${Number(v.toFixed(1))}h`;
    case "days":
      return `${Math.round(v)} days`;
    default:
      return Math.round(v).toLocaleString("en-IN");
  }
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));

/** 0..1 — works for "lower is better" goals too (target < baseline). */
export function goalProgress(g: Pick<Goal, "baseline" | "target" | "actual">) {
  const span = g.target - g.baseline;
  if (span === 0) return 1;
  return clamp((g.actual - g.baseline) / span);
}

export function timeElapsed(g: Pick<Goal, "startDate" | "dueDate">) {
  const s = dayNum(g.startDate);
  const e = dayNum(g.dueDate);
  return clamp((dayNum(TODAY) - s) / Math.max(1, e - s));
}

export function expectedProgress(g: Pick<Goal, "baseline" | "target" | "expectedNow" | "startDate" | "dueDate">) {
  if (g.expectedNow !== undefined) {
    const span = g.target - g.baseline;
    return span === 0 ? 1 : clamp((g.expectedNow - g.baseline) / span);
  }
  return timeElapsed(g);
}

export function goalStatus(g: Pick<Goal, "baseline" | "target" | "actual" | "expectedNow" | "startDate" | "dueDate">): GoalStatus {
  const p = goalProgress(g);
  if (p >= 1) return "on-track";
  const ratio = p / Math.max(0.05, expectedProgress(g));
  if (ratio >= STATUS_THRESHOLDS.onTrack) return "on-track";
  if (ratio >= STATUS_THRESHOLDS.atRisk) return "at-risk";
  return "off-track";
}

// ───────────────────────────── Business Aspiration ─────────────────────────────

export const ASPIRATION = (() => {
  const q1Actual = 24.6 * L;
  const q2Actual = 27.2 * L; // Jul 9.1 + Aug 9.4 + Sep MTD 8.7
  const quarters = BUSINESS_ASPIRATION.quarters.map((q) => {
    if (q.q === "Q1") return { ...q, actual: q1Actual, state: "done" as const };
    if (q.q === "Q2") return { ...q, actual: q2Actual, state: "in-progress" as const };
    return { ...q, actual: 0, state: "upcoming" as const };
  });
  return {
    ...BUSINESS_ASPIRATION,
    quarters,
    ytdRevenue: ytd.revenue,
    ytdGoal: ytd.goal,
    ytdMargin: ytd.margin,
    ytdExpense: ytd.expense,
  };
})();

// ───────────────────────────── The goal tree ─────────────────────────────

const REV = "g-co-revenue";
const MARGIN = "g-co-margin";

export const GOALS: Goal[] = [
  // ── Company ──
  {
    id: REV,
    parentId: null,
    level: "company",
    title: "Business Aspiration — ₹1.2 Cr revenue in FY 2026-27",
    department: "Company",
    type: "financial",
    ownerIds: ["p-jana"],
    metric: "Invoiced revenue (FY to date)",
    unit: "inr",
    baseline: 0,
    target: BUSINESS_ASPIRATION.revenueGoal,
    actual: ytd.revenue,
    expectedNow: ytd.goal,
    startDate: "2026-04-01",
    dueDate: "2027-03-31",
    cadence: "strategic",
    source: { kind: "linked", label: "Billing · Invoiced revenue", syncedAt: "2026-09-25T09:10" },
    smart: {
      specific: "Grow Genie Magnet's invoiced revenue to ₹1.2 Cr in FY 2026-27 through retainers, one-off brand films and partner work.",
      measurable: "Sum of invoiced revenue (ex-GST) from Billing, tracked monthly against the quarterly break-up Q1 ₹25L · Q2 ₹28L · Q3 ₹32L · Q4 ₹35L.",
      achievable: "FY 2025-26 closed at ₹82.2L. 46% growth needs ~8 new retainers plus 80% renewal of the existing book — in line with last year's pipeline.",
      relevant: "Funds the second edit bay, a full-time sales executive and the move to a bigger Appakudal studio.",
      timeBound: "1 Apr 2026 – 31 Mar 2027. Reviewed every 45 days in the Strategic STOP review.",
    },
    checkIns: [
      { id: "ci-1", date: "2026-09-02", by: "p-jana", kind: "breakthrough", note: "August closed at ₹9.4L — exactly on plan. Two brand-film one-offs from Erode textile clients landed.", value: 43.1 * L },
      { id: "ci-2", date: "2026-08-14", by: "p-jana", kind: "breakdown", note: "Q1 missed by ₹40K — Apr retainer for a Salem jeweller slipped to May. Tighter start-date clauses in agreements from now.", value: 33.7 * L },
    ],
    audit: [],
  },
  {
    id: MARGIN,
    parentId: null,
    level: "company",
    title: "20% net margin on FY revenue",
    department: "Company",
    type: "financial",
    ownerIds: ["p-jana", "p-ashwin"],
    metric: "Net margin (FY to date)",
    unit: "pct",
    baseline: 16.2,
    target: 20,
    actual: Number((ytd.margin * 100).toFixed(1)),
    startDate: "2026-04-01",
    dueDate: "2027-03-31",
    cadence: "strategic",
    source: { kind: "linked", label: "Finance · P&L (revenue − expense)", syncedAt: "2026-09-25T09:10" },
    smart: {
      specific: "Lift net margin from 16.2% (FY 2025-26) to 20% by cutting rework, collecting faster and keeping payroll clean.",
      measurable: "(Revenue − all expenses incl. overhead pools) ÷ revenue, from the monthly P&L.",
      achievable: "QC first-pass and edit-time improvements alone are worth ~2 points; DSO reduction removes interest on the working-capital OD.",
      relevant: "Margin, not just revenue, decides whether we can hire ahead of demand.",
      timeBound: "Measured monthly, final on 31 Mar 2027.",
    },
    checkIns: [
      { id: "ci-3", date: "2026-09-10", by: "p-ashwin", kind: "update", note: "Aug margin 19.1%. Freelancer spend down after Surya took over reel batches.", value: 18.2 },
    ],
    audit: [],
  },

  // ── Department: Sales ──
  {
    id: "g-sales-clients",
    parentId: REV,
    level: "department",
    title: "Sign 8 new retainer clients",
    department: "Sales",
    type: "financial",
    ownerIds: ["p-priya"],
    metric: "New retainers signed",
    unit: "count",
    baseline: 0,
    target: 8,
    actual: 4,
    startDate: "2026-04-01",
    dueDate: "2027-03-31",
    cadence: "tactical",
    source: { kind: "linked", label: "CRM · Won deals", syncedAt: "2026-09-25T08:45" },
    smart: {
      specific: "Close 8 new monthly retainers (min. ₹40K/month) with Tamil Nadu SMEs — textiles, jewellery, healthcare, education.",
      measurable: "Count of deals marked Won in CRM with a signed agreement.",
      achievable: "28% win rate on ~29 proposals, based on FY 2025-26 history.",
      relevant: "Retainers are ~70% of revenue and smooth the production load.",
      timeBound: "By 31 Mar 2027; 2 per quarter.",
    },
    checkIns: [
      { id: "ci-4", date: "2026-09-18", by: "p-priya", kind: "breakthrough", note: "Signed Sri Annapoorna Sweets (Coimbatore) — ₹55K/month, 12 months.", value: 4 },
      { id: "ci-5", date: "2026-08-21", by: "p-priya", kind: "breakdown", note: "Lost Kongu Motors to a Chennai agency on price. Need a lighter ‘starter’ retainer tier.", value: 3 },
    ],
    audit: [],
  },
  {
    id: "g-sales-revenue",
    parentId: REV,
    level: "department",
    title: "₹60L new annualised revenue",
    department: "Sales",
    type: "financial",
    ownerIds: ["p-priya"],
    metric: "Annualised value of new deals",
    unit: "inr",
    baseline: 0,
    target: 60 * L,
    actual: 25.2 * L,
    startDate: "2026-04-01",
    dueDate: "2027-03-31",
    cadence: "tactical",
    source: { kind: "linked", label: "CRM · Won deals (ACV)", syncedAt: "2026-09-25T08:45" },
    smart: {
      specific: "Add ₹60L of annualised contract value from new clients.",
      measurable: "Sum of 12-month value of Won deals in CRM.",
      achievable: "8 deals × ₹7.5L average — see Revenue breakdown.",
      relevant: "New sales must cover the gap after renewals and churn to reach ₹1.2 Cr.",
      timeBound: "By 31 Mar 2027.",
    },
    checkIns: [{ id: "ci-6", date: "2026-09-18", by: "p-priya", kind: "update", note: "4 deals, average ₹6.3L — below the ₹7.5L plan. Pushing 6-video packages.", value: 25.2 * L }],
    audit: [],
  },

  // ── Department: Marketing ──
  {
    id: "g-mkt-leads",
    parentId: REV,
    level: "department",
    title: "240 marketing-qualified leads",
    department: "Marketing",
    type: "functional",
    ownerIds: ["p-priya", "p-meena"],
    metric: "MQLs created",
    unit: "count",
    baseline: 0,
    target: 240,
    actual: 118,
    startDate: "2026-04-01",
    dueDate: "2027-03-31",
    cadence: "tactical",
    source: { kind: "linked", label: "CRM · Qualified leads", syncedAt: "2026-09-25T08:45" },
    smart: {
      specific: "Generate 240 MQLs from Meta ads, Instagram organic, referrals and Jana's coaching network.",
      measurable: "Leads tagged MQL in CRM (budget ≥ ₹30K/month, decision-maker reached).",
      achievable: "~20/month at ₹450 cost per lead — ₹9K/month ad spend.",
      relevant: "Feeds the 64 sales-qualified conversations needed for 8 wins.",
      timeBound: "By 31 Mar 2027, reviewed every 14 days.",
    },
    checkIns: [{ id: "ci-7", date: "2026-09-12", by: "p-meena", kind: "breakthrough", note: "‘Behind the reel’ carousel series pulled 23 MQLs in August — best month so far.", value: 104 }],
    audit: [],
  },

  // ── Department: Production ──
  {
    id: "g-prod-ontime",
    parentId: REV,
    level: "department",
    title: "95% on-time delivery",
    department: "Production",
    type: "operational",
    ownerIds: ["p-karthik"],
    metric: "Videos delivered on/before due date (rolling 30 days)",
    unit: "pct",
    baseline: 86,
    target: 95,
    actual: 91.2,
    startDate: "2026-04-01",
    dueDate: "2027-03-31",
    cadence: "tactical",
    source: { kind: "linked", label: "Production · on-time delivery", syncedAt: "2026-09-25T09:00" },
    smart: {
      specific: "Deliver at least 95% of client videos on or before the committed date.",
      measurable: "Delivered date vs due date on every video card, rolling 30 days.",
      achievable: "Was 86% last year; dual-cam shoots and the edit checklist have already lifted it to 91%.",
      relevant: "Late delivery is the #1 reason clients cite at renewal.",
      timeBound: "Sustained by 31 Mar 2027; checked daily in the Operational huddle.",
    },
    checkIns: [{ id: "ci-8", date: "2026-09-19", by: "p-karthik", kind: "breakdown", note: "3 reels late for Lakshmi Silks — client voice-over came in 2 days late. Adding VO deadline to the shoot brief.", value: 90.4 }],
    audit: [],
  },
  {
    id: "g-prod-qc",
    parentId: MARGIN,
    level: "department",
    title: "QC first-pass ≥ 85%",
    department: "Production",
    type: "operational",
    ownerIds: ["p-karthik"],
    metric: "Videos passing internal QC on first submission",
    unit: "pct",
    baseline: 72,
    target: 85,
    actual: 76,
    startDate: "2026-04-01",
    dueDate: "2027-03-31",
    cadence: "tactical",
    source: { kind: "linked", label: "QC · first-pass", syncedAt: "2026-09-25T09:00" },
    smart: {
      specific: "85% of edits pass the 12-point QC checklist on the first submission.",
      measurable: "QC pass/fail events per video version.",
      achievable: "Checklist in the edit timeline + colour course for editors.",
      relevant: "Each rework round costs ~1.8 editor hours — directly hits margin.",
      timeBound: "By 31 Mar 2027.",
    },
    checkIns: [{ id: "ci-9", date: "2026-09-16", by: "p-karthik", kind: "breakdown", note: "Most fails are audio levels and subtitle typos, not creative. Fixable with a pre-export checklist.", value: 75 }],
    audit: [],
  },

  // ── Department: HR ──
  {
    id: "g-hr-hire",
    parentId: MARGIN,
    level: "department",
    title: "Hire 3 — 2 editors + 1 sales executive",
    department: "HR",
    type: "functional",
    ownerIds: ["p-harini"],
    metric: "Hires joined",
    unit: "count",
    baseline: 0,
    target: 3,
    actual: 1,
    startDate: "2026-04-01",
    dueDate: "2026-12-31",
    cadence: "tactical",
    source: { kind: "linked", label: "HR · onboarding records", syncedAt: "2026-09-24T18:30" },
    smart: {
      specific: "Two video editors (Premiere/DaVinci) and one field sales executive for Coimbatore–Erode.",
      measurable: "Offer accepted and joined (Day 1 in HR).",
      achievable: "Referral bonus ₹10K + Naukri + Kongu Engineering College placement cell.",
      relevant: "Editor capacity is the binding constraint for Q3–Q4 growth.",
      timeBound: "All three joined by 31 Dec 2026.",
    },
    checkIns: [{ id: "ci-10", date: "2026-09-11", by: "p-harini", kind: "breakdown", note: "Editor candidate from Madurai declined — salary expectation ₹38K vs our ₹30K band.", value: 1 }],
    audit: [],
  },
  {
    id: "g-hr-payroll",
    parentId: MARGIN,
    level: "department",
    title: "Zero payroll errors — 12 clean runs",
    department: "HR",
    type: "operational",
    ownerIds: ["p-harini"],
    metric: "Payroll runs with zero corrections",
    unit: "count",
    baseline: 0,
    target: 12,
    actual: 5,
    expectedNow: 5,
    startDate: "2026-04-01",
    dueDate: "2027-03-31",
    cadence: "operational",
    source: { kind: "linked", label: "HR · payroll runs", syncedAt: "2026-09-01T11:20" },
    smart: {
      specific: "Every monthly payroll run closes with zero corrections, re-runs or late payments.",
      measurable: "Payroll runs Apr–Mar marked ‘clean’ (no correction entries).",
      achievable: "Attendance and leave now flow straight from the Attendance module.",
      relevant: "Trust — and avoids late-fee/PF penalties.",
      timeBound: "12 runs, Apr 2026 – Mar 2027. Sep run due 30 Sep.",
    },
    checkIns: [{ id: "ci-11", date: "2026-09-01", by: "p-harini", kind: "update", note: "August payroll clean — 5 of 5 so far.", value: 5 }],
    audit: [],
  },

  // ── Department: Finance ──
  {
    id: "g-fin-dso",
    parentId: MARGIN,
    level: "department",
    title: "Collections within 30 days (DSO ≤ 30)",
    department: "Finance",
    type: "financial",
    ownerIds: ["p-ashwin"],
    ownerNote: "Ashwin / Finance desk",
    metric: "Days sales outstanding",
    unit: "days",
    baseline: 46,
    target: 30,
    actual: 37,
    startDate: "2026-04-01",
    dueDate: "2027-03-31",
    cadence: "tactical",
    source: { kind: "linked", label: "Billing · DSO", syncedAt: "2026-09-25T09:10" },
    smart: {
      specific: "Bring average collection period down from 46 to 30 days.",
      measurable: "DSO = receivables ÷ revenue × days, from Billing.",
      achievable: "UPI/NEFT links on invoices and reminders at day 7/21/28.",
      relevant: "Every 10 days of DSO ≈ ₹3L of cash tied up.",
      timeBound: "≤ 30 days by 31 Mar 2027.",
    },
    checkIns: [{ id: "ci-12", date: "2026-09-15", by: "p-ashwin", kind: "breakthrough", note: "Auto-reminders live — 6 invoices paid within a week of the day-21 nudge.", value: 38 }],
    audit: [],
  },

  // ── Individual ──
  {
    id: "i-divya-edit",
    parentId: "g-prod-ontime",
    level: "individual",
    title: "Cut average reel edit time to 4h",
    department: "Production",
    type: "operational",
    ownerIds: ["p-divya"],
    metric: "Avg logged edit hours per reel",
    unit: "hours",
    baseline: 6.2,
    target: 4,
    actual: 5.1,
    startDate: "2026-07-01",
    dueDate: "2026-12-31",
    cadence: "tactical",
    source: { kind: "linked", label: "Time · logged edit hours", syncedAt: "2026-09-25T08:30" },
    smart: {
      specific: "Bring average edit time for 30–60s reels from 6.2h to 4h.",
      measurable: "Timesheet hours tagged ‘Edit’ ÷ reels delivered.",
      achievable: "Template library for lower-thirds and a shared LUT pack.",
      relevant: "Frees ~40 editor hours a month — almost a quarter of an editor.",
      timeBound: "By 31 Dec 2026.",
    },
    checkIns: [{ id: "ci-13", date: "2026-09-17", by: "p-divya", kind: "breakthrough", note: "Motion-text templates saved ~50 min per reel this sprint.", value: 5.1 }],
    audit: [],
  },
  {
    id: "i-divya-colour",
    parentId: "g-prod-qc",
    level: "individual",
    title: "Complete DaVinci Resolve colour course",
    department: "Production",
    type: "learning",
    ownerIds: ["p-divya"],
    metric: "Course modules completed",
    unit: "count",
    baseline: 0,
    target: 12,
    actual: 5,
    startDate: "2026-08-01",
    dueDate: "2026-11-30",
    cadence: "tactical",
    source: { kind: "linked", label: "Learning · course progress", syncedAt: "2026-09-24T21:05" },
    smart: {
      specific: "Finish the 12-module DaVinci Resolve colour grading course.",
      measurable: "Modules marked complete in Learning.",
      achievable: "2 hours every Saturday morning, studio time blocked.",
      relevant: "Colour mismatches are 18% of QC fails.",
      timeBound: "By 30 Nov 2026.",
    },
    checkIns: [],
    audit: [],
  },
  {
    id: "i-surya-qc",
    parentId: "g-prod-qc",
    level: "individual",
    title: "QC first-pass 90% on own edits",
    department: "Production",
    type: "operational",
    ownerIds: ["p-surya"],
    metric: "Own edits passing QC first time",
    unit: "pct",
    baseline: 74,
    target: 90,
    actual: 79,
    startDate: "2026-07-01",
    dueDate: "2026-12-31",
    cadence: "tactical",
    source: { kind: "linked", label: "QC · first-pass", syncedAt: "2026-09-25T09:00" },
    smart: {
      specific: "90% of Surya's edits pass QC on first submission.",
      measurable: "QC events filtered by editor = Surya.",
      achievable: "Pre-export checklist (audio −14 LUFS, subtitle spell-check).",
      relevant: "Rolls up to the department QC goal.",
      timeBound: "By 31 Dec 2026.",
    },
    checkIns: [{ id: "ci-14", date: "2026-09-19", by: "p-karthik", kind: "breakdown", note: "Two fails on subtitle timing in Tamil captions. Pairing with Divya for a week.", value: 78 }],
    audit: [],
  },
  {
    id: "i-surya-sound",
    parentId: "g-prod-qc",
    level: "individual",
    title: "Complete Fairlight sound design course",
    department: "Production",
    type: "learning",
    ownerIds: ["p-surya"],
    metric: "Course modules completed",
    unit: "count",
    baseline: 0,
    target: 8,
    actual: 6,
    startDate: "2026-07-01",
    dueDate: "2026-10-31",
    cadence: "tactical",
    source: { kind: "linked", label: "Learning · course progress", syncedAt: "2026-09-23T20:40" },
    smart: {
      specific: "Finish the 8-module Fairlight audio course.",
      measurable: "Modules marked complete in Learning.",
      achievable: "Already 6 of 8 done.",
      relevant: "Audio levels are the top QC failure reason.",
      timeBound: "By 31 Oct 2026.",
    },
    checkIns: [],
    audit: [],
  },
  {
    id: "i-vignesh-kit",
    parentId: "g-prod-ontime",
    level: "individual",
    title: "Zero kit-missing incidents on shoots",
    department: "Production",
    type: "operational",
    ownerIds: ["p-vignesh"],
    metric: "Kit-missing incidents per month",
    unit: "count",
    baseline: 3,
    target: 0,
    actual: 1,
    startDate: "2026-07-01",
    dueDate: "2026-12-31",
    cadence: "operational",
    source: {
      kind: "manual",
      label: "Manual override",
      linkedLabel: "Shoots · kit checklist sign-off",
      reason: "Counted from paper shoot sign-off sheets — kit checklist module goes live in October.",
      syncedAt: "2026-09-22T17:40",
    },
    smart: {
      specific: "No shoot delayed or compromised because a battery, card, mic or light was left behind.",
      measurable: "Incidents logged against shoots each month.",
      achievable: "Dual-cam / single-cam kit checklists signed before leaving the studio.",
      relevant: "One missed kit item cost a half-day reshoot in June.",
      timeBound: "Zero every month from Oct to Dec 2026.",
    },
    checkIns: [{ id: "ci-15", date: "2026-09-22", by: "p-vignesh", kind: "breakdown", note: "Forgot spare NP-FZ100 on the Tiruppur shoot — borrowed from client's team.", value: 1 }],
    audit: [{ at: "2026-09-22T17:40", by: "Karthik Subramanian", text: "Manual override set — counted from paper shoot sign-off sheets." }],
  },
  {
    id: "i-naveen-nas",
    parentId: "g-prod-ontime",
    level: "individual",
    title: "NAS backup automation — nightly, all projects",
    department: "Production",
    type: "operational",
    ownerIds: ["p-naveen"],
    metric: "Active projects on automated nightly backup",
    unit: "pct",
    baseline: 20,
    target: 100,
    actual: 45,
    startDate: "2026-07-01",
    dueDate: "2026-10-31",
    cadence: "tactical",
    source: { kind: "linked", label: "Tech · backup job logs", syncedAt: "2026-09-25T02:00" },
    smart: {
      specific: "Every active project folder backs up nightly to the Synology NAS, with a weekly off-site copy.",
      measurable: "Projects with a successful backup job in the last 24h ÷ active projects.",
      achievable: "Synology Hyper Backup + folder naming convention.",
      relevant: "A lost SSD in May nearly cost a client's raw footage.",
      timeBound: "By 31 Oct 2026.",
    },
    checkIns: [{ id: "ci-16", date: "2026-09-09", by: "p-ashwin", kind: "breakdown", note: "Naveen on medical leave till 30 Sep — setup paused at 45%.", value: 45 }],
    audit: [],
  },
  {
    id: "i-meena-reach",
    parentId: "g-mkt-leads",
    level: "individual",
    title: "Instagram reach +40%",
    department: "Marketing",
    type: "functional",
    ownerIds: ["p-meena"],
    metric: "Monthly accounts reached (@geniemagnet)",
    unit: "count",
    baseline: 120_000,
    target: 168_000,
    actual: 141_000,
    startDate: "2026-07-01",
    dueDate: "2026-12-31",
    cadence: "tactical",
    source: { kind: "linked", label: "Social · Meta insights", syncedAt: "2026-09-25T07:00" },
    smart: {
      specific: "Grow monthly Instagram reach from 1.2L to 1.68L accounts.",
      measurable: "Meta Business Suite ‘accounts reached’, 30-day window.",
      achievable: "4 reels/week + 2 collabs a month with client brands.",
      relevant: "Instagram drives ~45% of inbound leads.",
      timeBound: "By 31 Dec 2026.",
    },
    checkIns: [{ id: "ci-17", date: "2026-09-12", by: "p-meena", kind: "breakthrough", note: "Collab reel with a Coimbatore café hit 38K reach — our best ever.", value: 139_000 }],
    audit: [],
  },
  {
    id: "i-priya-proposals",
    parentId: "g-sales-clients",
    level: "individual",
    title: "Send 29 proposals this FY",
    department: "Sales",
    type: "functional",
    ownerIds: ["p-priya"],
    metric: "Proposals sent",
    unit: "count",
    baseline: 0,
    target: 29,
    actual: 12,
    startDate: "2026-04-01",
    dueDate: "2027-03-31",
    cadence: "tactical",
    source: { kind: "linked", label: "CRM · Proposals sent", syncedAt: "2026-09-25T08:45" },
    smart: {
      specific: "Send 29 tailored proposals to sales-qualified leads.",
      measurable: "Proposal documents sent from CRM.",
      achievable: "~2.5 a month; proposal templates by industry.",
      relevant: "At a 28% win rate, 29 proposals → 8 wins.",
      timeBound: "By 31 Mar 2027.",
    },
    checkIns: [],
    audit: [],
  },
  {
    id: "i-priya-meta",
    parentId: "g-mkt-leads",
    level: "individual",
    title: "Meta Blueprint — Media Buying certification",
    department: "Marketing",
    type: "learning",
    ownerIds: ["p-priya"],
    metric: "Blueprint modules completed",
    unit: "count",
    baseline: 0,
    target: 5,
    actual: 3,
    startDate: "2026-07-01",
    dueDate: "2026-10-31",
    cadence: "tactical",
    source: { kind: "linked", label: "Learning · course progress", syncedAt: "2026-09-20T22:10" },
    smart: {
      specific: "Pass the Meta Certified Media Buying Professional exam.",
      measurable: "5 prep modules + exam.",
      achievable: "1 module per fortnight.",
      relevant: "Bring cost per lead from ₹450 towards ₹350.",
      timeBound: "By 31 Oct 2026.",
    },
    checkIns: [],
    audit: [],
  },
  {
    id: "i-ashwin-followup",
    parentId: "g-fin-dso",
    level: "individual",
    title: "Follow up every invoice older than 21 days",
    department: "Finance",
    type: "operational",
    ownerIds: ["p-ashwin"],
    metric: "Overdue invoices with a logged follow-up",
    unit: "pct",
    baseline: 40,
    target: 100,
    actual: 82,
    startDate: "2026-07-01",
    dueDate: "2026-12-31",
    cadence: "operational",
    source: { kind: "linked", label: "Billing · reminders sent", syncedAt: "2026-09-25T09:10" },
    smart: {
      specific: "Every invoice past day 21 gets a call or WhatsApp follow-up, logged in Billing.",
      measurable: "Invoices >21 days with a follow-up entry ÷ all invoices >21 days.",
      achievable: "10-minute daily collections slot after the morning huddle.",
      relevant: "Main lever on DSO.",
      timeBound: "100% from Dec 2026.",
    },
    checkIns: [],
    audit: [],
  },
  {
    id: "i-harini-editor",
    parentId: "g-hr-hire",
    level: "individual",
    title: "Close editor #2 offer by 15 Nov",
    department: "HR",
    type: "functional",
    ownerIds: ["p-harini"],
    metric: "Shortlisted editor candidates interviewed",
    unit: "count",
    baseline: 0,
    target: 10,
    actual: 3,
    startDate: "2026-09-01",
    dueDate: "2026-11-15",
    cadence: "tactical",
    source: { kind: "linked", label: "HR · recruitment pipeline", syncedAt: "2026-09-24T18:30" },
    smart: {
      specific: "Interview 10 shortlisted editors and close one offer.",
      measurable: "Interviews logged in the recruitment pipeline.",
      achievable: "Revised band ₹30–36K approved by Jana.",
      relevant: "Capacity check shows editors over 100% from November.",
      timeBound: "Offer accepted by 15 Nov 2026.",
    },
    checkIns: [],
    audit: [],
  },
];

// ───────────────────────────── Revenue breakdown defaults (history) ─────────────────────────────

export const FUNNEL_HISTORY = {
  revenueTarget: BUSINESS_ASPIRATION.revenueGoal, // ₹1.2 Cr
  baseBook: 80 * L, // annualised value of existing retainers at 1 Apr
  retention: 0.8, // share of base book renewed
  churn: 0.05, // mid-year churn / downgrades on base book
  avgDeal: 7.5 * L, // annualised retainer value of a new client
  winRate: 0.28,
  proposalRate: 0.45, // sales-qualified → proposal
  qualRate: 0.3, // lead (MQL) → sales-qualified
  cpl: 450, // ₹ cost per lead (Meta ads)
  months: 12,
};

export const CAPACITY_HISTORY = {
  editors: 3,
  productiveHrs: 150, // per editor per month
  hrsPerVideo: 5.5,
  currentLoad: 58, // videos / month now
  unitsPerClient: 5, // videos / month per new retainer
};

export const summaryLine = () => `${ASPIRATION.fy} · ${inrCompact(ASPIRATION.revenueGoal)} revenue · ${ASPIRATION.netMarginGoal * 100}% net margin`;
