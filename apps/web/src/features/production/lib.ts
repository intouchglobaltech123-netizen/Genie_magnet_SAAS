import type { CSSProperties } from "react";
import { addDays, format, getDay, parseISO } from "date-fns";
import {
  agreementById,
  clientById,
  clients,
  cycles,
  daysBetween,
  personById,
  shoots,
  TODAY,
} from "@/lib/mock/core";
import { EDIT_STEPS, QC_CHECKS, VIDEO_STAGES, type Video, type VideoStage } from "@/lib/types";

// ───────────────────────────── Dates ─────────────────────────────

export const toDate = (iso: string) => parseISO(iso);
export const toIso = (d: Date) => format(d, "yyyy-MM-dd");
export const fmt = (iso: string, f = "d MMM") => format(parseISO(iso), f);
export const shiftIso = (iso: string, days: number) => toIso(addDays(parseISO(iso), days));

/** Public holidays observed by Genie Magnet (Tamil Nadu). */
export const HOLIDAYS: Record<string, string> = {
  "2026-10-02": "Gandhi Jayanti",
  "2026-10-19": "Ayudha Pooja",
  "2026-10-20": "Vijayadashami",
  "2026-11-08": "Deepavali",
};

export const isSundayIso = (iso: string) => getDay(parseISO(iso)) === 0;
export const isWorkingDay = (iso: string) => !isSundayIso(iso) && !HOLIDAYS[iso];

/** Step back N working days (skips Sundays and holidays). */
export function backWorkingDays(iso: string, n: number) {
  let cur = iso;
  let left = n;
  while (left > 0) {
    cur = shiftIso(cur, -1);
    if (isWorkingDay(cur)) left--;
  }
  return cur;
}

export function prevWorkingDay(iso: string) {
  return backWorkingDays(iso, 1);
}

export function relDue(iso: string) {
  const d = daysBetween(TODAY, iso);
  if (d === 0) return "Due today";
  if (d === 1) return "Due tomorrow";
  if (d === -1) return "1 day overdue";
  if (d < 0) return `${-d} days overdue`;
  return `Due in ${d} days`;
}

// ───────────────────────────── Clients ─────────────────────────────

export const CLIENT_COLOR: Record<string, string> = {
  "c-kaveri": "var(--chart-1)",
  "c-lakshmi": "var(--chart-4)",
  "c-nova": "var(--chart-2)",
  "c-bright": "var(--chart-3)",
  "c-urban": "var(--info)",
};

export function clientTint(clientId: string, strength = 14): CSSProperties {
  const c = CLIENT_COLOR[clientId] ?? "var(--chart-5)";
  return { backgroundColor: `color-mix(in srgb, ${c} ${strength}%, transparent)`, color: c };
}

export const clientDot = (clientId: string): CSSProperties => ({ backgroundColor: CLIENT_COLOR[clientId] ?? "var(--chart-5)" });

// ───────────────────────────── Stages & gates ─────────────────────────────

export const stageIdx = (s: VideoStage) => VIDEO_STAGES.indexOf(s);

export const NEXT_STAGE: Partial<Record<VideoStage, VideoStage>> = {
  Planned: "Scripting",
  Scripting: "Shoot Scheduled",
  "Shoot Scheduled": "Shot",
  Shot: "Editing",
  Editing: "Internal QC",
  "Internal QC": "Client Review",
  "Client Review": "Approved",
  Revision: "Internal QC",
  Approved: "Published",
};

export const doneSteps = (v: Video) => EDIT_STEPS.filter((s) => v.editSteps[s]).length;
export const qcCounts = (v: Video) => {
  const vals = QC_CHECKS.map((c) => v.qc[c] ?? "pending");
  return {
    pass: vals.filter((x) => x === "pass").length,
    fail: vals.filter((x) => x === "fail").length,
    pending: vals.filter((x) => x === "pending").length,
  };
};

export type Gate = { ok: true } | { ok: false; kind: "vp" | "edit" | "qc-fail" | "qc-pending"; title: string; reason: string; missing: string[] };

/** Gate that must pass before a video can LEAVE `from`. */
export function gateLeaving(v: Video, from: VideoStage): Gate {
  if (from === "Shot" && !v.videoProtection) {
    return {
      ok: false,
      kind: "vp",
      title: "Footage not protected (VP)",
      reason: "Raw footage must be copied card → NAS and verified before editing can start.",
      missing: ["Video Protection"],
    };
  }
  if (from === "Editing") {
    const missing = EDIT_STEPS.filter((s) => !v.editSteps[s]);
    if (missing.length)
      return {
        ok: false,
        kind: "edit",
        title: `${missing.length} of 9 edit steps still open`,
        reason: "All nine steps on the Video Editing Data Sheet must be ticked before the video can go to Internal QC.",
        missing: [...missing],
      };
  }
  if (from === "Internal QC" || from === "Revision") {
    if (from === "Revision") return { ok: true };
    const failed = QC_CHECKS.filter((c) => v.qc[c] === "fail");
    if (failed.length)
      return {
        ok: false,
        kind: "qc-fail",
        title: "Mandatory check failed — stage held, corrective task created",
        reason: "Fix the failed checks and re-run QC. The video cannot reach the client until every check passes.",
        missing: [...failed],
      };
    const pending = QC_CHECKS.filter((c) => (v.qc[c] ?? "pending") === "pending");
    if (pending.length)
      return {
        ok: false,
        kind: "qc-pending",
        title: `${pending.length} QC checks still pending`,
        reason: "Every internal QC check must pass before client review.",
        missing: [...pending],
      };
  }
  return { ok: true };
}

/** Checks every gate between the current stage and `to` (forward moves only). */
export function canMoveTo(v: Video, to: VideoStage): Gate {
  const a = stageIdx(v.stage);
  const b = stageIdx(to);
  if (b <= a) return { ok: true };
  for (let i = a; i < b; i++) {
    const g = gateLeaving(v, VIDEO_STAGES[i]!);
    if (!g.ok) return g;
  }
  return { ok: true };
}

// ───────────────────────────── Video helpers ─────────────────────────────

export const ACTIVE_STAGES: VideoStage[] = ["Scripting", "Shoot Scheduled", "Shot", "Editing", "Internal QC", "Client Review", "Revision"];
export const isDone = (v: Video) => v.stage === "Approved" || v.stage === "Published";

export function nextVideoCode(all: Video[], clientId: string, dueIso: string) {
  const c = clientById(clientId);
  const mmyy = format(parseISO(dueIso), "MMyy");
  const prefix = `${c.code}-${mmyy}-`;
  const n = all.filter((v) => v.code.startsWith(prefix)).length + 1;
  return `${prefix}${String(n).padStart(2, "0")}`;
}

export function cycleFor(agreementId: string, dueIso: string) {
  return (
    cycles.find((c) => c.agreementId === agreementId && c.start <= dueIso && c.end >= dueIso) ??
    cycles.find((c) => c.agreementId === agreementId && c.status === "in-progress") ??
    cycles[0]!
  );
}

export const PLANNED_MIN: Record<Video["format"], number> = {
  Reel: 300,
  "Long-form": 960,
  Ad: 540,
  Testimonial: 420,
  "Podcast clip": 240,
  Explainer: 300,
};

export function shootOf(v: Video) {
  return v.shootId ? shoots.find((s) => s.id === v.shootId) : undefined;
}

export function avgTurnaround(all: Video[]) {
  const done = all.filter((v) => isDone(v) && v.shootId);
  if (!done.length) return 0;
  const sum = done.reduce((acc, v) => acc + Math.max(1, daysBetween(shootOf(v)!.date, v.dueDate)), 0);
  return sum / done.length;
}

// ───────────────────────────── Cost ─────────────────────────────

export function costBreakdown(v: Video) {
  const editor = personById(v.editorId);
  const director = personById(v.directorId);
  const camera = personById(v.cameraId);
  const shoot = shootOf(v);
  const perShootVideos = shoot ? shoot.videoIds.length : 1;
  const ag = agreementById(v.agreementId);
  const unitsPerCycle = ag.units.reduce((a, u) => a + u.perCycle, 0);
  const revenue = ag.monthlyFee / unitsPerCycle;

  const editPlanned = (v.plannedMinutes / 60) * editor.hourlyCost;
  const editActual = (v.loggedMinutes / 60) * editor.hourlyCost;
  const directionHrs = v.format === "Long-form" ? 4 : 1.5;
  const direction = directionHrs * director.hourlyCost;
  const shootHrs = shoot ? 6 / perShootVideos : 0;
  const cameraCost = shootHrs * camera.hourlyCost;
  const equipment = shoot ? (shoot.kit === "dual" ? 2400 : 1500) / perShootVideos : 0;
  const rework = v.revisionsUsed * 90 / 60 * editor.hourlyCost;
  const labour = editActual + direction + cameraCost + rework;
  const overhead = labour * 0.18;
  const total = labour + equipment + overhead;
  return {
    editor,
    revenue,
    editPlanned,
    editActual,
    lines: [
      { label: `Editing — ${editor.name}`, detail: `${(v.loggedMinutes / 60).toFixed(1)}h × ₹${editor.hourlyCost}/h`, value: editActual },
      { label: `Direction — ${director.name}`, detail: `${directionHrs}h × ₹${director.hourlyCost}/h`, value: direction },
      { label: `Camera — ${camera.name}`, detail: shoot ? `${shootHrs.toFixed(1)}h share of ${shoot.batchNo}` : "No shoot yet", value: cameraCost },
      { label: "Rework (revisions)", detail: `${v.revisionsUsed} × 1.5h`, value: rework },
      { label: "Equipment wear", detail: shoot ? `${shoot.kit === "dual" ? "Dual" : "Single"}-cam kit ÷ ${perShootVideos} videos` : "—", value: equipment },
      { label: "Overhead (18% of labour)", detail: "Rent, power, software, admin", value: overhead },
    ],
    total,
    margin: revenue - total,
  };
}

// ───────────────────────────── Brief & script (mock) ─────────────────────────────

export function briefFor(v: Video) {
  const c = clientById(v.clientId);
  const topic = v.title.split("—")[0]!.trim();
  const hooks: Record<Video["format"], string> = {
    Reel: `“You've been buying ${topic.toLowerCase()} wrong — here's what nobody tells you.”`,
    "Long-form": `“Every bottle, every thread, every brick has a story. This is ours.”`,
    Ad: `“This festive season, gift something that's actually good for them.”`,
    Testimonial: `“I was sceptical at first. Three months later, I can't go back.”`,
    "Podcast clip": `“The one mistake every small business makes with content…”`,
    Explainer: `“${topic}? Let's clear that up in 40 seconds.”`,
  };
  return {
    objective: `Build trust for ${c.name} with ${c.industry.split("·")[1]?.trim() ?? c.industry} buyers in ${c.city} and across Tamil Nadu. Drive profile visits and WhatsApp enquiries.`,
    audience: c.id === "c-nova" ? "Parents and working adults, 25–45, Coimbatore" : c.id === "c-bright" ? "Class 11–12 students and parents, Salem district" : "Tamil-speaking households, 28–50, Tier-2 cities",
    hook: hooks[v.format],
    cta: c.id === "c-nova" ? "Book a consultation — link in bio" : c.id === "c-urban" ? "Schedule a site visit this weekend" : "Order on WhatsApp: +91 94430 55100",
    tone: "Warm, honest, local — Tamil with English captions",
    script: [
      { t: "00:00", line: hooks[v.format].replace(/[“”]/g, ""), shot: "Close-up, handheld, natural light" },
      { t: "00:04", line: `Introduce ${c.contacts[0]!.name.split(" ")[0]} / the product in context`, shot: "Medium shot, 35mm, eye-level" },
      { t: "00:12", line: "Three proof points — process, people, quality check", shot: "B-roll montage (clips per data sheet)" },
      { t: "00:30", line: "Customer or expert reaction", shot: "Two-cam interview, A-cam 50mm / B-cam 35mm" },
      { t: "00:40", line: "Call to action with logo lock-up", shot: "Branded end card, 2s hold" },
    ],
    references: [
      { label: "Brand guide v3 (PDF)", kind: "Drive" },
      { label: `${c.code} — reference reel from Aug cycle`, kind: "Instagram" },
      { label: "Moodboard — warm earthy grade", kind: "Figma" },
    ],
    approvedBy: c.contacts.find((x) => x.approver)?.name ?? c.contacts[0]!.name,
  };
}

// ───────────────────────────── Projects & tasks ─────────────────────────────

export type TaskStatus = "done" | "in-progress" | "todo" | "blocked";
export interface GenTask {
  id: string;
  videoId: string;
  name: string;
  ownerId: string;
  contributors: string[];
  dependsOn?: string;
  due: string;
  status: TaskStatus;
  priority: "High" | "Medium" | "Low";
}

export const TASK_NAMES = ["Script", "Shoot", "Backup", "Edit", "QC", "Client review", "Publish"] as const;

export function tasksFor(v: Video): GenTask[] {
  const idx = stageIdx(v.stage);
  const c = clientById(v.clientId);
  const shoot = shootOf(v);
  const priority = v.urgency === "rush" ? "High" : v.urgency === "priority" ? "Medium" : "Low";
  const doneFlags = [idx >= 2, idx >= 3, v.videoProtection, idx >= 5, idx >= 6, idx >= 8, idx >= 9];
  const firstOpen = doneFlags.findIndex((x) => !x);
  const owners = [
    v.format === "Long-form" || v.format === "Testimonial" ? "p-karthik" : "f-keerthana",
    v.cameraId,
    "p-naveen",
    v.editorId,
    "p-karthik",
    c.accountOwnerId,
    "p-meena",
  ];
  const contrib: string[][] = [
    v.format === "Long-form" ? ["f-keerthana"] : ["p-karthik"],
    shoot?.kit === "dual" ? [v.directorId, "f-gokul"] : [v.directorId],
    [v.cameraId],
    v.format === "Ad" || v.format === "Long-form" ? ["f-sneha", "f-sathish"] : ["f-sathish"],
    [v.editorId],
    [v.editorId],
    ["f-lavanya"],
  ];
  const dues = [
    backWorkingDays(v.dueDate, 8),
    shoot?.date ?? backWorkingDays(v.dueDate, 6),
    shoot ? shiftIso(shoot.date, 1) : backWorkingDays(v.dueDate, 5),
    backWorkingDays(v.dueDate, 3),
    backWorkingDays(v.dueDate, 2),
    prevWorkingDay(v.dueDate),
    v.dueDate,
  ];
  return TASK_NAMES.map((name, i) => {
    let status: TaskStatus = doneFlags[i] ? "done" : i === firstOpen ? "in-progress" : "todo";
    if (!doneFlags[i] && name === "Edit" && !v.videoProtection && idx >= 3) status = "blocked";
    if (name === "Client review" && v.stage === "Revision") status = "blocked";
    return {
      id: `${v.id}-t${i}`,
      videoId: v.id,
      name,
      ownerId: owners[i]!,
      contributors: contrib[i]!.filter((x) => x !== owners[i]),
      dependsOn: i > 0 ? TASK_NAMES[i - 1] : undefined,
      due: dues[i]!,
      status,
      priority,
    };
  });
}

// ───────────────────────────── Capacity ─────────────────────────────

export const CAPACITY_PEOPLE = ["p-karthik", "p-vignesh", "p-divya", "p-surya", "f-rahul", "p-naveen", "p-meena", "f-keerthana", "f-sneha", "f-gokul"];

export const WEEKS = [
  { id: "w39", label: "21 – 26 Sep", days: ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26"] },
  { id: "w40", label: "28 Sep – 3 Oct", days: ["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03"] },
];

const LEAVE: Record<string, string[]> = { "p-naveen": ["2026-09-25", "2026-09-26"], "f-gokul": ["2026-09-29"] };

function hash(s: string) {
  let h = 7;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export const availableHours = (personId: string) => (personById(personId).type === "freelancer" ? 6 : 8);

export interface CapCell {
  booked: number;
  available: number;
  leave?: boolean;
  holiday?: string;
  items: string[];
}

export function capacityCell(personId: string, day: string): CapCell {
  const avail = availableHours(personId);
  if (HOLIDAYS[day]) return { booked: 0, available: 0, holiday: HOLIDAYS[day], items: [] };
  if (LEAVE[personId]?.includes(day)) return { booked: 0, available: 0, leave: true, items: ["Sick leave (approved)"] };
  const p = personById(personId);
  const noise = ((hash(personId + day) % 100) / 100 - 0.5) * 3;
  let booked = Math.max(0.5, Math.round((p.utilisation * avail + noise) * 2) / 2);
  if (personId === "p-divya" && ["2026-09-28", "2026-09-29", "2026-09-24"].includes(day)) booked = 10;
  if (personId === "p-vignesh" && (day === "2026-09-30" || day === "2026-09-27")) booked = 9.5;
  const items = taskHintsFor(personId, day);
  return { booked, available: avail, items };
}

function taskHintsFor(personId: string, day: string): string[] {
  const map: Record<string, string[]> = {
    "p-divya": ["KVR-0926-05 Diwali ad — edit", "SLS-0926-01 v3 revision"],
    "p-surya": ["KVR-0926-06 QC fixes", "NVD-0926-04 script read-through"],
    "f-rahul": ["SLS-0926-03 bridal walkthrough", "NVD-0926-02 aligners"],
    "p-vignesh": day === "2026-09-30" ? ["NVD-B07 shoot — RS Puram"] : ["Kit maintenance", "KVR-B20 prep"],
    "p-karthik": ["Script reviews ×3", "QC — BPA-0926-02"],
    "p-naveen": ["NAS backup verification", "LMS support"],
    "p-meena": ["Publishing queue — 4 posts", "Kaveri community replies"],
    "f-keerthana": ["SLS-0926-04 weaver script", "NVD-0926-04 kids script"],
    "f-sneha": ["Diwali ad motion titles"],
    "f-gokul": ["UNR drone reel pickup shots"],
  };
  return map[personId] ?? [];
}

export function weekUtil(personId: string, days: string[]) {
  let booked = 0;
  let avail = 0;
  for (const d of days) {
    const c = capacityCell(personId, d);
    booked += c.booked;
    avail += c.available;
  }
  return { booked, avail, util: avail ? booked / avail : 0 };
}

// ───────────────────────────── Backward planning ─────────────────────────────

export const EDIT_DAYS: Record<Video["format"], number> = {
  Reel: 1,
  "Long-form": 3,
  Ad: 2,
  Testimonial: 1.5,
  "Podcast clip": 1,
  Explainer: 1,
};

export interface PlanStep {
  key: string;
  label: string;
  days: number;
  start: string;
  end: string;
  role: string;
  candidates: string[];
}

export function backwardPlan(v: Video, publish: string): PlanStep[] {
  const c = clientById(v.clientId);
  const defs: { key: string; label: string; days: number; role: string; candidates: string[] }[] = [
    { key: "publish", label: "Publish", days: 0, role: "Social media", candidates: ["p-meena"] },
    { key: "approval", label: "Client approval window", days: 2, role: "Account owner", candidates: [c.accountOwnerId, "p-ashwin", "p-priya"].filter((x, i, a) => a.indexOf(x) === i) },
    { key: "qc", label: "Internal QC", days: 0.5, role: "QC reviewer", candidates: ["p-karthik", "p-ashwin"] },
    { key: "edit", label: `Edit (${v.format} standard)`, days: EDIT_DAYS[v.format], role: "Editor", candidates: ["p-divya", "p-surya", "f-rahul"] },
    { key: "backup", label: "Backup & VP", days: 0.5, role: "Technical", candidates: ["p-naveen", "p-surya"] },
    { key: "shoot", label: "Shoot", days: 1, role: "Camera", candidates: ["p-vignesh", "f-gokul"] },
    { key: "script", label: "Script & approval", days: 2, role: "Script writer", candidates: ["f-keerthana", "p-karthik"] },
  ];
  const out: PlanStep[] = [];
  let cursor = publish;
  for (const d of defs) {
    if (d.days === 0) {
      out.push({ ...d, start: cursor, end: cursor });
      cursor = prevWorkingDay(cursor);
      continue;
    }
    const whole = Math.max(1, Math.ceil(d.days));
    const end = cursor;
    const start = backWorkingDays(end, whole - 1);
    out.push({ ...d, start, end });
    cursor = prevWorkingDay(start);
  }
  return out.reverse();
}

export function scoreCandidate(personId: string, v: Video, stepKey: string, onDate: string, allVideos: Video[]) {
  const p = personById(personId);
  const weekDays = WEEKS.find((w) => w.days.includes(onDate))?.days ?? WEEKS[1]!.days;
  const util = weekUtil(personId, weekDays).util || p.utilisation;
  const cell = capacityCell(personId, onDate);
  const avail = cell.leave || cell.holiday ? 0 : Math.max(0, 1 - util);
  const familiarity = allVideos.filter((x) => x.clientId === v.clientId && (x.editorId === personId || x.cameraId === personId || x.directorId === personId)).length;
  let skill = 0.6;
  if (stepKey === "edit") {
    if (v.format === "Long-form" && p.skills.includes("Long-form")) skill = 0.95;
    else if (v.format === "Reel" && p.skills.includes("Reels")) skill = 0.9;
    else if (p.skills.includes("Colour") || p.skills.includes("Motion text")) skill = 0.85;
  } else if (stepKey === "shoot") skill = p.skills.includes("Cinematography") ? 0.95 : 0.7;
  else if (stepKey === "script") skill = p.skills.includes("Tamil scripts") ? 0.9 : 0.8;
  else skill = 0.85;
  const fam = Math.min(1, familiarity / 4);
  const score = skill * 0.45 + avail * 0.35 + fam * 0.2;
  const reasons: string[] = [];
  reasons.push(`${Math.round(skill * 100)}% skill fit`);
  reasons.push(cell.leave ? "On leave" : cell.holiday ? cell.holiday : `${Math.round(util * 100)}% booked`);
  reasons.push(familiarity ? `${familiarity} ${clientById(v.clientId).code} videos` : "New to client");
  return { score, reasons, blocked: !!(cell.leave || cell.holiday), overloaded: util > 1 };
}

export { clients };
