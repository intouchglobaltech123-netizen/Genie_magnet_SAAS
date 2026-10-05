"use client";

import {
  Banknote,
  Boxes,
  Briefcase,
  Building2,
  Calculator,
  CalendarCheck,
  CalendarDays,
  CalendarOff,
  Camera,
  Clapperboard,
  ClipboardList,
  Contact,
  CreditCard,
  DatabaseBackup,
  FileBarChart,
  FileSignature,
  FileSpreadsheet,
  Filter,
  Fingerprint,
  FolderKanban,
  Gauge,
  GraduationCap,
  Handshake,
  HelpCircle,
  History,
  Home,
  Inbox,
  Landmark,
  Layers,
  LifeBuoy,
  Lightbulb,
  ListChecks,
  ListOrdered,
  Megaphone,
  MessageCircle,
  Package,
  PiggyBank,
  Receipt,
  ReceiptIndianRupee,
  ReceiptText,
  Repeat,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Stethoscope,
  Target,
  Timer,
  Users,
  Wallet,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { AreaKey, SuiteKey } from "@gm/shared";
import { useCan, useMe } from "./queries";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  /** Shown only to people whose role has at least this access (view unless said) to this area. */
  area?: AreaKey;
  level?: "view" | "edit";
  /** The add-on suite it is part of: hidden when the agency's plan does not have it (ADR 0011). */
  suite?: SuiteKey;
}

export interface NavGroup {
  key: string;
  title: string;
  icon: LucideIcon;
  items: NavItem[];
}

/** Always at the top of the side menu. */
export const NAV_TOP: NavItem[] = [
  { title: "Home", href: "/app", icon: Home },
  { title: "Genie Assistant", href: "/app/genie", icon: Sparkles, suite: "genie" },
];

/** The side menu's sections, each folding open; every page keeps its address. */
export const NAV_GROUPS: NavGroup[] = [
  {
    key: "clients",
    title: "Sales and clients",
    icon: Handshake,
    items: [
      { title: "Sales pipeline", href: "/app/sales", icon: Filter, area: "crm" },
      { title: "Clients", href: "/app/clients", icon: Building2, area: "clients" },
      { title: "Client requests", href: "/app/requests", icon: Inbox, area: "clients" },
      { title: "WhatsApp messages", href: "/app/messages", icon: MessageCircle, area: "clients" },
      { title: "Onboarding", href: "/app/onboarding", icon: ClipboardList, area: "onboarding" },
      { title: "Agreements", href: "/app/agreements", icon: FileSignature, area: "agreements" },
    ],
  },
  {
    key: "delivery",
    title: "Delivery",
    icon: Clapperboard,
    items: [
      { title: "Content", href: "/app/content", icon: Lightbulb, area: "content" },
      { title: "Production", href: "/app/production", icon: Clapperboard, area: "production" },
      { title: "Shoots", href: "/app/shoots", icon: Camera, area: "production" },
      { title: "Calendar", href: "/app/calendar", icon: CalendarDays, area: "production" },
      { title: "Publishing", href: "/app/publishing", icon: Megaphone, area: "publishing" },
      { title: "Monthly delivery", href: "/app/cycles", icon: Repeat, area: "production" },
      { title: "Monthly reports", href: "/app/reports", icon: FileBarChart, area: "reports" },
      { title: "Projects and tasks", href: "/app/projects", icon: FolderKanban, suite: "operations" },
      { title: "Equipment", href: "/app/assets", icon: Boxes, area: "equipment", suite: "operations" },
    ],
  },
  {
    key: "money",
    title: "Money",
    icon: Wallet,
    items: [
      { title: "Invoices", href: "/app/invoices", icon: ReceiptIndianRupee, area: "invoices" },
      { title: "Expenses", href: "/app/expenses", icon: Wallet, suite: "finance" },
      { title: "Costing", href: "/app/costing", icon: Calculator, area: "finance", suite: "finance" },
      { title: "Finance", href: "/app/finance", icon: Landmark, area: "finance", suite: "finance" },
    ],
  },
  {
    key: "people",
    title: "People",
    icon: Users,
    items: [
      { title: "People", href: "/app/people", icon: Contact, suite: "people" },
      { title: "Attendance", href: "/app/attendance", icon: Fingerprint, suite: "people" },
      { title: "Leave", href: "/app/leave", icon: CalendarOff, suite: "people" },
      { title: "Daily sheet", href: "/app/daily-sheet", icon: ClipboardList, suite: "people" },
      { title: "Hiring", href: "/app/hiring", icon: Briefcase, area: "hr", suite: "people" },
      { title: "Performance", href: "/app/performance", icon: Gauge, suite: "people" },
      { title: "Learning", href: "/app/learning", icon: GraduationCap, suite: "people" },
      { title: "Payroll", href: "/app/payroll", icon: Banknote, area: "salaries", suite: "people" },
      { title: "My payslips", href: "/app/payslips", icon: ReceiptText, suite: "people" },
      { title: "My financial planner", href: "/app/planner", icon: PiggyBank, area: "personal_finance", suite: "people" },
    ],
  },
  {
    key: "management",
    title: "Management",
    icon: Target,
    items: [
      { title: "Goals", href: "/app/goals", icon: Target, suite: "management" },
      { title: "Reviews", href: "/app/reviews", icon: CalendarCheck, suite: "management" },
      { title: "Round Table", href: "/app/round-table", icon: Users, suite: "management" },
      { title: "SOPs and checklists", href: "/app/sops", icon: ListChecks, suite: "management" },
      { title: "Business diagnostic", href: "/app/diagnostic", icon: Stethoscope, area: "reports", suite: "management" },
    ],
  },
];

/** Settings: one entry in the side menu, its own sections inside. */
export const SETTINGS_GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: "Your agency",
    items: [
      { title: "Plan", href: "/app/settings/plan", icon: Layers },
      { title: "Agency profile", href: "/app/settings/agency", icon: Landmark, area: "settings" },
      { title: "Packages", href: "/app/settings/packages", icon: Package },
      { title: "Team", href: "/app/settings/team", icon: Users, area: "team" },
      { title: "Roles and permissions", href: "/app/settings/roles", icon: ShieldCheck, area: "team" },
    ],
  },
  {
    title: "Sales and money",
    items: [
      { title: "Pipeline stages", href: "/app/settings/pipeline", icon: ListOrdered, area: "settings" },
      { title: "Invoice settings", href: "/app/settings/invoices", icon: Receipt, area: "invoices" },
      { title: "Payments", href: "/app/settings/payments", icon: CreditCard, area: "settings" },
      { title: "Costing", href: "/app/settings/costing", icon: Calculator, area: "finance", suite: "finance" },
    ],
  },
  {
    title: "Delivery",
    items: [
      { title: "Onboarding questions", href: "/app/settings/onboarding", icon: ListChecks, area: "onboarding" },
      { title: "Production", href: "/app/settings/production", icon: SlidersHorizontal, area: "production" },
    ],
  },
  {
    title: "Connections",
    items: [
      { title: "WhatsApp", href: "/app/settings/whatsapp", icon: MessageCircle, area: "settings" },
      { title: "Genie Assistant", href: "/app/settings/genie", icon: Sparkles, area: "settings", suite: "genie" },
    ],
  },
  {
    title: "Data and security",
    items: [
      { title: "Your data", href: "/app/settings/data", icon: DatabaseBackup, area: "settings" },
      { title: "Import from Excel", href: "/app/import", icon: FileSpreadsheet, area: "clients", level: "edit" },
      { title: "Audit log", href: "/app/audit", icon: History, area: "audit" },
      { title: "Support access", href: "/app/settings/support", icon: LifeBuoy, area: "settings" },
      { title: "Background jobs", href: "/app/settings/jobs", icon: Timer, area: "settings" },
    ],
  },
];

export const SETTINGS: NavItem = { title: "Settings", href: "/app/settings", icon: Settings };
export const HELP: NavItem = { title: "Help and support", href: "/app/help", icon: HelpCircle };

/** Pages reached from elsewhere: named in the top bar's trail and found by search. */
const OTHER_PAGES: { section?: string; item: NavItem }[] = [
  { section: "Help and support", item: { title: "Write to support", href: "/app/support", icon: LifeBuoy } },
  { item: { title: "Your account", href: "/app/account", icon: Contact } },
  { item: { title: "Notifications", href: "/app/notifications", icon: Inbox } },
  { item: { title: "Set-up wizard", href: "/app/setup", icon: ListChecks } },
  { item: { title: "Platform console", href: "/app/platform", icon: Building2 } },
];

export const isActive = (pathname: string, href: string) =>
  href === "/app" ? pathname === "/app" : pathname === href || pathname.startsWith(href + "/");

/** Settings in the side menu stays lit on every settings page, including import and the audit log. */
export const inSettings = (pathname: string) =>
  isActive(pathname, SETTINGS.href) || SETTINGS_GROUPS.some((g) => g.items.some((i) => isActive(pathname, i.href)));

/** Whether this person's role and the agency's plan show an entry. */
export function useNavVisible() {
  const can = useCan();
  const plan = useMe().data?.entitlements;
  return (i: NavItem) => (!i.area || can(i.area, i.level ?? "view")) && (!i.suite || !plan || plan.suites.includes(i.suite));
}

/** Every page with the section it sits in, for the trail and for search. */
export function allPages(): { section?: string; item: NavItem }[] {
  return [
    ...NAV_TOP.map((item) => ({ item })),
    ...NAV_GROUPS.flatMap((g) => g.items.map((item) => ({ section: g.title, item }))),
    { item: SETTINGS },
    ...SETTINGS_GROUPS.flatMap((g) => g.items.map((item) => ({ section: "Settings", item }))),
    { item: HELP },
    ...OTHER_PAGES,
  ];
}

/** The page this address belongs to (the longest matching address wins). */
export function pageFor(pathname: string) {
  let match: { section?: string; item: NavItem } | undefined;
  for (const p of allPages()) if (isActive(pathname, p.item.href) && (!match || p.item.href.length > match.item.href.length)) match = p;
  return match;
}
