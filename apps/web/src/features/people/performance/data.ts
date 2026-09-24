export interface Kra {
  kra: string;
  measurement: string;
  unit: string;
  target: number;
  actual: number;
  weight: number; // %
  lowerIsBetter?: boolean;
}

export interface QualityGate {
  kra: string; // must match a Kra.kra
  threshold: number; // achievement below this (in the KRA's own unit) triggers the gate
  cap: number;
  label: string;
}

export interface RoleScorecard {
  id: "editor" | "smm" | "camera";
  role: string;
  gate: QualityGate;
  people: { personId: string; kras: Kra[] }[];
}

const editorKras = (a: [number, number, number, number, number]): Kra[] => [
  { kra: "Videos delivered", measurement: "Videos passed to client / month", unit: "", target: 14, actual: a[0], weight: 25 },
  { kra: "On-time delivery", measurement: "% delivered within agreement TAT", unit: "%", target: 95, actual: a[1], weight: 20 },
  { kra: "QC first-pass rate", measurement: "% passing internal QC first time", unit: "%", target: 85, actual: a[2], weight: 30 },
  { kra: "Revisions per video", measurement: "Avg client revision rounds", unit: "", target: 1.5, actual: a[3], weight: 15, lowerIsBetter: true },
  { kra: "Time-log compliance", measurement: "% of working hours logged to tasks", unit: "%", target: 100, actual: a[4], weight: 10 },
];

export const scorecards: RoleScorecard[] = [
  {
    id: "editor",
    role: "Video Editor",
    gate: { kra: "QC first-pass rate", threshold: 80, cap: 70, label: "QC first-pass rate < 80% caps composite at 70" },
    people: [
      { personId: "p-divya", kras: editorKras([13, 86, 90, 1.9, 88]) },
      { personId: "p-surya", kras: editorKras([12, 86, 72, 2.4, 94]) },
    ],
  },
  {
    id: "smm",
    role: "Social Media Manager",
    gate: { kra: "Client reports on time", threshold: 60, cap: 75, label: "Client reports on time < 60% caps composite at 75" },
    people: [
      {
        personId: "p-meena",
        kras: [
          { kra: "Posts published vs plan", measurement: "% of content calendar published", unit: "%", target: 100, actual: 88, weight: 25 },
          { kra: "Schedule adherence", measurement: "% posted in planned slot", unit: "%", target: 95, actual: 84, weight: 20 },
          { kra: "Client reports on time", measurement: "% monthly reports sent by 5th", unit: "%", target: 100, actual: 60, weight: 20 },
          { kra: "Engagement growth", measurement: "Avg engagement rate growth, MoM", unit: "%", target: 10, actual: 8, weight: 20 },
          { kra: "DM response time", measurement: "Avg first response (hours)", unit: " h", target: 4, actual: 6, weight: 15, lowerIsBetter: true },
        ],
      },
    ],
  },
  {
    id: "camera",
    role: "Camera Man",
    gate: { kra: "Kit checklist compliance", threshold: 90, cap: 70, label: "Kit checklist compliance < 90% caps composite at 70" },
    people: [
      {
        personId: "p-vignesh",
        kras: [
          { kra: "Shoots completed", measurement: "Shoots executed as scheduled", unit: "", target: 12, actual: 13, weight: 25 },
          { kra: "Kit checklist compliance", measurement: "% items checked out & back in", unit: "%", target: 100, actual: 96, weight: 20 },
          { kra: "Usable footage first time", measurement: "% shoots needing no reshoot", unit: "%", target: 90, actual: 78, weight: 25 },
          { kra: "Call-time punctuality", measurement: "% on location before call time", unit: "%", target: 100, actual: 88, weight: 15 },
          { kra: "Equipment incidents", measurement: "Damage / loss incidents", unit: "", target: 1, actual: 2, weight: 15, lowerIsBetter: true },
        ],
      },
    ],
  },
];

export function achievement(k: Kra) {
  if (k.lowerIsBetter) return k.actual <= 0 ? 1 : Math.min(1, k.target / k.actual);
  return Math.min(1, k.actual / k.target);
}

export function weighted(k: Kra) {
  return achievement(k) * k.weight;
}

export function composite(kras: Kra[], gate?: QualityGate) {
  const raw = Math.round(kras.reduce((s, k) => s + weighted(k), 0) * 10) / 10;
  const gk = gate ? kras.find((k) => k.kra === gate.kra) : undefined;
  const triggered = !!gate && !!gk && gk.actual < gate.threshold;
  return { raw, final: triggered ? Math.min(raw, gate!.cap) : raw, triggered, gateActual: gk?.actual };
}

// ─────────────── Player rating (Competence vs Commitment) ───────────────

export type Params = { Skill: number; Knowledge: number; "Self image": number; Motive: number; Trait: number };
export type Player = "A" | "B-Competence" | "B-Commitment" | "C";

export const playerParams: Record<string, Params> = {
  "p-ashwin": { Skill: 5, Knowledge: 4, "Self image": 5, Motive: 4, Trait: 4 },
  "p-priya": { Skill: 4, Knowledge: 4, "Self image": 4, Motive: 5, Trait: 4 },
  "p-karthik": { Skill: 5, Knowledge: 5, "Self image": 4, Motive: 4, Trait: 4 },
  "p-divya": { Skill: 5, Knowledge: 5, "Self image": 4, Motive: 4, Trait: 4 },
  "p-vignesh": { Skill: 3, Knowledge: 3, "Self image": 4, Motive: 5, Trait: 4 },
  "p-surya": { Skill: 4, Knowledge: 4, "Self image": 3, Motive: 3, Trait: 3 },
  "p-meena": { Skill: 4, Knowledge: 4, "Self image": 3, Motive: 4, Trait: 3 },
  "p-harini": { Skill: 3, Knowledge: 4, "Self image": 4, Motive: 4, Trait: 4 },
  "p-naveen": { Skill: 3, Knowledge: 3, "Self image": 3, Motive: 3, Trait: 4 },
};

export function classify(p: Params): Player {
  const vals = Object.values(p);
  const total = vals.reduce((a, b) => a + b, 0);
  const competence = p.Skill >= 4 && p.Knowledge >= 4;
  const commitment = p["Self image"] >= 4 && p.Motive >= 4 && p.Trait >= 4;
  if (vals.every((v) => v >= 4) || total >= 20) return "A";
  if (competence && !commitment) return "B-Competence";
  if (!competence && commitment) return "B-Commitment";
  return "C";
}

export const playerMeta: Record<Player, { label: string; tone: "success" | "info" | "gold" | "danger"; desc: string; action: string }> = {
  A: { label: "A player", tone: "success", desc: "High competence · high commitment", action: "Retain, stretch, give ownership" },
  "B-Competence": { label: "B · Competence", tone: "info", desc: "Skilled, but attitude < 4", action: "Coach on ownership & motivation" },
  "B-Commitment": { label: "B · Commitment", tone: "gold", desc: "Committed, but skill/knowledge < 4", action: "Train — LMS path + mentoring" },
  C: { label: "C player", tone: "danger", desc: "Low on both", action: "Performance improvement plan" },
};

// ─────────────── Composite for non-scorecard roles (from their own KRA sheets) ───────────────

export const otherComposites: Record<string, { score: number; trend: number }> = {
  "p-ashwin": { score: 86, trend: 4 },
  "p-karthik": { score: 84, trend: 2 },
  "p-priya": { score: 81, trend: 6 },
  "p-harini": { score: 74, trend: 8 },
  "p-naveen": { score: 66, trend: -3 },
};

export const scorecardTrend: Record<string, number> = {
  "p-divya": 3,
  "p-surya": -6,
  "p-meena": 1,
  "p-vignesh": 5,
};

export function compositeFor(personId: string): number | null {
  for (const sc of scorecards) {
    const p = sc.people.find((x) => x.personId === personId);
    if (p) return composite(p.kras, sc.gate).final;
  }
  return otherComposites[personId]?.score ?? null;
}

export const INCENTIVE_POOL = 60000;
export const INCENTIVE_MIN_SCORE = 70;
