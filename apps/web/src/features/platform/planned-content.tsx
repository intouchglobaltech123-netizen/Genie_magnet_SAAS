"use client";

import type { ComponentType } from "react";
import {
  Bell,
  Bot,
  BrainCircuit,
  CalendarSync,
  CheckCheck,
  CloudOff,
  Copy,
  DatabaseZap,
  Eye,
  FileCheck2,
  FileSearch,
  FileSpreadsheet,
  FolderTree,
  Gauge,
  GitCompare,
  History,
  Link2,
  ListRestart,
  Lock,
  MessageSquareText,
  Plug,
  Repeat,
  ScanSearch,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  UserRoundCheck,
  Users,
  Webhook,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import {
  AiPreview,
  AuditPreview,
  AutomationPreview,
  DiagnosticPreview,
  FilesPreview,
  IntegrationsPreview,
  MigrationPreview,
  OfflinePreview,
  PeerFeedbackPreview,
  ScenarioPreview,
} from "@/features/platform/planned-previews";

export interface PlannedModule {
  headline: string;
  capabilities: { icon: LucideIcon; title: string; desc: string }[];
  previewTitle: string;
  previewDesc: string;
  Preview: ComponentType;
  dependencies: string[];
  questions: string[];
}

export const plannedModules: Record<string, PlannedModule> = {
  diagnostic: {
    headline: "A structured health check of every business function — and how much of it still depends on the founder.",
    capabilities: [
      { icon: ScanSearch, title: "Function assessment", desc: "Marketing, Sales, Operations, R&D, Accounts & Finance, HR and Management scored on action consistency, owner dependency and results efficiency." },
      { icon: Gauge, title: "Founder-dependency index", desc: "One number for how many decisions, approvals and client moments still route through Janarthanan — tracked quarter on quarter." },
      { icon: FileSearch, title: "Evidence, not opinion", desc: "Scores are pre-filled from SOP compliance, delivery on time, approvals and review outcomes; the founder confirms or overrides with a note." },
      { icon: CheckCheck, title: "Actions into goals", desc: "Each weak cell becomes a commitment with an owner and due date in Decisions & Commitments." },
    ],
    previewTitle: "Assessment grid",
    previewDesc: "Click a cell to see the evidence behind it",
    Preview: DiagnosticPreview,
    dependencies: ["SOP compliance data (SOPs & Checklists)", "Approvals history (Audit Log)", "Goals & Reviews modules live for 1+ quarter"],
    questions: ["Use the BFA framework as-is, or adapt the three dimensions?", "Who else answers — manager only, or department leads too?", "How often: quarterly or half-yearly?"],
  },
  scenarios: {
    headline: "What-if planning on real numbers before you commit — more clients, new pricing, a new hire or outsourcing.",
    capabilities: [
      { icon: SlidersHorizontal, title: "What-if sliders", desc: "Add clients, change price, hire an editor or outsource a share of edits and see revenue, cost and margin move instantly." },
      { icon: Users, title: "Capacity impact", desc: "Shows who becomes overloaded — using real utilisation and hours per video from Time Tracking." },
      { icon: GitCompare, title: "Compare & save scenarios", desc: "Keep side-by-side versions (e.g. “Hire in Nov” vs “Outsource 30%”) and share one with the manager." },
      { icon: Lock, title: "Founder only", desc: "Scenarios never change live agreements, salaries or targets until you convert one into goals." },
    ],
    previewTitle: "Illustrative what-if",
    previewDesc: "Move the sliders — numbers are illustrative",
    Preview: ScenarioPreview,
    dependencies: ["True Costing per video (labour + overhead)", "Capacity & utilisation from Planning", "At least 3 months of reconciled cycles"],
    questions: ["Which scenarios matter most in the next 6 months?", "Should freelancer rates come from actual invoices or a rate card?"],
  },
  "peer-feedback": {
    headline: "Structured 45-day peer feedback that is safe to give and useful to receive.",
    capabilities: [
      { icon: MessageSquareText, title: "Structured prompts", desc: "Five role-specific prompts with a 1–5 rating and a required concrete example — no free-for-all comments." },
      { icon: Eye, title: "Anonymity rules", desc: "Responses are anonymous by default and only released when at least 3 peers respond." },
      { icon: UserRoundCheck, title: "Moderated release", desc: "HR reviews wording; the manager releases it inside the 45-day review with a development plan." },
      { icon: History, title: "Trend over time", desc: "See how feedback themes change across cycles, linked to KRA scorecards." },
    ],
    previewTitle: "Give feedback · release flow",
    previewDesc: "Toggle anonymity and rate — nothing is sent",
    Preview: PeerFeedbackPreview,
    dependencies: ["Reviews & Meetings 45-day cycle", "Role definitions from Team & HR"],
    questions: ["Should freelancers give or receive peer feedback?", "Minimum responses before release — 3 or 4?", "Should the founder see raw responses?"],
  },
  ai: {
    headline: "An assistant that suggests the next best action, shows its evidence, and never acts without a human.",
    capabilities: [
      { icon: BrainCircuit, title: "Recommendations", desc: "Rebalance editor load, flag renewals, chase overdue invoices, spot at-risk clients — each with the data behind it." },
      { icon: CheckCheck, title: "Human approval", desc: "Every suggestion is Approve / Dismiss. Approving creates the task; nothing changes silently." },
      { icon: ShieldCheck, title: "Role-scoped", desc: "The assistant only reads what the asking person's role can see — personal finance data is never included." },
      { icon: FileSearch, title: "Evidence shown", desc: "Each suggestion lists the records and numbers it used, so it can be checked in seconds." },
      { icon: Bot, title: "Ask in plain English", desc: "“Which videos are at risk this week?” answered from live data, with links." },
    ],
    previewTitle: "Today's suggestions",
    previewDesc: "Approve or dismiss — nothing happens without you",
    Preview: AiPreview,
    dependencies: ["Clean data in CRM, Production and Billing", "Audit Log (to record approvals)", "Data-processing agreement with the AI provider"],
    questions: ["Which suggestions would save you the most time?", "Should the manager be able to approve AI suggestions, or founder only?"],
  },
  automation: {
    headline: "Rules that do the repetitive work — reliably, once, with a clear queue when something goes wrong.",
    capabilities: [
      { icon: Workflow, title: "Won deal → onboarding", desc: "A won sale creates the client, agreement draft and onboarding checklist automatically." },
      { icon: Repeat, title: "Recurring cycles", desc: "On the 1st, every active agreement generates its monthly cycle with units, videos and due dates." },
      { icon: Bell, title: "Reminders & escalation", desc: "Asset return reminders, overdue video escalation, invoice follow-ups — respecting quiet hours." },
      { icon: ListRestart, title: "Idempotent & retried", desc: "Each run has a key so retries never create duplicates; failures retry with back-off." },
      { icon: Timer, title: "Exception queue", desc: "Anything that can't complete lands in a queue with the reason and a one-click retry." },
    ],
    previewTitle: "Rules & exception queue",
    previewDesc: "Retry an exception to clear it",
    Preview: AutomationPreview,
    dependencies: ["Agreements & cycles data model", "Notifications channels (email, WhatsApp)", "Audit Log for every automated change"],
    questions: ["Which three automations should go live first?", "Who owns the exception queue day to day?"],
  },
  integrations: {
    headline: "Connect the tools Genie Magnet already uses so data flows in without re-typing.",
    capabilities: [
      { icon: CalendarSync, title: "Google Workspace", desc: "Sign-in, Calendar sync for shoots and reviews, Drive links for footage and deliverables." },
      { icon: Plug, title: "Meta & YouTube", desc: "Lead ads into CRM; published URLs and views into Outcomes & Reports." },
      { icon: MessageSquareText, title: "WhatsApp", desc: "Reminders to staff and review links / approvals for clients." },
      { icon: Users, title: "Hikvision & LMS", desc: "Attendance punches and training progress imported automatically." },
      { icon: Webhook, title: "Email & webhooks", desc: "Invoices and alerts by email; webhooks to send events anywhere." },
    ],
    previewTitle: "Planned connectors",
    previewDesc: "Mark the ones you want first",
    Preview: IntegrationsPreview,
    dependencies: ["Google Workspace admin access", "WhatsApp Business API number & approved templates", "Hikvision export format / API access"],
    questions: ["Which WhatsApp number should the system use?", "Is the LMS the WTF Community platform or a separate one?", "Does Hikvision support API, or Excel export only?"],
  },
  offline: {
    headline: "Shoot and asset checklists that work in places with no signal — then sync safely.",
    capabilities: [
      { icon: CloudOff, title: "Works offline", desc: "Kit, pre-shoot and return checklists with photo evidence captured on the phone without internet." },
      { icon: Repeat, title: "Queued sync", desc: "Changes sync in order as soon as there's signal; the phone shows exactly what's pending." },
      { icon: GitCompare, title: "Conflict review", desc: "If the office changed the same item, you pick which version wins — both are kept in the audit log." },
      { icon: FileCheck2, title: "Evidence intact", desc: "Photos and timestamps are taken on-device so evidence stays valid even when uploaded later." },
    ],
    previewTitle: "Field app preview",
    previewDesc: "Tick items, go online, resolve the conflict",
    Preview: OfflinePreview,
    dependencies: ["SOP checklists finalised", "Mobile install (PWA) on team phones", "Asset tags / QR labels on kit"],
    questions: ["Android only, or iPhones too?", "Which locations have the worst signal?"],
  },
  audit: {
    headline: "A tamper-evident record of who changed what, when, and why.",
    capabilities: [
      { icon: History, title: "Every change", desc: "Actor, time, action, record, old → new value on all important records." },
      { icon: MessageSquareText, title: "Reasons required", desc: "Overrides, discount approvals and gate skips require a reason that is stored with the change." },
      { icon: FileSearch, title: "Search & filter", desc: "By person, record, action or date — export for disputes or reviews." },
      { icon: Lock, title: "Read-only", desc: "Entries can't be edited or deleted, including by the founder." },
    ],
    previewTitle: "Sample audit trail",
    previewDesc: "Filter by person",
    Preview: AuditPreview,
    dependencies: ["Backend API (every write goes through it)", "Retention policy"],
    questions: ["How long should audit history be kept — 3 years? 7?", "Should clients see the audit trail for their own approvals?"],
  },
  migration: {
    headline: "Bring existing Excel sheets and records in cleanly — validated before anything is imported.",
    capabilities: [
      { icon: FileSpreadsheet, title: "CSV templates", desc: "One template per entity: clients, employees, assets, agreements, invoices." },
      { icon: Copy, title: "Column mapping", desc: "Map your existing sheet columns once; the mapping is saved for re-runs." },
      { icon: ShieldCheck, title: "Validate & dry run", desc: "Errors and warnings row-by-row before import; a dry run shows exactly what will be created." },
      { icon: DatabaseZap, title: "Reconcile", desc: "Totals after import (e.g. outstanding invoices) are matched against the source file." },
    ],
    previewTitle: "Import wizard",
    previewDesc: "Pick an entity and step",
    Preview: MigrationPreview,
    dependencies: ["Final data model for each entity", "Source files from the team (current Excel sheets)"],
    questions: ["Which history do we import — current FY only or all years?", "Who signs off the reconciled totals?"],
  },
  files: {
    headline: "Every file attached to the record it belongs to — uploads or Drive links, with previews and versions.",
    capabilities: [
      { icon: FolderTree, title: "Linked to records", desc: "Agreements, brand kits, exports and evidence photos live on the client, video or SOP run they belong to." },
      { icon: Link2, title: "Uploads or Drive links", desc: "Large footage stays in Google Drive; the system stores the link and checks access." },
      { icon: Eye, title: "Previews", desc: "PDFs, images and videos preview in-app — no downloading to check." },
      { icon: History, title: "Versions", desc: "New uploads become new versions; approved versions are locked." },
    ],
    previewTitle: "Document library",
    previewDesc: "Select a file",
    Preview: FilesPreview,
    dependencies: ["Storage provider decision (S3 / Drive)", "Google Drive integration"],
    questions: ["Should raw footage ever be uploaded, or always Drive links?", "Max file size for uploads?"],
  },
};
