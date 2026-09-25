// Finance mock data — Genie Magnet, Indian FY (Apr–Mar). FY 2026-27 is the current year; "today" is 25 Sep 2026.
// Scale: 5 retainer clients (Kaveri ₹85K, Sri Lakshmi ₹65K, Nova ₹48K, BrightPath ₹30K, Urban Nest ₹40K = ₹2.68L/month
// contracted) plus small add-ons, re-billed travel and one-off projects → ~₹2.4–3.3L revenue a month.
// The business runs close to break-even: founder remuneration is excluded from expenses, freelancers are variable.

export const FY_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;
export type FyMonth = (typeof FY_MONTHS)[number];

export const GST_RATE = 0.18;

const L = 100_000;

/** Business Aspiration FY 2026-27 — roughly double the current run-rate (~₹33L/yr). */
export const BUSINESS_ASPIRATION = {
  fy: "FY 2026-27",
  revenueGoal: 60 * L, // ₹60L
  netMarginGoal: 0.15,
  quarters: [
    { q: "Q1", months: "Apr–Jun", goal: 8.5 * L },
    { q: "Q2", months: "Jul–Sep", goal: 10.5 * L },
    { q: "Q3", months: "Oct–Dec", goal: 17 * L },
    { q: "Q4", months: "Jan–Mar", goal: 24 * L },
  ],
};

export interface MonthFinance {
  month: FyMonth;
  /** FY 2025-26 actuals */
  prevRevenue: number;
  prevExpense: number;
  /** FY 2026-27 goal (Business Aspiration break-up) */
  goalRevenue: number;
  goalExpense: number; // budget = 85% of goal revenue (15% margin goal)
  /** FY 2026-27 actuals (earned revenue, ex-GST) — null for future months. Sep is month-to-date (period open). */
  actualRevenue: number | null;
  actualExpense: number | null;
  locked: boolean;
}

const mf = (
  month: FyMonth,
  prevRevenue: number,
  prevExpense: number,
  goalRevenue: number,
  actualRevenue: number | null,
  actualExpense: number | null,
  locked: boolean,
): MonthFinance => ({
  month,
  prevRevenue: prevRevenue * L,
  prevExpense: prevExpense * L,
  goalRevenue: goalRevenue * L,
  goalExpense: Math.round(goalRevenue * 0.85 * L),
  actualRevenue: actualRevenue === null ? null : Math.round(actualRevenue * L),
  actualExpense: actualExpense === null ? null : Math.round(actualExpense * L),
  locked,
});

// Actual revenue = retainer revenue earned (₹1.98L Apr, ₹2.13L May, ₹2.68L from Jun) + add-ons, re-billed travel, one-offs.
export const monthlyFinance: MonthFinance[] = [
  mf("Apr", 1.05, 1.03, 2.6, 2.365, 2.24, true),
  mf("May", 1.12, 1.09, 2.8, 2.42, 2.31, true),
  mf("Jun", 0.98, 0.99, 3.1, 3.085, 2.86, true),
  mf("Jul", 1.2, 1.16, 3.3, 3.312, 3.02, true),
  mf("Aug", 1.15, 1.12, 3.5, 3.06, 2.88, true),
  mf("Sep", 1.3, 1.26, 3.7, 2.937, 2.79, false),
  mf("Oct", 1.62, 1.55, 4.9, null, null, false),
  mf("Nov", 1.55, 1.5, 5.6, null, null, false),
  mf("Dec", 1.7, 1.63, 6.5, null, null, false),
  mf("Jan", 1.58, 1.54, 7.4, null, null, false),
  mf("Feb", 2.05, 1.96, 8.0, null, null, false),
  mf("Mar", 2.12, 2.03, 8.6, null, null, false),
];

export const ytd = (() => {
  const done = monthlyFinance.filter((x) => x.actualRevenue !== null);
  const revenue = done.reduce((s, x) => s + (x.actualRevenue ?? 0), 0);
  const expense = done.reduce((s, x) => s + (x.actualExpense ?? 0), 0);
  const goal = done.reduce((s, x) => s + x.goalRevenue, 0);
  const prev = done.reduce((s, x) => s + x.prevRevenue, 0);
  return { months: done.length, revenue, expense, goal, prev, margin: (revenue - expense) / revenue };
})();

// ───────────────────────────── Overhead pools ─────────────────────────────
// Shared costs that cannot be traced to a single video. Allocated on direct labour hours.

export interface OverheadPool {
  id: string;
  name: string;
  monthly: number;
  basis: string;
  items: { label: string; amount: number }[];
  note?: string;
}

export const overheadPools: OverheadPool[] = [
  {
    id: "op-mgmt",
    name: "Management",
    monthly: 18_000,
    basis: "Direct labour hours",
    items: [{ label: "Ashwin — unlogged (non-project) hours", amount: 18_000 }],
    note: "Founder remuneration is excluded from costing. Hours logged directly on a video are charged as labour, so only Ashwin's unlogged share flows here — no double counting.",
  },
  {
    id: "op-hr",
    name: "HR & Admin",
    monthly: 12_000,
    basis: "Direct labour hours",
    items: [
      { label: "Harini Selvam — HR & admin share", amount: 8_000 },
      { label: "Naveen Raj — IT support share", amount: 4_000 },
    ],
  },
  {
    id: "op-rent",
    name: "Rent — Appakudal studio & office",
    monthly: 15_000,
    basis: "Direct labour hours",
    items: [{ label: "Studio + office lease", amount: 15_000 }],
  },
  {
    id: "op-soft",
    name: "Software & subscriptions",
    monthly: 11_580,
    basis: "Direct labour hours",
    items: [
      { label: "Adobe Creative Cloud (2 seats)", amount: 8_460 },
      { label: "Frame.io (Pro)", amount: 1_250 },
      { label: "Google Workspace (10 users, Starter)", amount: 1_370 },
      { label: "Canva Pro", amount: 500 },
    ],
  },
  {
    id: "op-power",
    name: "Electricity",
    monthly: 5_620,
    basis: "Direct labour hours",
    items: [{ label: "TNEB — studio + edit bay", amount: 5_620 }],
  },
  {
    id: "op-net",
    name: "Internet",
    monthly: 1_800,
    basis: "Direct labour hours",
    items: [
      { label: "Airtel Xstream fibre 100 Mbps", amount: 1_200 },
      { label: "BSNL backup line", amount: 600 },
    ],
  },
];

export const OVERHEAD_TOTAL = overheadPools.reduce((s, p) => s + p.monthly, 0); // ₹64,000
/** Direct labour hours logged on client work in a typical month (employees + freelancers). */
export const DIRECT_LABOUR_HOURS = 800;
/** ₹80 per direct labour hour */
export const OVERHEAD_RATE = OVERHEAD_TOTAL / DIRECT_LABOUR_HOURS;

// ═════════════════════════ Billing & Collections (Module 33) ═════════════════════════
// Invoice numbering GM/26-27/NNN. Intra-state (Tamil Nadu, state code 33) → CGST 9% + SGST 9%; other states → IGST 18%.

export interface BillingParty {
  key: string;
  name: string;
  city: string;
  state: string;
  gstin: string;
  interState: boolean;
  clientId?: string; // link to core clients for the 5 showcase accounts
}

export const billingParties: BillingParty[] = [
  { key: "KVR", name: "Kaveri Organics", city: "Erode", state: "Tamil Nadu", gstin: "33AAHFK2231L1ZQ", interState: false, clientId: "c-kaveri" },
  { key: "SLS", name: "Sri Lakshmi Silks", city: "Kanchipuram", state: "Tamil Nadu", gstin: "33ABMFS8812C1Z5", interState: false, clientId: "c-lakshmi" },
  { key: "NVD", name: "Nova Dental Care", city: "Coimbatore", state: "Tamil Nadu", gstin: "33AAJCN4417R1ZK", interState: false, clientId: "c-nova" },
  { key: "BPA", name: "BrightPath Academy", city: "Salem", state: "Tamil Nadu", gstin: "33AAFTB6620N1Z2", interState: false, clientId: "c-bright" },
  { key: "UNR", name: "Urban Nest Realty", city: "Tiruppur", state: "Tamil Nadu", gstin: "33AACCU9014H1ZV", interState: false, clientId: "c-urban" },
  { key: "CHN", name: "Chandran Hospitals", city: "Madurai", state: "Tamil Nadu", gstin: "33AABCC3390F1ZM", interState: false },
  { key: "RVJ", name: "Revathi Jewellers", city: "Coimbatore", state: "Tamil Nadu", gstin: "33AAKFR5561D1Z9", interState: false },
  { key: "AND", name: "Anand Sweets", city: "Madurai", state: "Tamil Nadu", gstin: "33ADXPA7243B1ZS", interState: false },
  { key: "NCA", name: "Nirmala Cooking Academy", city: "Chennai", state: "Tamil Nadu", gstin: "33BGRPN4410J1Z1", interState: false },
  { key: "KFB", name: "Kovai Fresh Bakes", city: "Coimbatore", state: "Tamil Nadu", gstin: "33AAQFK8871E1ZT", interState: false },
  { key: "THS", name: "Thanjavur Heritage Stays", city: "Thanjavur", state: "Tamil Nadu", gstin: "33AAMFT1123Q1ZC", interState: false },
  { key: "MDM", name: "Madurai Mobiles", city: "Madurai", state: "Tamil Nadu", gstin: "33ATHPM6652K1ZD", interState: false },
  { key: "KSR", name: "Kochi Spice Route", city: "Kochi", state: "Kerala", gstin: "32AAKCK4410P1ZF", interState: true },
  { key: "MSH", name: "Mysuru Silk House", city: "Mysuru", state: "Karnataka", gstin: "29ABHFM3310G1ZX", interState: true },
];

export const partyByKey = (key: string) => billingParties.find((p) => p.key === key)!;

export type PaymentMode = "UPI" | "NEFT" | "Cheque" | "Cash" | "Advance";

export interface InvoicePayment {
  id: string;
  date: string;
  amount: number; // cash received (excl. TDS)
  tds: number;
  mode: PaymentMode;
  ref: string;
}

export interface Invoice {
  id: string;
  number: string;
  partyKey: string;
  period: string;
  description: string;
  issueDate: string;
  dueDate: string;
  taxable: number;
  payments: InvoicePayment[];
  creditAdj: number; // credit notes applied
  reminders: number;
  lastReminder?: string;
  draft?: boolean;
}

export function gstSplit(taxable: number, interState: boolean) {
  const gst = Math.round(taxable * GST_RATE);
  if (interState) return { cgst: 0, sgst: 0, igst: gst, gst, total: taxable + gst };
  const cgst = Math.round(gst / 2);
  return { cgst, sgst: gst - cgst, igst: 0, gst, total: taxable + gst };
}

type PaySpec = { date: string; mode: PaymentMode; ref?: string; amount?: number; tdsPct?: number };

let payCounter = 0;
function mkInvoice(
  n: number,
  partyKey: string,
  period: string,
  description: string,
  issueDate: string,
  dueDate: string,
  taxable: number,
  pays: PaySpec[] = [],
  extra: Partial<Invoice> = {},
): Invoice {
  const party = partyByKey(partyKey);
  const { total } = gstSplit(taxable, party.interState);
  const creditAdj = extra.creditAdj ?? 0;
  const payments: InvoicePayment[] = pays.map((p) => {
    const tds = p.tdsPct ? Math.round(taxable * p.tdsPct) : 0;
    const amount = p.amount ?? total - creditAdj - tds;
    payCounter += 1;
    return {
      id: `pay-${payCounter}`,
      date: p.date,
      amount,
      tds,
      mode: p.mode,
      ref: p.ref ?? (p.mode === "UPI" ? `UPI/${612000000 + payCounter * 7919}` : p.mode === "Cheque" ? `CHQ ${402100 + payCounter}` : p.mode === "Advance" ? "Advance adjusted" : `UTR HDFCR5${String(2026090000 + payCounter * 131).slice(-9)}`),
    };
  });
  return {
    id: `inv-${String(n).padStart(3, "0")}`,
    number: `GM/26-27/${String(n).padStart(3, "0")}`,
    partyKey,
    period,
    description,
    issueDate,
    dueDate,
    taxable,
    payments,
    creditAdj,
    reminders: 0,
    ...extra,
  };
}

const RET_KVR = "Growth Video Pack — monthly retainer (advance)";
const RET_SLS = "Social Starter Pack — monthly retainer (advance)";
const RET_NVD = "Authority Builder — deliverables (billed in arrears)";
const BPA_ADV = "Admissions Campaign — 50% advance";
const BPA_BAL = "Admissions Campaign — 50% balance on delivery";
const TRAVEL = "Re-billed travel (outstation, beyond 150 km per agreement)";

// ~9–10 invoices a month: 5 retainers (Kaveri & Sri Lakshmi billed at month-end for next month, Nova in arrears,
// BrightPath 50/50, Urban Nest in arrears) + small add-ons, re-billed travel/pass-through costs and one-off projects.
export const invoicesSeed: Invoice[] = [
  // ── April
  mkInvoice(1, "NVD", "Mar 2026", RET_NVD, "2026-04-02", "2026-04-17", 48_000, [{ date: "2026-04-16", mode: "NEFT" }]),
  mkInvoice(2, "KVR", "Apr 2026", `${TRAVEL} — Chennai distributor shoot`, "2026-04-06", "2026-04-21", 3_500, [{ date: "2026-04-18", mode: "UPI" }]),
  mkInvoice(3, "AND", "Apr 2026", "Tamil New Year festive reels — 3 reels (one-off)", "2026-04-08", "2026-04-23", 18_000, [{ date: "2026-04-22", mode: "UPI" }], { creditAdj: 2_360 }),
  mkInvoice(4, "SLS", "Apr 2026", "Add-on: 2 extra Akshaya Tritiya reels", "2026-04-11", "2026-04-26", 4_000, [{ date: "2026-04-24", mode: "UPI" }]),
  mkInvoice(5, "KVR", "Apr 2026", "Add-on: product stills — 12 SKUs", "2026-04-15", "2026-04-30", 5_000, [{ date: "2026-04-28", mode: "NEFT" }]),
  mkInvoice(6, "NVD", "Apr 2026", "Add-on: Google Business Profile video", "2026-04-18", "2026-05-03", 3_000, [{ date: "2026-05-02", mode: "UPI" }]),
  mkInvoice(7, "SLS", "Apr 2026", "Re-billed: model & make-up artist (pass-through)", "2026-04-22", "2026-05-07", 2_500, [{ date: "2026-05-05", mode: "UPI" }]),
  mkInvoice(8, "KVR", "May 2026", RET_KVR, "2026-04-27", "2026-05-01", 85_000, [{ date: "2026-04-30", mode: "NEFT" }]),
  mkInvoice(9, "SLS", "May 2026", RET_SLS, "2026-04-27", "2026-05-01", 65_000, [{ date: "2026-05-02", mode: "UPI" }]),
  mkInvoice(10, "KVR", "Apr 2026", "Out-of-scope CR: label redesign in ad super", "2026-04-29", "2026-05-14", 2_500, [{ date: "2026-05-08", mode: "UPI" }]),
  // ── May
  mkInvoice(11, "NVD", "Apr 2026", RET_NVD, "2026-05-02", "2026-05-17", 48_000, [{ date: "2026-05-15", mode: "NEFT" }]),
  mkInvoice(12, "KVR", "May 2026", `${TRAVEL} — Salem stockist shoot`, "2026-05-06", "2026-05-21", 3_000, [{ date: "2026-05-19", mode: "UPI" }]),
  mkInvoice(13, "NCA", "May 2026", "Course trailer — 1 × 90s film (one-off)", "2026-05-09", "2026-05-24", 15_000, [{ date: "2026-05-20", mode: "UPI" }]),
  mkInvoice(14, "SLS", "May 2026", "Add-on: wedding-season carousel shoot", "2026-05-12", "2026-05-27", 4_500, [{ date: "2026-05-26", mode: "UPI" }]),
  mkInvoice(15, "BPA", "May 2026", "Admissions Campaign — 15–31 May (advance)", "2026-05-15", "2026-05-22", 15_000, [{ date: "2026-05-20", mode: "UPI" }]),
  mkInvoice(16, "NVD", "May 2026", "Add-on: patient FAQ stills", "2026-05-19", "2026-06-03", 2_500, [{ date: "2026-06-02", mode: "UPI" }]),
  mkInvoice(17, "KVR", "May 2026", "Add-on: 2 extra product reels", "2026-05-22", "2026-06-06", 4_000, [{ date: "2026-06-04", mode: "NEFT" }]),
  mkInvoice(18, "KVR", "Jun 2026", RET_KVR, "2026-05-27", "2026-06-01", 85_000, [{ date: "2026-05-30", mode: "NEFT" }]),
  mkInvoice(19, "SLS", "Jun 2026", RET_SLS, "2026-05-27", "2026-06-01", 65_000, [{ date: "2026-06-01", mode: "UPI" }]),
  // ── June
  mkInvoice(20, "BPA", "Jun 2026", BPA_ADV, "2026-06-01", "2026-06-05", 15_000, [{ date: "2026-06-04", mode: "UPI" }]),
  mkInvoice(21, "NVD", "May 2026", RET_NVD, "2026-06-02", "2026-06-17", 48_000, [{ date: "2026-06-17", mode: "NEFT" }]),
  mkInvoice(22, "KFB", "Jun 2026", "Bakery launch reels — 4 reels (one-off)", "2026-06-05", "2026-06-20", 20_000, [{ date: "2026-06-19", mode: "NEFT" }]),
  mkInvoice(23, "SLS", "Jun 2026", `${TRAVEL} — Kanchipuram showroom`, "2026-06-09", "2026-06-24", 3_500, [{ date: "2026-06-22", mode: "UPI" }]),
  mkInvoice(24, "KVR", "Jun 2026", "Add-on: Father's Day ad cut-down", "2026-06-12", "2026-06-27", 6_000, [{ date: "2026-06-24", mode: "NEFT" }]),
  mkInvoice(25, "NVD", "Jun 2026", "Add-on: clinic walkthrough stills", "2026-06-16", "2026-07-01", 3_500, [{ date: "2026-07-01", mode: "UPI" }]),
  mkInvoice(26, "SLS", "Jun 2026", "Add-on: Aadi sale teaser reels", "2026-06-18", "2026-07-03", 5_000, [{ date: "2026-07-02", mode: "UPI" }]),
  mkInvoice(27, "BPA", "Jun 2026", BPA_BAL, "2026-06-20", "2026-06-27", 15_000, [{ date: "2026-06-26", mode: "UPI" }]),
  mkInvoice(28, "KVR", "Jul 2026", RET_KVR, "2026-06-26", "2026-07-01", 85_000, [{ date: "2026-06-30", mode: "NEFT" }]),
  mkInvoice(29, "SLS", "Jul 2026", RET_SLS, "2026-06-26", "2026-07-01", 65_000, [{ date: "2026-07-01", mode: "UPI" }]),
  mkInvoice(30, "KVR", "Jun 2026", "Out-of-scope CR: extra language subtitles", "2026-06-29", "2026-07-14", 2_500, [{ date: "2026-07-10", mode: "UPI" }]),
  // ── July
  mkInvoice(31, "BPA", "Jul 2026", BPA_ADV, "2026-07-01", "2026-07-05", 15_000, [{ date: "2026-07-03", mode: "UPI" }]),
  mkInvoice(32, "NVD", "Jun 2026", RET_NVD, "2026-07-02", "2026-07-17", 48_000, [{ date: "2026-07-18", mode: "NEFT" }], { creditAdj: 11_328 }),
  mkInvoice(33, "THS", "Jul 2026", "Heritage property reel + stills (one-off)", "2026-07-06", "2026-07-21", 18_000, [{ date: "2026-07-20", mode: "NEFT" }]),
  mkInvoice(34, "KVR", "Jul 2026", `${TRAVEL} — Bhavani farmhouse, 2nd trip`, "2026-07-09", "2026-07-24", 4_500, [{ date: "2026-07-22", mode: "UPI" }]),
  mkInvoice(35, "SLS", "Jul 2026", "Add-on: 2 extra Aadi sale reels", "2026-07-13", "2026-07-28", 5_500, [{ date: "2026-07-25", mode: "UPI" }]),
  mkInvoice(36, "NVD", "Jul 2026", "Add-on: doctor profile stills", "2026-07-15", "2026-07-30", 3_000, [{ date: "2026-07-30", mode: "UPI" }]),
  mkInvoice(37, "BPA", "Jul 2026", BPA_BAL, "2026-07-20", "2026-07-27", 15_000, [{ date: "2026-07-27", mode: "UPI" }]),
  mkInvoice(38, "KVR", "Jul 2026", "Add-on: recipe carousel set", "2026-07-22", "2026-08-06", 5_000, [{ date: "2026-08-04", mode: "NEFT" }]),
  mkInvoice(39, "SLS", "Jul 2026", "Re-billed: model & jewellery stylist (pass-through)", "2026-07-23", "2026-08-07", 3_000, [{ date: "2026-08-06", mode: "UPI" }]),
  mkInvoice(40, "KVR", "Jul 2026", "Out-of-scope CR: extra product-angle re-edit", "2026-07-24", "2026-08-08", 2_500, [{ date: "2026-08-06", mode: "UPI" }]),
  mkInvoice(41, "UNR", "Jun–Jul 2026", "Project walkthroughs & reels Jun–Jul (arrears) + drone add-on", "2026-07-25", "2026-08-24", 101_695, [], { reminders: 2, lastReminder: "2026-09-18" }),
  mkInvoice(42, "SLS", "Aug 2026", RET_SLS, "2026-07-27", "2026-08-01", 65_000, [{ date: "2026-07-31", mode: "UPI" }]),
  mkInvoice(43, "KVR", "Aug 2026", RET_KVR, "2026-07-27", "2026-08-01", 85_000, [{ date: "2026-07-31", mode: "NEFT" }]),
  // ── August
  mkInvoice(44, "BPA", "Aug 2026", BPA_ADV, "2026-08-01", "2026-08-05", 15_000, [{ date: "2026-08-04", mode: "UPI" }]),
  mkInvoice(45, "NVD", "Jul 2026", RET_NVD, "2026-08-03", "2026-08-18", 48_000, [{ date: "2026-08-25", mode: "UPI", amount: 17_280 }], { reminders: 1, lastReminder: "2026-09-08" }),
  mkInvoice(46, "SLS", "Aug 2026", "Navaratri add-on shoot — 6 reels + stills", "2026-08-05", "2026-08-20", 28_000, [
    { date: "2026-08-10", mode: "UPI", amount: 16_520 },
    { date: "2026-09-15", mode: "UPI", amount: 16_520 },
  ]),
  mkInvoice(47, "KVR", "Aug 2026", `${TRAVEL} — Coimbatore distributor meet`, "2026-08-11", "2026-08-26", 3_500, [{ date: "2026-08-24", mode: "UPI" }]),
  mkInvoice(48, "NVD", "Aug 2026", "Add-on: Instagram highlight covers", "2026-08-18", "2026-09-02", 2_500, [{ date: "2026-08-30", mode: "UPI" }]),
  mkInvoice(49, "BPA", "Aug 2026", BPA_BAL, "2026-08-20", "2026-08-27", 15_000, [{ date: "2026-08-27", mode: "UPI" }]),
  mkInvoice(50, "KVR", "Aug 2026", "Add-on: Onam greeting reel", "2026-08-24", "2026-09-08", 4_000, [{ date: "2026-09-05", mode: "NEFT" }]),
  mkInvoice(51, "SLS", "Sep 2026", RET_SLS, "2026-08-26", "2026-09-01", 65_000, [{ date: "2026-08-30", mode: "UPI" }]),
  mkInvoice(52, "KVR", "Sep 2026", RET_KVR, "2026-08-26", "2026-09-01", 85_000, [{ date: "2026-08-30", mode: "NEFT" }]),
  // ── September (month-to-date)
  mkInvoice(53, "BPA", "Sep 2026", BPA_ADV, "2026-09-01", "2026-09-05", 15_000, [{ date: "2026-09-01", mode: "Advance", amount: 17_700 }]),
  mkInvoice(54, "NVD", "Aug 2026", RET_NVD, "2026-09-02", "2026-09-17", 48_000, [], { reminders: 1, lastReminder: "2026-09-22" }),
  mkInvoice(55, "MDM", "Sep 2026", "Store opening reel — Perundurai branch (one-off)", "2026-09-07", "2026-09-22", 12_000, [{ date: "2026-09-18", mode: "UPI" }]),
  mkInvoice(56, "KVR", "Sep 2026", `${TRAVEL} — Chennai testimonial (train + cab)`, "2026-09-10", "2026-09-25", 4_200, [{ date: "2026-09-21", mode: "UPI" }]),
  mkInvoice(57, "SLS", "Sep 2026", "Add-on: Navaratri countdown stories pack", "2026-09-14", "2026-09-29", 3_500, [{ date: "2026-09-22", mode: "UPI" }]),
  mkInvoice(58, "KVR", "Sep 2026", "Add-on: Diwali hamper product stills", "2026-09-18", "2026-10-03", 6_000),
  mkInvoice(59, "BPA", "Sep 2026", BPA_BAL, "2026-09-21", "2026-09-28", 15_000, [{ date: "2026-09-23", mode: "UPI", amount: 2_700 }]),
  mkInvoice(60, "SLS", "Oct 2026", RET_SLS, "2026-09-25", "2026-10-01", 65_000, [{ date: "2026-09-25", mode: "Advance", amount: 11_700 }]),
  mkInvoice(61, "KVR", "Oct 2026", RET_KVR, "2026-09-25", "2026-10-01", 85_000),
];

export interface ClientAdvance {
  id: string;
  number: string;
  partyKey: string;
  receivedOn: string;
  amount: number;
  mode: PaymentMode;
  ref: string;
  purpose: string;
  adjustments: { invoiceNo: string; amount: number; date: string }[];
}

export const advancesSeed: ClientAdvance[] = [
  { id: "adv-1", number: "ADV/26-27/001", partyKey: "BPA", receivedOn: "2026-08-28", amount: 17_700, mode: "UPI", ref: "UPI/624118820113", purpose: "50% advance — Sep cycle", adjustments: [{ invoiceNo: "GM/26-27/053", amount: 17_700, date: "2026-09-01" }] },
  { id: "adv-2", number: "ADV/26-27/002", partyKey: "SLS", receivedOn: "2026-08-29", amount: 11_700, mode: "UPI", ref: "UPI/624120074452", purpose: "Navaratri extra stories — part advance", adjustments: [{ invoiceNo: "GM/26-27/060", amount: 11_700, date: "2026-09-25" }] },
  { id: "adv-3", number: "ADV/26-27/003", partyKey: "NCA", receivedOn: "2026-09-22", amount: 20_000, mode: "NEFT", ref: "UTR HDFCR52026092207", purpose: "Personal-branding retainer (starts Oct) — onboarding advance", adjustments: [] },
];

export interface CreditNote {
  id: string;
  number: string;
  partyKey: string;
  invoiceNo: string;
  date: string;
  taxable: number;
  reason: string;
  status: "applied" | "draft";
  raisedBy: string;
}

export const creditNotesSeed: CreditNote[] = [
  { id: "cn-1", number: "CN/26-27/001", partyKey: "AND", invoiceNo: "GM/26-27/003", date: "2026-04-20", taxable: 2_000, reason: "One festive reel delivered after Tamil New Year — goodwill discount", status: "applied", raisedBy: "Ashwin" },
  { id: "cn-2", number: "CN/26-27/002", partyKey: "NVD", invoiceNo: "GM/26-27/032", date: "2026-07-15", taxable: 9_600, reason: "Unit not delivered — carry forward refused (1 testimonial, Jun cycle)", status: "applied", raisedBy: "Ashwin" },
  { id: "cn-3", number: "CN/26-27/003", partyKey: "SLS", invoiceNo: "GM/26-27/057", date: "2026-09-23", taxable: 1_000, reason: "Agency error — wrong date on 2 stories; reposted, goodwill credit", status: "draft", raisedBy: "Karthik Subramanian" },
];

// ═════════════════════════ Expenses & Vendors (Module 34) ═════════════════════════

export const EXPENSE_CATEGORIES = [
  "Travel",
  "Food & refreshments",
  "Equipment rental",
  "Props & consumables",
  "Software",
  "Freelancer",
  "Utilities",
  "Marketing/Ads",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface ExpenseEvent {
  at: string;
  text: string;
  tone?: "success" | "danger" | "warning" | "accent";
}

export interface Expense {
  id: string;
  code: string;
  date: string;
  vendor: string;
  description: string;
  category: ExpenseCategory;
  requesterId: string;
  approverId: string;
  clientId?: string; // undefined → Overhead
  videoCode?: string;
  overheadPool?: string;
  amount: number; // incl. GST
  gst: number;
  itc: boolean; // GST input tax credit claimable
  paidBy: "employee" | "company";
  mode: "UPI" | "Card" | "Cash" | "NEFT" | "Auto-debit";
  paymentStatus: "unpaid" | "reimbursed" | "paid-to-vendor";
  approval: "pending" | "approved" | "rejected";
  receipt: boolean;
  rejectReason?: string;
  timeline: ExpenseEvent[];
}

export const expensesSeed: Expense[] = [
  {
    id: "e-01", code: "EXP-0926-031", date: "2026-09-24", vendor: "Chennai Camera Rentals", description: "Sony FX3 + gimbal kit — 2 days (bridal trousseau shoot)",
    category: "Equipment rental", requesterId: "p-karthik", approverId: "p-jana", clientId: "c-lakshmi", videoCode: "SLS-0926-03",
    amount: 10_620, gst: 1_620, itc: true, paidBy: "company", mode: "NEFT", paymentStatus: "unpaid", approval: "pending", receipt: true,
    timeline: [{ at: "2026-09-24T18:20:00", text: "Submitted by Karthik Subramanian" }, { at: "2026-09-24T18:21:00", text: "Above ₹10,000 — routed to Janarthanan", tone: "warning" }],
  },
  {
    id: "e-02", code: "EXP-0926-030", date: "2026-09-24", vendor: "Ola Outstation", description: "Cab — Appakudal ⇄ Coimbatore clinic shoot (2 days)",
    category: "Travel", requesterId: "p-vignesh", approverId: "p-ashwin", clientId: "c-nova", videoCode: "NVD-0926-02",
    amount: 5_450, gst: 260, itc: false, paidBy: "employee", mode: "UPI", paymentStatus: "unpaid", approval: "pending", receipt: true,
    timeline: [{ at: "2026-09-24T21:05:00", text: "Submitted by Vignesh Kumar" }, { at: "2026-09-24T21:05:00", text: "Travel above ₹5,000 — manager approval needed", tone: "warning" }],
  },
  {
    id: "e-03", code: "EXP-0926-029", date: "2026-09-23", vendor: "Studio Props Erode", description: "Diwali hamper props — rangoli kit, brass diyas, gift boxes",
    category: "Props & consumables", requesterId: "p-karthik", approverId: "p-ashwin", clientId: "c-kaveri", videoCode: "KVR-0926-05",
    amount: 2_360, gst: 360, itc: true, paidBy: "employee", mode: "UPI", paymentStatus: "unpaid", approval: "pending", receipt: true,
    timeline: [{ at: "2026-09-23T16:40:00", text: "Submitted by Karthik Subramanian" }],
  },
  {
    id: "e-04", code: "EXP-0926-028", date: "2026-09-23", vendor: "Deepa Nair", description: "Tamil voice-over — Diwali hamper ad (3h × ₹900)",
    category: "Freelancer", requesterId: "p-divya", approverId: "p-ashwin", clientId: "c-kaveri", videoCode: "KVR-0926-05",
    amount: 2_700, gst: 0, itc: false, paidBy: "company", mode: "NEFT", paymentStatus: "unpaid", approval: "pending", receipt: true,
    timeline: [{ at: "2026-09-23T12:10:00", text: "Submitted by Divya Lakshmi" }],
  },
  {
    id: "e-05", code: "EXP-0926-027", date: "2026-09-22", vendor: "Meta Platforms", description: "Meta ads — Genie Magnet lead-gen campaign (Sep week 3)",
    category: "Marketing/Ads", requesterId: "p-priya", approverId: "p-jana", overheadPool: "Sales & marketing",
    amount: 4_720, gst: 720, itc: true, paidBy: "company", mode: "Card", paymentStatus: "paid-to-vendor", approval: "pending", receipt: true,
    timeline: [{ at: "2026-09-22T10:00:00", text: "Auto-charged to company card" }, { at: "2026-09-22T10:02:00", text: "Submitted by Priya Venkatesh for approval" }],
  },
  {
    id: "e-06", code: "EXP-0926-026", date: "2026-09-21", vendor: "Kanchi Decor Rentals", description: "Silk saree display mannequins — rental (3 days)",
    category: "Props & consumables", requesterId: "p-meena", approverId: "p-ashwin", clientId: "c-lakshmi", videoCode: "SLS-0926-03",
    amount: 1_770, gst: 270, itc: true, paidBy: "employee", mode: "Cash", paymentStatus: "unpaid", approval: "pending", receipt: false,
    timeline: [{ at: "2026-09-21T19:30:00", text: "Submitted by Meena Ravi" }, { at: "2026-09-21T19:30:00", text: "Receipt missing — reminder sent", tone: "danger" }],
  },
  {
    id: "e-07", code: "EXP-0926-025", date: "2026-09-20", vendor: "Kovai Lights & Grip", description: "Aputure 600d ×2 + C-stands + diffusion — 1 day",
    category: "Equipment rental", requesterId: "p-vignesh", approverId: "p-ashwin", clientId: "c-nova", videoCode: "NVD-0926-01",
    amount: 3_540, gst: 540, itc: true, paidBy: "company", mode: "NEFT", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-20T09:10:00", text: "Submitted by Vignesh Kumar" }, { at: "2026-09-20T11:45:00", text: "Approved by Ashwin", tone: "success" }, { at: "2026-09-22T15:00:00", text: "Paid to vendor · NEFT", tone: "accent" }],
  },
  {
    id: "e-08", code: "EXP-0926-024", date: "2026-09-19", vendor: "Hotel Saravana Bhavan", description: "Crew lunch — Kanchipuram store shoot (9 pax)",
    category: "Food & refreshments", requesterId: "p-karthik", approverId: "p-ashwin", clientId: "c-lakshmi", videoCode: "SLS-0926-01",
    amount: 1_850, gst: 88, itc: false, paidBy: "employee", mode: "UPI", paymentStatus: "reimbursed", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-19T15:20:00", text: "Submitted by Karthik Subramanian" }, { at: "2026-09-19T18:00:00", text: "Approved by Ashwin", tone: "success" }, { at: "2026-09-21T10:30:00", text: "Reimbursed via UPI", tone: "accent" }],
  },
  {
    id: "e-09", code: "EXP-0926-023", date: "2026-09-18", vendor: "Manoj Pillai", description: "Drone aerials — Green Meadows sunset (4h × ₹1,200)",
    category: "Freelancer", requesterId: "p-karthik", approverId: "p-ashwin", clientId: "c-urban", videoCode: "UNR-0926-02",
    amount: 4_800, gst: 0, itc: false, paidBy: "company", mode: "NEFT", paymentStatus: "unpaid", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-18T20:00:00", text: "Submitted by Karthik Subramanian" }, { at: "2026-09-19T09:30:00", text: "Approved by Ashwin", tone: "success" }],
  },
  {
    id: "e-10", code: "EXP-0926-022", date: "2026-09-16", vendor: "Adobe", description: "Creative Cloud — 2 seats (Sep)",
    category: "Software", requesterId: "p-naveen", approverId: "p-ashwin", overheadPool: "Software & subscriptions",
    amount: 8_460, gst: 1_290, itc: true, paidBy: "company", mode: "Card", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-16T00:05:00", text: "Auto-charged to company card" }, { at: "2026-09-16T10:00:00", text: "Approved by Ashwin (recurring)", tone: "success" }],
  },
  {
    id: "e-11", code: "EXP-0926-021", date: "2026-09-15", vendor: "TNEB (TANGEDCO)", description: "Studio + edit bay electricity — Jul–Aug bill",
    category: "Utilities", requesterId: "p-harini", approverId: "p-ashwin", overheadPool: "Electricity",
    amount: 11_240, gst: 0, itc: false, paidBy: "company", mode: "NEFT", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-15T11:00:00", text: "Submitted by Harini Selvam" }, { at: "2026-09-15T12:10:00", text: "Approved by Ashwin", tone: "success" }, { at: "2026-09-15T12:30:00", text: "Paid online · TANGEDCO portal", tone: "accent" }],
  },
  {
    id: "e-12", code: "EXP-0926-020", date: "2026-09-14", vendor: "Indian Railways / Auto", description: "Train + auto — Kanchipuram store recce",
    category: "Travel", requesterId: "p-priya", approverId: "p-ashwin", clientId: "c-lakshmi", videoCode: "SLS-0926-04",
    amount: 1_840, gst: 0, itc: false, paidBy: "employee", mode: "UPI", paymentStatus: "reimbursed", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-14T21:00:00", text: "Submitted by Priya Venkatesh" }, { at: "2026-09-15T09:20:00", text: "Approved by Ashwin", tone: "success" }, { at: "2026-09-17T10:30:00", text: "Reimbursed via UPI", tone: "accent" }],
  },
  {
    id: "e-13", code: "EXP-0926-019", date: "2026-09-12", vendor: "Chennai Camera Rentals", description: "DJI RS4 Pro gimbal — 1 day (faculty intro)",
    category: "Equipment rental", requesterId: "p-vignesh", approverId: "p-ashwin", clientId: "c-bright", videoCode: "BPA-0926-02",
    amount: 2_950, gst: 450, itc: true, paidBy: "company", mode: "NEFT", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-12T08:30:00", text: "Submitted by Vignesh Kumar" }, { at: "2026-09-12T09:00:00", text: "Approved by Ashwin", tone: "success" }, { at: "2026-09-18T16:00:00", text: "Paid to vendor · NEFT", tone: "accent" }],
  },
  {
    id: "e-14", code: "EXP-0926-018", date: "2026-09-11", vendor: "Café Coffee Day", description: "Client coffee — Urban Nest site visit",
    category: "Food & refreshments", requesterId: "p-ashwin", approverId: "p-jana", overheadPool: "Management",
    amount: 780, gst: 37, itc: false, paidBy: "employee", mode: "Card", paymentStatus: "unpaid", approval: "rejected", receipt: true,
    rejectReason: "Duplicate of EXP-0926-015 — already claimed",
    timeline: [{ at: "2026-09-11T17:00:00", text: "Submitted by Ashwin" }, { at: "2026-09-12T10:00:00", text: "Rejected by Janarthanan — duplicate claim", tone: "danger" }],
  },
  {
    id: "e-15", code: "EXP-0926-017", date: "2026-09-10", vendor: "Airtel", description: "Xstream fibre 100 Mbps — Sep",
    category: "Utilities", requesterId: "p-naveen", approverId: "p-ashwin", overheadPool: "Internet",
    amount: 1_416, gst: 216, itc: true, paidBy: "company", mode: "Auto-debit", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-10T06:00:00", text: "Auto-debit from HDFC current account" }, { at: "2026-09-10T11:00:00", text: "Approved by Ashwin (recurring)", tone: "success" }],
  },
  {
    id: "e-16", code: "EXP-0926-016", date: "2026-09-09", vendor: "Google", description: "Google Ads — 'video agency Erode' search campaign",
    category: "Marketing/Ads", requesterId: "p-priya", approverId: "p-jana", overheadPool: "Sales & marketing",
    amount: 3_540, gst: 540, itc: true, paidBy: "company", mode: "Card", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-09T09:00:00", text: "Submitted by Priya Venkatesh" }, { at: "2026-09-09T13:15:00", text: "Approved by Janarthanan", tone: "success" }],
  },
  {
    id: "e-17", code: "EXP-0926-015", date: "2026-09-08", vendor: "Rahul Menon", description: "Freelance edit — Bridal trousseau long-form (16h × ₹450)",
    category: "Freelancer", requesterId: "p-karthik", approverId: "p-ashwin", clientId: "c-lakshmi", videoCode: "SLS-0926-03",
    amount: 7_200, gst: 0, itc: false, paidBy: "company", mode: "NEFT", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-08T19:00:00", text: "Submitted by Karthik Subramanian" }, { at: "2026-09-09T10:00:00", text: "Approved by Ashwin", tone: "success" }, { at: "2026-09-15T11:00:00", text: "Paid to freelancer · NEFT (TDS 1% u/s 194C)", tone: "accent" }],
  },
  {
    id: "e-18", code: "EXP-0926-014", date: "2026-09-06", vendor: "Frame.io", description: "Frame.io Pro plan — Sep",
    category: "Software", requesterId: "p-naveen", approverId: "p-ashwin", overheadPool: "Software & subscriptions",
    amount: 1_250, gst: 191, itc: true, paidBy: "company", mode: "Card", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-06T00:05:00", text: "Auto-charged to company card" }, { at: "2026-09-06T10:00:00", text: "Approved by Ashwin (recurring)", tone: "success" }],
  },
  {
    id: "e-19", code: "EXP-0926-013", date: "2026-09-05", vendor: "Indian Oil — Erode", description: "Fuel + toll — Erode mill shoot (Kaveri)",
    category: "Travel", requesterId: "p-vignesh", approverId: "p-ashwin", clientId: "c-kaveri", videoCode: "KVR-0926-07",
    amount: 2_860, gst: 0, itc: false, paidBy: "employee", mode: "UPI", paymentStatus: "unpaid", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-05T20:10:00", text: "Submitted by Vignesh Kumar" }, { at: "2026-09-06T09:00:00", text: "Approved by Ashwin", tone: "success" }],
  },
];

export interface Vendor {
  id: string;
  name: string;
  category: ExpenseCategory | "Rent";
  city: string;
  gstin: string; // or a note for unregistered / overseas (OIDAR)
  registered: boolean;
  terms: string;
  ytdSpend: number;
  lastPayment: { date: string; amount: number };
  rating: number; // out of 5
  contact: string;
}

export const vendorsSeed: Vendor[] = [
  { id: "vd-01", name: "Chennai Camera Rentals", category: "Equipment rental", city: "Chennai", gstin: "33AAKFC4521M1Z8", registered: true, terms: "Net 15", ytdSpend: 38_400, lastPayment: { date: "2026-09-18", amount: 2_950 }, rating: 4.8, contact: "Prakash · +91 98410 22871" },
  { id: "vd-02", name: "Kovai Lights & Grip", category: "Equipment rental", city: "Coimbatore", gstin: "33ABCFK7812P1Z3", registered: true, terms: "Net 7", ytdSpend: 21_600, lastPayment: { date: "2026-09-22", amount: 3_540 }, rating: 4.6, contact: "Senthil · +91 98430 51220" },
  { id: "vd-03", name: "Studio Props Erode", category: "Props & consumables", city: "Erode", gstin: "33BQTPS3398K1ZN", registered: true, terms: "50% advance", ytdSpend: 14_200, lastPayment: { date: "2026-09-02", amount: 1_890 }, rating: 4.2, contact: "Jayanthi · +91 94420 77310" },
  { id: "vd-04", name: "Airtel (Bharti Airtel Ltd)", category: "Utilities", city: "Chennai", gstin: "33AAACB2894G1ZP", registered: true, terms: "Auto-debit monthly", ytdSpend: 8_496, lastPayment: { date: "2026-09-10", amount: 1_416 }, rating: 3.9, contact: "Business care · 121" },
  { id: "vd-05", name: "TNEB (TANGEDCO)", category: "Utilities", city: "Erode", gstin: "Govt. utility — GST exempt", registered: false, terms: "Bi-monthly · due in 20 days", ytdSpend: 33_720, lastPayment: { date: "2026-09-15", amount: 11_240 }, rating: 3.5, contact: "Service no. 04-213-004-1187" },
  { id: "vd-06", name: "Adobe", category: "Software", city: "Overseas", gstin: "OIDAR · IGST collected by Adobe India", registered: true, terms: "Card · monthly", ytdSpend: 50_760, lastPayment: { date: "2026-09-16", amount: 8_460 }, rating: 4.5, contact: "adobe.com/in" },
  { id: "vd-07", name: "Frame.io", category: "Software", city: "Overseas", gstin: "OIDAR · reverse charge", registered: true, terms: "Card · monthly", ytdSpend: 7_500, lastPayment: { date: "2026-09-06", amount: 1_250 }, rating: 4.7, contact: "frame.io" },
  { id: "vd-08", name: "Google India Pvt Ltd", category: "Marketing/Ads", city: "Bengaluru", gstin: "29AACCG0527D1Z8", registered: true, terms: "Card · threshold billing", ytdSpend: 21_240, lastPayment: { date: "2026-09-09", amount: 3_540 }, rating: 4.4, contact: "ads.google.com" },
  { id: "vd-09", name: "Meta Platforms", category: "Marketing/Ads", city: "Overseas", gstin: "OIDAR · reverse charge", registered: true, terms: "Card · threshold billing", ytdSpend: 28_320, lastPayment: { date: "2026-09-22", amount: 4_720 }, rating: 4.1, contact: "business.facebook.com" },
  { id: "vd-10", name: "Rahul Menon", category: "Freelancer", city: "Coimbatore", gstin: "Unregistered · PAN BXKPM4421L", registered: false, terms: "Per job · Net 7", ytdSpend: 108_000, lastPayment: { date: "2026-09-15", amount: 7_200 }, rating: 4.9, contact: "+91 90030 22001" },
  { id: "vd-11", name: "Manoj Pillai", category: "Freelancer", city: "Tiruppur", gstin: "Unregistered · PAN CQPPP8810D", registered: false, terms: "Per job · Net 7", ytdSpend: 19_200, lastPayment: { date: "2026-08-28", amount: 4_800 }, rating: 4.7, contact: "+91 90030 22007" },
  { id: "vd-12", name: "Sneha Iyer", category: "Freelancer", city: "Chennai", gstin: "33AOJPI5561R1ZB", registered: true, terms: "Per job · Net 15", ytdSpend: 64_800, lastPayment: { date: "2026-09-12", amount: 7_080 }, rating: 4.8, contact: "+91 90030 22002" },
  { id: "vd-13", name: "Deepa Nair", category: "Freelancer", city: "Coimbatore", gstin: "Unregistered · PAN AHWPN2290K", registered: false, terms: "Per job · Net 7", ytdSpend: 16_200, lastPayment: { date: "2026-09-03", amount: 2_700 }, rating: 4.6, contact: "+91 90030 22004" },
  { id: "vd-14", name: "Appakudal Properties", category: "Rent", city: "Appakudal", gstin: "Unregistered landlord · PAN AKRPS4417M", registered: false, terms: "Rent · 5th of month", ytdSpend: 90_000, lastPayment: { date: "2026-09-05", amount: 15_000 }, rating: 4.3, contact: "Owner · +91 94433 10087" },
];

// ═════════════════════════ Financial Reports (Module 36) ═════════════════════════

const REPORT_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"] as const;
const monthKey = (iso: string) => FY_MONTHS[(Number(iso.slice(5, 7)) + 8) % 12]!;

/** Retainer value contracted per month (matches the dashboard revenue trend) + add-ons/one-offs signed. */
const RETAINER_CONTRACTED = { Apr: 198_000, May: 213_000, Jun: 268_000, Jul: 268_000, Aug: 268_000, Sep: 268_000 } as const;
/** New contracts signed in the month that start later (Nirmala Cooking Academy ₹40K/month from Oct). */
const SIGNED_FORWARD = { Apr: 0, May: 0, Jun: 0, Jul: 0, Aug: 0, Sep: 40_000 } as const;

/** Receipts in the month against invoices raised last FY (Sri Lakshmi's April advance, paid 2 Apr). */
const PRIOR_YEAR_RECEIPTS: Record<string, number> = { Apr: 76_700 };

/** Cash received per month incl. GST (payments by cash/bank + advances received). */
const cashIn = (month: string) =>
  (PRIOR_YEAR_RECEIPTS[month] ?? 0) +
  invoicesSeed.flatMap((i) => i.payments).filter((p) => p.mode !== "Advance" && monthKey(p.date) === month).reduce((s, p) => s + p.amount + p.tds, 0) +
  advancesSeed.filter((a) => monthKey(a.receivedOn) === month).reduce((s, a) => s + a.amount, 0);

/** Revenue types by month, ex-GST. Invoiced & collected are derived from the invoice register; earned = monthlyFinance actual. */
export const revenueTypes = REPORT_MONTHS.map((month) => {
  const earned = monthlyFinance.find((x) => x.month === month)!.actualRevenue ?? 0;
  const addOns = earned - RETAINER_CONTRACTED[month];
  return {
    month,
    contracted: RETAINER_CONTRACTED[month] + addOns + SIGNED_FORWARD[month],
    invoiced: invoicesSeed.filter((i) => monthKey(i.issueDate) === month).reduce((s, i) => s + i.taxable, 0),
    earned,
    collected: Math.round(cashIn(month) / (1 + GST_RATE)),
  };
});

export const REVENUE_TYPE_DEFS = {
  contracted: "Value of signed agreements & POs for the month — what clients have committed to pay (includes new retainers signed to start later).",
  invoiced: "Tax invoices raised in the month (taxable value, before GST). Kaveri & Sri Lakshmi are billed at month-end for the next month.",
  earned: "Revenue recognised for work actually delivered in the month — the P&L number.",
  collected: "Cash received in the month (net of GST), including client advances.",
} as const;

export const OPENING_CASH_APR = 4.2 * L;

/** Cash flow (incl. GST) Apr–Sep. Outflows = expenses (+ GST on purchases) + net GST remitted on last month's invoices. */
export const cashFlow = (() => {
  let bal = OPENING_CASH_APR;
  let prevInvoiced = 2.05 * L; // March 2026 invoices (FY 2025-26)
  return REPORT_MONTHS.map((month) => {
    const mfRow = monthlyFinance.find((x) => x.month === month)!;
    const inflow = cashIn(month);
    const outflow = Math.round((mfRow.actualExpense ?? 0) * 1.05 + prevInvoiced * 0.13);
    prevInvoiced = revenueTypes.find((r) => r.month === month)!.invoiced;
    const net = inflow - outflow;
    bal += net;
    return { month, inflow, outflow, net, closing: bal };
  });
})();

/** Budget vs actual FY 2026-27, Apr–Sep (ex-GST). Salaries exclude founder remuneration. Totals tie to monthlyFinance. */
export const budgetCategories = [
  { category: "Salaries", budget: 9.5 * L, actual: 9.6 * L, note: "Excl. founder remuneration" },
  { category: "Freelancers", budget: 2.0 * L, actual: 2.3 * L, note: "Variable — Rahul (edits), Sneha (motion) in festive rush" },
  { category: "Rent", budget: 0.9 * L, actual: 0.9 * L, note: "Appakudal studio & office" },
  { category: "Software", budget: 0.72 * L, actual: 0.69 * L, note: "Adobe (2 seats), Frame.io, Workspace" },
  { category: "Equipment", budget: 0.69 * L, actual: 0.55 * L, note: "Rentals + maintenance" },
  { category: "Travel", budget: 0.6 * L, actual: 0.62 * L, note: "Outstation shoots — Kanchipuram, Chennai" },
  { category: "Marketing", budget: 0.8 * L, actual: 0.5 * L, note: "Meta + Google ads, BNI" },
  { category: "Utilities", budget: 0.44 * L, actual: 0.44 * L, note: "Electricity + internet" },
  { category: "Props & misc", budget: 0.5 * L, actual: 0.5 * L, note: "Props, consumables, CA & bank fees" },
];

/** P&L FY-to-date (Apr–Sep 2026), ex-GST. Draft structure — definitions pending approval. */
export const pnlYtd = {
  revenue: ytd.revenue,
  direct: [
    { label: "Direct labour (logged hours on videos)", amount: 6.4 * L },
    { label: "Freelancers", amount: 2.3 * L },
    { label: "Shoot travel & equipment rental", amount: 1.17 * L },
    { label: "Props & consumables", amount: 0.2 * L },
  ],
  variable: [
    { label: "Marketing & ads", amount: 0.5 * L },
    { label: "Software seats", amount: 0.69 * L },
    { label: "Utilities (power, internet)", amount: 0.44 * L },
  ],
  fixed: [
    { label: "Management & admin salaries (excl. founder)", amount: 3.2 * L },
    { label: "Rent", amount: 0.9 * L },
    { label: "CA, bank & professional fees", amount: 0.3 * L },
  ],
};

export const periodLocksSeed = [
  { month: "Apr", lockedOn: "5 May 2026", by: "Finance Desk" },
  { month: "May", lockedOn: "5 Jun 2026", by: "Finance Desk" },
  { month: "Jun", lockedOn: "4 Jul 2026", by: "Finance Desk" },
  { month: "Jul", lockedOn: "5 Aug 2026", by: "Finance Desk" },
  { month: "Aug", lockedOn: "5 Sep 2026", by: "Finance Desk" },
];
