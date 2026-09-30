// WhatsApp Business message templates (Meta-approved templates in production).
// {{placeholders}} are filled from the record the message is sent for.

export interface WaTemplate {
  id: string;
  name: string;
  category: "Utility" | "Marketing";
  purpose: string;
  status: "Approved" | "In review" | "Draft";
  body: string;
  buttons?: { label: string; kind?: "url" | "reply" }[];
}

export const waTemplates: WaTemplate[] = [
  {
    id: "onboarding_link",
    name: "onboarding_questionnaire",
    category: "Utility",
    purpose: "Onboarding link",
    status: "Approved",
    body: "Hi {{name}}, welcome to Genie Magnet! 🎉\n\nPlease fill your onboarding questionnaire. The required part takes about 8 minutes — the rest can be done within 7 days.",
    buttons: [{ label: "Open questionnaire", kind: "url" }],
  },
  {
    id: "onboarding_reminder",
    name: "onboarding_reminder",
    category: "Utility",
    purpose: "Onboarding reminder",
    status: "Approved",
    body: "Hi {{name}}, a gentle reminder: {{open}} sections of your onboarding questionnaire are still open. Please finish them by {{due}} — it opens at the next unanswered question.",
    buttons: [{ label: "Continue questionnaire", kind: "url" }],
  },
  {
    id: "approval_request",
    name: "approval_request",
    category: "Utility",
    purpose: "Approval request",
    status: "Approved",
    body: "Hi {{name}}, your {{item}} is ready for approval:\n“{{title}}”\n\nReview it in the Client Hub, or reply below.",
    buttons: [
      { label: "Approve", kind: "reply" },
      { label: "Request changes", kind: "reply" },
      { label: "Open in Client Hub", kind: "url" },
    ],
  },
  {
    id: "approval_reminder",
    name: "approval_reminder",
    category: "Utility",
    purpose: "Approval reminder",
    status: "Approved",
    body: "Hi {{name}}, “{{title}}” has been waiting for your approval for {{days}} days. Approving by {{due}} keeps it on schedule for {{publish}}.",
    buttons: [
      { label: "Approve", kind: "reply" },
      { label: "Open in Client Hub", kind: "url" },
    ],
  },
  {
    id: "approval_confirmation",
    name: "approval_confirmation",
    category: "Utility",
    purpose: "Confirmation",
    status: "Approved",
    body: "Thank you, {{name}}! ✅ “{{title}}” is approved and scheduled for {{publish}} on {{platforms}}. We'll share the live link once it's posted.",
  },
  {
    id: "published_link",
    name: "published_link",
    category: "Utility",
    purpose: "Published",
    status: "In review",
    body: "“{{title}}” is live on {{platforms}} 🚀\nShare it with your customers — every share helps reach.",
    buttons: [{ label: "View post", kind: "url" }],
  },
  {
    id: "invoice_due",
    name: "invoice_reminder",
    category: "Utility",
    purpose: "Payment reminder",
    status: "Draft",
    body: "Hi {{name}}, invoice {{invoice}} for {{amount}} is due on {{due}}. Pay securely with the link below.",
    buttons: [{ label: "Pay now", kind: "url" }],
  },
];

export const waTemplateById = (id: string) => waTemplates.find((t) => t.id === id)!;

/** Fills {{placeholders}}; unknown ones are left visible so gaps are obvious in the preview. */
export function fillTemplate(body: string, vars: Record<string, string | number>) {
  return body.replace(/\{\{(\w+)\}\}/g, (m, k: string) => (vars[k] !== undefined ? String(vars[k]) : m));
}
