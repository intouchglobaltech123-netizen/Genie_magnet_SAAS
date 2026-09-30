// Genie Assistant = rules + drafts + human approval.
// Rules find what slipped (numbers come from the data, never from the model); the language model
// only writes the draft; a person approves before anything is sent or changed.

export type InsightArea = "Delivery" | "Clients" | "Finance" | "Team" | "Onboarding" | "Content" | "Reports";

export interface InsightDraft {
  kind: "WhatsApp" | "Email" | "Task" | "Report" | "Agenda item";
  to?: string;
  subject?: string;
  text: string;
  buttons?: { label: string; kind?: "url" | "reply" }[];
}

export interface Insight {
  id: string;
  rule: string;
  area: InsightArea;
  severity: "high" | "medium" | "low";
  title: string;
  evidence: string[];
  audience: string;
  source: { label: string; href: string };
  at: string;
  draft?: InsightDraft;
  approveLabel: string;
  doneLabel: string;
}

export const insights: Insight[] = [
  {
    id: "g-nova-approval",
    rule: "Client approval waiting more than 2 days",
    area: "Delivery",
    severity: "high",
    title: "Nova Dental: “Is root canal painful?” has waited 3 days for Dr. Arvind's approval",
    evidence: ["v1 sent 22 Sep · no reply", "Publish slot 28 Sep is at risk", "Dr. Arvind usually replies on WhatsApp within a day"],
    audience: "Founder, Manager",
    source: { label: "Video Production · NVD-0926-01", href: "/production" },
    at: "2026-09-25T08:30",
    draft: {
      kind: "WhatsApp",
      to: "Dr. Arvind Balaji · +91 94430 55301",
      text: "Hi Dr. Arvind, “Is root canal painful? Dr. Arvind explains” has been waiting for your approval for 3 days. Approving by 26 Sep keeps it on schedule for 28 Sep on Instagram.",
      buttons: [
        { label: "Approve", kind: "reply" },
        { label: "Open in Client Hub", kind: "url" },
      ],
    },
    approveLabel: "Send reminder",
    doneLabel: "Reminder sent on WhatsApp",
  },
  {
    id: "g-divya-load",
    rule: "Editor above 100% of weekly capacity",
    area: "Team",
    severity: "high",
    title: "Divya is at 108% this week — move KVR-0926-05 (Diwali hamper ad) to Surya",
    evidence: ["Divya: 43.2 h logged against 40 h capacity", "Surya: 30.1 h, same skills (Premiere, Reels)", "KVR-0926-05 due 27 Sep · rush"],
    audience: "Founder, Manager",
    source: { label: "Planning & Capacity", href: "/planning" },
    at: "2026-09-25T08:00",
    draft: { kind: "Task", to: "Ashwin", text: "Reassign KVR-0926-05 “Diwali gift hamper ad — 30s” from Divya Lakshmi to Surya Prakash. Brief Surya on the re-shot product frames before 2 PM." },
    approveLabel: "Create task",
    doneLabel: "Task created for Ashwin",
  },
  {
    id: "g-onb-nirmala",
    rule: "Onboarding sections still open near the due date",
    area: "Onboarding",
    severity: "medium",
    title: "Nirmala Cooking Academy: onboarding questionnaire is due tomorrow — approvers and brand files missing",
    evidence: ["Sent 19 Sep · day 6 of 7", "Required: 17 of 19 answered", "Reminders sent on day 2 and day 5"],
    audience: "Manager, account owner",
    source: { label: "Onboarding", href: "/onboarding" },
    at: "2026-09-25T09:00",
    draft: {
      kind: "WhatsApp",
      to: "Nirmala Devi · +91 98421 33017",
      text: "Hi Nirmala, just two things left before we can plan your first shoot: your logo files and who approves the scripts. It takes 2 minutes — it opens right where you left off.",
      buttons: [{ label: "Continue questionnaire", kind: "url" }],
    },
    approveLabel: "Send reminder",
    doneLabel: "Reminder sent on WhatsApp",
  },
  {
    id: "g-urban-invoice",
    rule: "Invoice overdue more than 30 days",
    area: "Finance",
    severity: "high",
    title: "Urban Nest: invoice GM/26-27/041 is 32 days overdue (₹40,000)",
    evidence: ["₹1,20,000 outstanding in total", "2 reminders sent (day 7, day 15)", "Client Fitment Map: Dangerous"],
    audience: "Founder, Finance",
    source: { label: "Billing & Collections", href: "/billing" },
    at: "2026-09-25T07:45",
    draft: {
      kind: "WhatsApp",
      to: "Vikram Shetty · +91 94430 55501",
      text: "Hi Vikram, invoice GM/26-27/041 for ₹40,000 was due on 24 Aug. Could you arrange payment this week? You can pay securely with the link below.",
      buttons: [{ label: "Pay now", kind: "url" }],
    },
    approveLabel: "Send reminder",
    doneLabel: "Payment reminder sent",
  },
  {
    id: "g-sls-renewal",
    rule: "Agreement ends within 45 days",
    area: "Clients",
    severity: "medium",
    title: "Sri Lakshmi Silks: agreement ends 31 Oct — send the renewal proposal",
    evidence: ["Client Fitment Map: Amazing · health 92", "Delivered 96% of units over 12 months", "Festive season: renewal before Deepavali is easier"],
    audience: "Founder, Sales",
    source: { label: "Agreements · a-sls-01", href: "/agreements/a-sls-01" },
    at: "2026-09-24T18:00",
    draft: {
      kind: "Email",
      to: "Meenakshi Sundaram · meenakshi@srilakshmisilks.com",
      subject: "Renewing our partnership for 2026-27",
      text: "Dear Meenakshi,\n\nThank you for a wonderful year — 118 reels and 96% of planned content delivered, with the Navaratri drop becoming your best-performing post.\n\nWe'd like to renew from 1 November with the same Social Starter Pack, plus 2 festive long-form videos a quarter. The proposal is attached; happy to walk you through it at the store on Tuesday.\n\nWarm regards,\nPriya Venkatesh\nGenie Magnet",
    },
    approveLabel: "Send email",
    doneLabel: "Renewal proposal sent",
  },
  {
    id: "g-kvr-report",
    rule: "Monthly report ready to draft",
    area: "Reports",
    severity: "low",
    title: "September report for Kaveri Organics is drafted — review the summary",
    evidence: ["Reach 3.1 L (+22% on August)", "Best post: KVR-0926-01 — 48 K views", "7 enquiries attributed to reels"],
    audience: "Manager",
    source: { label: "Outcomes & Reports", href: "/outcomes" },
    at: "2026-09-25T06:30",
    draft: {
      kind: "Report",
      to: "Ramesh Gounder (Client Hub)",
      subject: "Kaveri Organics — September summary",
      text: "September was your strongest month yet: reach grew 22% to 3.1 lakh, led by “Cold-pressed groundnut oil — farm to bottle” (48 K views). Reels brought 7 enquiries, 3 of them bulk orders.\n\nNext month we focus on Deepavali hampers and the founder story, and we'll test a Tamil-only version of the recipe reels.",
    },
    approveLabel: "Publish to Client Hub",
    doneLabel: "Summary published to the Client Hub",
  },
  {
    id: "g-urban-review",
    rule: "Client moved to Dangerous",
    area: "Clients",
    severity: "medium",
    title: "Urban Nest moved to Dangerous — add it to the 45-day strategic review",
    evidence: ["High effort: 1 out-of-scope change request, 610 min on one walkthrough", "Low return: ₹40K/month, 32 days overdue", "Partner agreement ends 31 Dec"],
    audience: "Founder",
    source: { label: "Client Health", href: "/client-health" },
    at: "2026-09-24T17:30",
    draft: { kind: "Agenda item", to: "45-day strategic review · 14 Oct", text: "Urban Nest Realty: fix the terms (advance billing, CR rates) or plan an exit at the 31 Dec renewal. Owner: Janarthanan." },
    approveLabel: "Add to agenda",
    doneLabel: "Added to the 14 Oct agenda",
  },
  {
    id: "g-sls-topics",
    rule: "Topic list not picked within 2 days",
    area: "Content",
    severity: "low",
    title: "Sri Lakshmi Silks hasn't picked October topics yet (sent yesterday)",
    evidence: ["12 topics proposed · 0 picked", "Automatic reminder goes out tomorrow at 10 AM", "Deepavali content must be shot by 5 Oct"],
    audience: "Manager",
    source: { label: "Content · Topic lists", href: "/content" },
    at: "2026-09-25T09:15",
    approveLabel: "Got it",
    doneLabel: "Noted — automatic reminder stays on",
  },
];

export const AREA_TONE: Record<InsightArea, "info" | "accent" | "warning" | "gold" | "success" | "neutral"> = {
  Delivery: "info",
  Clients: "accent",
  Finance: "warning",
  Team: "gold",
  Onboarding: "success",
  Content: "neutral",
  Reports: "neutral",
};
