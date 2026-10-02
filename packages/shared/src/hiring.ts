// Hiring (P5-10): openings with the role's task document, candidates through the agency's stages, interviews and
// scorecards, the hire approved, the offer, and joining — which invites them to the workspace.
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
const lines = z.array(text(300).min(1)).max(30).default([]);
const rupees = z.number().int("Whole rupees").min(0, "Not below zero").max(100_000_000);

export const OPENING_STATUSES = ["open", "on_hold", "closed"] as const;
export type OpeningStatus = (typeof OPENING_STATUSES)[number];
export const OPENING_STATUS_LABEL: Record<OpeningStatus, string> = { open: "Open", on_hold: "On hold", closed: "Closed" };

/** What the role is, for the hiring manager, interviewers and candidates. */
export const COMPETENCES = ["skills", "knowledge", "selfImage", "traits", "motives"] as const;
export type Competence = (typeof COMPETENCES)[number];
export const COMPETENCE_LABEL: Record<Competence, string> = {
  skills: "Skills",
  knowledge: "Knowledge",
  selfImage: "Self image",
  traits: "Traits",
  motives: "Motives",
};

export const STAR_STEPS = ["situation", "task", "action", "result"] as const;
export type StarStep = (typeof STAR_STEPS)[number];
export const STAR_LABEL: Record<StarStep, string> = { situation: "Situation", task: "Task", action: "Action", result: "Result" };

export const openingInput = z
  .object({
    title: text(120).min(2, "Name the role"),
    departmentId: z.uuid().nullable().optional(),
    positions: z.number().int().min(1).max(50).default(1),
    hiringManagerId: z.string().max(64).nullable().optional(),
    budgetFrom: rupees.nullable().optional(),
    budgetTo: rupees.nullable().optional(),
    status: z.enum(OPENING_STATUSES).default("open"),
    /** What the role is responsible for, in a sentence. */
    definition: text(1000).default(""),
    deliverables: lines,
    tasks: lines,
    competence: z.object(Object.fromEntries(COMPETENCES.map((c) => [c, lines])) as Record<Competence, typeof lines>).default({
      skills: [],
      knowledge: [],
      selfImage: [],
      traits: [],
      motives: [],
    }),
    /** The behavioural interview's questions, one for each step. */
    star: z.object(Object.fromEntries(STAR_STEPS.map((s) => [s, text(500).default("")])) as Record<StarStep, z.ZodDefault<z.ZodString>>).default({
      situation: "",
      task: "",
      action: "",
      result: "",
    }),
    sources: z.array(text(80).min(1)).max(20).default([]),
  })
  .refine((o) => o.budgetFrom == null || o.budgetTo == null || o.budgetFrom <= o.budgetTo, { path: ["budgetTo"], message: "Not below the lower end" });
export type OpeningInput = z.input<typeof openingInput>;

/** A candidate moves through these; "rejected" ends it at any point, with the reason. */
export const CANDIDATE_STAGES = ["applied", "screening", "interview", "scorecard", "approval", "offer", "joined", "rejected"] as const;
export type CandidateStage = (typeof CANDIDATE_STAGES)[number];
export const CANDIDATE_STAGE_LABEL: Record<CandidateStage, string> = {
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  scorecard: "Scorecards",
  approval: "Waiting for approval",
  offer: "Offer",
  joined: "Joined",
  rejected: "Not taken",
};

export const DEFAULT_SOURCES = ["Employee referral", "Job portal", "LinkedIn", "Social media", "Campus", "Consultant", "Walk-in"];

export const candidateInput = z.object({
  openingId: z.uuid("Choose the opening"),
  name: text(120).min(2, "Enter their name"),
  email: z
    .email("Enter a valid email address")
    .transform((e) => e.toLowerCase())
    .optional()
    .or(z.literal("").transform(() => undefined)),
  phone: text(30).optional(),
  city: text(80).optional(),
  source: text(80).optional(),
  experience: text(200).optional(),
  currentPay: rupees.optional(),
  expectedPay: rupees.optional(),
  notes: text(2000).optional(),
});
export type CandidateInput = z.input<typeof candidateInput>;

/** Moving a candidate on (or back); rejecting needs the reason. */
export const candidateMove = z
  .object({ stage: z.enum(CANDIDATE_STAGES), reason: text(500).optional() })
  .refine((m) => m.stage !== "rejected" || !!m.reason, { path: ["reason"], message: "Say why they are not taken" });

export const INTERVIEW_MODES = ["in_person", "video", "phone"] as const;
export type InterviewMode = (typeof INTERVIEW_MODES)[number];
export const INTERVIEW_MODE_LABEL: Record<InterviewMode, string> = { in_person: "In person", video: "Video call", phone: "Phone" };

export const interviewInput = z.object({
  at: z.iso.datetime({ offset: true, message: "Pick the day and time" }),
  interviewerId: z.string().min(1, "Choose who interviews").max(64),
  mode: z.enum(INTERVIEW_MODES).default("in_person"),
  where: text(300).optional(),
});
export type InterviewInput = z.input<typeof interviewInput>;

const rating = z.number().int().min(1, "Rate 1 to 5").max(5, "Rate 1 to 5");
export const scorecardInput = z.object({
  ratings: z.object(Object.fromEntries(COMPETENCES.map((c) => [c, rating])) as Record<Competence, typeof rating>),
  star: z.object(Object.fromEntries(STAR_STEPS.map((s) => [s, text(2000).default("")])) as Record<StarStep, z.ZodDefault<z.ZodString>>),
  /** The role's task, out of 10. */
  taskScore: z.number().int().min(0).max(10),
  remarks: text(2000).default(""),
});
export type ScorecardInput = z.input<typeof scorecardInput>;

/** The agency's rule for what a scorecard recommends. */
export const hiringSettingsInput = z.object({
  /** Hire: every rating at least this, or the ratings' total at least `hireTotal`… */
  hireEach: z.number().int().min(1).max(5).default(4),
  hireTotal: z.number().int().min(5).max(25).default(20),
  /** …and the task at least this. */
  hireTask: z.number().int().min(0).max(10).default(7),
  /** Hold: the total and the task at least these. Below is not taken. */
  holdTotal: z.number().int().min(5).max(25).default(15),
  holdTask: z.number().int().min(0).max(10).default(5),
  sources: z.array(text(80).min(1)).max(30).default(DEFAULT_SOURCES),
});
export type HiringSettings = z.output<typeof hiringSettingsInput>;
export const DEFAULT_HIRING: HiringSettings = hiringSettingsInput.parse({});

export type Recommendation = "hire" | "hold" | "not_taken";
export const RECOMMENDATION_LABEL: Record<Recommendation, string> = { hire: "Hire", hold: "Hold", not_taken: "Not taken" };

/** What a scorecard adds up to, and what it recommends by the agency's rule: ratings count 70%, the task 30%. */
export function scoreOf(s: { ratings: Record<Competence, number>; taskScore: number }, rule: HiringSettings) {
  const values = COMPETENCES.map((c) => s.ratings[c]);
  const total = values.reduce((a, b) => a + b, 0);
  const percent = Math.round(((total / 25) * 0.7 + (s.taskScore / 10) * 0.3) * 100);
  const recommendation: Recommendation =
    (values.every((v) => v >= rule.hireEach) || total >= rule.hireTotal) && s.taskScore >= rule.hireTask
      ? "hire"
      : total >= rule.holdTotal && s.taskScore >= rule.holdTask
        ? "hold"
        : "not_taken";
  return { total, percent, recommendation };
}

export const offerInput = z.object({
  designation: text(120).min(2, "The designation they join as"),
  monthlyPay: rupees.min(1, "The monthly pay offered"),
  joiningDate: z.iso.date("Pick the joining day"),
  /** The role they get in the workspace when they join. */
  role: z.string().min(1, "Choose their role in the workspace").max(64),
  notes: text(2000).optional(),
});
export type OfferInput = z.input<typeof offerInput>;

export const OFFER_STATUSES = ["made", "accepted", "declined"] as const;
export type OfferStatus = (typeof OFFER_STATUSES)[number];

/** GET /hiring/openings (one item) */
export interface OpeningRow {
  id: string;
  title: string;
  department: { id: string; name: string } | null;
  positions: number;
  hiringManager: { id: string; name: string } | null;
  budgetFrom: number | null;
  budgetTo: number | null;
  status: OpeningStatus;
  definition: string;
  deliverables: string[];
  tasks: string[];
  competence: Record<Competence, string[]>;
  star: Record<StarStep, string>;
  sources: string[];
  createdAt: string;
  /** Candidates at each stage. */
  pipeline: Partial<Record<CandidateStage, number>>;
}

export interface ScorecardRow {
  id: string;
  interviewer: { id: string; name: string };
  ratings: Record<Competence, number>;
  star: Record<StarStep, string>;
  taskScore: number;
  remarks: string;
  total: number;
  percent: number;
  recommendation: Recommendation;
  createdAt: string;
}

export interface InterviewRow {
  id: string;
  at: string;
  interviewer: { id: string; name: string };
  mode: InterviewMode;
  where: string | null;
  scored: boolean;
}

/** GET /hiring/candidates (one item); a single one has interviews and scorecards. */
export interface CandidateRow {
  id: string;
  opening: { id: string; title: string };
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  source: string | null;
  experience: string | null;
  currentPay: number | null;
  expectedPay: number | null;
  notes: string | null;
  stage: CandidateStage;
  rejectedReason: string | null;
  approvedBy: string | null;
  offer: (OfferInput & { status: OfferStatus; madeAt: string }) | null;
  invitationLink: string | null;
  createdAt: string;
  /** The average of its scorecards, when there are some. */
  score: { percent: number; recommendation: Recommendation; count: number } | null;
  nextInterview: string | null;
  interviews?: InterviewRow[];
  scorecards?: ScorecardRow[];
}
