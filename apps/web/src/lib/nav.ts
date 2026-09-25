import {
  Activity,
  AlarmClock,
  Banknote,
  BarChart3,
  BookOpen,
  Bot,
  Boxes,
  Briefcase,
  CalendarDays,
  CalendarRange,
  Camera,
  ClipboardCheck,
  ClipboardList,
  Clock,
  CloudOff,
  Coins,
  DatabaseZap,
  FileSignature,
  FileText,
  Film,
  FolderKanban,
  Gauge,
  GitPullRequestArrow,
  Goal,
  HeartPulse,
  Layers,
  LayoutDashboard,
  LineChart,
  ListChecks,
  MessagesSquare,
  Network,
  PiggyBank,
  Plug,
  Receipt,
  Repeat,
  ScanSearch,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Target,
  UserCheck,
  UserPlus,
  Users,
  Wallet,
  Workflow,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/types";

/** demo = fully clickable, preview = list/detail with dummy data, planned = overview page (phase 2) */
export type Depth = "demo" | "preview" | "planned";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  depth: Depth;
  moduleNo?: number; // number in MODULES.md
  summary: string;
  roles?: Role[]; // omitted = all internal roles
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

const ALL_INTERNAL: Role[] = ["founder", "manager", "editor", "finance", "hr"];
const LEADERS: Role[] = ["founder", "manager"];

export const navSections: NavSection[] = [
  {
    title: "Overview",
    items: [
      { title: "Dashboard", href: "/", icon: LayoutDashboard, depth: "demo", moduleNo: 43, summary: "Role dashboards: revenue, delivery, exceptions", roles: ALL_INTERNAL },
      { title: "Module Map", href: "/modules", icon: Network, depth: "demo", summary: "All 47 modules and their demo status", roles: LEADERS },
    ],
  },
  {
    title: "Client Delivery",
    items: [
      { title: "CRM & Sales", href: "/crm", icon: Target, depth: "demo", moduleNo: 9, summary: "Leads, pipeline, proposals, discount approval", roles: ["founder", "manager"] },
      { title: "Agreements", href: "/agreements", icon: FileSignature, depth: "demo", moduleNo: 10, summary: "Packages, units, revision allowance, billing terms", roles: ["founder", "manager", "finance"] },
      { title: "Onboarding", href: "/onboarding", icon: UserCheck, depth: "preview", moduleNo: 11, summary: "Brief, brand files, approver, onboarding gate", roles: LEADERS },
      { title: "Recurring Cycles", href: "/cycles", icon: Repeat, depth: "preview", moduleNo: 12, summary: "Monthly cycles auto-generated from agreements", roles: LEADERS },
      { title: "Projects & Tasks", href: "/projects", icon: FolderKanban, depth: "preview", moduleNo: 13, summary: "Deliverables, tasks, owners, dependencies", roles: ALL_INTERNAL },
      { title: "Planning & Capacity", href: "/planning", icon: CalendarRange, depth: "preview", moduleNo: 14, summary: "Backward planning, workload, leave conflicts", roles: LEADERS },
      { title: "Video Production", href: "/production", icon: Film, depth: "demo", moduleNo: 15, summary: "Video calendar, codes, urgency, VP, editing steps", roles: ALL_INTERNAL },
      { title: "Shoots & Kit", href: "/shoots", icon: Camera, depth: "demo", moduleNo: 15, summary: "Shoot sheets, dual/single cam kit checklist", roles: ["founder", "manager", "editor"] },
      { title: "SOPs & Checklists", href: "/sops", icon: ListChecks, depth: "preview", moduleNo: 16, summary: "Versioned SOPs, evidence, doer/checker/approver", roles: ALL_INTERNAL },
      { title: "Internal QC", href: "/qc", icon: ClipboardCheck, depth: "demo", moduleNo: 17, summary: "Quality gate before client review", roles: ["founder", "manager", "editor"] },
      { title: "Revisions & CRs", href: "/revisions", icon: GitPullRequestArrow, depth: "demo", moduleNo: 19, summary: "Agency correction · included · out-of-scope", roles: ["founder", "manager", "editor"] },
      { title: "Publishing", href: "/publishing", icon: Send, depth: "preview", moduleNo: 20, summary: "Approved version, URL, timestamp, proof", roles: ALL_INTERNAL },
      { title: "Outcomes & Reports", href: "/outcomes", icon: LineChart, depth: "preview", moduleNo: 21, summary: "Reach, views, leads; client reports", roles: LEADERS },
      { title: "Cycle Reconciliation", href: "/reconciliation", icon: Layers, depth: "preview", moduleNo: 22, summary: "Delivered units, carry-forward, period close", roles: ["founder", "manager", "finance"] },
      { title: "Client Health", href: "/client-health", icon: HeartPulse, depth: "preview", moduleNo: 23, summary: "Awesome · Breadwinning · Convincing · Dangerous", roles: LEADERS },
    ],
  },
  {
    title: "People & Resources",
    items: [
      { title: "Daily Data Sheet", href: "/daily-sheet", icon: ClipboardList, depth: "demo", moduleNo: 32, summary: "Employee daily task log with GM & HR sign-off", roles: ALL_INTERNAL },
      { title: "Team & HR", href: "/hr", icon: Users, depth: "preview", moduleNo: 24, summary: "Employee lifecycle, roles, skills, documents", roles: ["founder", "manager", "hr"] },
      { title: "Recruitment", href: "/recruitment", icon: UserPlus, depth: "preview", moduleNo: 24, summary: "Role task document, STAR interview scorecards", roles: ["founder", "hr"] },
      { title: "Attendance & Leave", href: "/attendance", icon: AlarmClock, depth: "preview", moduleNo: 25, summary: "Hikvision/Excel import, leave, conflicts", roles: ALL_INTERNAL },
      { title: "Calendar", href: "/calendar", icon: CalendarDays, depth: "preview", moduleNo: 26, summary: "Shoots, meetings, leave, locked events", roles: ALL_INTERNAL },
      { title: "Performance & KRA", href: "/performance", icon: Gauge, depth: "preview", moduleNo: 28, summary: "Role scorecards, A/B player rating, leaderboard", roles: ["founder", "manager", "hr"] },
      { title: "Learning", href: "/learning", icon: BookOpen, depth: "preview", moduleNo: 27, summary: "Training paths, LMS links, skill matrix", roles: ALL_INTERNAL },
      { title: "Payroll", href: "/payroll", icon: Wallet, depth: "preview", moduleNo: 29, summary: "Salary rules, payroll run, payslips", roles: ["founder", "hr", "finance"] },
      { title: "Equipment & Assets", href: "/assets", icon: Boxes, depth: "preview", moduleNo: 30, summary: "Register, custody, maintenance, depreciation", roles: ["founder", "manager", "editor"] },
      { title: "Time Tracking", href: "/time", icon: Clock, depth: "preview", moduleNo: 32, summary: "Time against tasks, categories, approvals", roles: ALL_INTERNAL },
    ],
  },
  {
    title: "Finance",
    items: [
      { title: "Billing & Collections", href: "/billing", icon: Receipt, depth: "preview", moduleNo: 33, summary: "Invoices, advances, overdue, reconciliation", roles: ["founder", "finance"] },
      { title: "Expenses & Vendors", href: "/expenses", icon: Banknote, depth: "preview", moduleNo: 34, summary: "Requests, receipts, approvals, allocation", roles: ["founder", "manager", "finance"] },
      { title: "True Costing", href: "/costing", icon: Coins, depth: "demo", moduleNo: 35, summary: "Cost per video: labour, equipment, overhead, rework", roles: ["founder", "finance"] },
      { title: "Financial Reports", href: "/finance", icon: BarChart3, depth: "preview", moduleNo: 36, summary: "Contracted · invoiced · earned · collected", roles: ["founder", "finance"] },
      { title: "Financial Planner", href: "/planner", icon: PiggyBank, depth: "demo", summary: "Way To Fortune — personal leakage auditor & money diagnostic", roles: ALL_INTERNAL },
    ],
  },
  {
    title: "Management",
    items: [
      { title: "Goals", href: "/goals", icon: Goal, depth: "demo", moduleNo: 37, summary: "Company → department → individual goals", roles: ["founder", "manager"] },
      { title: "Reviews & Meetings", href: "/reviews", icon: MessagesSquare, depth: "demo", moduleNo: 40, summary: "Daily · 7-day · 14-day · 45-day reviews", roles: ALL_INTERNAL },
      { title: "Decisions & Commitments", href: "/commitments", icon: Briefcase, depth: "preview", moduleNo: 41, summary: "Owner + due date → tasks; carried forward", roles: ALL_INTERNAL },
      { title: "Business Diagnostic", href: "/m/diagnostic", icon: ScanSearch, depth: "planned", moduleNo: 38, summary: "Internal diagnosis & founder-dependency index", roles: ["founder"] },
      { title: "Scenario Planner", href: "/m/scenarios", icon: Sparkles, depth: "planned", moduleNo: 39, summary: "What-if: clients, price, hiring, outsourcing", roles: ["founder"] },
      { title: "Round Table", href: "/round-table", icon: Activity, depth: "demo", moduleNo: 42, summary: "45-day team feedback circle: timed rounds, anonymous results", roles: ALL_INTERNAL },
    ],
  },
  {
    title: "Platform",
    items: [
      { title: "AI Assistant", href: "/m/ai", icon: Bot, depth: "planned", moduleNo: 45, summary: "Recommendations with human approval", roles: LEADERS },
      { title: "Automation", href: "/m/automation", icon: Workflow, depth: "planned", moduleNo: 7, summary: "Triggers, rules, retries, exception queue", roles: ["founder"] },
      { title: "Integrations", href: "/m/integrations", icon: Plug, depth: "planned", moduleNo: 46, summary: "Google, Meta, Drive, LMS, WhatsApp, Hikvision", roles: ["founder"] },
      { title: "Offline Field App", href: "/m/offline", icon: CloudOff, depth: "planned", moduleNo: 31, summary: "Offline shoot/asset checklists with sync", roles: LEADERS },
      { title: "Audit Log", href: "/m/audit", icon: ShieldCheck, depth: "planned", moduleNo: 4, summary: "Who changed what, when, and why", roles: ["founder"] },
      { title: "Data Migration", href: "/m/migration", icon: DatabaseZap, depth: "planned", moduleNo: 47, summary: "Import clients, employees, assets, finance", roles: ["founder"] },
      { title: "Documents", href: "/m/files", icon: FileText, depth: "planned", moduleNo: 5, summary: "Uploads, Drive links, previews", roles: ALL_INTERNAL },
      { title: "Settings", href: "/settings", icon: Settings, depth: "preview", moduleNo: 8, summary: "Roles, packages, statuses, thresholds", roles: ["founder"] },
    ],
  },
];

export const allNavItems = navSections.flatMap((s) => s.items);

export const roleLabels: Record<Role, { label: string; person: string; desc: string }> = {
  founder: { label: "Founder / MD", person: "Janarthanan", desc: "Everything, exceptions & approvals" },
  manager: { label: "Manager", person: "Ashwin", desc: "Planning, delivery, team" },
  editor: { label: "Editor", person: "Divya Lakshmi", desc: "Assigned videos, daily sheet" },
  finance: { label: "Finance", person: "Finance Desk", desc: "Billing, costing, reports" },
  hr: { label: "HR", person: "Harini Selvam", desc: "People, attendance, payroll" },
  client: { label: "Client", person: "Ramesh Gounder · Kaveri Organics", desc: "Client portal only" },
};
