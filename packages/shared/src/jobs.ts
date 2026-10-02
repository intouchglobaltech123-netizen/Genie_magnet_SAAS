// Background jobs (ADR 0010): what runs outside a request, by name, with what people see in Settings → Background jobs.

export const JOB_NAMES = {
  "videos.due": "Videos due tomorrow, and videos now late",
  "onboarding.reminders": "Onboarding reminders to send, and onboarding past its window",
  "agreements.renewals": "Agreements coming up for renewal, and agreements that ended",
  "invoices.overdue": "Invoices that became overdue",
  "cycles.month": "Monthly delivery set up, and last month to close",
  "files.cleanup": "Unfinished uploads cleared",
  "reports.draft": "Monthly reports drafted (on the 25th)",
  "whatsapp.send": "A WhatsApp message",
  "payments.link": "A payment link for an invoice",
  "payments.cancel": "A payment link switched off",
  "social.publish": "A post on a connected platform",
  "social.metrics": "Numbers for posts on connected platforms",
} as const;
export type JobName = keyof typeof JOB_NAMES;

/** Run once a day for every agency, in the morning. */
export const DAILY_JOBS: JobName[] = [
  "videos.due",
  "onboarding.reminders",
  "agreements.renewals",
  "invoices.overdue",
  "cycles.month",
  "files.cleanup",
  "reports.draft",
  "social.metrics",
];

export const JOB_STATUSES = ["queued", "running", "done", "failed"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];
export const JOB_STATUS_LABEL: Record<JobStatus, string> = { queued: "Waiting", running: "Running", done: "Done", failed: "Failed" };

/** Waits before the 2nd, 3rd, 4th and 5th try: 1 minute, 5 minutes, 30 minutes, 2 hours. */
export const RETRY_DELAYS_SECONDS = [60, 300, 1800, 7200];
export const retryDelaySeconds = (attempt: number) => RETRY_DELAYS_SECONDS[Math.min(attempt, RETRY_DELAYS_SECONDS.length) - 1] ?? 60;
