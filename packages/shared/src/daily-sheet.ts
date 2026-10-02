// The daily data sheet (P5-12): each role's sheet — the day's tasks with their times and the role's own counters —
// filled in by the person, submitted by the agency's cut-off, and signed by their manager and HR in the agency's order.
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, e.g. 09:30");

export const SIGNERS = ["manager", "hr"] as const;
export type Signer = (typeof SIGNERS)[number];
export const SIGNER_LABEL: Record<Signer, string> = { manager: "Manager", hr: "HR" };

export const sheetTemplateInput = z.object({
  name: text(80).min(2, "Name the sheet, e.g. Video Editing"),
  /** What the role counts each day besides its tasks: posts done, DMs replied, errors… */
  counters: z
    .array(
      z.object({
        key: z.string().min(1).max(40),
        label: text(80).min(1, "Name the counter"),
        /** Counted in hours (half hours allowed). */
        hours: z.boolean().default(false),
        /** A mistake: shown in red when above zero. */
        bad: z.boolean().default(false),
      }),
    )
    .max(20)
    .default([]),
  taskHint: text(120).default(""),
  /** Who signs, in order. */
  signers: z
    .array(z.enum(SIGNERS))
    .min(1, "Someone signs it")
    .max(2)
    .refine((s) => new Set(s).size === s.length, "Each signs once")
    .default(["manager", "hr"]),
});
export type SheetTemplateInput = z.input<typeof sheetTemplateInput>;
export type SheetTemplate = z.output<typeof sheetTemplateInput>;

export const DEFAULT_SHEET_TEMPLATES: SheetTemplate[] = [
  { name: "Video Editing", counters: [], taskHint: "Task (if not a video)", signers: ["hr", "manager"] },
  {
    name: "Social Media",
    counters: [
      { key: "posts", label: "Posts done", hours: false, bad: false },
      { key: "errors", label: "Errors", hours: false, bad: true },
      { key: "shootHours", label: "Hours of shoot", hours: true, bad: false },
      { key: "scripts", label: "Scripts written", hours: false, bad: false },
      { key: "dms", label: "DMs replied", hours: false, bad: false },
      { key: "comments", label: "Comments replied", hours: false, bad: false },
      { key: "stories", label: "Stories posted", hours: false, bad: false },
    ],
    taskHint: "e.g. Schedule the festival reel",
    signers: ["manager", "hr"],
  },
  {
    name: "Technical Support",
    counters: [
      { key: "errors", label: "Errors", hours: false, bad: true },
      { key: "serverIssues", label: "Server issues", hours: false, bad: true },
    ],
    taskHint: "e.g. Check the backup",
    signers: ["manager", "hr"],
  },
  { name: "HR", counters: [{ key: "errors", label: "Errors", hours: false, bad: true }], taskHint: "e.g. Screen applicants", signers: ["manager"] },
];

export const sheetSettingsInput = z.object({
  /** The working day the sheet should add up to. */
  shiftMinutes: z
    .number()
    .int()
    .min(60)
    .max(16 * 60)
    .default(480),
  /** Submitted after this, a sheet is late. */
  cutoff: time.default("19:00"),
  /** More than this short of (or over) the shift needs the day's reason. */
  slackMinutes: z.number().int().min(0).max(240).default(30),
});
export type SheetSettings = z.output<typeof sheetSettingsInput>;
export const DEFAULT_SHEET_SETTINGS: SheetSettings = sheetSettingsInput.parse({});

export const sheetRow = z.object({
  id: z.string().min(1).max(40),
  /** A video worked on (one assigned to them), or a task in words. */
  videoId: z.uuid().nullable().default(null),
  task: text(200).default(""),
  details: text(500).default(""),
  start: time.or(z.literal("")).default(""),
  end: time.or(z.literal("")).default(""),
  status: z.enum(["completed", "pending"]).default("completed"),
  delayReason: text(300).default(""),
  productive: z.boolean().default(true),
});
export type SheetRow = z.output<typeof sheetRow>;

export const sheetInput = z.object({
  rows: z.array(sheetRow).max(60).default([]),
  counters: z.record(z.string().max(40), z.number().min(0).max(100_000)).default({}),
  otherWorks: text(1000).default(""),
  /** Why the day is short of the shift, or over it. */
  dayReason: text(500).default(""),
});
export type SheetInput = z.input<typeof sheetInput>;

const minutes = (t: string) => (t ? Number(t.slice(0, 2)) * 60 + Number(t.slice(3)) : null);
export function spanOf(r: { start: string; end: string }) {
  const a = minutes(r.start);
  const b = minutes(r.end);
  return a === null || b === null || b <= a ? null : b - a;
}

/** The day added up: time on tasks, productive or not, done and pending, and how far from the shift. */
export function sheetTotals(s: { rows: SheetRow[] }, settings: SheetSettings) {
  let total = 0;
  let productive = 0;
  for (const r of s.rows) {
    const m = spanOf(r) ?? 0;
    total += m;
    if (r.productive) productive += m;
  }
  return {
    minutes: total,
    productive,
    completed: s.rows.filter((r) => r.status === "completed").length,
    pending: s.rows.filter((r) => r.status === "pending").length,
    gap: settings.shiftMinutes - total,
  };
}

/** What stops a sheet from being submitted, row by row (rows numbered from 1). */
export function sheetProblems(s: z.output<typeof sheetInput>, settings: SheetSettings) {
  const problems: { path: string; message: string }[] = [];
  if (!s.rows.length) problems.push({ path: "rows", message: "Add at least one task" });
  s.rows.forEach((r, i) => {
    if (!r.videoId && !r.task) problems.push({ path: `rows.${i}.task`, message: `Row ${i + 1}: the video or the task` });
    if (spanOf(r) === null) problems.push({ path: `rows.${i}.end`, message: `Row ${i + 1}: a start and a later end` });
    if (r.status === "pending" && !r.delayReason) problems.push({ path: `rows.${i}.delayReason`, message: `Row ${i + 1}: why it is pending` });
  });
  const { gap } = sheetTotals(s, settings);
  if (s.rows.length && Math.abs(gap) > settings.slackMinutes && !s.dayReason)
    problems.push({ path: "dayReason", message: gap > 0 ? "Short of the day's shift — say why" : "Over the day's shift — say why" });
  return problems;
}

export const SHEET_STATUSES = ["draft", "submitted", "signed"] as const;
export type SheetStatus = (typeof SHEET_STATUSES)[number];

/** GET /daily-sheets/:date (one person's day) */
export interface DailySheetRow {
  id: string | null;
  date: string;
  user: { id: string; name: string };
  template: { id: string; name: string; counters: SheetTemplate["counters"]; taskHint: string; signers: Signer[] };
  rows: SheetRow[];
  counters: Record<string, number>;
  otherWorks: string;
  dayReason: string;
  status: SheetStatus;
  submittedAt: string | null;
  late: boolean;
  signatures: { signer: Signer; by: string; at: string }[];
  /** Who signs next, when it waits. */
  waitingFor: Signer | null;
  returnNote: string | null;
  totals: ReturnType<typeof sheetTotals>;
  /** Videos assigned to them, to pick from. */
  videos: { id: string; code: string; title: string }[];
}

/** GET /daily-sheets/team?date= (one item) */
export interface SheetTeamRow {
  user: { id: string; name: string };
  template: string;
  state: "submitted" | "late" | "signed" | "draft" | "missed" | "pending" | "on_leave" | "off";
  sheetId: string | null;
  minutes: number;
  waitingFor: Signer | null;
}
