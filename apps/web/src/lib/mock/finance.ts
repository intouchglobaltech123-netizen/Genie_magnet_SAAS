// Finance mock data — Genie Magnet, Indian FY (Apr–Mar). FY 2026-27 is the current year; "today" is 25 Sep 2026.
// Company-level figures include all retainers, one-off projects and partner work (not only the 5 showcase clients).

export const FY_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"] as const;
export type FyMonth = (typeof FY_MONTHS)[number];

export const GST_RATE = 0.18;

/** Business Aspiration FY 2026-27 */
export const BUSINESS_ASPIRATION = {
  fy: "FY 2026-27",
  revenueGoal: 12_000_000, // ₹1.2 Cr
  netMarginGoal: 0.2,
  quarters: [
    { q: "Q1", months: "Apr–Jun", goal: 2_500_000 },
    { q: "Q2", months: "Jul–Sep", goal: 2_800_000 },
    { q: "Q3", months: "Oct–Dec", goal: 3_200_000 },
    { q: "Q4", months: "Jan–Mar", goal: 3_500_000 },
  ],
};

export interface MonthFinance {
  month: FyMonth;
  /** FY 2025-26 actuals */
  prevRevenue: number;
  prevExpense: number;
  /** FY 2026-27 goal (Business Aspiration break-up) */
  goalRevenue: number;
  goalExpense: number; // budget
  /** FY 2026-27 actuals — null for future months. Sep is month-to-date (period open). */
  actualRevenue: number | null;
  actualExpense: number | null;
  locked: boolean;
}

const L = 100_000;

export const monthlyFinance: MonthFinance[] = [
  { month: "Apr", prevRevenue: 5.6 * L, prevExpense: 5.0 * L, goalRevenue: 8.0 * L, goalExpense: 6.4 * L, actualRevenue: 7.8 * L, actualExpense: 6.5 * L, locked: true },
  { month: "May", prevRevenue: 5.9 * L, prevExpense: 5.2 * L, goalRevenue: 8.3 * L, goalExpense: 6.64 * L, actualRevenue: 8.2 * L, actualExpense: 6.7 * L, locked: true },
  { month: "Jun", prevRevenue: 6.1 * L, prevExpense: 5.3 * L, goalRevenue: 8.7 * L, goalExpense: 6.96 * L, actualRevenue: 8.6 * L, actualExpense: 7.0 * L, locked: true },
  { month: "Jul", prevRevenue: 6.4 * L, prevExpense: 5.5 * L, goalRevenue: 9.0 * L, goalExpense: 7.2 * L, actualRevenue: 9.1 * L, actualExpense: 7.3 * L, locked: true },
  { month: "Aug", prevRevenue: 6.8 * L, prevExpense: 5.7 * L, goalRevenue: 9.4 * L, goalExpense: 7.52 * L, actualRevenue: 9.4 * L, actualExpense: 7.6 * L, locked: true },
  { month: "Sep", prevRevenue: 6.5 * L, prevExpense: 5.6 * L, goalRevenue: 9.6 * L, goalExpense: 7.68 * L, actualRevenue: 8.7 * L, actualExpense: 7.2 * L, locked: false },
  { month: "Oct", prevRevenue: 7.4 * L, prevExpense: 6.0 * L, goalRevenue: 10.4 * L, goalExpense: 8.32 * L, actualRevenue: null, actualExpense: null, locked: false },
  { month: "Nov", prevRevenue: 7.1 * L, prevExpense: 5.9 * L, goalRevenue: 10.9 * L, goalExpense: 8.72 * L, actualRevenue: null, actualExpense: null, locked: false },
  { month: "Dec", prevRevenue: 7.6 * L, prevExpense: 6.1 * L, goalRevenue: 10.7 * L, goalExpense: 8.56 * L, actualRevenue: null, actualExpense: null, locked: false },
  { month: "Jan", prevRevenue: 7.2 * L, prevExpense: 6.0 * L, goalRevenue: 11.2 * L, goalExpense: 8.96 * L, actualRevenue: null, actualExpense: null, locked: false },
  { month: "Feb", prevRevenue: 7.5 * L, prevExpense: 6.2 * L, goalRevenue: 11.6 * L, goalExpense: 9.28 * L, actualRevenue: null, actualExpense: null, locked: false },
  { month: "Mar", prevRevenue: 8.1 * L, prevExpense: 6.4 * L, goalRevenue: 12.2 * L, goalExpense: 9.76 * L, actualRevenue: null, actualExpense: null, locked: false },
];

export const ytd = (() => {
  const done = monthlyFinance.filter((m) => m.actualRevenue !== null);
  const revenue = done.reduce((s, m) => s + (m.actualRevenue ?? 0), 0);
  const expense = done.reduce((s, m) => s + (m.actualExpense ?? 0), 0);
  const goal = done.reduce((s, m) => s + m.goalRevenue, 0);
  const prev = done.reduce((s, m) => s + m.prevRevenue, 0);
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
    monthly: 95_000,
    basis: "Direct labour hours",
    items: [
      { label: "Janarthanan — unlogged (non-project) hours", amount: 68_000 },
      { label: "Ashwin — unlogged (non-project) hours", amount: 27_000 },
    ],
    note: "Hours logged directly on a video are charged as labour, so only the unlogged share flows here — no double counting.",
  },
  {
    id: "op-hr",
    name: "HR & Admin",
    monthly: 38_000,
    basis: "Direct labour hours",
    items: [
      { label: "Harini Selvam — HR & admin", amount: 26_000 },
      { label: "Naveen Raj — IT support (share)", amount: 12_000 },
    ],
  },
  {
    id: "op-rent",
    name: "Rent — Appakudal studio & office",
    monthly: 42_000,
    basis: "Direct labour hours",
    items: [{ label: "Studio + office lease", amount: 42_000 }],
  },
  {
    id: "op-soft",
    name: "Software & subscriptions",
    monthly: 36_400,
    basis: "Direct labour hours",
    items: [
      { label: "Adobe Creative Cloud (5 seats)", amount: 21_150 },
      { label: "Frame.io (Team)", amount: 4_150 },
      { label: "Google Workspace (12 users)", amount: 8_832 },
      { label: "Canva Pro", amount: 2_268 },
    ],
  },
  {
    id: "op-power",
    name: "Electricity",
    monthly: 16_400,
    basis: "Direct labour hours",
    items: [{ label: "TNEB — studio + edit bay", amount: 16_400 }],
  },
  {
    id: "op-net",
    name: "Internet",
    monthly: 6_200,
    basis: "Direct labour hours",
    items: [
      { label: "Airtel Xstream fibre 300 Mbps", amount: 4_200 },
      { label: "ACT backup line", amount: 2_000 },
    ],
  },
];

export const OVERHEAD_TOTAL = overheadPools.reduce((s, p) => s + p.monthly, 0); // ₹2,34,000
/** Direct labour hours logged on client work in a typical month (all employees + freelancers). */
export const DIRECT_LABOUR_HOURS = 1_950;
/** ₹120 per direct labour hour */
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
const RET_BPA = "Admissions Campaign — 50% advance + balance";
const RET_AND = "Social retainer — reels & festive posts";
const TDS2 = 0.02; // TDS u/s 194C deducted by corporate clients

export const invoicesSeed: Invoice[] = [
  // ── April
  mkInvoice(1, "KVR", "Apr 2026", RET_KVR, "2026-04-01", "2026-04-10", 85_000, [{ date: "2026-04-08", mode: "NEFT" }]),
  mkInvoice(2, "SLS", "Apr 2026", RET_SLS, "2026-04-01", "2026-04-10", 65_000, [{ date: "2026-04-09", mode: "UPI" }]),
  mkInvoice(3, "NVD", "Mar 2026", RET_NVD, "2026-04-02", "2026-04-17", 48_000, [{ date: "2026-04-16", mode: "NEFT" }]),
  mkInvoice(4, "CHN", "Apr 2026", "Corporate film — 25 years of care (milestone 1 of 2)", "2026-04-05", "2026-04-20", 220_000, [{ date: "2026-04-24", mode: "NEFT", tdsPct: TDS2 }]),
  mkInvoice(5, "RVJ", "Apr 2026", "Akshaya Tritiya campaign — 6 reels + 2 ads", "2026-04-10", "2026-04-25", 185_000, [{ date: "2026-04-22", mode: "NEFT" }]),
  mkInvoice(6, "AND", "Apr 2026", RET_AND, "2026-04-12", "2026-04-27", 45_000, [{ date: "2026-04-30", mode: "UPI" }]),
  mkInvoice(7, "THS", "Apr 2026", "Property film — 3 heritage properties", "2026-04-18", "2026-05-03", 132_000, [{ date: "2026-05-02", mode: "Cheque" }]),
  // ── May
  mkInvoice(8, "KVR", "May 2026", RET_KVR, "2026-05-01", "2026-05-10", 85_000, [{ date: "2026-05-09", mode: "NEFT" }]),
  mkInvoice(9, "SLS", "May 2026", RET_SLS, "2026-05-01", "2026-05-10", 65_000, [{ date: "2026-05-08", mode: "UPI" }]),
  mkInvoice(10, "NVD", "Apr 2026", RET_NVD, "2026-05-02", "2026-05-17", 48_000, [{ date: "2026-05-15", mode: "NEFT" }]),
  mkInvoice(11, "AND", "May 2026", RET_AND, "2026-05-05", "2026-05-20", 45_000, [{ date: "2026-05-24", mode: "UPI" }]),
  mkInvoice(12, "RVJ", "May 2026", "Wedding season catalogue shoot", "2026-05-08", "2026-05-23", 160_000, [{ date: "2026-05-21", mode: "NEFT" }]),
  mkInvoice(13, "NCA", "May 2026", "Course trailer series — 5 trailers", "2026-05-12", "2026-05-27", 118_000, [{ date: "2026-05-26", mode: "UPI" }]),
  mkInvoice(14, "BPA", "May 2026", "Admissions Campaign — 50% advance (15–31 May)", "2026-05-15", "2026-05-22", 15_000, [{ date: "2026-05-20", mode: "UPI" }]),
  mkInvoice(15, "KFB", "May 2026", "Bakery launch reels pack — 8 reels", "2026-05-19", "2026-06-03", 96_000, [{ date: "2026-06-02", mode: "NEFT" }]),
  mkInvoice(16, "KSR", "May 2026", "Export brand film — English + Malayalam cuts", "2026-05-24", "2026-06-08", 188_000, [{ date: "2026-05-24", mode: "Advance", amount: 35_400 }, { date: "2026-06-10", mode: "NEFT", amount: 186_440 }]),
  // ── June
  mkInvoice(17, "KVR", "Jun 2026", RET_KVR, "2026-06-01", "2026-06-10", 85_000, [{ date: "2026-06-09", mode: "NEFT" }]),
  mkInvoice(18, "SLS", "Jun 2026", RET_SLS, "2026-06-01", "2026-06-10", 65_000, [{ date: "2026-06-10", mode: "UPI" }]),
  mkInvoice(19, "NVD", "May 2026", RET_NVD, "2026-06-02", "2026-06-17", 48_000, [{ date: "2026-06-17", mode: "NEFT" }]),
  mkInvoice(20, "BPA", "Jun 2026", RET_BPA, "2026-06-03", "2026-06-10", 30_000, [{ date: "2026-06-09", mode: "UPI" }]),
  mkInvoice(21, "AND", "Jun 2026", RET_AND, "2026-06-04", "2026-06-19", 45_000, [{ date: "2026-06-25", mode: "UPI" }]),
  mkInvoice(22, "THS", "Jun 2026", "Monsoon getaway campaign — film + 6 reels", "2026-06-08", "2026-06-23", 120_000, [{ date: "2026-06-28", mode: "NEFT", amount: 118_000 }], { reminders: 3, lastReminder: "2026-09-12" }),
  mkInvoice(23, "MDM", "Jun 2026", "Store launch campaign — 3 branches", "2026-06-10", "2026-06-25", 142_000, [{ date: "2026-06-30", mode: "Cheque" }]),
  mkInvoice(24, "CHN", "Jun 2026", "Corporate film final milestone + doctor profiles", "2026-06-12", "2026-06-27", 175_000, [{ date: "2026-07-02", mode: "NEFT", tdsPct: TDS2 }]),
  mkInvoice(25, "MSH", "Jun 2026", "Brand film + 4 reels (Kannada & English)", "2026-06-15", "2026-06-30", 150_000, [{ date: "2026-07-01", mode: "NEFT" }]),
  // ── July
  mkInvoice(26, "KVR", "Jul 2026", RET_KVR, "2026-07-01", "2026-07-10", 85_000, [{ date: "2026-07-08", mode: "NEFT" }]),
  mkInvoice(27, "SLS", "Jul 2026", RET_SLS, "2026-07-01", "2026-07-10", 65_000, [{ date: "2026-07-09", mode: "UPI" }]),
  mkInvoice(28, "NVD", "Jun 2026", RET_NVD, "2026-07-02", "2026-07-17", 48_000, [{ date: "2026-07-18", mode: "NEFT" }], { creditAdj: 11_328 }),
  mkInvoice(29, "BPA", "Jul 2026", RET_BPA, "2026-07-03", "2026-07-10", 30_000, [{ date: "2026-07-12", mode: "UPI" }]),
  mkInvoice(30, "AND", "Jul 2026", RET_AND, "2026-07-03", "2026-07-15", 45_000, [{ date: "2026-07-20", mode: "UPI", amount: 23_600 }], { reminders: 2, lastReminder: "2026-09-05" }),
  mkInvoice(31, "RVJ", "Jul 2026", "Aadi sale reels — 8 reels", "2026-07-06", "2026-07-21", 138_000, [{ date: "2026-07-20", mode: "NEFT" }]),
  mkInvoice(32, "CHN", "Jul 2026", "OPD awareness films — 4 films", "2026-07-09", "2026-07-24", 190_000, [{ date: "2026-07-29", mode: "NEFT", tdsPct: TDS2 }]),
  mkInvoice(33, "NCA", "Jul 2026", "Recipe reel series — 6 reels", "2026-07-14", "2026-07-29", 98_000, [{ date: "2026-07-28", mode: "UPI" }]),
  mkInvoice(34, "KFB", "Jul 2026", "Monsoon menu reels", "2026-07-18", "2026-08-02", 86_000, [{ date: "2026-08-01", mode: "NEFT" }]),
  mkInvoice(35, "MDM", "Jul 2026", "Aadi offer campaign + in-store reels", "2026-07-26", "2026-08-10", 125_000, [{ date: "2026-08-14", mode: "Cheque", amount: 106_200 }], { reminders: 1, lastReminder: "2026-09-10" }),
  // ── August
  mkInvoice(36, "KVR", "Aug 2026", RET_KVR, "2026-08-01", "2026-08-10", 85_000, [{ date: "2026-08-07", mode: "NEFT" }]),
  mkInvoice(37, "SLS", "Aug 2026", RET_SLS, "2026-08-01", "2026-08-10", 65_000, [{ date: "2026-08-11", mode: "UPI" }]),
  mkInvoice(38, "NVD", "Jul 2026", RET_NVD, "2026-08-03", "2026-08-18", 48_000, [{ date: "2026-08-25", mode: "UPI", amount: 17_280 }], { reminders: 1, lastReminder: "2026-09-08" }),
  mkInvoice(39, "BPA", "Aug 2026", RET_BPA, "2026-08-04", "2026-08-10", 30_000, [{ date: "2026-08-09", mode: "UPI" }]),
  mkInvoice(40, "AND", "Aug 2026", RET_AND, "2026-08-06", "2026-08-21", 45_000, [{ date: "2026-08-22", mode: "UPI" }]),
  mkInvoice(41, "UNR", "Jun–Jul 2026", "Project walkthroughs Jun & Jul (arrears) + drone add-on", "2026-08-09", "2026-08-24", 101_695, [], { reminders: 2, lastReminder: "2026-09-18" }),
  mkInvoice(42, "CHN", "Aug 2026", "Heart-care month campaign — 5 films", "2026-08-12", "2026-08-27", 210_000, [{ date: "2026-09-02", mode: "NEFT", tdsPct: TDS2 }]),
  mkInvoice(43, "RVJ", "Aug 2026", "Varalakshmi Vratham campaign", "2026-08-14", "2026-08-29", 152_000, [{ date: "2026-08-28", mode: "NEFT" }]),
  mkInvoice(44, "THS", "Aug 2026", "Weekend packages — reels & stills", "2026-08-18", "2026-09-02", 118_000, [{ date: "2026-09-05", mode: "NEFT" }]),
  mkInvoice(45, "MDM", "Aug 2026", "Vinayagar Chathurthi offers — 5 reels", "2026-08-22", "2026-09-06", 85_000, [{ date: "2026-09-10", mode: "Cheque" }]),
  // ── September (month-to-date)
  mkInvoice(46, "KVR", "Sep 2026", RET_KVR, "2026-09-01", "2026-09-10", 85_000, [{ date: "2026-09-08", mode: "NEFT" }]),
  mkInvoice(47, "SLS", "Sep 2026", RET_SLS, "2026-09-01", "2026-09-30", 65_000, [{ date: "2026-09-01", mode: "Advance", amount: 11_700 }]),
  mkInvoice(48, "BPA", "Sep 2026", RET_BPA, "2026-09-01", "2026-09-20", 30_000, [{ date: "2026-09-01", mode: "Advance", amount: 20_400 }]),
  mkInvoice(49, "NVD", "Aug 2026", RET_NVD, "2026-09-02", "2026-09-17", 48_000, [], { reminders: 1, lastReminder: "2026-09-22" }),
  mkInvoice(50, "AND", "Sep 2026", RET_AND, "2026-09-04", "2026-09-19", 45_000, [{ date: "2026-09-18", mode: "UPI" }]),
  mkInvoice(51, "CHN", "Sep 2026", "Diwali health camp film + 3 reels", "2026-09-08", "2026-10-08", 180_000),
  mkInvoice(52, "RVJ", "Sep 2026", "Navaratri collection film", "2026-09-10", "2026-10-10", 168_000),
  mkInvoice(53, "NCA", "Sep 2026", "Festive baking course trailers", "2026-09-12", "2026-09-27", 72_000, [{ date: "2026-09-20", mode: "UPI" }]),
  mkInvoice(54, "KFB", "Sep 2026", "Diwali hamper launch reels", "2026-09-15", "2026-09-30", 92_000),
  mkInvoice(55, "KSR", "Sep 2026", "Onam export campaign — 4 reels", "2026-09-18", "2026-10-03", 85_000),
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
  { id: "adv-1", number: "ADV/26-27/001", partyKey: "KSR", receivedOn: "2026-05-20", amount: 59_000, mode: "NEFT", ref: "UTR FDRLR52026052011", purpose: "Export film — booking advance", adjustments: [{ invoiceNo: "GM/26-27/016", amount: 35_400, date: "2026-05-24" }] },
  { id: "adv-2", number: "ADV/26-27/002", partyKey: "BPA", receivedOn: "2026-08-28", amount: 20_400, mode: "UPI", ref: "UPI/624118820113", purpose: "50% advance — Sep cycle", adjustments: [{ invoiceNo: "GM/26-27/048", amount: 20_400, date: "2026-09-01" }] },
  { id: "adv-3", number: "ADV/26-27/003", partyKey: "SLS", receivedOn: "2026-08-29", amount: 11_700, mode: "UPI", ref: "UPI/624120074452", purpose: "Navaratri extra reels — part advance", adjustments: [{ invoiceNo: "GM/26-27/047", amount: 11_700, date: "2026-09-01" }] },
  { id: "adv-4", number: "ADV/26-27/004", partyKey: "CHN", receivedOn: "2026-08-30", amount: 100_000, mode: "NEFT", ref: "UTR ICICR52026083044", purpose: "Diwali health camp film — booking", adjustments: [] },
  { id: "adv-5", number: "ADV/26-27/005", partyKey: "RVJ", receivedOn: "2026-09-12", amount: 50_000, mode: "Cheque", ref: "CHQ 118842 · Canara Bank", purpose: "Diwali catalogue shoot (Oct) — advance", adjustments: [] },
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
  { id: "cn-1", number: "CN/26-27/001", partyKey: "AND", invoiceNo: "GM/26-27/011", date: "2026-05-22", taxable: 5_000, reason: "Festival reel published 2 days late — goodwill discount", status: "applied", raisedBy: "Ashwin" },
  { id: "cn-2", number: "CN/26-27/002", partyKey: "NVD", invoiceNo: "GM/26-27/028", date: "2026-07-15", taxable: 9_600, reason: "Unit not delivered — carried forward refused (1 testimonial, Jun cycle)", status: "applied", raisedBy: "Ashwin" },
  { id: "cn-3", number: "CN/26-27/003", partyKey: "MDM", invoiceNo: "GM/26-27/023", date: "2026-07-02", taxable: 7_500, reason: "Duplicate billing of 1 in-store reel", status: "applied", raisedBy: "Finance Desk" },
  { id: "cn-4", number: "CN/26-27/004", partyKey: "MDM", invoiceNo: "GM/26-27/035", date: "2026-09-23", taxable: 5_000, reason: "Agency error — wrong store address in super; reshoot not billable", status: "draft", raisedBy: "Karthik Subramanian" },
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
    id: "e-01", code: "EXP-0926-031", date: "2026-09-24", vendor: "Chennai Camera Rentals", description: "Sony FX6 + 24-70 GM — 2 days (bridal trousseau shoot)",
    category: "Equipment rental", requesterId: "p-karthik", approverId: "p-jana", clientId: "c-lakshmi", videoCode: "SLS-0926-03",
    amount: 21_240, gst: 3_240, itc: true, paidBy: "company", mode: "NEFT", paymentStatus: "unpaid", approval: "pending", receipt: true,
    timeline: [{ at: "2026-09-24T18:20:00", text: "Submitted by Karthik Subramanian" }, { at: "2026-09-24T18:21:00", text: "Above ₹10,000 — routed to Janarthanan", tone: "warning" }],
  },
  {
    id: "e-02", code: "EXP-0926-030", date: "2026-09-24", vendor: "Ola Outstation", description: "Cab — Appakudal ⇄ Coimbatore clinic shoot (2 days)",
    category: "Travel", requesterId: "p-vignesh", approverId: "p-ashwin", clientId: "c-nova", videoCode: "NVD-0926-02",
    amount: 6_420, gst: 306, itc: false, paidBy: "employee", mode: "UPI", paymentStatus: "unpaid", approval: "pending", receipt: true,
    timeline: [{ at: "2026-09-24T21:05:00", text: "Submitted by Vignesh Kumar" }, { at: "2026-09-24T21:05:00", text: "Travel above ₹5,000 — manager approval needed", tone: "warning" }],
  },
  {
    id: "e-03", code: "EXP-0926-029", date: "2026-09-23", vendor: "Studio Props Erode", description: "Diwali hamper props — rangoli kit, brass diyas, gift boxes",
    category: "Props & consumables", requesterId: "p-karthik", approverId: "p-ashwin", clientId: "c-kaveri", videoCode: "KVR-0926-05",
    amount: 6_490, gst: 990, itc: true, paidBy: "employee", mode: "UPI", paymentStatus: "unpaid", approval: "pending", receipt: true,
    timeline: [{ at: "2026-09-23T16:40:00", text: "Submitted by Karthik Subramanian" }],
  },
  {
    id: "e-04", code: "EXP-0926-028", date: "2026-09-23", vendor: "Deepa Nair", description: "Tamil voice-over — Diwali hamper ad (30s + 15s cut)",
    category: "Freelancer", requesterId: "p-divya", approverId: "p-ashwin", clientId: "c-kaveri", videoCode: "KVR-0926-05",
    amount: 7_500, gst: 0, itc: false, paidBy: "company", mode: "NEFT", paymentStatus: "unpaid", approval: "pending", receipt: true,
    timeline: [{ at: "2026-09-23T12:10:00", text: "Submitted by Divya Lakshmi" }],
  },
  {
    id: "e-05", code: "EXP-0926-027", date: "2026-09-22", vendor: "Meta Platforms", description: "Meta ads — Genie Magnet lead-gen campaign (Sep week 3)",
    category: "Marketing/Ads", requesterId: "p-priya", approverId: "p-jana", overheadPool: "Sales & marketing",
    amount: 14_750, gst: 2_250, itc: true, paidBy: "company", mode: "Card", paymentStatus: "paid-to-vendor", approval: "pending", receipt: true,
    timeline: [{ at: "2026-09-22T10:00:00", text: "Auto-charged to company card" }, { at: "2026-09-22T10:02:00", text: "Submitted by Priya Venkatesh for approval" }],
  },
  {
    id: "e-06", code: "EXP-0926-026", date: "2026-09-21", vendor: "Kanchi Decor Rentals", description: "Silk saree display mannequins — rental (3 days)",
    category: "Props & consumables", requesterId: "p-meena", approverId: "p-ashwin", clientId: "c-lakshmi", videoCode: "SLS-0926-03",
    amount: 4_720, gst: 720, itc: true, paidBy: "employee", mode: "Cash", paymentStatus: "unpaid", approval: "pending", receipt: false,
    timeline: [{ at: "2026-09-21T19:30:00", text: "Submitted by Meena Ravi" }, { at: "2026-09-21T19:30:00", text: "Receipt missing — reminder sent", tone: "danger" }],
  },
  {
    id: "e-07", code: "EXP-0926-025", date: "2026-09-20", vendor: "Kovai Lights & Grip", description: "Aputure 600d ×2 + C-stands + diffusion — 1 day",
    category: "Equipment rental", requesterId: "p-vignesh", approverId: "p-ashwin", clientId: "c-nova", videoCode: "NVD-0926-01",
    amount: 8_260, gst: 1_260, itc: true, paidBy: "company", mode: "NEFT", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-20T09:10:00", text: "Submitted by Vignesh Kumar" }, { at: "2026-09-20T11:45:00", text: "Approved by Ashwin", tone: "success" }, { at: "2026-09-22T15:00:00", text: "Paid to vendor · NEFT", tone: "accent" }],
  },
  {
    id: "e-08", code: "EXP-0926-024", date: "2026-09-19", vendor: "Hotel Saravana Bhavan", description: "Crew lunch — Kanchipuram store shoot (9 pax)",
    category: "Food & refreshments", requesterId: "p-karthik", approverId: "p-ashwin", clientId: "c-lakshmi", videoCode: "SLS-0926-01",
    amount: 3_150, gst: 150, itc: false, paidBy: "employee", mode: "UPI", paymentStatus: "reimbursed", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-19T15:20:00", text: "Submitted by Karthik Subramanian" }, { at: "2026-09-19T18:00:00", text: "Approved by Ashwin", tone: "success" }, { at: "2026-09-21T10:30:00", text: "Reimbursed via UPI", tone: "accent" }],
  },
  {
    id: "e-09", code: "EXP-0926-023", date: "2026-09-18", vendor: "Manoj Pillai", description: "Drone aerials — Green Meadows sunset (DJI Mavic 3)",
    category: "Freelancer", requesterId: "p-karthik", approverId: "p-ashwin", clientId: "c-urban", videoCode: "UNR-0926-02",
    amount: 12_000, gst: 0, itc: false, paidBy: "company", mode: "NEFT", paymentStatus: "unpaid", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-18T20:00:00", text: "Submitted by Karthik Subramanian" }, { at: "2026-09-19T09:30:00", text: "Approved by Ashwin", tone: "success" }],
  },
  {
    id: "e-10", code: "EXP-0926-022", date: "2026-09-16", vendor: "Adobe", description: "Creative Cloud — 5 seats (Sep)",
    category: "Software", requesterId: "p-naveen", approverId: "p-ashwin", overheadPool: "Software & subscriptions",
    amount: 21_150, gst: 3_226, itc: true, paidBy: "company", mode: "Card", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-16T00:05:00", text: "Auto-charged to company card" }, { at: "2026-09-16T10:00:00", text: "Approved by Ashwin (recurring)", tone: "success" }],
  },
  {
    id: "e-11", code: "EXP-0926-021", date: "2026-09-15", vendor: "TNEB (TANGEDCO)", description: "Studio + edit bay electricity — Jul–Aug bill",
    category: "Utilities", requesterId: "p-harini", approverId: "p-ashwin", overheadPool: "Electricity",
    amount: 32_800, gst: 0, itc: false, paidBy: "company", mode: "NEFT", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
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
    id: "e-15", code: "EXP-0926-017", date: "2026-09-10", vendor: "Airtel", description: "Xstream fibre 300 Mbps — Sep",
    category: "Utilities", requesterId: "p-naveen", approverId: "p-ashwin", overheadPool: "Internet",
    amount: 4_956, gst: 756, itc: true, paidBy: "company", mode: "Auto-debit", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-10T06:00:00", text: "Auto-debit from HDFC current account" }, { at: "2026-09-10T11:00:00", text: "Approved by Ashwin (recurring)", tone: "success" }],
  },
  {
    id: "e-16", code: "EXP-0926-016", date: "2026-09-09", vendor: "Google", description: "Google Ads — 'video agency Erode' search campaign",
    category: "Marketing/Ads", requesterId: "p-priya", approverId: "p-jana", overheadPool: "Sales & marketing",
    amount: 9_440, gst: 1_440, itc: true, paidBy: "company", mode: "Card", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-09T09:00:00", text: "Submitted by Priya Venkatesh" }, { at: "2026-09-09T13:15:00", text: "Approved by Janarthanan", tone: "success" }],
  },
  {
    id: "e-17", code: "EXP-0926-015", date: "2026-09-08", vendor: "Rahul Menon", description: "Freelance edit — Bridal trousseau long-form (rough cut)",
    category: "Freelancer", requesterId: "p-karthik", approverId: "p-ashwin", clientId: "c-lakshmi", videoCode: "SLS-0926-03",
    amount: 24_000, gst: 0, itc: false, paidBy: "company", mode: "NEFT", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
    timeline: [{ at: "2026-09-08T19:00:00", text: "Submitted by Karthik Subramanian" }, { at: "2026-09-09T10:00:00", text: "Approved by Ashwin", tone: "success" }, { at: "2026-09-15T11:00:00", text: "Paid to freelancer · NEFT (TDS 1% u/s 194C)", tone: "accent" }],
  },
  {
    id: "e-18", code: "EXP-0926-014", date: "2026-09-06", vendor: "Frame.io", description: "Frame.io Team plan — Sep",
    category: "Software", requesterId: "p-naveen", approverId: "p-ashwin", overheadPool: "Software & subscriptions",
    amount: 4_150, gst: 633, itc: true, paidBy: "company", mode: "Card", paymentStatus: "paid-to-vendor", approval: "approved", receipt: true,
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
  { id: "vd-01", name: "Chennai Camera Rentals", category: "Equipment rental", city: "Chennai", gstin: "33AAKFC4521M1Z8", registered: true, terms: "Net 15", ytdSpend: 284_600, lastPayment: { date: "2026-09-18", amount: 2_950 }, rating: 4.8, contact: "Prakash · +91 98410 22871" },
  { id: "vd-02", name: "Kovai Lights & Grip", category: "Equipment rental", city: "Coimbatore", gstin: "33ABCFK7812P1Z3", registered: true, terms: "Net 7", ytdSpend: 146_200, lastPayment: { date: "2026-09-22", amount: 8_260 }, rating: 4.6, contact: "Senthil · +91 98430 51220" },
  { id: "vd-03", name: "Studio Props Erode", category: "Props & consumables", city: "Erode", gstin: "33BQTPS3398K1ZN", registered: true, terms: "50% advance", ytdSpend: 62_450, lastPayment: { date: "2026-09-02", amount: 5_310 }, rating: 4.2, contact: "Jayanthi · +91 94420 77310" },
  { id: "vd-04", name: "Airtel (Bharti Airtel Ltd)", category: "Utilities", city: "Chennai", gstin: "33AAACB2894G1ZP", registered: true, terms: "Auto-debit monthly", ytdSpend: 29_736, lastPayment: { date: "2026-09-10", amount: 4_956 }, rating: 3.9, contact: "Business care · 121" },
  { id: "vd-05", name: "TNEB (TANGEDCO)", category: "Utilities", city: "Erode", gstin: "Govt. utility — GST exempt", registered: false, terms: "Bi-monthly · due in 20 days", ytdSpend: 98_400, lastPayment: { date: "2026-09-15", amount: 32_800 }, rating: 3.5, contact: "Service no. 04-213-004-1187" },
  { id: "vd-06", name: "Adobe", category: "Software", city: "Overseas", gstin: "OIDAR · IGST collected by Adobe India", registered: true, terms: "Card · monthly", ytdSpend: 126_900, lastPayment: { date: "2026-09-16", amount: 21_150 }, rating: 4.5, contact: "adobe.com/in" },
  { id: "vd-07", name: "Frame.io", category: "Software", city: "Overseas", gstin: "OIDAR · reverse charge", registered: true, terms: "Card · monthly", ytdSpend: 24_900, lastPayment: { date: "2026-09-06", amount: 4_150 }, rating: 4.7, contact: "frame.io" },
  { id: "vd-08", name: "Google India Pvt Ltd", category: "Marketing/Ads", city: "Bengaluru", gstin: "29AACCG0527D1Z8", registered: true, terms: "Card · threshold billing", ytdSpend: 109_000, lastPayment: { date: "2026-09-09", amount: 9_440 }, rating: 4.4, contact: "ads.google.com" },
  { id: "vd-09", name: "Meta Platforms", category: "Marketing/Ads", city: "Overseas", gstin: "OIDAR · reverse charge", registered: true, terms: "Card · threshold billing", ytdSpend: 88_500, lastPayment: { date: "2026-09-22", amount: 14_750 }, rating: 4.1, contact: "business.facebook.com" },
  { id: "vd-10", name: "Rahul Menon", category: "Freelancer", city: "Coimbatore", gstin: "Unregistered · PAN BXKPM4421L", registered: false, terms: "Per job · Net 7", ytdSpend: 312_000, lastPayment: { date: "2026-09-15", amount: 24_000 }, rating: 4.9, contact: "+91 90030 22001" },
  { id: "vd-11", name: "Manoj Pillai", category: "Freelancer", city: "Tiruppur", gstin: "Unregistered · PAN CQPPP8810D", registered: false, terms: "Per job · Net 7", ytdSpend: 84_000, lastPayment: { date: "2026-08-28", amount: 12_000 }, rating: 4.7, contact: "+91 90030 22007" },
  { id: "vd-12", name: "Sneha Iyer", category: "Freelancer", city: "Chennai", gstin: "33AOJPI5561R1ZB", registered: true, terms: "Per job · Net 15", ytdSpend: 146_400, lastPayment: { date: "2026-09-12", amount: 21_240 }, rating: 4.8, contact: "+91 90030 22002" },
  { id: "vd-13", name: "Deepa Nair", category: "Freelancer", city: "Coimbatore", gstin: "Unregistered · PAN AHWPN2290K", registered: false, terms: "Per job · Net 7", ytdSpend: 42_500, lastPayment: { date: "2026-09-03", amount: 7_500 }, rating: 4.6, contact: "+91 90030 22004" },
  { id: "vd-14", name: "Appakudal Properties", category: "Rent", city: "Appakudal", gstin: "33AAHFA7719B1ZK", registered: true, terms: "Rent · 5th of month", ytdSpend: 297_360, lastPayment: { date: "2026-09-05", amount: 49_560 }, rating: 4.3, contact: "Owner · +91 94433 10087" },
];

// ═════════════════════════ Financial Reports (Module 36) ═════════════════════════

/** Revenue types by month, ex-GST. Earned = recognised revenue (= monthlyFinance actual). */
export const revenueTypes = [
  { month: "Apr", contracted: 8.6 * L, invoiced: 7.8 * L, earned: 7.8 * L, collected: 7.1 * L },
  { month: "May", contracted: 8.9 * L, invoiced: 8.2 * L, earned: 8.2 * L, collected: 7.9 * L },
  { month: "Jun", contracted: 9.3 * L, invoiced: 8.6 * L, earned: 8.6 * L, collected: 8.0 * L },
  { month: "Jul", contracted: 9.6 * L, invoiced: 9.1 * L, earned: 9.1 * L, collected: 8.4 * L },
  { month: "Aug", contracted: 9.9 * L, invoiced: 9.4 * L, earned: 9.4 * L, collected: 8.1 * L },
  { month: "Sep", contracted: 10.1 * L, invoiced: 8.7 * L, earned: 8.7 * L, collected: 5.6 * L },
] as const;

export const REVENUE_TYPE_DEFS = {
  contracted: "Value of signed agreements & POs for the month — what clients have committed to pay.",
  invoiced: "Tax invoices raised in the month (taxable value, before GST).",
  earned: "Revenue recognised for work actually delivered in the month — the P&L number.",
  collected: "Cash received against invoices in the month (net of GST), including advances adjusted.",
} as const;

export const OPENING_CASH_APR = 14.2 * L;

/** Cash flow (incl. GST) Apr–Sep. Outflows include GST & TDS remittances. */
export const cashFlow = (() => {
  const rows = [
    { month: "Apr", inflow: 8.62 * L, outflow: 7.48 * L },
    { month: "May", inflow: 9.31 * L, outflow: 7.9 * L },
    { month: "Jun", inflow: 9.44 * L, outflow: 8.26 * L },
    { month: "Jul", inflow: 9.91 * L, outflow: 8.52 * L },
    { month: "Aug", inflow: 9.56 * L, outflow: 9.34 * L },
    { month: "Sep", inflow: 6.61 * L, outflow: 7.86 * L },
  ];
  let bal = OPENING_CASH_APR;
  return rows.map((r) => {
    const net = r.inflow - r.outflow;
    bal += net;
    return { ...r, net, closing: bal };
  });
})();

/** Budget vs actual FY 2026-27, Apr–Sep (ex-GST). Salaries exclude founder remuneration. */
export const budgetCategories = [
  { category: "Salaries", budget: 24.9 * L, actual: 25.1 * L, note: "Excl. founder remuneration" },
  { category: "Freelancers", budget: 3.6 * L, actual: 4.3 * L, note: "Festive rush — 2 extra editors in Aug–Sep" },
  { category: "Rent", budget: 2.52 * L, actual: 2.52 * L, note: "Appakudal studio & office" },
  { category: "Software", budget: 2.1 * L, actual: 2.18 * L, note: "Adobe seat added in Jul" },
  { category: "Equipment", budget: 3.0 * L, actual: 2.7 * L, note: "Rentals + maintenance" },
  { category: "Travel", budget: 1.8 * L, actual: 1.9 * L, note: "Outstation shoots — Kanchipuram, Kochi" },
  { category: "Marketing", budget: 3.0 * L, actual: 2.24 * L, note: "Meta + Google ads, BNI" },
  { category: "Utilities", budget: 1.48 * L, actual: 1.36 * L, note: "Electricity + internet" },
];

/** P&L FY-to-date (Apr–Sep 2026), ex-GST. Draft structure — definitions pending approval. */
export const pnlYtd = {
  revenue: 51.8 * L,
  direct: [
    { label: "Direct labour (logged hours on videos)", amount: 16.9 * L },
    { label: "Freelancers", amount: 4.3 * L },
    { label: "Shoot travel & equipment rental", amount: 3.1 * L },
    { label: "Props & consumables", amount: 0.6 * L },
  ],
  variable: [
    { label: "Marketing & ads", amount: 2.24 * L },
    { label: "Software seats", amount: 2.18 * L },
    { label: "Utilities (power, internet)", amount: 1.36 * L },
  ],
  fixed: [
    { label: "Management & admin salaries", amount: 8.44 * L },
    { label: "Rent", amount: 2.52 * L },
    { label: "Depreciation — camera & edit kit", amount: 0.66 * L },
  ],
};

export const periodLocksSeed = [
  { month: "Apr", lockedOn: "5 May 2026", by: "Finance Desk" },
  { month: "May", lockedOn: "5 Jun 2026", by: "Finance Desk" },
  { month: "Jun", lockedOn: "4 Jul 2026", by: "Finance Desk" },
  { month: "Jul", lockedOn: "5 Aug 2026", by: "Finance Desk" },
  { month: "Aug", lockedOn: "5 Sep 2026", by: "Finance Desk" },
];
