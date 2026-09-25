// True Costing model — every number on /costing is derived here so the math stays consistent.
//
// True cost = Labour + Equipment + Shared overhead + Travel & consumables + Rework
//   Labour     = Σ (minutes ÷ 60 × person hourly cost)        — editor, director, camera, freelancers
//   Equipment  = Σ (equipment hours × per-hour depreciation)   — (purchase − residual) ÷ life ÷ productive hrs/yr
//   Overhead   = direct labour hours × overhead rate            — pools ÷ direct labour hours (₹80/hr)
//   Travel     = shoot travel & consumables ÷ videos in that shoot
//   Rework     = agency-correction minutes × editor rate        — free corrections, measured as cost
// Revenue share = agreement monthly fee × (format weight ÷ Σ unit weights in the package)

import { agreementById, assets, personById, shoots } from "@/lib/mock/core";
import { OVERHEAD_RATE } from "@/lib/mock/finance";
import type { ChangeRequest } from "@/lib/store";
import type { Asset, Video, VideoStage } from "@/lib/types";

export interface Scenario {
  labourPct: number; // +/- % on all hourly rates
  overheadPct: number; // +/- % on overhead pools
  cameraLifeYears: number; // useful life of GM-CAM-01 (base 1)
}
export const BASE_SCENARIO: Scenario = { labourPct: 0, overheadPct: 0, cameraLifeYears: 1 };

// ───────────────────────────── Equipment rates ─────────────────────────────

export const PRODUCTIVE_HOURS: Record<Asset["category"], number> = {
  Camera: 1200, Lens: 1200, Lighting: 1200, Audio: 1200, Support: 1200, Power: 1200, Storage: 1200, Accessory: 1200, Computer: 1800,
};

export function assetRate(a: Asset, sc: Scenario = BASE_SCENARIO) {
  const life = a.id === "as-01" ? sc.cameraLifeYears : a.usefulLifeYears;
  return (a.purchaseValue - a.residualValue) / life / PRODUCTIVE_HOURS[a.category];
}

export const KIT = {
  single: ["as-01", "as-05", "as-03", "as-06", "as-07", "as-08", "as-11", "as-16", "as-17"],
  dual: ["as-01", "as-02", "as-05", "as-03", "as-04", "as-06", "as-07", "as-08", "as-10", "as-11", "as-16", "as-17"],
} as const;

export const assetById = (id: string) => assets.find((a) => a.id === id)!;

export function kitRate(kit: "single" | "dual", sc: Scenario = BASE_SCENARIO) {
  return KIT[kit].reduce((s, id) => s + assetRate(assetById(id), sc), 0);
}

/** Edit machine used by each editor (freelancers use their own — included in their rate). */
export const EDIT_MACHINE: Record<string, string | undefined> = { "p-divya": "as-14", "p-surya": "as-15" };

// ───────────────────────────── Format standards ─────────────────────────────

type Format = Video["format"];
/**
 * Crew mix: how a video's total planned/logged minutes split across roles, by format.
 * `second` = second camera operator (dual-cam kit only; otherwise folds into editor).
 * `motion` = motion designer (freelancer) for ads.
 */
export const CREW_MIX: Record<Format, { editor: number; director: number; camera: number; second: number; motion: number }> = {
  Reel: { editor: 0.7, director: 0.15, camera: 0.15, second: 0, motion: 0 },
  Explainer: { editor: 0.7, director: 0.15, camera: 0.15, second: 0, motion: 0 },
  "Podcast clip": { editor: 0.8, director: 0.1, camera: 0.1, second: 0, motion: 0 },
  Testimonial: { editor: 0.6, director: 0.15, camera: 0.15, second: 0.1, motion: 0 },
  "Long-form": { editor: 0.6, director: 0.15, camera: 0.15, second: 0.1, motion: 0 },
  Ad: { editor: 0.55, director: 0.15, camera: 0.15, second: 0, motion: 0.15 },
};
export const FORMAT_WEIGHT: Record<Format, number> = { Reel: 1, Explainer: 1, Testimonial: 1.5, Ad: 1.5, "Long-form": 3, "Podcast clip": 0.6 };

export function unitWeight(label: string) {
  if (/long-form|walkthrough|faculty/i.test(label)) return 3;
  if (/\bad\b|testimonial/i.test(label)) return 1.5;
  if (/static/i.test(label)) return 0.15;
  if (/stor/i.test(label)) return 0.05;
  return 1;
}

export function revenueShare(v: Video) {
  const ag = agreementById(v.agreementId);
  const totalWeight = ag.units.reduce((s, u) => s + u.perCycle * unitWeight(u.label), 0);
  const perWeight = ag.monthlyFee / totalWeight;
  return { value: perWeight * FORMAT_WEIGHT[v.format], perWeight, totalWeight, fee: ag.monthlyFee, weight: FORMAT_WEIGHT[v.format], packageName: ag.packageName };
}

// ───────────────────────────── Travel ─────────────────────────────

export const SHOOT_TRAVEL: Record<string, { budget: number; actual: number; note: string }> = {
  "sh-01": { budget: 1400, actual: 1320, note: "Perundurai — fuel, tolls, breakfast for crew" },
  "sh-02": { budget: 1200, actual: 1480, note: "Bhavani farmhouse — fuel + lunch, extra trip for archival photos" },
  "sh-03": { budget: 900, actual: 860, note: "Studio shoot — props & consumables only" },
  "sh-04": { budget: 4200, actual: 4200, note: "Chennai — train + cab (stay re-billed: beyond 150 km per agreement)" },
  "sh-05": { budget: 3400, actual: 3650, note: "Kanchipuram — cab, crew lunch, gaffer tape & diffusion" },
  "sh-06": { budget: 1600, actual: 1540, note: "RS Puram, Coimbatore — fuel + parking" },
  "sh-07": { budget: 1800, actual: 1760, note: "Salem campus — fuel + tolls" },
  "sh-08": { budget: 2400, actual: 3120, note: "Tiruppur site — 2 trips (first day rained out)" },
  "sh-09": { budget: 1600, actual: 1600, note: "RS Puram, Coimbatore — planned" },
};

/** Minutes of free agency corrections (our mistakes) already logged. Store CRs of kind agency-correction add 90 min each. */
export const REWORK_SEED: Record<string, number> = { "v-sls-1": 120, "v-unr-1": 150, "v-kvr-4": 45 };

const STAGE_IDX: Record<VideoStage, number> = {
  Planned: 0, Scripting: 1, "Shoot Scheduled": 2, Shot: 3, Editing: 4, "Internal QC": 5, "Client Review": 6, Revision: 7, Approved: 8, Published: 9,
};
export const stageIdx = (s: VideoStage) => STAGE_IDX[s];

function jitter(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return 0.9 + ((h % 30) / 100); // 0.90 – 1.19
}

// ───────────────────────────── Cost build-up ─────────────────────────────

export type LabourBucket = "Editor" | "Director" | "Camera" | "Freelancer";

export interface LabourLine {
  personId: string;
  name: string;
  role: string;
  bucket: LabourBucket;
  minutes: number;
  rate: number;
  cost: number;
}

export interface CostBreakdown {
  labour: number;
  labourLines: LabourLine[];
  labourByBucket: Record<LabourBucket, number>;
  equipment: number;
  equipmentLines: { label: string; hours: number; rate: number; cost: number }[];
  overhead: number;
  labourHours: number;
  travel: number;
  travelNote?: string;
  rework: number;
  reworkMinutes: number;
  total: number;
}

export interface VideoCost {
  video: Video;
  standard: CostBreakdown;
  actual: CostBreakdown;
  revenue: number;
  revenueInfo: ReturnType<typeof revenueShare>;
  complete: boolean; // cost essentially final (client review or later)
  variance: number; // actual − standard (only meaningful if complete)
  projected: number; // cost used for margin: actual if complete else max(actual, standard)
  margin: number; // revenue − projected
  marginPct: number;
}

function line(personId: string, bucket: LabourBucket, minutes: number, sc: Scenario): LabourLine {
  const p = personById(personId);
  const rate = p.hourlyCost * (1 + sc.labourPct / 100);
  const b: LabourBucket = p.type === "freelancer" ? "Freelancer" : bucket;
  return { personId, name: p.name, role: p.role, bucket: b, minutes, rate, cost: (minutes / 60) * rate };
}

function build(
  v: Video,
  mode: "standard" | "actual",
  sc: Scenario,
  reworkMinutes: number,
): CostBreakdown {
  const idx = STAGE_IDX[v.stage];
  const j = jitter(v.id);
  const shoot = shoots.find((s) => s.id === v.shootId);
  const kit = shoot?.kit ?? "single";

  const shot = mode === "standard" || idx >= 3;
  const mix = CREW_MIX[v.format];
  const dual = kit === "dual" && mix.second > 0;
  const editorShare = mix.editor + (dual ? 0 : mix.second);
  const P = v.plannedMinutes;

  // Standard: planned minutes split by crew mix.
  // Actual: director & camera from the shoot sheet (std share × actual variance once shot);
  //         editor = logged minutes − director − camera − motion − rework (rework shown separately).
  const dirStd = P * mix.director;
  const camStd = P * mix.camera;
  const secStd = dual ? P * mix.second : 0;
  const motStd = P * mix.motion;
  const directorMin = Math.round(mode === "standard" ? dirStd : dirStd * (idx >= 3 ? j : idx >= 1 ? 0.5 : 0));
  const cameraMin = Math.round(mode === "standard" ? camStd : shot ? camStd * j : 0);
  const secondMin = Math.round(mode === "standard" ? secStd : shot ? secStd * j : 0);
  const motionMin = Math.round(mode === "standard" ? motStd : idx >= 5 ? motStd * j : 0);
  const editorMin =
    mode === "standard"
      ? Math.round(P * editorShare)
      : Math.max(0, v.loggedMinutes - directorMin - cameraMin - secondMin - motionMin - reworkMinutes);

  const lines: LabourLine[] = [];
  if (editorMin) lines.push(line(v.editorId, "Editor", editorMin, sc));
  if (directorMin) lines.push(line(v.directorId, "Director", directorMin, sc));
  if (cameraMin) lines.push(line(v.cameraId, "Camera", cameraMin, sc));
  if (secondMin) lines.push(line(v.cameraId === "f-gokul" ? "p-vignesh" : "f-gokul", "Camera", secondMin, sc));
  if (motionMin) lines.push(line("f-sneha", "Freelancer", motionMin, sc));

  const labour = lines.reduce((s, l) => s + l.cost, 0);
  const labourByBucket: Record<LabourBucket, number> = { Editor: 0, Director: 0, Camera: 0, Freelancer: 0 };
  lines.forEach((l) => (labourByBucket[l.bucket] += l.cost));

  // Equipment: camera kit for shoot hours + edit workstation for edit hours
  const equipmentLines: CostBreakdown["equipmentLines"] = [];
  if (cameraMin) {
    const r = kitRate(kit, sc);
    equipmentLines.push({ label: `${kit === "dual" ? "Dual" : "Single"}-cam kit`, hours: cameraMin / 60, rate: r, cost: (cameraMin / 60) * r });
  }
  const machine = EDIT_MACHINE[v.editorId];
  const editHrs = (editorMin + reworkMinutes) / 60;
  if (machine && editHrs) {
    const a = assetById(machine);
    const r = assetRate(a, sc);
    equipmentLines.push({ label: a.name, hours: editHrs, rate: r, cost: editHrs * r });
  }
  const equipment = equipmentLines.reduce((s, l) => s + l.cost, 0);

  const labourHours = lines.reduce((s, l) => s + l.minutes, 0) / 60 + reworkMinutes / 60;
  const overhead = labourHours * OVERHEAD_RATE * (1 + sc.overheadPct / 100);

  let travel = 0;
  let travelNote: string | undefined;
  if (shoot && SHOOT_TRAVEL[shoot.id]) {
    const t = SHOOT_TRAVEL[shoot.id]!;
    const share = shoot.videoIds.length || 1;
    travel = (mode === "standard" ? t.budget : shot && idx >= 3 ? t.actual : 0) / share;
    travelNote = `${t.note} · ÷ ${share} video${share > 1 ? "s" : ""}`;
  }

  const editorRate = personById(v.editorId).hourlyCost * (1 + sc.labourPct / 100);
  const rework = (reworkMinutes / 60) * editorRate;

  const total = labour + equipment + overhead + travel + rework;
  return { labour, labourLines: lines, labourByBucket, equipment, equipmentLines, overhead, labourHours, travel, travelNote, rework, reworkMinutes, total };
}

export function reworkMinutesFor(v: Video, crs: ChangeRequest[]) {
  const agencyCRs = crs.filter((c) => c.videoId === v.id && c.kind === "agency-correction").length;
  return (REWORK_SEED[v.id] ?? 0) + agencyCRs * 90;
}

export function costVideo(v: Video, crs: ChangeRequest[], sc: Scenario = BASE_SCENARIO): VideoCost {
  const rw = reworkMinutesFor(v, crs);
  const standard = build(v, "standard", sc, 0);
  const actual = build(v, "actual", sc, rw);
  const info = revenueShare(v);
  const complete = STAGE_IDX[v.stage] >= 6;
  const projected = complete ? actual.total : Math.max(actual.total, standard.total);
  const margin = info.value - projected;
  return {
    video: v,
    standard,
    actual,
    revenue: info.value,
    revenueInfo: info,
    complete,
    variance: actual.total - standard.total,
    projected,
    margin,
    marginPct: margin / info.value,
  };
}

export function marginTone(p: number): "success" | "warning" | "danger" {
  if (p >= 0.3) return "success";
  if (p >= 0.12) return "warning";
  return "danger";
}

// ───────────────────────────── Rate card history ─────────────────────────────

export const rateCards = [
  { version: "v3", effectiveFrom: "2026-07-01", effectiveTo: null as string | null, change: "Editor rates revised after Q1 appraisal (Divya ₹430 → ₹460/hr); overhead rate ₹74 → ₹80/hr", by: "Finance Desk", status: "current" as const },
  { version: "v2", effectiveFrom: "2026-04-01", effectiveTo: "2026-06-30", change: "FY 2026-27 opening rates; camera GM-CAM-01 added at ₹150/hr", by: "Finance Desk", status: "locked" as const },
  { version: "v1", effectiveFrom: "2025-04-01", effectiveTo: "2026-03-31", change: "FY 2025-26 rates", by: "Janarthanan", status: "locked" as const },
];

export const periods = [
  { label: "Apr 2026", status: "locked" as const, lockedOn: "2026-05-06" },
  { label: "May 2026", status: "locked" as const, lockedOn: "2026-06-05" },
  { label: "Jun 2026", status: "locked" as const, lockedOn: "2026-07-07" },
  { label: "Jul 2026", status: "locked" as const, lockedOn: "2026-08-05" },
  { label: "Aug 2026", status: "locked" as const, lockedOn: "2026-09-05" },
  { label: "Sep 2026", status: "open" as const, lockedOn: null },
];
