// The client portal (P3-01 to P3-05): what a client contact may send from their private link.
import { z } from "zod";

export const CLIENT_REQUEST_KINDS = { idea: "An idea for a video", change: "A change to something", question: "A question", other: "Something else" } as const;
export type ClientRequestKind = keyof typeof CLIENT_REQUEST_KINDS;

export const portalPick = z.object({ pick: z.enum(["picked", "skipped"]).nullable() });

/** A comment on the video the client is watching, at a time in it (seconds) when given. */
export const portalComment = z.object({
  text: z.string().trim().min(1, "Write your comment").max(2000),
  at: z
    .number()
    .int()
    .min(0)
    .max(24 * 3600)
    .optional(),
});

export const clientRequestInput = z.object({
  kind: z.enum(Object.keys(CLIENT_REQUEST_KINDS) as [ClientRequestKind, ...ClientRequestKind[]]),
  text: z.string().trim().min(3, "Say a little more").max(4000),
});

export const clientRequestAnswer = z.object({ answer: z.string().trim().min(1, "Write the answer").max(4000) });

/** "1:05" as 65 seconds; undefined when it is not a time. */
export function parseVideoTime(v: string): number | undefined {
  const m = /^(?:(\d+):)?(\d{1,2}):(\d{2})$|^(\d+)$/.exec(v.trim());
  if (!m) return undefined;
  if (m[4] !== undefined) return Number(m[4]);
  return Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** 65 → "1:05". */
export const videoTime = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
};
