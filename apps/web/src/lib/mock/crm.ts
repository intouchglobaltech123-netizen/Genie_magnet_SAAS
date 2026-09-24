import { addMonths, format, parseISO } from "date-fns";
import { agreements, clients, cycles, TODAY } from "@/lib/mock/core";
import type { Agreement, Cycle, Lead } from "@/lib/types";

// ───────────────────────────── Revenue trend ─────────────────────────────

export const revenueTrend = [
  { month: "Apr", contracted: 198000, invoiced: 198000, collected: 192000 },
  { month: "May", contracted: 213000, invoiced: 213000, collected: 205000 },
  { month: "Jun", contracted: 268000, invoiced: 243000, collected: 221000 },
  { month: "Jul", contracted: 268000, invoiced: 268000, collected: 238000 },
  { month: "Aug", contracted: 268000, invoiced: 268000, collected: 209000 },
  { month: "Sep", contracted: 268000, invoiced: 253000, collected: 148000 },
];

// ───────────────────────────── Lead intelligence ─────────────────────────────

export const LEAD_STAGES: Lead["stage"][] = ["New", "Contacted", "Qualified", "Discovery", "Proposal", "Negotiation", "Won", "Lost"];

export const stageProbability: Record<Lead["stage"], number> = {
  New: 0.05,
  Contacted: 0.1,
  Qualified: 0.25,
  Discovery: 0.4,
  Proposal: 0.55,
  Negotiation: 0.75,
  Won: 1,
  Lost: 0,
};

/** Historical source performance (last 6 months) blended with live leads. */
export const sourceHistory: Record<Lead["source"], { leads: number; qualified: number; won: number; revenue: number }> = {
  Website: { leads: 14, qualified: 6, won: 2, revenue: 90000 },
  "Meta Ads": { leads: 31, qualified: 9, won: 2, revenue: 85000 },
  "Google Ads": { leads: 12, qualified: 5, won: 1, revenue: 48000 },
  WhatsApp: { leads: 9, qualified: 4, won: 1, revenue: 30000 },
  Referral: { leads: 8, qualified: 7, won: 4, revenue: 263000 },
  BNI: { leads: 6, qualified: 4, won: 2, revenue: 150000 },
  Instagram: { leads: 17, qualified: 5, won: 2, revenue: 105000 },
  Event: { leads: 5, qualified: 3, won: 1, revenue: 40000 },
  "Walk-in": { leads: 2, qualified: 1, won: 0, revenue: 0 },
};

export function scoreBreakdown(l: Lead) {
  const s = l.score / 100;
  const jitter = (n: number) => ((l.id.charCodeAt(l.id.length - 1) * n) % 7) - 3;
  return [
    { label: "Budget fit", max: 30, value: Math.max(4, Math.min(30, Math.round(30 * s + jitter(3)))) },
    { label: "Decision authority", max: 25, value: Math.max(3, Math.min(25, Math.round(25 * s + jitter(5)))) },
    { label: "Need / pain clarity", max: 25, value: Math.max(3, Math.min(25, Math.round(25 * s - jitter(2)))) },
    { label: "Timeline urgency", max: 20, value: Math.max(2, Math.min(20, Math.round(20 * s - jitter(4)))) },
  ];
}

export function leadTimeline(l: Lead) {
  const idx = LEAD_STAGES.indexOf(l.stage);
  const d = parseISO(l.createdAt);
  const day = (n: number) => format(new Date(d.getTime() + n * 86_400_000), "d MMM");
  const items: { at: string; text: string; kind: "system" | "call" | "meeting" | "doc" | "win" | "loss" }[] = [
    { at: day(0), text: `Lead captured from ${l.source}${l.notes?.startsWith("Referred") ? " — " + l.notes : ""}`, kind: "system" },
  ];
  if (idx >= 1) items.push({ at: day(1), text: `Intro call with ${l.name} — interested in ${l.service.toLowerCase()}`, kind: "call" });
  if (idx >= 2) items.push({ at: day(3), text: `Qualified: budget ~${Math.round(l.value / 1000)}K/month, decision maker confirmed`, kind: "call" });
  if (idx >= 3) items.push({ at: day(6), text: "Discovery meeting — current content, competitors, goals captured", kind: "meeting" });
  if (idx >= 4 && l.stage !== "Lost") items.push({ at: day(9), text: "Proposal v1 sent", kind: "doc" });
  if (idx >= 5 && l.stage !== "Lost") items.push({ at: day(13), text: "Proposal v2 sent after scope discussion", kind: "doc" });
  if (l.stage === "Won") items.push({ at: day(18), text: "Verbal yes — advance invoice requested", kind: "win" });
  if (l.stage === "Lost") items.push({ at: day(12), text: l.notes ?? "Marked lost", kind: "loss" });
  return items.reverse();
}

export function proposalVersions(l: Lead) {
  const idx = LEAD_STAGES.indexOf(l.stage);
  if (idx < 4 || l.stage === "Lost") return [];
  const hasV2 = idx >= 5 || l.id === "l-07";
  const v1 = Math.round((l.value * 1.15) / 1000) * 1000;
  type P = { label: string; note: string; price: number; scope: string; status: "sent" | "superseded" | "accepted" };
  const list: P[] = [
    { label: "v1", note: "Initial scope", price: hasV2 ? v1 : l.value, scope: "12 videos / month · 2 revisions each", status: hasV2 ? "superseded" : "sent" },
  ];
  if (hasV2)
    list.push({ label: "v2", note: "Revised after discovery", price: l.value, scope: "10 videos / month · 2 revisions each", status: l.stage === "Won" ? "accepted" : "sent" });
  return list;
}

export const SALES_DISCOUNT_AUTHORITY = 10; // %

export const packageForService: Record<Agreement["service"], { name: string; units: { label: string; perCycle: number }[] }> = {
  "Video Production": { name: "Growth Video Pack", units: [{ label: "Reels", perCycle: 8 }, { label: "Long-form videos", perCycle: 2 }] },
  "Social Media Management": { name: "Social Starter Pack", units: [{ label: "Reels", perCycle: 8 }, { label: "Static posts", perCycle: 12 }] },
  "Personal Branding": { name: "Authority Builder", units: [{ label: "Explainer reels", perCycle: 6 }, { label: "Podcast clips", perCycle: 2 }] },
  Website: { name: "Web Launch", units: [{ label: "Pages", perCycle: 6 }] },
  Consulting: { name: "Growth Advisory", units: [{ label: "Strategy sessions", perCycle: 2 }] },
};

// ───────────────────────────── Agreements ─────────────────────────────

export const agreementChanges: Record<string, { at: string; text: string; by: string; kind: "create" | "sign" | "change" | "renew" | "note" }[]> = {
  "a-kvr-01": [
    { at: "2026-07-01", text: "Units changed 10 → 12 per cycle (added 2 ad creatives); fee ₹72,000 → ₹85,000", by: "Janarthanan", kind: "change" },
    { at: "2026-04-01", text: "Renewed for FY 2026-27 with 6% price uplift", by: "Janarthanan", kind: "renew" },
    { at: "2025-04-01", text: "Original agreement signed — Starter Video Pack, 10 units", by: "Ramesh Gounder", kind: "sign" },
  ],
  "a-sls-01": [
    { at: "2026-09-20", text: "Renewal reminder sent — agreement ends 31 Oct 2026", by: "System", kind: "note" },
    { at: "2026-03-01", text: "Stories increased 12 → 20 per cycle at no extra cost (goodwill, festive season)", by: "Janarthanan", kind: "change" },
    { at: "2025-10-01", text: "Agreement signed — Social Starter Pack", by: "Meenakshi Sundaram", kind: "sign" },
  ],
  "a-nvd-01": [
    { at: "2026-06-15", text: "Billing terms changed Monthly advance → Monthly arrears (client request)", by: "Janarthanan", kind: "change" },
    { at: "2026-02-01", text: "Agreement signed — Authority Builder", by: "Dr. Arvind Balaji", kind: "sign" },
  ],
  "a-bpa-01": [{ at: "2026-05-15", text: "Partner agreement signed via BrightPath's agency — 6-month sprint", by: "Suresh Kannan", kind: "sign" }],
  "a-unr-01": [
    { at: "2026-09-20", text: "Out-of-scope change request raised: floor-plan animation ₹18,000", by: "Ashwin", kind: "note" },
    { at: "2026-08-10", text: "Payment reminder escalated to founder — 2 invoices overdue", by: "System", kind: "note" },
    { at: "2026-06-01", text: "Partner agreement signed — Property Showcase", by: "Vikram Shetty", kind: "sign" },
  ],
};

export interface Invoice {
  no: string;
  period: string;
  issued: string;
  due: string;
  amount: number;
  paid: number;
  status: "paid" | "partial" | "due" | "overdue" | "scheduled";
}

export function billingSchedule(a: Agreement): Invoice[] {
  const client = clients.find((c) => c.id === a.clientId)!;
  const arrears = a.billing === "Monthly arrears";
  const start = parseISO(a.startDate);
  const list: Invoice[] = [];
  let seq = 0;
  for (let i = 0; i < 24; i++) {
    const periodStart = addMonths(start, i);
    if (periodStart > parseISO(a.endDate)) break;
    const issued = arrears ? addMonths(periodStart, 1) : periodStart;
    if (issued > addMonths(parseISO(TODAY), 2)) break;
    const due = new Date(issued.getTime() + (arrears ? 15 : 7) * 86_400_000);
    seq++;
    list.push({
      no: `GM/${client.code}/${String(seq).padStart(3, "0")}`,
      period: format(periodStart, "MMM yyyy"),
      issued: format(issued, "yyyy-MM-dd"),
      due: format(due, "yyyy-MM-dd"),
      amount: a.monthlyFee,
      paid: a.monthlyFee,
      status: "paid",
    });
  }
  // Allocate outstanding to latest issued invoices
  let remaining = client.outstanding;
  for (let i = list.length - 1; i >= 0; i--) {
    const inv = list[i]!;
    if (inv.issued > TODAY) {
      inv.paid = 0;
      inv.status = "scheduled";
      continue;
    }
    if (remaining <= 0) break;
    const unpaid = Math.min(remaining, inv.amount);
    remaining -= unpaid;
    inv.paid = inv.amount - unpaid;
    inv.status = inv.paid > 0 ? "partial" : inv.due < TODAY ? "overdue" : "due";
  }
  return list.reverse();
}

// ───────────────────────────── Cycles timeline ─────────────────────────────

export function cycleTimeline(a: Agreement): (Cycle & { synthetic?: boolean })[] {
  const months = [
    { label: "Aug 2026", start: "2026-08-01", end: "2026-08-31" },
    { label: "Sep 2026", start: "2026-09-01", end: "2026-09-30" },
    { label: "Oct 2026", start: "2026-10-01", end: "2026-10-31" },
  ];
  // Video deliverables tracked per cycle (social statics/stories live in the content calendar)
  const promised = cycles.find((c) => c.agreementId === a.id)?.promised ?? a.units.reduce((s, u) => s + u.perCycle, 0);
  return months.map((m, i) => {
    const real = cycles.find((c) => c.agreementId === a.id && c.label === m.label);
    if (real) return real;
    const closed = i === 0;
    return {
      id: `cy-${a.id}-${m.start.slice(5, 7)}`,
      agreementId: a.id,
      clientId: a.clientId,
      label: m.label,
      start: m.start,
      end: m.end,
      status: closed ? "closed" : "upcoming",
      promised,
      delivered: closed ? promised : 0,
      inProgress: 0,
      revenue: a.monthlyFee,
      cost: closed ? Math.round(a.monthlyFee * 0.66) : 0,
      synthetic: true,
    };
  });
}

// ───────────────────────────── Client health factors ─────────────────────────────

export const healthFactors: Record<string, { billing: number; profitability: number; payment: number; repeat: number; salesEffort: number; deliveryEffort: number }> = {
  // Higher = better for value factors; effort factors: higher = more effort (worse)
  "c-kaveri": { billing: 92, profitability: 70, payment: 95, repeat: 90, salesEffort: 45, deliveryEffort: 78 },
  "c-lakshmi": { billing: 76, profitability: 82, payment: 72, repeat: 88, salesEffort: 18, deliveryEffort: 34 },
  "c-nova": { billing: 58, profitability: 32, payment: 48, repeat: 55, salesEffort: 35, deliveryEffort: 50 },
  "c-bright": { billing: 30, profitability: 50, payment: 70, repeat: 40, salesEffort: 30, deliveryEffort: 36 },
  "c-urban": { billing: 46, profitability: 14, payment: 12, repeat: 20, salesEffort: 62, deliveryEffort: 84 },
};

export function effortReturn(clientId: string) {
  const f = healthFactors[clientId]!;
  return {
    effort: Math.round(f.salesEffort * 0.4 + f.deliveryEffort * 0.6),
    return: Math.round(f.billing * 0.4 + f.profitability * 0.35 + f.payment * 0.25),
  };
}

export const recoveryActions: Record<string, string[]> = {
  "c-urban": [
    "Hold new shoots until ₹80,000 of the ₹1.2L outstanding is cleared",
    "Founder call with Vikram Shetty — reset scope & payment terms",
    "Switch to 50% advance billing from Oct cycle",
    "Bill out-of-scope floor-plan CR (₹18,000) before delivery",
    "If no payment by 10 Oct review — plan exit at agreement end (31 Dec)",
  ],
  "c-nova": [
    "Move back to monthly advance billing at renewal",
    "Cap doctor-approval wait at 48h — else auto-approve per agreement",
  ],
};

// ───────────────────────────── Onboarding ─────────────────────────────

export interface OnboardingItem {
  id: string;
  label: string;
  detail: string;
  mandatory: boolean;
  owner: string;
}

export const onboardingTemplate: OnboardingItem[] = [
  { id: "ob-agreement", label: "Agreement signed", detail: "Signed PDF uploaded, advance invoice raised", mandatory: true, owner: "Priya Venkatesh" },
  { id: "ob-contacts", label: "Client contacts captured", detail: "Primary, marketing and accounts contacts", mandatory: true, owner: "Priya Venkatesh" },
  { id: "ob-brand", label: "Brand assets received", detail: "Logo files, colours, fonts, brand guide", mandatory: true, owner: "Meena Ravi" },
  { id: "ob-social", label: "Social media access", detail: "Instagram, YouTube & Meta Business Suite access", mandatory: false, owner: "Meena Ravi" },
  { id: "ob-brief", label: "Creative brief completed", detail: "Audience, tone, competitors, content pillars", mandatory: true, owner: "Karthik Subramanian" },
  { id: "ob-deliverables", label: "Deliverables confirmed", detail: "Units per cycle, formats and first-cycle calendar", mandatory: true, owner: "Ashwin" },
  { id: "ob-approver", label: "Approval authority named", detail: "One approver, response time within 48h", mandatory: true, owner: "Ashwin" },
  { id: "ob-channel", label: "Communication channel set", detail: "WhatsApp group + client portal invite", mandatory: false, owner: "Ashwin" },
  { id: "ob-billing", label: "Billing information", detail: "GSTIN, billing address, accounts contact", mandatory: true, owner: "Finance Desk" },
  { id: "ob-files", label: "Required files uploaded", detail: "Product photos, testimonials, past videos", mandatory: false, owner: "Meena Ravi" },
];

export const onboardingClients = [
  {
    id: "ob-nirmala",
    name: "Nirmala Cooking Academy",
    contact: "Nirmala",
    city: "Madurai",
    service: "Personal Branding",
    packageName: "Authority Builder",
    monthlyFee: 40000,
    wonOn: "2026-09-18",
    targetStart: "2026-10-01",
    ownerName: "Priya Venkatesh",
    initialDone: ["ob-agreement", "ob-contacts", "ob-channel", "ob-billing"],
  },
  {
    id: "ob-urban",
    name: "Urban Nest Realty",
    contact: "Vikram Shetty",
    city: "Tiruppur",
    service: "Video Production",
    packageName: "Property Showcase",
    monthlyFee: 40000,
    wonOn: "2026-05-22",
    targetStart: "2026-06-01",
    ownerName: "Ashwin",
    initialDone: onboardingTemplate.map((i) => i.id),
  },
];

// ───────────────────────────── Misc ─────────────────────────────

export const agreementsForClient = (clientId: string) => agreements.filter((a) => a.clientId === clientId);

/** Terms as first signed (before amendments), where they differ from the current agreement. */
export const originalTerms: Record<string, { packageName: string; monthlyFee: number; units: number; startDate: string; endDate: string }> = {
  "a-kvr-01": { packageName: "Starter Video Pack", monthlyFee: 68000, units: 10, startDate: "2025-04-01", endDate: "2026-03-31" },
  "a-sls-01": { packageName: "Social Starter Pack", monthlyFee: 65000, units: 34, startDate: "2025-10-01", endDate: "2026-10-31" },
};
