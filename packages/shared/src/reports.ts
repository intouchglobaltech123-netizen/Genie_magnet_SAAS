// Monthly reports (P3-09): what a client's month delivered, posted and achieved, released to their portal.
import { z } from "zod";

const count = z.number().int().min(0).max(1_000_000_000).nullable().optional();

/** A published post's numbers, entered by the team until a platform connection brings them in. */
export const postMetricInput = z.object({ views: count, reach: count, likes: count, comments: count, shares: count, saves: count });
export type PostMetricInput = z.infer<typeof postMetricInput>;
export const METRIC_KEYS = ["views", "reach", "likes", "comments", "shares", "saves"] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];
export const METRIC_LABEL: Record<MetricKey, string> = {
  views: "Views",
  reach: "Reach",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
};

export const reportNote = z.object({ note: z.string().trim().max(4000).nullable() });
export const reportMake = z.object({ clientId: z.uuid(), month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Pick the month") });
