// Notifications in the app (P1-04). Each kind can be switched off by each person; email joins as a second channel in the
// last step without changing who sends what.
import { z } from "zod";

export const NOTIFICATION_KINDS = [
  { key: "discount_approval", group: "Sales", label: "A discount waits for my approval" },
  { key: "discount_decided", group: "Sales", label: "My proposal's discount is approved or rejected" },
  { key: "deal_won", group: "Sales", label: "A deal I follow is won" },
  { key: "agreement_signoff", group: "Clients", label: "An agreement waits for my sign-off" },
  { key: "agreement_signed", group: "Clients", label: "An agreement I drafted is signed off" },
  { key: "onboarding_progress", group: "Clients", label: "A client I look after finishes onboarding (the required part, or all of it)" },
  { key: "invoice_to_issue", group: "Money", label: "A draft invoice waits to be issued" },
  { key: "invoice_paid", group: "Money", label: "An invoice I drafted is paid" },
  { key: "expense_to_approve", group: "Money", label: "An expense waits for my approval" },
  { key: "expense_decided", group: "Money", label: "My expense is approved or rejected" },
  { key: "script_approval", group: "Delivery", label: "A script waits for approval" },
  { key: "script_decided", group: "Delivery", label: "My script is approved or sent back" },
  { key: "video_assigned", group: "Delivery", label: "A video or shoot is assigned to me" },
  { key: "qc_ready", group: "Delivery", label: "A video waits for the internal quality check" },
  { key: "qc_failed", group: "Delivery", label: "My video failed the quality check" },
  { key: "revision_requested", group: "Delivery", label: "The client asks for changes to a video I edit" },
  { key: "video_due", group: "Delivery", label: "A video I work on is due tomorrow, or is late" },
  { key: "onboarding_reminder", group: "Clients", label: "A client's onboarding reminder is due, or their onboarding is past its window" },
  { key: "renewal_due", group: "Clients", label: "An agreement comes up for renewal, or ends without one" },
  { key: "invoice_overdue", group: "Money", label: "An invoice becomes overdue" },
  { key: "month_to_close", group: "Delivery", label: "Last month's delivery waits to be closed" },
  { key: "client_portal", group: "Clients", label: "A client I look after picks topics, comments on a video or asks something in their portal" },
  { key: "report_draft", group: "Clients", label: "A client's monthly report is drafted and waits to be released" },
  { key: "leave_to_approve", group: "People", label: "A leave request or attendance correction waits for my approval" },
  { key: "leave_decided", group: "People", label: "My leave or attendance correction is approved or not" },
  { key: "payslip_ready", group: "People", label: "My payslip is ready" },
  { key: "interview_assigned", group: "People", label: "An interview is set up with me" },
  { key: "hire_to_approve", group: "People", label: "A candidate waits for my approval to be hired" },
  { key: "scorecard_shared", group: "People", label: "My month's scorecard is shared with me, or someone replies to one I shared" },
  { key: "learning_assigned", group: "People", label: "A learning path is given to me" },
  { key: "sheet_to_sign", group: "People", label: "A daily sheet waits for my signature" },
  { key: "sheet_returned", group: "People", label: "My daily sheet is sent back to me" },
  { key: "post_failed", group: "Delivery", label: "The app could not post a video, or a client's platform needs connecting again" },
  { key: "goal_breakdown", group: "Management", label: "A breakdown is reported on a goal I own, or one serving it" },
  { key: "review_scheduled", group: "Management", label: "A review I take part in is scheduled" },
  { key: "commitment_assigned", group: "Management", label: "A commitment is given to me" },
  { key: "task_assigned", group: "Management", label: "A task is given to me, or one I wait for is done" },
  { key: "round_table_released", group: "Management", label: "What my team said at a Round Table is ready" },
  { key: "sop_to_approve", group: "Management", label: "An SOP version waits for my approval" },
  { key: "checklist_to_check", group: "Management", label: "An SOP checklist waits for me to check it" },
  { key: "genie_insight", group: "Genie Assistant", label: "Genie Assistant finds something I should act on" },
  { key: "job_failed", group: "Settings", label: "Background work failed after all its tries" },
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number]["key"];
export const NOTIFICATION_KEYS = NOTIFICATION_KINDS.map((k) => k.key) as [NotificationKind, ...NotificationKind[]];

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour time, e.g. 21:00");

/** A person's choices: kinds switched off, and quiet hours (for email and phone alerts, once they arrive). */
export const notificationPreferences = z
  .object({
    muted: z.array(z.enum(NOTIFICATION_KEYS)).max(NOTIFICATION_KEYS.length),
    quietFrom: time.nullable(),
    quietTo: time.nullable(),
  })
  .refine((p) => (p.quietFrom === null) === (p.quietTo === null), { path: ["quietTo"], message: "Give both times, or neither" });
export type NotificationPreferences = z.infer<typeof notificationPreferences>;

export const markRead = z.object({
  /** Leave out to mark everything as read. */
  ids: z.array(z.uuid()).max(200).optional(),
});
