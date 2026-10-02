// Finance and costing (Phase 5, stream B): cost rates, expenses, the true cost of each video and client, and the
// month's money in and out.
import { z } from "zod";

export const EXPENSE_CATEGORIES = ["Travel", "Food", "Props and set", "Equipment rental", "Freelancer", "Software", "Ads", "Printing", "Other"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_STATUSES = ["submitted", "approved", "rejected"] as const;
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number];

const rupees = z.number().int("Whole rupees").min(0, "Not below zero").max(100_000_000);
const day = z.iso.date("Pick the date");

export const expenseInput = z.object({
  date: day,
  /** A vendor by name: added to the agency's vendors the first time. */
  vendor: z.string().trim().max(120).optional(),
  category: z.enum(EXPENSE_CATEGORIES, "Choose the category"),
  description: z.string().trim().min(2, "Say what it was for").max(500),
  amount: rupees.min(1, "Enter the amount"),
  gst: rupees.default(0),
  /** A video it was for, or a client (shared across its videos); neither is an overhead. */
  videoId: z.uuid().optional(),
  clientId: z.uuid().optional(),
});
export type ExpenseInput = z.input<typeof expenseInput>;

export const expenseDecision = z
  .object({ approved: z.boolean(), note: z.string().trim().max(500).optional() })
  .refine((d) => d.approved || !!d.note, { path: ["note"], message: "Say why it is rejected" });

export const costRateInput = z.object({
  monthlyCost: rupees,
  hoursPerMonth: z.number().int().min(1, "At least 1 hour").max(400, "At most 400 hours"),
  effectiveFrom: day,
});
export type CostRateInput = z.infer<typeof costRateInput>;

export const costSettingsInput = z.object({
  kitRates: z.record(z.string().max(60), rupees),
  monthlyOverhead: rupees,
});
export type CostSettingsInput = z.infer<typeof costSettingsInput>;

/** GET /expenses (one item) */
export interface ExpenseRow {
  id: string;
  date: string;
  vendor: { id: string; name: string } | null;
  category: ExpenseCategory;
  description: string;
  amount: number;
  gst: number;
  status: ExpenseStatus;
  /** What it is allocated to: a video, a client, or overheads. */
  video: { id: string; code: string; title: string } | null;
  client: { id: string; name: string } | null;
  submittedBy: { id: string; name: string | null } | null;
  decidedBy: { id: string; name: string | null } | null;
  decisionNote: string | null;
  receipts: number;
  createdAt: string;
}

/** GET /costing/rates (one person) */
export interface CostRateRow {
  user: { id: string; name: string; role: string | null };
  /** The rate in force today, rupees an hour, or null when none is set. */
  hourly: number | null;
  current: { monthlyCost: number; hoursPerMonth: number; effectiveFrom: string } | null;
  history: { monthlyCost: number; hoursPerMonth: number; effectiveFrom: string }[];
}

/** GET /costing/settings */
export interface CostSettings {
  kits: { key: string; name: string; dailyRate: number }[];
  monthlyOverhead: number;
}

/** What something cost, in rupees, split the way the agency thinks about it. */
export interface CostBreakdown {
  /** Time logged on it, at each person's rate. */
  labour: number;
  /** Its share of shoots: the crew's time and the kit's day rate. */
  shoots: number;
  /** Approved expenses allocated to it. */
  expenses: number;
  /** Its share of the month's overheads, by hours. */
  overhead: number;
  total: number;
  /** Labour spent while it was in revision (part of labour). */
  rework: number;
  hours: number;
}

/** GET /costing/videos?month= (one item): a video's whole cost so far, against what the client pays for it. */
export interface VideoCostRow extends CostBreakdown {
  id: string;
  code: string;
  title: string;
  stage: string;
  client: { id: string; name: string; code: string };
  /** The agreement's monthly fee shared across the month's promised videos; null when it is not in a monthly cycle. */
  revenue: number | null;
  margin: number | null;
}

/** GET /costing/clients?month= (one item): a client's month. */
export interface ClientCostRow extends CostBreakdown {
  client: { id: string; name: string; code: string };
  package: string | null;
  /** Monthly fees of the agreements running that month. */
  revenue: number;
  margin: number;
  /** Margin as a share of revenue, 0 to 100 (null without revenue). */
  marginPct: number | null;
  videos: number;
}

/** GET /costing/summary?month= */
export interface CostingSummary {
  month: string;
  /** People whose time counted but who have no cost rate yet: their time is costed at nothing. */
  missingRates: { id: string; name: string; hours: number }[];
  /** Overheads shared out this month: the monthly figure plus approved expenses not allocated to a video or client. */
  overheads: number;
  /** Rupees of overhead per hour logged. */
  overheadPerHour: number;
  hours: number;
  /** Everything the month cost: time at cost rates, shoots and kit, approved expenses and overheads. */
  totalCost: number;
}

// ─── Collections (P5-04) ─────────────────────────────────────────────

/** Unpaid amounts by how late they are: not yet due, then days past the due date. */
export interface AgeingBuckets {
  notDue: number;
  d1to30: number;
  d31to60: number;
  d61to90: number;
  over90: number;
  total: number;
}

/** GET /collections/ageing */
export interface AgeingReport {
  totals: AgeingBuckets;
  clients: {
    client: { id: string; name: string; code: string };
    /** Who to remind: the client's approver. */
    contact: { name: string; phone: string } | null;
    buckets: AgeingBuckets;
    invoices: { id: string; number: string | null; balance: number; dueDate: string | null; daysOverdue: number; payUrl: string | null }[];
  }[];
}

// ─── The month's money (P5-05) ───────────────────────────────────────

/** One month: what was agreed, invoiced, earned by delivering, collected and spent. Rupees. */
export interface FinanceMonthRow {
  month: string;
  /** Monthly fees of the agreements running that month. */
  contracted: number;
  /** Invoices issued in the month, before GST. */
  invoiced: number;
  /** Each running agreement's fee in proportion to the videos delivered against those promised. */
  earned: number;
  /** Money received in the month (with GST). */
  collected: number;
  /** Time at cost rates, shoots and kit, approved expenses and the month's overheads. */
  costs: number;
  /** Earned less costs. */
  margin: number;
  marginPct: number | null;
  /** Closed months keep the figures they had when closed. */
  closed: boolean;
  closedAt: string | null;
  closedBy: string | null;
}

export const reopenInput = z.object({ reason: z.string().trim().min(3, "Say why it is reopened").max(500) });
