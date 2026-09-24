import { TODAY } from "@/lib/mock/core";
import type { Asset } from "@/lib/types";

export const CATEGORIES: Asset["category"][] = ["Camera", "Lens", "Lighting", "Audio", "Support", "Power", "Storage", "Computer", "Accessory"];

export const STATUS_META: Record<Asset["status"], { label: string; tone: "success" | "info" | "accent" | "warning" | "neutral" }> = {
  available: { label: "Available", tone: "success" },
  reserved: { label: "Reserved", tone: "info" },
  "checked-out": { label: "Checked out", tone: "accent" },
  maintenance: { label: "Maintenance", tone: "warning" },
  retired: { label: "Retired", tone: "neutral" },
};

export const CONDITION_TONE: Record<Asset["condition"], "success" | "info" | "warning" | "danger"> = {
  Excellent: "success",
  Good: "info",
  Fair: "warning",
  "Needs repair": "danger",
};

/** Expected productive hours per year for per-hour costing. null = not hour-costed. */
export function expectedHoursPerYear(category: Asset["category"]): number | null {
  if (category === "Storage") return null;
  if (category === "Computer") return 2000;
  return 1200;
}

export function annualDepreciation(a: Asset) {
  return (a.purchaseValue - a.residualValue) / a.usefulLifeYears;
}

export function perHourCost(a: Asset) {
  const h = expectedHoursPerYear(a.category);
  return h ? annualDepreciation(a) / h : null;
}

function yearsBetween(from: string, to: string) {
  return (new Date(to).getTime() - new Date(from).getTime()) / (365.25 * 86_400_000);
}

export function bookValueAt(a: Asset, iso: string) {
  const y = Math.max(0, yearsBetween(a.purchaseDate, iso));
  const acc = Math.min(annualDepreciation(a) * y, a.purchaseValue - a.residualValue);
  return Math.round(a.purchaseValue - acc);
}

export const bookValue = (a: Asset) => bookValueAt(a, TODAY);

function addYears(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}
function addMonths(iso: string, n: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setMonth(d.getMonth() + n);
  return d.toISOString().slice(0, 10);
}

export function depreciationSchedule(a: Asset) {
  const annual = annualDepreciation(a);
  return Array.from({ length: a.usefulLifeYears }, (_, i) => {
    const from = addYears(a.purchaseDate, i);
    const to = addYears(a.purchaseDate, i + 1);
    const opening = a.purchaseValue - annual * i;
    return { year: i + 1, from, to, opening, depreciation: annual, closing: opening - annual, current: TODAY >= from && TODAY < to };
  });
}

export function bookValueSeries(a: Asset) {
  const months = a.usefulLifeYears * 12;
  const step = months > 24 ? 3 : 1;
  const pts: { date: string; label: string; value: number }[] = [];
  for (let m = 0; m <= months; m += step) {
    const date = addMonths(a.purchaseDate, m);
    pts.push({
      date,
      label: new Date(date).toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
      value: bookValueAt(a, date),
    });
  }
  return pts;
}

// ─────────────────────────── Custody history ───────────────────────────

export interface CustodyEvent {
  kind: "out" | "in" | "assigned";
  at: string; // display string
  personId: string;
  purpose: string;
  note?: string;
}

const custody: Record<string, CustodyEvent[]> = {
  "GM-CAM-01": [
    { kind: "out", at: "25 Sep 2026, 06:10", personId: "p-vignesh", purpose: "Sri Lakshmi — reel pickups (Kanchipuram)", note: "Kit: single-cam · 2 batteries · 3 SD cards" },
    { kind: "in", at: "19 Sep 2026, 20:10", personId: "p-vignesh", purpose: "Kaveri — Sept batch B", note: "Returned clean · sensor checked by Naveen" },
    { kind: "out", at: "19 Sep 2026, 05:45", personId: "p-vignesh", purpose: "Kaveri — Sept batch B", note: "Studio, Appakudal · call time 06:30" },
    { kind: "in", at: "17 Sep 2026, 18:30", personId: "p-vignesh", purpose: "Nova Dental — Explainers" },
    { kind: "out", at: "17 Sep 2026, 12:15", personId: "p-vignesh", purpose: "Nova Dental — Explainers", note: "RS Puram, Coimbatore" },
    { kind: "in", at: "15 Sep 2026, 19:40", personId: "f-gokul", purpose: "Sri Lakshmi — Navaratri" },
    { kind: "out", at: "15 Sep 2026, 05:30", personId: "f-gokul", purpose: "Sri Lakshmi — Navaratri", note: "Second camera for dual-cam kit" },
    { kind: "in", at: "10 Sep 2026, 17:55", personId: "p-vignesh", purpose: "Kaveri — Founder story" },
    { kind: "out", at: "10 Sep 2026, 07:50", personId: "p-vignesh", purpose: "Kaveri — Founder story", note: "Farmhouse, Bhavani" },
  ],
  "GM-LEN-03": [
    { kind: "in", at: "19 Sep 2026, 20:10", personId: "p-vignesh", purpose: "Kaveri — Sept batch B" },
    { kind: "out", at: "19 Sep 2026, 05:45", personId: "p-vignesh", purpose: "Kaveri — Sept batch B" },
    { kind: "in", at: "14 Sep 2026, 16:20", personId: "f-gokul", purpose: "Urban Nest — Green Meadows" },
    { kind: "out", at: "14 Sep 2026, 05:15", personId: "f-gokul", purpose: "Urban Nest — Green Meadows", note: "Tiruppur site" },
  ],
  "GM-AUD-02": [
    { kind: "in", at: "22 Sep 2026, 17:05", personId: "p-vignesh", purpose: "Nova Dental — reshoot", note: "Returned with incident: crackling on XLR" },
    { kind: "out", at: "22 Sep 2026, 12:30", personId: "p-vignesh", purpose: "Nova Dental — reshoot" },
    { kind: "in", at: "15 Sep 2026, 19:40", personId: "p-vignesh", purpose: "Sri Lakshmi — Navaratri" },
    { kind: "out", at: "15 Sep 2026, 05:30", personId: "p-vignesh", purpose: "Sri Lakshmi — Navaratri" },
  ],
};

export function custodyFor(a: Asset): CustodyEvent[] {
  if (custody[a.tag]) return custody[a.tag]!;
  if (a.category === "Computer" || a.category === "Storage") {
    return a.custodianId
      ? [{ kind: "assigned", at: new Date(a.purchaseDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }), personId: a.custodianId, purpose: "Permanent desk assignment", note: "Issued by Naveen Raj (IT)" }]
      : [];
  }
  const base: CustodyEvent[] = [
    { kind: "in", at: "19 Sep 2026, 20:10", personId: "p-vignesh", purpose: "Kaveri — Sept batch B" },
    { kind: "out", at: "19 Sep 2026, 05:45", personId: "p-vignesh", purpose: "Kaveri — Sept batch B" },
    { kind: "in", at: "12 Sep 2026, 18:00", personId: "p-vignesh", purpose: "BrightPath — Admissions" },
    { kind: "out", at: "12 Sep 2026, 07:30", personId: "p-vignesh", purpose: "BrightPath — Admissions", note: "Salem campus" },
  ];
  if (a.status === "checked-out" && a.custodianId) {
    base.unshift({ kind: "out", at: "25 Sep 2026, 06:10", personId: a.custodianId, purpose: "Sri Lakshmi — reel pickups (Kanchipuram)" });
  }
  return base;
}

// ─────────────────────────── Maintenance ───────────────────────────

export interface MaintenanceEntry {
  date: string;
  title: string;
  by: string;
  cost: number;
  note?: string;
}

const maintenance: Record<string, MaintenanceEntry[]> = {
  "GM-CAM-01": [
    { date: "2026-08-30", title: "Sensor cleaning & firmware 4.01", by: "Naveen Raj", cost: 0 },
    { date: "2026-03-12", title: "Sensor swab — dust spots in sky shots", by: "Camera Care, Coimbatore", cost: 1800 },
  ],
  "GM-AUD-02": [
    { date: "2026-09-22", title: "Incident: crackling on XLR output", by: "Vignesh Kumar", cost: 0, note: "Reported after Nova Dental shoot" },
    { date: "2026-04-05", title: "Foam windscreen replaced", by: "Naveen Raj", cost: 650 },
  ],
  "GM-LGT-02": [{ date: "2026-07-18", title: "Diffuser fabric torn — stitched", by: "Local tailor, Appakudal", cost: 250 }],
  "GM-PC-01": [
    { date: "2026-09-01", title: "Dust clean + thermal paste", by: "Naveen Raj", cost: 400 },
    { date: "2026-05-20", title: "Added 2TB NVMe scratch disk", by: "Naveen Raj", cost: 12500 },
  ],
};

export function maintenanceFor(a: Asset): MaintenanceEntry[] {
  return maintenance[a.tag] ?? [{ date: "2026-08-30", title: "Quarterly inspection — no issues", by: "Naveen Raj", cost: 0 }];
}

// ─────────────────────────── Reservations ───────────────────────────

export interface Reservation {
  id: string;
  tag: string;
  date: string;
  purpose: string;
  personId: string;
  location?: string;
}

export const seedReservations: Reservation[] = [
  { id: "rs-1", tag: "GM-CAM-01", date: "2026-09-27", purpose: "Kaveri — Testimonial shoot", personId: "p-vignesh", location: "Anna Nagar, Chennai" },
  { id: "rs-2", tag: "GM-LEN-03", date: "2026-09-27", purpose: "Kaveri — Testimonial shoot", personId: "p-vignesh", location: "Anna Nagar, Chennai" },
  { id: "rs-3", tag: "GM-AUD-01", date: "2026-09-27", purpose: "Kaveri — Testimonial shoot", personId: "p-vignesh", location: "Anna Nagar, Chennai" },
  { id: "rs-4", tag: "GM-CAM-01", date: "2026-09-30", purpose: "Nova Dental — Testimonials", personId: "p-vignesh", location: "RS Puram, Coimbatore" },
  { id: "rs-5", tag: "GM-LGT-01", date: "2026-09-30", purpose: "Nova Dental — Testimonials", personId: "p-vignesh", location: "RS Puram, Coimbatore" },
];

/** Suggested substitute when a reservation clashes. */
export const ALTERNATIVES: Record<string, string> = {
  "GM-CAM-01": "GM-CAM-02",
  "GM-CAM-02": "GM-CAM-01",
  "GM-LEN-03": "GM-LEN-02",
  "GM-LEN-02": "GM-LEN-01",
  "GM-LGT-01": "GM-LGT-02",
};

export const RESERVE_PEOPLE = ["p-vignesh", "p-karthik", "f-gokul", "f-manoj", "p-divya", "p-surya", "p-meena"];

// ─────────────────────────── Incident ───────────────────────────

export const INCIDENT_STEPS = [
  { label: "Incident reported", date: "22 Sep", detail: "“Crackling on XLR during Nova Dental shoot” — Vignesh Kumar", action: "" },
  { label: "Sent for repair", date: "23 Sep", detail: "Sound Wave Service Centre, Coimbatore · est. ₹3,500", action: "Mark sent for repair" },
  { label: "Reinspection", date: "", detail: "Naveen tests XLR output with Zoom H5 + headphones", action: "Reinspection passed" },
  { label: "Back in service", date: "", detail: "Asset available for booking, condition Good", action: "Return to service" },
] as const;
