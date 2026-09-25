import { allNavItems, type Depth } from "@/lib/nav";

export interface ModuleDef {
  no: number;
  name: string;
  group: string;
  summary: string;
}

export const MODULE_GROUPS = [
  { id: "platform", title: "Platform foundation", range: "1–8", desc: "Tenancy, access, audit, files, notifications, automation, settings" },
  { id: "a", title: "Section A · Client delivery", range: "9–23", desc: "From lead to published video to renewal" },
  { id: "b", title: "Section B · Supporting workflows", range: "24–36", desc: "People, equipment, time and money behind delivery" },
  { id: "c", title: "Section C · Management", range: "37–42", desc: "Goals, reviews, decisions and founder dependency" },
  { id: "x", title: "Cross-cutting", range: "43–47", desc: "Dashboards, alerts, AI, integrations, migration" },
] as const;

const raw: [number, string, string][] = [
  [1, "Tenancy & Organisation", "Company, branches, departments, fiscal year"],
  [2, "Auth & Users", "Login, invites, sessions, 2FA"],
  [3, "Roles & Permissions", "Founder, manager, editor, finance, HR, client"],
  [4, "Audit Log", "Who changed what, when and why"],
  [5, "Files & Documents", "Uploads, Drive links, previews, versions"],
  [6, "Notifications", "In-app, email and WhatsApp alerts"],
  [7, "Automation Engine", "Triggers, rules, retries, exception queue"],
  [8, "Settings & Configuration", "Packages, statuses, thresholds, templates"],
  [9, "CRM & Sales", "Leads, pipeline, proposals, discount approval"],
  [10, "Agreements & Packages", "Units, revision allowance, billing terms"],
  [11, "Client Onboarding", "Brief, brand files, approver, onboarding gate"],
  [12, "Recurring Cycles", "Monthly cycles auto-generated from agreements"],
  [13, "Projects, Deliverables & Tasks", "Deliverables, tasks, owners, dependencies"],
  [14, "Planning & Scheduling", "Backward planning, capacity, leave conflicts"],
  [15, "Video Production", "Video codes, urgency, VP, edit steps, shoots & kit"],
  [16, "SOPs & Checklists", "Versioned SOPs with doer / checker / approver"],
  [17, "Internal QC", "Quality gate before client review"],
  [18, "Client Portal", "Review, timestamped comments, approvals"],
  [19, "Revisions & Change Requests", "Agency correction · included · out-of-scope"],
  [20, "Publishing & Delivery", "Approved version, URL, timestamp, proof"],
  [21, "Outcomes & Reporting", "Reach, views, leads; monthly client reports"],
  [22, "Cycle Reconciliation", "Delivered units, carry-forward, period close"],
  [23, "Agreement Review & Client Health", "A/B/C/D categories, renewal risk"],
  [24, "HR Employee Lifecycle", "Hiring, onboarding, documents, exit"],
  [25, "Attendance & Leave", "Hikvision / Excel import, leave approvals"],
  [26, "Calendar", "Shoots, meetings, leave, locked events"],
  [27, "Learning (LMS Link)", "Training paths, LMS links, skill matrix"],
  [28, "Performance & KRA", "Role scorecards, A/B player rating"],
  [29, "Payroll", "Salary rules, payroll run, payslips"],
  [30, "Equipment & Assets", "Register, custody, maintenance, depreciation"],
  [31, "Offline Field App", "Offline shoot & asset checklists with sync"],
  [32, "Time Tracking", "Daily data sheet, time against tasks"],
  [33, "Billing & Collections", "Invoices, advances, overdue, reconciliation"],
  [34, "Expenses & Vendors", "Requests, receipts, approvals, allocation"],
  [35, "True Costing", "Cost per video: labour, equipment, overhead, rework"],
  [36, "Financial Reporting & Planning", "Contracted · invoiced · earned · collected"],
  [37, "Goals", "Company → department → individual goals"],
  [38, "Business Diagnostic & Founder Dependency", "Internal diagnosis, founder-dependency index"],
  [39, "Scenario Planner", "What-if: clients, price, hiring, outsourcing"],
  [40, "Meetings & Reviews", "Daily · 7-day · 14-day · 45-day reviews"],
  [41, "Decisions & Commitments", "Owner + due date → tasks, carried forward"],
  [42, "Round Table (Peer Feedback)", "45-day team feedback circle with timed rounds and controlled release"],
  [43, "Dashboards", "Founder, manager, editor, finance, HR views"],
  [44, "Alerts & Risk", "Exceptions: overdue, payment, leave, capacity"],
  [45, "AI Assistant", "Recommendations with human approval"],
  [46, "Integrations", "Google, Meta, Drive, LMS, WhatsApp, Hikvision"],
  [47, "Data Migration", "Import clients, employees, assets, finance"],
];

const groupFor = (n: number) => (n <= 8 ? "platform" : n <= 23 ? "a" : n <= 36 ? "b" : n <= 42 ? "c" : "x");

const depthRank: Record<Depth, number> = { demo: 3, preview: 2, planned: 1 };

export interface ModuleRow extends ModuleDef {
  depth: Depth;
  routes: { title: string; href: string }[];
}

export const modules: ModuleRow[] = raw.map(([no, name, summary]) => {
  const matches = allNavItems.filter((i) => i.moduleNo === no);
  let routes = matches.map((m) => ({ title: m.title, href: m.href }));
  let depth: Depth = matches.reduce<Depth>((best, m) => (depthRank[m.depth] > depthRank[best] ? m.depth : best), "planned");
  if (no === 18) {
    routes = [{ title: "Client Portal", href: "/portal" }];
    depth = "demo";
  } else if (no === 44) {
    routes = [{ title: "Dashboard · Needs your attention", href: "/" }];
    depth = "demo";
  } else if ([1, 2, 3, 6].includes(no)) {
    routes = [{ title: "Settings", href: "/settings" }];
    depth = "preview";
  }
  return { no, name, summary, group: groupFor(no), depth, routes };
});

export const depthMeta: Record<Depth, { label: string; tone: "accent" | "info" | "neutral"; desc: string }> = {
  demo: { label: "Demo", tone: "accent", desc: "Fully clickable — state changes on screen" },
  preview: { label: "Preview", tone: "info", desc: "List / detail screens with sample data" },
  planned: { label: "Planned", tone: "neutral", desc: "Overview only — built in phase 2" },
};
