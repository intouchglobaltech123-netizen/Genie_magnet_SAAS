// Mock data for Revisions, Publishing, Outcomes and Cycle Reconciliation.

// ─────────────────────────────── Revisions ───────────────────────────────

/** Historical (last 90 days) classified revisions, before the ones in the live store. */
export const revisionCauseBaseline = [
  { cause: "Client preference change", kind: "included-revision" as const, count: 11 },
  { cause: "New requirement after brief", kind: "out-of-scope" as const, count: 5 },
  { cause: "Editing slip (spelling, sync)", kind: "agency-correction" as const, count: 6 },
  { cause: "Brand guideline miss", kind: "agency-correction" as const, count: 3 },
  { cause: "Brief was unclear", kind: "included-revision" as const, count: 4 },
];

/** Rework cost already booked in Sep 2026 (before any new agency corrections logged in the demo). */
export const reworkCostBooked = 14600;
/** Default loaded editor cost / hour used to price agency corrections. */
export const reworkHourlyCost = 460;

// ─────────────────────────────── Publishing ───────────────────────────────

export interface PublishProof {
  videoId: string;
  url: string;
  publishedAt: string;
  proofFile: string;
  by: string;
}

export const seedProofs: PublishProof[] = [
  { videoId: "v-kvr-1", url: "https://instagram.com/reel/KVR1demo", publishedAt: "2026-09-06T18:30", proofFile: "proof_KVR-0926-01.png", by: "Meena Ravi" },
  { videoId: "v-kvr-2", url: "https://instagram.com/reel/KVR2demo", publishedAt: "2026-09-09T19:00", proofFile: "proof_KVR-0926-02.png", by: "Meena Ravi" },
  { videoId: "v-sls-2", url: "https://instagram.com/reel/SLS2demo", publishedAt: "2026-09-12T18:00", proofFile: "proof_SLS-0926-02.png", by: "Meena Ravi" },
];

export const scheduleSlots = ["Today · 6:30 PM", "Tomorrow · 11:00 AM", "Tomorrow · 6:30 PM", "Sat 27 Sep · 7:00 PM", "Mon 29 Sep · 6:30 PM"];

// ─────────────────────────────── Outcomes ───────────────────────────────

export interface OutcomeKpi {
  key: "reach" | "views" | "er" | "leads" | "enquiries";
  label: string;
  value: number;
  delta: number;
  source: string;
  freshness: string;
  manual?: boolean;
}

export interface ClientOutcomes {
  clientId: string;
  kpis: OutcomeKpi[];
  weekly: { week: string; reach: number; views: number }[];
  monthlyLeads: { month: string; leads: number; enquiries: number }[];
  topVideos: { code: string; title: string; platform: string; views: number; er: number; saves: number; leads: number }[];
  highlights: string[];
  nextMonth: string[];
}

const weeks = ["7 Jul", "14 Jul", "21 Jul", "28 Jul", "4 Aug", "11 Aug", "18 Aug", "25 Aug", "1 Sep", "8 Sep", "15 Sep", "22 Sep"];

function series(base: number, growth: number, wobble: number[]) {
  return weeks.map((week, i) => {
    const reach = Math.round(base * (1 + growth * i) * (1 + (wobble[i % wobble.length] ?? 0)));
    return { week, reach, views: Math.round(reach * 1.68) };
  });
}

export const outcomes: ClientOutcomes[] = [
  {
    clientId: "c-kaveri",
    kpis: [
      { key: "reach", label: "Reach", value: 184200, delta: 0.22, source: "Meta API", freshness: "2h ago" },
      { key: "views", label: "Views", value: 312400, delta: 0.31, source: "Meta + YouTube API", freshness: "2h ago" },
      { key: "er", label: "Engagement rate", value: 0.058, delta: 0.09, source: "Meta API", freshness: "2h ago" },
      { key: "leads", label: "Leads", value: 146, delta: 0.18, source: "Website form · CRM", freshness: "live" },
      { key: "enquiries", label: "WhatsApp enquiries", value: 38, delta: 0.27, source: "Manual entry", freshness: "23 Sep", manual: true },
    ],
    weekly: series(11800, 0.055, [0, 0.08, -0.04, 0.12, -0.02, 0.05, 0.1, -0.06]),
    monthlyLeads: [
      { month: "Apr", leads: 64, enquiries: 14 },
      { month: "May", leads: 81, enquiries: 19 },
      { month: "Jun", leads: 97, enquiries: 22 },
      { month: "Jul", leads: 112, enquiries: 26 },
      { month: "Aug", leads: 124, enquiries: 30 },
      { month: "Sep", leads: 146, enquiries: 38 },
    ],
    topVideos: [
      { code: "KVR-0926-01", title: "Cold-pressed groundnut oil — farm to bottle", platform: "Instagram", views: 96400, er: 0.071, saves: 2140, leads: 41 },
      { code: "KVR-0826-04", title: "Wood-pressed vs expeller — what's the difference?", platform: "Instagram", views: 74200, er: 0.064, saves: 1860, leads: 29 },
      { code: "KVR-0926-02", title: "Why our turmeric is lab tested", platform: "YouTube Shorts", views: 58100, er: 0.052, saves: 980, leads: 22 },
      { code: "KVR-0826-07", title: "A day at the Perundurai mill", platform: "YouTube", views: 21900, er: 0.046, saves: 310, leads: 11 },
      { code: "KVR-0826-02", title: "Diwali combo pack unboxing", platform: "Instagram", views: 18700, er: 0.039, saves: 260, leads: 9 },
    ],
    highlights: [
      "Reach up 22% month-on-month, driven by the farm-to-bottle reel (96K views).",
      "146 website leads — best month since the retainer started in April.",
      "Educational “myth buster” format saves 2.3× more than product showcases.",
    ],
    nextMonth: ["Diwali gift hamper ad goes live 1 Oct", "Customer testimonial series (3 parts)", "Test Tamil-first captions on all reels"],
  },
  {
    clientId: "c-lakshmi",
    kpis: [
      { key: "reach", label: "Reach", value: 241800, delta: 0.34, source: "Meta API", freshness: "1h ago" },
      { key: "views", label: "Views", value: 402600, delta: 0.41, source: "Meta API", freshness: "1h ago" },
      { key: "er", label: "Engagement rate", value: 0.067, delta: 0.12, source: "Meta API", freshness: "1h ago" },
      { key: "leads", label: "Store visits (coupon)", value: 212, delta: 0.29, source: "Manual entry", freshness: "22 Sep", manual: true },
      { key: "enquiries", label: "WhatsApp enquiries", value: 164, delta: 0.46, source: "WhatsApp Business export", freshness: "yesterday" },
    ],
    weekly: series(15200, 0.06, [0.02, -0.05, 0.1, 0.04, -0.03, 0.14, 0.06, 0.18]),
    monthlyLeads: [
      { month: "Apr", leads: 96, enquiries: 70 },
      { month: "May", leads: 104, enquiries: 82 },
      { month: "Jun", leads: 118, enquiries: 91 },
      { month: "Jul", leads: 139, enquiries: 102 },
      { month: "Aug", leads: 164, enquiries: 112 },
      { month: "Sep", leads: 212, enquiries: 164 },
    ],
    topVideos: [
      { code: "SLS-0926-02", title: "How to identify pure zari", platform: "Instagram", views: 142000, er: 0.082, saves: 6100, leads: 58 },
      { code: "SLS-0826-05", title: "Aadi sale — 5 sarees under ₹10K", platform: "Instagram", views: 98300, er: 0.07, saves: 3400, leads: 47 },
      { code: "SLS-0826-01", title: "Muhurtham silk — bride's pick", platform: "Instagram", views: 61200, er: 0.061, saves: 2200, leads: 31 },
    ],
    highlights: ["Pure zari explainer is the best-performing reel across all clients this quarter.", "WhatsApp enquiries up 46% ahead of Navaratri."],
    nextMonth: ["Navaratri collection drop", "Weaver spotlight mini-series"],
  },
  {
    clientId: "c-nova",
    kpis: [
      { key: "reach", label: "Reach", value: 48600, delta: 0.08, source: "Meta API", freshness: "3h ago" },
      { key: "views", label: "Views", value: 71200, delta: 0.05, source: "Meta API", freshness: "3h ago" },
      { key: "er", label: "Engagement rate", value: 0.041, delta: -0.04, source: "Meta API", freshness: "3h ago" },
      { key: "leads", label: "Appointment requests", value: 57, delta: 0.14, source: "Practo export · Manual", freshness: "20 Sep", manual: true },
      { key: "enquiries", label: "Call enquiries", value: 23, delta: -0.08, source: "Manual entry", freshness: "20 Sep", manual: true },
    ],
    weekly: series(3600, 0.03, [0, -0.06, 0.04, -0.02, 0.07, -0.05, 0.02]),
    monthlyLeads: [
      { month: "Apr", leads: 31, enquiries: 18 },
      { month: "May", leads: 38, enquiries: 21 },
      { month: "Jun", leads: 44, enquiries: 25 },
      { month: "Jul", leads: 47, enquiries: 26 },
      { month: "Aug", leads: 50, enquiries: 25 },
      { month: "Sep", leads: 57, enquiries: 23 },
    ],
    topVideos: [
      { code: "NVD-0826-03", title: "5 signs you need a root canal", platform: "Instagram", views: 22100, er: 0.052, saves: 690, leads: 17 },
      { code: "NVD-0826-01", title: "Invisible aligners — patient story", platform: "Instagram", views: 14800, er: 0.047, saves: 410, leads: 12 },
    ],
    highlights: ["Appointment requests up 14% despite fewer videos delivered in August.", "Doctor-led explainers outperform clinic tours 3:1."],
    nextMonth: ["Smile makeover testimonial", "Kids' first visit reel"],
  },
  {
    clientId: "c-bright",
    kpis: [
      { key: "reach", label: "Reach", value: 36400, delta: 0.19, source: "Partner report · Manual", freshness: "18 Sep", manual: true },
      { key: "views", label: "Views", value: 52800, delta: 0.21, source: "Partner report · Manual", freshness: "18 Sep", manual: true },
      { key: "er", label: "Engagement rate", value: 0.036, delta: 0.02, source: "Partner report · Manual", freshness: "18 Sep", manual: true },
      { key: "leads", label: "Admission leads", value: 88, delta: 0.37, source: "Partner CRM export", freshness: "18 Sep", manual: true },
      { key: "enquiries", label: "Campus visits", value: 19, delta: 0.12, source: "Manual entry", freshness: "18 Sep", manual: true },
    ],
    weekly: series(2400, 0.07, [0, 0.05, 0.1, -0.03]),
    monthlyLeads: [
      { month: "Apr", leads: 0, enquiries: 0 },
      { month: "May", leads: 22, enquiries: 6 },
      { month: "Jun", leads: 41, enquiries: 10 },
      { month: "Jul", leads: 56, enquiries: 13 },
      { month: "Aug", leads: 64, enquiries: 17 },
      { month: "Sep", leads: 88, enquiries: 19 },
    ],
    topVideos: [{ code: "BPA-0826-02", title: "Topper interview — NEET 2026 AIR 412", platform: "Instagram", views: 19400, er: 0.049, saves: 520, leads: 34 }],
    highlights: ["Topper interview drove 34 admission leads (partner-reported)."],
    nextMonth: ["NEET 2027 admissions ad", "Physics faculty intro"],
  },
  {
    clientId: "c-urban",
    kpis: [
      { key: "reach", label: "Reach", value: 22100, delta: -0.06, source: "Partner report · Manual", freshness: "12 Sep", manual: true },
      { key: "views", label: "Views", value: 30900, delta: -0.02, source: "Partner report · Manual", freshness: "12 Sep", manual: true },
      { key: "er", label: "Engagement rate", value: 0.028, delta: -0.1, source: "Partner report · Manual", freshness: "12 Sep", manual: true },
      { key: "leads", label: "Site-visit leads", value: 26, delta: 0.04, source: "Manual entry", freshness: "12 Sep", manual: true },
      { key: "enquiries", label: "Call enquiries", value: 11, delta: -0.15, source: "Manual entry", freshness: "12 Sep", manual: true },
    ],
    weekly: series(2100, 0.01, [0, -0.08, 0.03, -0.04]),
    monthlyLeads: [
      { month: "Apr", leads: 0, enquiries: 0 },
      { month: "May", leads: 0, enquiries: 0 },
      { month: "Jun", leads: 14, enquiries: 9 },
      { month: "Jul", leads: 21, enquiries: 12 },
      { month: "Aug", leads: 25, enquiries: 13 },
      { month: "Sep", leads: 26, enquiries: 11 },
    ],
    topVideos: [{ code: "UNR-0826-01", title: "Green Meadows — site progress update", platform: "YouTube", views: 8400, er: 0.031, saves: 120, leads: 9 }],
    highlights: ["Data is 13 days old — request fresh numbers from partner before the review."],
    nextMonth: ["Green Meadows 3BHK walkthrough", "Sunset drone reel"],
  },
];

// ─────────────────────────────── Reconciliation ───────────────────────────────

export interface CarryRule {
  id: string;
  label: string;
  desc: string;
  enabled: boolean;
}

export const carryRules: CarryRule[] = [
  { id: "agency-shortfall", label: "Agency-caused shortfall carries forward", desc: "Units we could not deliver move to the next cycle — maximum one cycle, then credit note.", enabled: true },
  { id: "client-delay", label: "Client-caused delay: carry forward only with approval", desc: "If the client held up approval or shoot access, founder decides: carry forward or forfeit.", enabled: true },
  { id: "founder-approval", label: "Every carry-forward needs founder sign-off", desc: "No unit moves between cycles silently — each decision is logged with a reason.", enabled: true },
  { id: "auto-credit", label: "Auto-draft credit note after 2 missed cycles", desc: "Finance gets a draft credit note to review; nothing is sent automatically.", enabled: false },
];

/** Shortfall context for cycles that are not fully delivered. */
export const shortfallNotes: Record<string, { reason: string; cause: "agency" | "client" }> = {
  "cy-nvd-08": { reason: "Testimonial video: patient withdrew consent 2 days before shoot; replacement patient booked for Sep.", cause: "client" },
};
