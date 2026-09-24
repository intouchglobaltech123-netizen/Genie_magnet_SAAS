import type { SheetKind } from "./config";

export interface SheetRow {
  id: string;
  videoId?: string;
  task: string;
  details: string;
  duration: string; // editor: finished video runtime (mm:ss)
  start: string;
  end: string;
  status: "Pending" | "Completed";
  delayReason: string;
  productive: boolean;
}

export interface DaySheet {
  rows: SheetRow[];
  counters: Record<string, number>;
  otherWorks: string;
  dayReason: string;
  submittedAt?: string;
  gmSignedAt?: string;
  hrSignedAt?: string;
  gmNote?: string;
}

export const sheetKey = (personId: string, date: string) => `${personId}|${date}`;

let n = 0;
const r = (p: Partial<SheetRow> & Pick<SheetRow, "start" | "end">): SheetRow => ({
  id: `sr-seed-${++n}`,
  task: "",
  details: "",
  duration: "",
  status: "Completed",
  delayReason: "",
  productive: true,
  ...p,
});

export function emptySheet(): DaySheet {
  return { rows: [], counters: {}, otherWorks: "", dayReason: "" };
}

const signed = (date: string, sub: string, gm: string, hr: string) => ({
  submittedAt: `${date}T${sub}:00`,
  gmSignedAt: `${date}T${gm}:00`,
  hrSignedAt: `${date}T${hr}:00`,
});

// ── Today (Fri 25 Sep 2026) ──────────────────────────────────────────────
const today: Record<string, DaySheet> = {
  [sheetKey("p-divya", "2026-09-25")]: {
    rows: [
      r({ videoId: "v-sls-1", details: "Revision v2 — swapped BGM to veena track, tightened intro by 3s", duration: "00:45", start: "09:30", end: "11:20" }),
      r({ videoId: "v-kvr-5", details: "Text animations + transitions on hamper ad", duration: "00:30", start: "11:30", end: "13:30", status: "Pending", delayReason: "Waiting for 2 re-shot product clips (client changed hamper contents)" }),
      r({ task: "Waiting for footage", details: "Idle — re-shoot clips not yet uploaded to NAS", start: "14:15", end: "14:45", productive: false }),
      r({ videoId: "v-kvr-4", details: "Exported client-review proxy + burned-in timecode", duration: "06:42", start: "14:45", end: "16:10" }),
      r({ videoId: "v-nvd-3", details: "Selects & rough cut of patient interview", duration: "01:10", start: "16:20", end: "18:05", status: "Pending", delayReason: "Patient consent form pending — cannot finalise" }),
    ],
    counters: {},
    otherWorks: "",
    dayReason: "",
  },
  [sheetKey("p-meena", "2026-09-25")]: {
    rows: [
      r({ task: "Content planning", details: "Kaveri Organics — October content calendar (12 posts)", start: "09:30", end: "11:00" }),
      r({ task: "Post scheduling", details: "Sri Lakshmi Silks — Navaratri reel + 3 carousels in Meta Business Suite", start: "11:00", end: "11:50" }),
      r({ task: "Community management", details: "DMs & comments across 5 client handles", start: "12:00", end: "13:10" }),
      r({ task: "Stories", details: "Nova Dental — 'Ask the dentist' story series", start: "14:00", end: "14:40" }),
      r({ task: "Monthly report", details: "BrightPath Academy — Sep performance report", start: "14:45", end: "16:40", status: "Pending", delayReason: "Meta insights export failing for 2 days; retry tomorrow morning" }),
      r({ task: "Shoot support", details: "Reel hooks on set for Kaveri testimonial prep call", start: "16:45", end: "17:45" }),
    ],
    counters: { posts: 4, errors: 1, shootHrs: 1, financeHrs: 0, scripting: 2, planning: 12, dms: 23, comments: 41, stories: 6, otherApps: 2 },
    otherWorks: "Updated brand hashtag bank for Sri Lakshmi Silks",
    dayReason: "",
    submittedAt: "2026-09-25T18:04:00",
    gmSignedAt: "2026-09-25T18:32:00",
  },
  [sheetKey("p-harini", "2026-09-25")]: {
    rows: [
      r({ task: "Attendance", details: "Hikvision punch import + late-mark review (Surya 09:47)", start: "09:30", end: "10:15" }),
      r({ task: "Leave", details: "Reassigned Naveen's 2 tasks after sick leave approval", start: "10:15", end: "10:45" }),
      r({ task: "Recruitment", details: "Screened 14 Video Editor applicants from Naukri; shortlisted 5", start: "10:45", end: "13:00" }),
      r({ task: "Payroll inputs", details: "Sep LOP days compiled for payroll run", start: "14:00", end: "15:30" }),
      r({ task: "Interview", details: "First-round STAR interview — Sales Executive (2 candidates)", start: "15:30", end: "17:15" }),
      r({ task: "Onboarding", details: "Offer letter draft for Train-to-hire editor", start: "17:15", end: "18:00", status: "Pending", delayReason: "Awaiting founder approval on CTC band" }),
    ],
    counters: { errors: 0 },
    otherWorks: "Ordered drinking water cans & pantry supplies",
    dayReason: "",
    submittedAt: "2026-09-25T18:12:00",
  },
};

// ── Earlier this week (Mon 21 – Thu 24 Sep), all signed ─────────────────
const pastRows: Record<SheetKind, (d: number) => SheetRow[]> = {
  editor: (d) => [
    r({ videoId: d % 2 ? "v-kvr-5" : "v-bpa-1", details: d % 2 ? "Colour corrections + BGM pass" : "Final overview & export for approval", duration: d % 2 ? "00:30" : "00:40", start: "09:30", end: "12:40" }),
    r({ videoId: "v-kvr-4", details: "Founder story — B-roll layering & text", duration: "06:42", start: "13:30", end: "16:50" }),
    r({ videoId: "v-sls-1", details: "Client feedback review & revision plan", duration: "00:45", start: "17:00", end: "18:10" }),
  ],
  smm: () => [
    r({ task: "Post scheduling", details: "Scheduled 3 client posts", start: "09:30", end: "11:00" }),
    r({ task: "Community management", details: "DMs & comments", start: "11:00", end: "12:30" }),
    r({ task: "Content planning", details: "Hooks & captions for next week", start: "13:30", end: "16:30" }),
    r({ task: "Stories", details: "Stories for 3 handles", start: "16:30", end: "17:40" }),
  ],
  tech: (d) => [
    r({ task: "Backups", details: "NAS backup verification — VP footage for shoots", start: "09:30", end: "11:00" }),
    r({ task: "Support", details: d % 2 ? "Premiere crash on edit workstation — cache cleared" : "LMS user access for new courses", start: "11:00", end: "13:00" }),
    r({ task: "Storage", details: "Archived Aug projects to cold storage", start: "14:00", end: "17:30" }),
  ],
  hr: () => [
    r({ task: "Attendance", details: "Daily biometric import & exceptions", start: "09:30", end: "10:30" }),
    r({ task: "Recruitment", details: "Candidate calls & scheduling", start: "10:30", end: "13:00" }),
    r({ task: "Documentation", details: "Employee files & compliance", start: "14:00", end: "17:45" }),
  ],
};

const pastCounters: Record<SheetKind, Record<string, number>> = {
  editor: {},
  smm: { posts: 3, errors: 0, shootHrs: 0, financeHrs: 0, scripting: 1, planning: 6, dms: 18, comments: 33, stories: 5, otherApps: 1 },
  tech: { errors: 0, serverIssues: 1 },
  hr: { errors: 0 },
};

const past: Record<string, DaySheet> = {};
const who: [string, SheetKind][] = [
  ["p-divya", "editor"],
  ["p-meena", "smm"],
  ["p-naveen", "tech"],
  ["p-harini", "hr"],
];
["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"].forEach((date, i) => {
  for (const [pid, kind] of who) {
    past[sheetKey(pid, date)] = {
      rows: pastRows[kind](i),
      counters: pastCounters[kind],
      otherWorks: "",
      dayReason: "",
      ...signed(date, pid === "p-naveen" && i === 1 ? "19:26" : "18:1" + i, "18:4" + i, "19:3" + i),
    };
  }
});

export const seedSheets: Record<string, DaySheet> = { ...past, ...today };
