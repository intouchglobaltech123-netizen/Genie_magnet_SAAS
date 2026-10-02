// STOP reviews (P5-14) and decisions and commitments (P5-16): the agency's review rhythms — daily, 7-day, 14-day and
// 45-day — each with its agenda, people and the figures it looks at; meetings with attendance and notes, a snapshot of
// the figures when locked; decisions recorded, and commitments with an owner and due day, marked breakthrough or
// breakdown at each review and carried forward until done.
import { z } from "zod";
import { REVIEW_CADENCES, type ReviewCadence } from "./enums.js";

const text = (max: number) => z.string().trim().max(max);

/** Figures a review can look at, worked out as it happens and kept as they were when it is locked. */
export const REVIEW_BLOCKS = ["videos_due", "shoots_soon", "on_leave", "waiting_on_clients", "money", "sales", "delivery", "goals", "commitments"] as const;
export type ReviewBlock = (typeof REVIEW_BLOCKS)[number];
export const REVIEW_BLOCK_LABEL: Record<ReviewBlock, string> = {
  videos_due: "Videos due in the next two days",
  shoots_soon: "Shoots today and tomorrow",
  on_leave: "People on leave today",
  waiting_on_clients: "Videos waiting for the client's approval",
  money: "This month's invoicing and collections, and what is overdue",
  sales: "Leads and proposals this month",
  delivery: "This month's delivery: on time and the quality check first time",
  goals: "Goals on track, at risk and off track",
  commitments: "Open commitments, and those past due",
};

const agendaItem = z.object({ title: text(160).min(1, "Name the item"), minutes: z.number().int().min(0).max(600), note: text(300).default("") });

export const cadenceInput = z.object({
  name: text(120).min(2, "Name the review"),
  /** How often, in days. */
  everyDays: z.number().int().min(1).max(365),
  purpose: text(500).default(""),
  minutes: z.number().int().min(5).max(720),
  /** When, in words: "Every Monday, 10 am". */
  schedule: text(200).default(""),
  mandatory: z.boolean().default(false),
  facilitatorId: z.string().max(64).nullable().default(null),
  participantIds: z.array(z.string().min(1).max(64)).max(200).default([]),
  agenda: z.array(agendaItem).max(20).default([]),
  blocks: z.array(z.enum(REVIEW_BLOCKS)).max(REVIEW_BLOCKS.length).default([]),
});
export type CadenceInput = z.input<typeof cadenceInput>;
export type CadenceSettings = z.output<typeof cadenceInput>;

/** The Growth OS rhythm every agency starts with, and changes. */
export const DEFAULT_CADENCES: Record<ReviewCadence, Omit<CadenceSettings, "facilitatorId" | "participantIds">> = {
  daily: {
    name: "Daily stand-up",
    everyDays: 1,
    purpose: "Everyone leaves knowing today's top priorities, who is blocked and what must move before evening.",
    minutes: 15,
    schedule: "Working days, 9:30 am",
    mandatory: false,
    agenda: [
      { title: "Yesterday — done and not done", minutes: 5, note: "" },
      { title: "Today — top three each", minutes: 5, note: "" },
      { title: "Blockers, and who unblocks", minutes: 5, note: "" },
    ],
    blocks: ["videos_due", "shoots_soon", "on_leave", "waiting_on_clients"],
  },
  weekly: {
    name: "Weekly review",
    everyDays: 7,
    purpose: "Look at the week's numbers and delivery, fix slippages early and decide next week's priorities.",
    minutes: 60,
    schedule: "Every Monday, 10 am",
    mandatory: false,
    agenda: [
      { title: "Last week's commitments", minutes: 10, note: "" },
      { title: "Numbers: revenue, collections, leads", minutes: 15, note: "" },
      { title: "Delivery: on time, quality check, revisions", minutes: 15, note: "" },
      { title: "Clients and risks", minutes: 10, note: "" },
      { title: "Next week's priorities and commitments", minutes: 10, note: "" },
    ],
    blocks: ["money", "sales", "delivery", "commitments"],
  },
  tactical: {
    name: "Tactical review",
    everyDays: 14,
    purpose: "Close the loop on every action step — breakthrough or breakdown — and coach owners through breakdowns before they become misses.",
    minutes: 120,
    schedule: "Alternate Saturdays, 10 am to 12 noon",
    mandatory: false,
    agenda: [
      { title: "Completion — every action step marked breakthrough or breakdown", minutes: 45, note: "" },
      { title: "Coaching — breakdowns and their causes", minutes: 45, note: "" },
      { title: "Numbers against the goals", minutes: 15, note: "" },
      { title: "New action steps, each with an owner and a due day", minutes: 15, note: "" },
    ],
    blocks: ["commitments", "goals", "delivery"],
  },
  strategic: {
    name: "Strategic review",
    everyDays: 45,
    purpose: "A full-day reset: complete the last 45 days, grow people's competence, celebrate wins and create the next 45-day plan.",
    minutes: 480,
    schedule: "Every 45 days, 10 am to 6 pm",
    mandatory: true,
    agenda: [
      { title: "Completion — previous commitments, breakthrough or breakdown", minutes: 90, note: "" },
      { title: "Numbers — the business as it stands", minutes: 75, note: "" },
      { title: "Competence development", minutes: 90, note: "" },
      { title: "Celebration — recognitions", minutes: 45, note: "" },
      { title: "Creation — goals and strategies for the next 45 days", minutes: 120, note: "" },
      { title: "Decisions and commitments", minutes: 60, note: "" },
    ],
    blocks: ["money", "sales", "delivery", "goals", "commitments"],
  },
};

export const meetingInput = z.object({
  cadence: z.enum(REVIEW_CADENCES),
  startsAt: z.iso.datetime({ offset: true, message: "Pick the day and time" }),
  venue: text(200).optional(),
});
export type MeetingInput = z.input<typeof meetingInput>;

export const ATTENDANCE_MARKS = ["present", "late", "absent"] as const;
export type AttendanceMark = (typeof ATTENDANCE_MARKS)[number];

export const meetingUpdate = z.object({
  /** Notes against each agenda item, by its place in the agenda. */
  notes: z.record(z.string().regex(/^\d+$/), text(5000)).optional(),
  attendance: z.record(z.string().max(64), z.enum(ATTENDANCE_MARKS).nullable()).optional(),
  recognitions: z
    .array(z.object({ personId: z.string().min(1).max(64), title: text(120).min(2, "Say what for"), story: text(1000).default("") }))
    .max(50)
    .optional(),
});
export type MeetingUpdate = z.input<typeof meetingUpdate>;

export const commitmentInput = z.object({
  text: text(500).min(3, "Say what will be done"),
  ownerId: z.string().min(1, "Choose who owns it").max(64),
  due: z.iso.date("Pick the due day"),
  /** The meeting it is made in, when it is. */
  meetingId: z.uuid().optional(),
});
export type CommitmentInput = z.input<typeof commitmentInput>;

/** BT: done — a breakthrough. BD: not done — a breakdown; it is carried to the next review. */
export const COMMITMENT_MARKS = ["BT", "BD"] as const;
export type CommitmentMark = (typeof COMMITMENT_MARKS)[number];
export const commitmentMark = z
  .object({
    mark: z.enum(COMMITMENT_MARKS),
    note: text(500).default(""),
    meetingId: z.uuid().optional(),
    /** A new due day, for a breakdown. */
    due: z.iso.date().optional(),
  })
  .refine((m) => m.mark === "BT" || !!m.note, { path: ["note"], message: "Say what got in the way" });

export const decisionInput = z.object({
  text: text(1000).min(3, "Say what was decided"),
  ownerId: z.string().max(64).nullable().default(null),
  meetingId: z.uuid().optional(),
});
export type DecisionInput = z.input<typeof decisionInput>;

// ─── Rows ─────────────────────────────────────────────────────────────

export interface CadenceRow extends CadenceSettings {
  id: string;
  cadence: ReviewCadence;
  next: { id: string; startsAt: string; title: string } | null;
  last: { id: string; startsAt: string } | null;
}

export interface CommitmentRow {
  id: string;
  text: string;
  owner: { id: string; name: string };
  due: string;
  status: "open" | "done";
  mark: CommitmentMark | null;
  markNote: string | null;
  carried: number;
  madeIn: { id: string; title: string } | null;
  doneAt: string | null;
  createdAt: string;
  /** Each time it was marked, newest first. */
  history: { mark: CommitmentMark; note: string; at: string; meeting: string | null }[];
}

export interface DecisionRow {
  id: string;
  text: string;
  owner: { id: string; name: string } | null;
  madeIn: { id: string; title: string } | null;
  decidedAt: string;
  by: string | null;
}

export interface FigureBlock {
  key: ReviewBlock;
  label: string;
  lines: { label: string; value: string; tone?: "good" | "bad" }[];
}

export interface MeetingRow {
  id: string;
  cadence: ReviewCadence;
  number: number;
  title: string;
  startsAt: string;
  venue: string | null;
  status: "scheduled" | "locked";
  facilitator: { id: string; name: string } | null;
  participants: { id: string; name: string }[];
  agenda: z.output<typeof agendaItem>[];
  notes: Record<string, string>;
  attendance: Record<string, AttendanceMark>;
  recognitions: { personId: string; name: string; title: string; story: string; by: string }[];
  /** As they are now — or as they were when it was locked. */
  figures: FigureBlock[];
  /** Open commitments due by this review, to mark. */
  toReview: CommitmentRow[];
  made: CommitmentRow[];
  decisions: DecisionRow[];
  lockedAt: string | null;
  lockedBy: string | null;
}
