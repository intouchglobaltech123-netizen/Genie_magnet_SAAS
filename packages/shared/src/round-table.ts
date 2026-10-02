// Round Table (P5-15): the peer review inside the 45-day strategic review. Everyone answers three questions about each
// person — and about themselves — one person per timed round; the facilitator moderates, then releases, and each person
// reads what was said about them (without names) and commits to what they will do better.
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);

export const DEFAULT_RT_QUESTIONS = ["What does {name} do best?", "Where does {name} fall short?", "What can {name} do better in the next 45 days?"] as const;

/** A question with {name} put in. */
export const askAbout = (q: string, name: string) => q.replaceAll("{name}", name.split(" ")[0] ?? name);

export const RT_STATUSES = ["draft", "live", "moderation", "released"] as const;
export type RtStatus = (typeof RT_STATUSES)[number];
export const RT_STATUS_LABEL: Record<RtStatus, string> = { draft: "Not started", live: "Live", moderation: "Being moderated", released: "Released" };

export const rtSessionInput = z.object({
  name: text(120).min(2, "Name the round table"),
  meetingId: z.uuid().nullable().default(null),
  participantIds: z.array(z.string().min(1).max(64)).min(2, "At least two people").max(60),
  questions: z.tuple([text(200).min(3), text(200).min(3), text(200).min(3)]).default([...DEFAULT_RT_QUESTIONS]),
  secondsPerPerson: z.number().int().min(30).max(1800).default(180),
});
export type RtSessionInput = z.input<typeof rtSessionInput>;

export const rtAnswerInput = z.object({ answers: z.tuple([text(1000), text(1000), text(1000)]) });
export const rtHideInput = z
  .object({ hidden: z.boolean(), reason: text(300).default("") })
  .refine((h) => !h.hidden || !!h.reason, { path: ["reason"], message: "Say why it is hidden" });
export const rtCommitInput = z.object({ text: text(500).min(3, "Say what you will do better"), due: z.iso.date().optional() });

/** GET /round-tables/:id — what the signed-in person may see of it. */
export interface RtSessionRow {
  id: string;
  name: string;
  meeting: { id: string; title: string } | null;
  facilitator: { id: string; name: string } | null;
  participants: { id: string; name: string }[];
  questions: [string, string, string];
  secondsPerPerson: number;
  status: RtStatus;
  /** Live: whose round it is, and when the buzzer goes. */
  current: { index: number; subject: { id: string; name: string }; endsAt: string } | null;
  /** Live: what the signed-in person wrote in this round, if anything. */
  myAnswer: [string, string, string] | null;
  /** How many have written in this round. */
  written: number;
  /** For the facilitator in moderation and after: every answer, with who wrote it. */
  answers?: {
    id: string;
    subject: string;
    subjectId: string;
    author: string;
    self: boolean;
    answers: [string, string, string];
    hidden: boolean;
    hiddenReason: string | null;
    missed: boolean;
  }[];
  releasedAt: string | null;
  createdAt: string;
}

/** GET /round-tables/:id/mine — what was said about the signed-in person, once released, without names. */
export interface RtFeedback {
  session: { id: string; name: string; releasedAt: string };
  questions: [string, string, string];
  self: [string, string, string] | null;
  peers: [string, string, string][];
  commitment: { id: string; text: string; due: string } | null;
}
