// Plans, subscriptions and the platform's settings (P6-01 to P6-03, ADR 0011). The add-on suites a plan has and how
// much it may use; an agency's subscription; and the platform's own settings, which the platform admin keeps in the
// platform console. The plans below are placeholders so development works — names, contents and prices are set there.
import { z } from "zod";
import { gstRate } from "./invoices.js";

const text = (max: number) => z.string().trim().max(max);

/** The add-on suites; everything else (sales, clients, delivery, publishing, the portal, invoices, settings) is in every plan. */
export const SUITES = [
  {
    key: "people",
    label: "People and payroll",
    description: "Employee records, attendance and leave, payroll and payslips, hiring, performance and learning, the daily sheet, the financial planner",
  },
  { key: "finance", label: "Finance and costing", description: "Expenses, true costing per video and client, the month's money" },
  { key: "management", label: "Management", description: "Goals and the revenue cascade, reviews and the Round Table, SOPs, the business diagnostic" },
  { key: "operations", label: "Operations", description: "Equipment and assets, projects and tasks" },
  { key: "genie", label: "Genie Assistant", description: "Insights, drafts and Ask Genie" },
] as const;
export type SuiteKey = (typeof SUITES)[number]["key"];
export const SUITE_KEYS = SUITES.map((s) => s.key) as [SuiteKey, ...SuiteKey[]];
export const suiteLabel = (k: SuiteKey) => SUITES.find((s) => s.key === k)!.label;

/** How much a plan may use; null means no limit. */
export const planLimits = z.object({
  /** People on the team (client people do not count). */
  users: z.number().int().min(1).nullable(),
  clients: z.number().int().min(1).nullable(),
  /** Genie Assistant drafts and answers a month. */
  aiDrafts: z.number().int().min(0).nullable(),
  storageGb: z.number().int().min(1).nullable(),
});
export type PlanLimits = z.infer<typeof planLimits>;
export const NO_LIMITS: PlanLimits = { users: null, clients: null, aiDrafts: null, storageGb: null };
export const LIMIT_LABEL: Record<keyof PlanLimits, string> = {
  users: "People on the team",
  clients: "Clients",
  aiDrafts: "Genie Assistant drafts a month",
  storageGb: "Storage (GB)",
};

export const planDef = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_]{1,30}$/, "Lowercase letters, numbers and _"),
  name: text(40).min(2, "Name the plan"),
  description: text(300).default(""),
  suites: z.array(z.enum(SUITE_KEYS)).max(SUITES.length).default([]),
  limits: planLimits,
  /** A month, before GST, in whole rupees; null until the platform admin sets it. */
  priceInr: z.number().int().min(0).max(10_000_000).nullable().default(null),
  /** A month, in whole US dollars, for agencies abroad; null until set. */
  priceUsd: z.number().int().min(0).max(100_000).nullable().default(null),
  /** Offered to agencies and shown on the pricing page (an internal plan is not). */
  offered: z.boolean().default(true),
});
export type PlanDef = z.output<typeof planDef>;

export const platformSettingsInput = z
  .object({
    /** The SaaS brand name and domain (not decided yet; shown on the pricing page and invoices). */
    brandName: text(60).min(2, "Name the platform"),
    domain: text(120).default(""),
    trialDays: z.number().int().min(0).max(90),
    /** The plan a new agency tries. */
    trialPlan: z.string().min(1),
    /** Days a failed payment is allowed before the workspace turns read-only. */
    graceDays: z.number().int().min(0).max(60),
    plans: z.array(planDef).min(1).max(12),
    /** Our details on the invoices we issue to agencies. */
    invoice: z.object({
      legalName: text(160).default(""),
      gstin: text(15).default(""),
      address: text(400).default(""),
      /** The two-digit state code of our GSTIN's state, for CGST and SGST or IGST. */
      stateCode: text(2).default(""),
      sac: text(8).default(""),
      prefix: text(12).default("INV"),
      /** GST on our plans (a percentage), entered here like every other rate. */
      gstRate: gstRate.default(18),
    }),
  })
  .superRefine((s, ctx) => {
    const keys = new Set<string>();
    s.plans.forEach((p, i) => {
      if (keys.has(p.key)) ctx.addIssue({ code: "custom", path: ["plans", i, "key"], message: "Each plan needs its own key" });
      keys.add(p.key);
    });
    if (!keys.has(s.trialPlan)) ctx.addIssue({ code: "custom", path: ["trialPlan"], message: "Choose one of the plans" });
  });
export type PlatformSettings = z.output<typeof platformSettingsInput>;

const ALL = [...SUITE_KEYS];
export const DEFAULT_PLATFORM_SETTINGS: PlatformSettings = {
  brandName: "Genie Magnet OS",
  domain: "",
  trialDays: 14,
  trialPlan: "scale",
  graceDays: 7,
  plans: [
    {
      key: "starter",
      name: "Starter",
      description: "Sales, clients, delivery and publishing",
      suites: [],
      limits: { users: 5, clients: 10, aiDrafts: 0, storageGb: 25 },
      priceInr: null,
      priceUsd: null,
      offered: true,
    },
    {
      key: "growth",
      name: "Growth",
      description: "Adds people and payroll, finance and costing, and Genie Assistant",
      suites: ["people", "finance", "genie"],
      limits: { users: 15, clients: 30, aiDrafts: 300, storageGb: 100 },
      priceInr: null,
      priceUsd: null,
      offered: true,
    },
    {
      key: "scale",
      name: "Scale",
      description: "Everything, for a growing agency",
      suites: ALL,
      limits: { users: 40, clients: 100, aiDrafts: 1500, storageGb: 500 },
      priceInr: null,
      priceUsd: null,
      offered: true,
    },
    {
      key: "enterprise",
      name: "Enterprise",
      description: "Everything, without limits",
      suites: ALL,
      limits: NO_LIMITS,
      priceInr: null,
      priceUsd: null,
      offered: true,
    },
  ],
  invoice: { legalName: "", gstin: "", address: "", stateCode: "", sac: "", prefix: "INV", gstRate: 18 },
};

// ─── Subscriptions ────────────────────────────────────────────────────

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "past_due", "expired", "cancelled"] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
export const SUBSCRIPTION_STATUS_LABEL: Record<SubscriptionStatus, string> = {
  trialing: "Trial",
  active: "Active",
  past_due: "Payment due",
  expired: "Trial ended",
  cancelled: "Cancelled",
};

/** What the agency has: its plan's suites and limits, and whether it may change anything. */
export interface Entitlements {
  /** null: no subscription — every suite and no limits (Genie Magnet, and agencies made before plans). */
  plan: { key: string; name: string } | null;
  status: SubscriptionStatus | null;
  suites: SuiteKey[];
  limits: PlanLimits;
  readOnly: boolean;
  /** Why it is read-only, and what to do. */
  readOnlyReason: string | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  graceUntil: string | null;
}

/** What the agency uses now, against its limits. */
export interface UsageNow {
  users: number;
  clients: number;
  aiDrafts: number;
  storageBytes: number;
  /** WhatsApp messages sent this month (through the agency's own number; counted, not limited). */
  whatsappMessages: number;
}

/** A plan as agencies see it. */
export type PlanOffer = Pick<PlanDef, "key" | "name" | "description" | "suites" | "limits" | "priceInr" | "priceUsd">;

/** The currencies a plan is paid in: rupees in India (with GST, through Razorpay), US dollars abroad (Stripe). */
export const PLAN_CURRENCIES = ["INR", "USD"] as const;
export type PlanCurrency = (typeof PLAN_CURRENCIES)[number];

/** GET /plan: the agency's plan, what it uses, the plans it may choose, and our invoices to it. */
export interface PlanPage {
  brandName: string;
  entitlements: Entitlements;
  usage: UsageNow;
  plans: PlanOffer[];
  /** "outbox": pretend payments (development and tests, and until our billing accounts are set up). */
  billing: { provider: "outbox" | "live"; currencies: PlanCurrency[] };
  invoices: PlatformInvoiceRow[];
}

export const choosePlanInput = z.object({ plan: z.string().min(1).max(40), currency: z.enum(PLAN_CURRENCIES).default("INR") });

/** POST /plan/choose: the plan page, and the page to pay on when the plan starts after paying. */
export type ChoosePlanResult = PlanPage & { payUrl: string | null };

/** Our invoice to an agency for its plan (P6-04), issued when a payment comes in. */
export interface PlatformInvoiceRow {
  id: string;
  number: string;
  agency: { id: string; name: string };
  issuedOn: string;
  periodStart: string;
  periodEnd: string;
  plan: { key: string; name: string };
  currency: PlanCurrency;
  /** Before tax, in whole rupees or dollars. */
  amount: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  totalInWords: string;
  gstRate: number;
  seller: { name: string; gstin: string; address: string; state: string };
  buyer: { name: string; gstin: string; address: string; state: string };
  sac: string;
  provider: string;
  paidAt: string;
}

// ─── The platform console ─────────────────────────────────────────────

/** GET /platform/agencies (one item): the numbers, never the data. */
export interface PlatformAgencyRow {
  id: string;
  name: string;
  slug: string;
  createdAt: string;
  plan: { key: string; name: string } | null;
  status: SubscriptionStatus | null;
  trialEndsAt: string | null;
  readOnly: boolean;
  people: number;
  clients: number;
  aiDraftsThisMonth: number;
  whatsappThisMonth: number;
  storageBytes: number;
  /** The latest change anyone made in it. */
  lastActivityAt: string | null;
  failedJobs: number;
  /** The agency lets the platform's support team in until then (P6-08). */
  support: { until: string; level: "view" | "edit" } | null;
}

/** PUT /platform/agencies/:id/subscription: the platform admin sets an agency's plan (or takes it off plans). */
export const platformSubscriptionInput = z.object({
  /** null: no subscription — every suite, no limits (the platform's own and partner agencies). */
  plan: z.string().min(1).max(40).nullable(),
  status: z.enum(SUBSCRIPTION_STATUSES).default("active"),
  trialEndsAt: z.iso.date().nullable().default(null),
  currentPeriodEnd: z.iso.date().nullable().default(null),
});
