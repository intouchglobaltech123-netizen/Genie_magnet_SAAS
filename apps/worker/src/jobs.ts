import { z } from "zod";

// Every job carries its agency: workers set app.agency_id before touching the database,
// exactly like the API, so row-level security applies to background work too.
const base = z.object({ agencyId: z.uuid() });

export const QUEUES = {
  notifications: "notifications",
  genie: "genie",
  publishing: "publishing",
} as const;
export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

export const jobSchemas = {
  /** WhatsApp template message (approval request, reminder, confirmation…). */
  "whatsapp.send": base.extend({
    to: z.string().regex(/^\+?[0-9 ]{10,16}$/),
    template: z.string().min(1),
    variables: z.record(z.string(), z.string()),
    relatedType: z.string().optional(),
    relatedId: z.string().optional(),
  }),
  /** Onboarding reminders on day 2 and day 5; flag after the window. */
  "onboarding.remind": base.extend({ responseId: z.uuid(), day: z.number().int().min(1).max(30) }),
  /** Genie Assistant: run the rules for one agency and store new insights (hourly). */
  "genie.rules": base.extend({ rules: z.array(z.string()).optional() }),
  /** Post an approved video to a connected platform at its scheduled slot. */
  "publishing.post": base.extend({ scheduledPostId: z.uuid() }),
} as const;

export type JobName = keyof typeof jobSchemas;
export type JobData<N extends JobName> = z.infer<(typeof jobSchemas)[N]>;

export const JOB_QUEUE: Record<JobName, QueueName> = {
  "whatsapp.send": "notifications",
  "onboarding.remind": "notifications",
  "genie.rules": "genie",
  "publishing.post": "publishing",
};

export class UnknownJobError extends Error {}

/** Validates a job before any handler runs; a bad payload fails fast and lands in the exception queue. */
export function parseJob(name: string, data: unknown): { name: JobName; data: JobData<JobName> } {
  if (!(name in jobSchemas)) throw new UnknownJobError(`Unknown job "${name}"`);
  const jobName = name as JobName;
  return { name: jobName, data: jobSchemas[jobName].parse(data) };
}
