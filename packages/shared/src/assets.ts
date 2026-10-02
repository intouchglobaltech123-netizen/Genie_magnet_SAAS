// Equipment and assets (P5-20): the register of what the agency owns — cameras, lenses, lights, computers — who has
// each item, check-out and return against shoots, reservations, problems and repairs, and straight-line depreciation
// with the cost of an hour's use, which is what a shoot's kit costs when its items were checked out for it.
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const rupees = z.number().int("Whole rupees").min(0, "Not below zero").max(100_000_000);
const day = z.iso.date("Pick the date");
const person = z.string().min(1, "Choose the person").max(64);

export const ASSET_CATEGORIES = [
  "Camera",
  "Lens",
  "Lighting",
  "Audio",
  "Support",
  "Power",
  "Storage",
  "Computer",
  "Accessory",
  "Furniture",
  "Vehicle",
  "Other",
] as const;
export type AssetCategory = (typeof ASSET_CATEGORIES)[number];

export const ASSET_CONDITIONS = ["Excellent", "Good", "Fair", "Needs repair"] as const;
export type AssetCondition = (typeof ASSET_CONDITIONS)[number];

export const ASSET_STATUSES = ["available", "reserved", "checked_out", "assigned", "maintenance", "retired"] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
export const ASSET_STATUS_LABEL: Record<AssetStatus, string> = {
  available: "Available",
  reserved: "Reserved today",
  checked_out: "Checked out",
  assigned: "Assigned",
  maintenance: "Out for repair",
  retired: "Retired",
};

/** Productive hours a year, for an item's cost per hour, unless the agency sets its own; none where use is not by the hour. */
export function defaultHoursPerYear(category: AssetCategory): number | null {
  if (category === "Storage" || category === "Furniture" || category === "Other") return null;
  return category === "Computer" ? 2000 : 1200;
}

export const assetInput = z
  .object({
    tag: text(30)
      .min(1, "Give it a tag")
      .regex(/^[A-Za-z0-9][A-Za-z0-9._/-]*$/, "Letters, numbers, dots, dashes and slashes"),
    name: text(120).min(2, "Name the item"),
    category: z.enum(ASSET_CATEGORIES),
    serialNo: text(80).default(""),
    purchaseDate: day,
    purchaseValue: rupees.min(1, "Enter what it cost"),
    /** What it will still be worth at the end of its useful life. */
    residualValue: rupees.default(0),
    usefulLifeYears: z.number().int("Whole years").min(1, "At least a year").max(30, "At most 30 years"),
    /** Productive hours a year, for its cost per hour; null when its use is not costed by the hour. */
    hoursPerYear: z.number().int().min(1, "At least an hour").max(8760, "At most 8,760 hours").nullable().default(null),
    condition: z.enum(ASSET_CONDITIONS).default("Good"),
    /** Where it is kept when nobody has it. */
    location: text(120).default(""),
    notes: text(1000).default(""),
  })
  .refine((a) => a.residualValue <= a.purchaseValue, { path: ["residualValue"], message: "Not more than it cost" });
export type AssetInput = z.input<typeof assetInput>;

export const checkOutInput = z
  .object({
    userId: person,
    /** "out" for a while (a shoot, a trip), "assigned" for good (a laptop at a desk). */
    kind: z.enum(["out", "assigned"]).default("out"),
    shootId: z.uuid().nullable().default(null),
    purpose: text(200).default(""),
    dueOn: day.nullable().default(null),
    note: text(500).default(""),
  })
  .refine((c) => c.kind === "assigned" || !!c.shootId || !!c.purpose, { path: ["purpose"], message: "Say what it is for, or pick the shoot" });
export type CheckOutInput = z.input<typeof checkOutInput>;

export const returnInput = z
  .object({
    condition: z.enum(ASSET_CONDITIONS),
    /** Hours it was in use (on a shoot, the hours it was out shooting), for what its use cost. */
    hours: z.number().min(0).max(1000).nullable().default(null),
    note: text(500).default(""),
  })
  .refine((r) => r.condition !== "Needs repair" || !!r.note, { path: ["note"], message: "Say what is wrong" });
export type ReturnInput = z.input<typeof returnInput>;

export const reservationInput = z
  .object({
    date: day,
    userId: person,
    shootId: z.uuid().nullable().default(null),
    purpose: text(200).default(""),
    location: text(160).default(""),
  })
  .refine((r) => !!r.shootId || !!r.purpose, { path: ["purpose"], message: "Say what it is for, or pick the shoot" });
export type ReservationInput = z.input<typeof reservationInput>;

/** Anyone using an item reports a problem with it; it is out for repair until it is back in service. */
export const problemInput = z.object({ note: text(500).min(3, "Say what is wrong") });

/** A service or repair, with what it cost; one that takes the item out of service stays open until it is back. */
export const maintenanceInput = z.object({
  date: day,
  title: text(160).min(2, "Say what was done"),
  by: text(120).default(""),
  cost: rupees.default(0),
  note: text(500).default(""),
  outOfService: z.boolean().default(false),
});
export type MaintenanceInput = z.input<typeof maintenanceInput>;

export const backInServiceInput = z.object({
  condition: z.enum(["Excellent", "Good", "Fair"]),
  /** What the repair cost in the end, when it is known now. */
  cost: rupees.nullable().default(null),
  note: text(500).default(""),
});
export type BackInServiceInput = z.input<typeof backInServiceInput>;

export const retireInput = z.object({ note: text(300).min(2, "Say why it is retired") });

// ─── Depreciation ─────────────────────────────────────────────────────

interface Depreciable {
  purchaseDate: string;
  purchaseValue: number;
  residualValue: number;
  usefulLifeYears: number;
}

const utc = (d: string) => Date.UTC(Number(d.slice(0, 4)), Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)));
const addYears = (d: string, n: number) =>
  new Date(Date.UTC(Number(d.slice(0, 4)) + n, Number(d.slice(5, 7)) - 1, Number(d.slice(8, 10)))).toISOString().slice(0, 10);

/** Straight line: what it cost, less what it will still be worth, over its useful life. */
export const annualDepreciation = (a: Depreciable) => (a.purchaseValue - a.residualValue) / a.usefulLifeYears;

/** What it is worth on a day: never below what it will still be worth at the end. */
export function bookValueOn(a: Depreciable, on: string) {
  const years = Math.max(0, (utc(on) - utc(a.purchaseDate)) / (365.25 * 86_400_000));
  return Math.round(a.purchaseValue - Math.min(annualDepreciation(a) * years, a.purchaseValue - a.residualValue));
}

/** What an hour of its use costs; null when its use is not costed by the hour. */
export const perHourCost = (a: Depreciable & { hoursPerYear: number | null }) => (a.hoursPerYear ? annualDepreciation(a) / a.hoursPerYear : null);

/** Year by year over its useful life, marking the year `today` falls in. */
export function depreciationSchedule(a: Depreciable, today: string) {
  const annual = annualDepreciation(a);
  return Array.from({ length: a.usefulLifeYears }, (_, i) => {
    const from = addYears(a.purchaseDate, i);
    const to = addYears(a.purchaseDate, i + 1);
    const opening = a.purchaseValue - annual * i;
    return { year: i + 1, from, to, opening, depreciation: annual, closing: opening - annual, current: today >= from && today < to };
  });
}

/** Its depreciation in a month (yyyy-mm): a twelfth of a year's while it is in its useful life and not retired. */
export function monthDepreciation(a: Depreciable & { retiredAt: string | null }, month: string) {
  const start = `${month}-01`;
  const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).toISOString().slice(0, 10);
  if (a.purchaseDate > end || addYears(a.purchaseDate, a.usefulLifeYears) <= start) return 0;
  if (a.retiredAt && a.retiredAt.slice(0, 10) < start) return 0;
  return annualDepreciation(a) / 12;
}

// ─── What the API returns ─────────────────────────────────────────────

export interface AssetPerson {
  id: string;
  name: string | null;
}

export interface AssetShootRef {
  id: string;
  title: string;
  date: string;
  client: string;
}

/** GET /assets (one item) */
export interface AssetRow {
  id: string;
  tag: string;
  name: string;
  category: AssetCategory;
  serialNo: string;
  purchaseDate: string;
  purchaseValue: number;
  residualValue: number;
  usefulLifeYears: number;
  hoursPerYear: number | null;
  condition: AssetCondition;
  location: string;
  notes: string;
  status: AssetStatus;
  /** Who has it now: checked out to them or assigned to them. */
  out: {
    id: string;
    kind: "out" | "assigned";
    holder: AssetPerson;
    since: string;
    dueOn: string | null;
    overdue: boolean;
    purpose: string;
    shoot: AssetShootRef | null;
  } | null;
  openRepair: { id: string; title: string; since: string } | null;
  nextReservation: { id: string; date: string; for: AssetPerson; purpose: string } | null;
  /** Hours of use recorded on its returns. */
  hoursUsed: number;
  bookValue: number;
  perHour: number | null;
  retiredAt: string | null;
  retiredNote: string;
}

export interface AssetCustodyRow {
  id: string;
  kind: "out" | "assigned";
  holder: AssetPerson;
  shoot: AssetShootRef | null;
  purpose: string;
  outAt: string;
  outBy: AssetPerson | null;
  dueOn: string | null;
  note: string;
  returnedAt: string | null;
  returnedTo: AssetPerson | null;
  returnCondition: AssetCondition | null;
  hours: number | null;
  returnNote: string;
}

export interface AssetReservationRow {
  id: string;
  asset: { id: string; tag: string; name: string };
  date: string;
  for: AssetPerson;
  shoot: AssetShootRef | null;
  purpose: string;
  location: string;
  createdBy: AssetPerson | null;
}

export interface AssetMaintenanceRow {
  id: string;
  date: string;
  title: string;
  by: string;
  cost: number;
  note: string;
  outOfService: boolean;
  closedAt: string | null;
  closedBy: AssetPerson | null;
  closeCondition: AssetCondition | null;
  createdBy: AssetPerson | null;
}

/** GET /assets/:id */
export interface AssetDetail extends AssetRow {
  custody: AssetCustodyRow[];
  reservations: AssetReservationRow[];
  maintenance: AssetMaintenanceRow[];
  /** Its use so far at its cost per hour: what shoots have carried of its depreciation. */
  recovered: number | null;
}
