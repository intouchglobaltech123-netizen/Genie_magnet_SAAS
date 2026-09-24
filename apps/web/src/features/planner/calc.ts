/**
 * Way To Fortune — pure calculation engine.
 * Every function mirrors a formula from the two source workbooks
 * ("Personal Leakage Auditor" and "Money Behaviour Diagnostic").
 * Cell references are noted next to each function so the logic can be audited against the sheets.
 * No imports on purpose: this file must stay framework-free and unit-testable.
 */

// ───────────────────────────── Types ─────────────────────────────

export type SpendKind = "Need" | "Want" | "Craving";
export type RuleUsed = "Yes" | "No" | "NA";

export const LEAK_TYPES = [
  "GEYSER",
  "DRIPPER",
  "RESERVOIR",
  "OOZER",
  "PURIFIER",
  "CLOUD BURST",
  "THE DAM",
  "SPRINKLER",
  "MIRAGE",
  "NONE",
] as const;
export type LeakType = (typeof LEAK_TYPES)[number];

/** Order matters: the sheet's "Top Emotion" picks the FIRST emotion with the max count in this order. */
export const EMOTIONS = [
  "Stress/Frustration",
  "Boredom",
  "Excitement/Celebration",
  "Loneliness/Sadness",
  "Peer Pressure",
  "Anger",
  "Anxiety/Fear",
  "Self-Reward",
  "FOMO",
  "No Emotion-Just Habit",
] as const;
export type Emotion = (typeof EMOTIONS)[number];

export interface PlannerSetup {
  name: string;
  age: number;
  monthlyIncome: number;
  retireAge: number;
  inflation: number; // % — fixed at 7 in the sheet
  expectedReturn: number; // % — 12
  postRetirementReturn: number; // % — 6
  monthlySip: number; // Monthly Report!E39 — "Your Current Monthly SIP/Investment"
}

export interface LogEntry {
  id: string;
  day: number; // 1..30
  date: string; // ISO yyyy-mm-dd
  item: string;
  amount: number;
  kind: SpendKind;
  leakType: LeakType;
  emotion: Emotion;
  mood: number; // 1 = Regret … 5 = Happy (0 = not scored)
  rule48: RuleUsed;
  notes?: string;
}

// ───────────────────────────── MY SETUP ─────────────────────────────

export interface SetupCalc {
  yearsToRetire: number; // D14 = D7-D5
  monthlyLifestyle: number; // D15 = D6*0.5
  annualLifestyle: number; // D16 = D15*12
  monthlyAtRetirement: number; // D17 = D15*(1+D8/100)^D14
  annualAtRetirement: number; // D18 = D17*12
  corpus: number; // D19 = D18*25
}

export function calcSetup(s: PlannerSetup): SetupCalc {
  const yearsToRetire = s.retireAge - s.age;
  const monthlyLifestyle = s.monthlyIncome * 0.5;
  const annualLifestyle = monthlyLifestyle * 12;
  const monthlyAtRetirement = monthlyLifestyle * Math.pow(1 + s.inflation / 100, yearsToRetire);
  const annualAtRetirement = monthlyAtRetirement * 12;
  const corpus = annualAtRetirement * 25;
  return { yearsToRetire, monthlyLifestyle, annualLifestyle, monthlyAtRetirement, annualAtRetirement, corpus };
}

/** Year-by-year projection used for the corpus growth chart (SIP compounding monthly at expected return). */
export function corpusProjection(s: PlannerSetup, extraMonthly = 0) {
  const { yearsToRetire, corpus } = calcSetup(s);
  const r = s.expectedReturn / 1200;
  const rows: { year: number; age: number; invested: number; withLeakStopped: number; target: number }[] = [];
  const horizon = Math.max(1, yearsToRetire);
  for (let y = 0; y <= horizon; y++) {
    const n = y * 12;
    rows.push({
      year: y,
      age: s.age + y,
      invested: fv(r, n, s.monthlySip),
      withLeakStopped: fv(r, n, s.monthlySip + extraMonthly),
      target: corpus,
    });
  }
  return rows;
}

// ───────────────────────────── Finance helpers (Excel-compatible) ─────────────────────────────

/** Excel FV(rate, nper, -pmt) for an ordinary annuity (type 0). */
export function fv(rate: number, nper: number, pmt: number) {
  if (rate === 0) return pmt * nper;
  return (pmt * (Math.pow(1 + rate, nper) - 1)) / rate;
}

/** Excel NPER(rate, -pmt, 0, fv) → number of periods; NaN when unreachable. */
export function nper(rate: number, pmt: number, target: number) {
  if (pmt <= 0) return NaN;
  if (rate === 0) return target / pmt;
  return Math.log((target * rate + pmt) / pmt) / Math.log(1 + rate);
}

// ───────────────────────────── 30-DAY DAILY LOG ─────────────────────────────

/** J: =IF(E="Craving",D,IF(AND(E="Want",I="No"),D*0.5,0)) */
export function leakage(e: Pick<LogEntry, "kind" | "amount" | "rule48">) {
  if (e.kind === "Craving") return e.amount;
  if (e.kind === "Want" && e.rule48 === "No") return e.amount * 0.5;
  return 0;
}

/** Factor used in K (daily log) and E (weekly): ((1+1%)^180-1)/1% × 1.01 — monthly SIP, 15 yrs @ 12%, annuity-due. */
export const OPP_FACTOR_15Y = ((Math.pow(1.01, 180) - 1) / 0.01) * 1.01;

/** K: =ROUND(J*((1+0.01)^180-1)/0.01*1.01,0) */
export function opportunityCost15(leak: number) {
  return Math.round(leak * OPP_FACTOR_15Y);
}

export function withCalc(e: LogEntry) {
  const leak = leakage(e);
  return { ...e, leak, opp: opportunityCost15(leak) };
}

// ───────────────────────────── WEEKLY SUMMARY ─────────────────────────────

export const WEEKS = [
  { label: "Week 1", period: "Days 1–7", from: 1, to: 7 },
  { label: "Week 2", period: "Days 8–14", from: 8, to: 14 },
  { label: "Week 3", period: "Days 15–21", from: 15, to: 21 },
  { label: "Week 4", period: "Days 22–30", from: 22, to: 30 },
] as const;

function avgMood(entries: LogEntry[], digits: number) {
  const scored = entries.filter((e) => e.mood > 0); // AVERAGEIF(H,">0")
  if (!scored.length) return null;
  const f = Math.pow(10, digits);
  return Math.round((scored.reduce((s, e) => s + e.mood, 0) / scored.length) * f) / f;
}

/** INDEX(emotions, MATCH(MAX(COUNTIF(...)), COUNTIF(...), 0)) — first emotion with the highest count. */
export function topEmotion(entries: LogEntry[]): Emotion | null {
  const counts = EMOTIONS.map((em) => entries.filter((e) => e.emotion === em).length);
  const max = Math.max(...counts);
  // With no entries every count is 0 and the sheet returns the first emotion; we return null to show "—".
  if (max === 0) return entries.length ? EMOTIONS[0] : null;
  return EMOTIONS[counts.indexOf(max)];
}

export function weeklySummary(log: LogEntry[]) {
  return WEEKS.map((w) => {
    const entries = log.filter((e) => e.day >= w.from && e.day <= w.to);
    const spend = entries.reduce((s, e) => s + e.amount, 0); // C
    const leak = entries.reduce((s, e) => s + leakage(e), 0); // D
    return {
      ...w,
      entries: entries.length,
      spend,
      leak,
      opp: opportunityCost15(leak), // E
      leakScore: spend ? Math.round((leak / spend) * 1000) / 10 : 0, // F =IFERROR(ROUND(D/C*100,1),0)
      topEmotion: topEmotion(entries), // G
      mood: avgMood(entries, 1), // H
    };
  });
}

// ───────────────────────────── MONTHLY REPORT ─────────────────────────────

export function monthlyReport(log: LogEntry[], setup: PlannerSetup) {
  const sum = (f: (e: LogEntry) => number) => log.reduce((s, e) => s + f(e), 0);
  const total = sum((e) => e.amount); // E5
  const needs = sum((e) => (e.kind === "Need" ? e.amount : 0)); // E6
  const wants = sum((e) => (e.kind === "Want" ? e.amount : 0)); // E7
  const cravings = sum((e) => (e.kind === "Craving" ? e.amount : 0)); // E8
  const leak = sum(leakage); // E9
  const leakScore = total ? leak / total : 0; // E10 (fraction)
  const ruleUsed = log.filter((e) => e.rule48 === "Yes").length; // E11
  const mood = avgMood(log, 2); // E12

  const emotions = EMOTIONS.map((em) => {
    const rows = log.filter((e) => e.emotion === em);
    return {
      emotion: em,
      count: rows.length, // B
      spent: rows.reduce((s, e) => s + e.amount, 0), // D
      leak: rows.reduce((s, e) => s + leakage(e), 0), // F
    };
  });

  const leakTypes = LEAK_TYPES.filter((t) => t !== "NONE").map((t) => {
    const rows = log.filter((e) => e.leakType === t);
    return { type: t, count: rows.length, spent: rows.reduce((s, e) => s + e.amount, 0), leak: rows.reduce((s, e) => s + leakage(e), 0) };
  });

  // SECTION 3 — Opportunity cost & retirement impact
  const setupCalc = calcSetup(setup);
  const fv15 = fv(0.12 / 12, 15 * 12, leak); // E31 =FV(12%/12, 15*12, -E30)
  const r = setup.expectedReturn / 1200;
  const yearsWithLeak = setup.monthlySip > 0 ? nper(r, setup.monthlySip, setupCalc.corpus) / 12 : NaN; // E37
  const yearsLeakStopped = setup.monthlySip + leak > 0 ? nper(r, setup.monthlySip + leak, setupCalc.corpus) / 12 : NaN; // E38
  const retireAgeLeakStopped = setup.age + yearsLeakStopped; // E43 (unrounded in sheet)
  const retireAgeWithLeak = Number.isFinite(yearsWithLeak) ? Math.round((setup.age + yearsWithLeak) * 10) / 10 : NaN; // E44
  const yearsLost = Number.isFinite(yearsWithLeak) ? Math.round((retireAgeWithLeak - retireAgeLeakStopped) * 10) / 10 : NaN; // E45

  return {
    total,
    needs,
    wants,
    cravings,
    leak,
    leakScore,
    ruleUsed,
    mood,
    emotions,
    leakTypes,
    fv15,
    setup: setupCalc,
    yearsWithLeak,
    yearsLeakStopped,
    retireAgeLeakStopped,
    retireAgeWithLeak,
    yearsLost,
  };
}

// ───────────────────────────── MONEY BEHAVIOUR DIAGNOSTIC ─────────────────────────────

export type ScoreValue = 1 | 2 | 3 | 4 | 5;
/** Answers keyed by question number (1–54). null/undefined = blank or invalid entry. */
export type Answers = Record<number, number | null | undefined>;

export interface DiagnosticGroup {
  key: string; // as written in QUESTIONS!C
  label: string; // as shown on MY MONEY PROFILE
  section: "flow" | "belief";
  subtitle: string; // QUESTIONS!D
  /** Hidden multiplier in MY MONEY PROFILE!H (=B×weight). Drives intensity, raw total and "dominant". */
  weight: 1 | 2 | 3;
  meaning: string;
  dayToFix: string;
  action: string;
  questions: [number, number, number];
}

export type Intensity = "HIGH" | "MEDIUM" | "LOW";

/** C: =IF(H>=36,"HIGH",IF(H>=21,"MEDIUM","LOW")) where H = score × weight */
export function intensityOf(weighted: number): Intensity {
  if (weighted >= 36) return "HIGH";
  if (weighted >= 21) return "MEDIUM";
  return "LOW";
}

/** B: =IFERROR(F_a+F_b+F_c,0) — any blank/invalid answer in the trio makes the whole group 0 (Excel #VALUE! → 0). */
export function groupScore(answers: Answers, qs: readonly number[]) {
  let total = 0;
  for (const n of qs) {
    const v = answers[n];
    if (typeof v !== "number" || !Number.isFinite(v)) return 0;
    total += v;
  }
  return total;
}

export const RAW_MIN = 123; // 41 weight-units × 3
export const RAW_MAX = 615; // 41 weight-units × 15

export const PROFILE_BANDS = [
  { key: "architect", label: "The Wealth Architect", emoji: "🏆", min: 80.01, tagline: "You think, act, and invest like a builder. Scale your wealth.", guide: "Your money behaviour is disciplined, intentional, and system-driven. You are ready to scale wealth aggressively." },
  { key: "grower", label: "The Wealth Grower", emoji: "🌱", min: 60.01, tagline: "Your system is working. Focus on investment next.", guide: "Your behaviour is improving. Some leaks remain, but your system is forming. Focus on automation and consistency." },
  { key: "builder", label: "The Conscious Builder", emoji: "🔧", min: 35.01, tagline: "You are patching leaks. Keep building your system.", guide: "You are aware of your patterns and beliefs. Discipline is building but old habits still interrupt. Fix with systems." },
  { key: "bucket", label: "The Leaking Bucket", emoji: "🪣", min: -Infinity, tagline: "Your bucket has many holes. Behaviour is unconsciously controlled.", guide: "Your subconscious is running your money. Patterns and beliefs are dominating. Immediate rewiring needed." },
] as const;
export type ProfileBand = (typeof PROFILE_BANDS)[number];

/** C34: <=35 Leaking Bucket, <=60 Conscious Builder, <=80 Wealth Grower, else Wealth Architect. */
export function bandOf(score: number): ProfileBand {
  if (score <= 35) return PROFILE_BANDS[3];
  if (score <= 60) return PROFILE_BANDS[2];
  if (score <= 80) return PROFILE_BANDS[1];
  return PROFILE_BANDS[0];
}

export function scoreDiagnostic(answers: Answers, groups: readonly DiagnosticGroup[]) {
  const rows = groups.map((g) => {
    const score = groupScore(answers, g.questions);
    const weighted = score * g.weight;
    return { ...g, score, weighted, intensity: intensityOf(weighted) };
  });
  const flows = rows.filter((r) => r.section === "flow");
  const beliefs = rows.filter((r) => r.section === "belief");
  const raw = rows.reduce((s, r) => s + r.weighted, 0); // C32 =SUM(H6:H14)+SUM(H19:H27)
  const score = Math.round((100 - ((raw - RAW_MIN) / (RAW_MAX - RAW_MIN)) * 100) * 10) / 10; // C33
  // C36/C37 — nested IFs: first group (in sheet order) whose weighted score equals the max.
  const firstMax = (list: typeof rows) => {
    const max = Math.max(...list.map((r) => r.weighted));
    return list.find((r) => r.weighted === max)!;
  };
  const answered = Object.values(answers).filter((v) => typeof v === "number").length;
  return { rows, flows, beliefs, raw, score, band: bandOf(score), dominantFlow: firstMax(flows), dominantBelief: firstMax(beliefs), answered };
}
