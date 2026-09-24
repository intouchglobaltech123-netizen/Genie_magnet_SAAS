import type { LucideIcon } from "lucide-react";
import { Clapperboard, Megaphone, ServerCog, UserRoundCog } from "lucide-react";

export type SheetKind = "editor" | "smm" | "tech" | "hr";

export interface CounterDef {
  key: string;
  label: string;
  unit?: "h";
  step?: number;
  /** Counters that represent mistakes are highlighted when > 0. */
  bad?: boolean;
}

export interface SheetTemplate {
  kind: SheetKind;
  title: string;
  short: string;
  icon: LucideIcon;
  employeeSignLabel: string; // label on the paper form ("Editor", "SMM", "TS", "HR")
  paperSignatures: string[]; // order printed on the paper form
  counters: CounterDef[];
  taskPlaceholder: string;
}

export const templates: Record<SheetKind, SheetTemplate> = {
  editor: {
    kind: "editor",
    title: "Video Editing Data Sheet",
    short: "Video Editing",
    icon: Clapperboard,
    employeeSignLabel: "Editor",
    paperSignatures: ["Editor", "HR", "GM"],
    counters: [],
    taskPlaceholder: "Task (if not a video)",
  },
  smm: {
    kind: "smm",
    title: "Social Media Manager Data Sheet",
    short: "Social Media",
    icon: Megaphone,
    employeeSignLabel: "SMM",
    paperSignatures: ["SMM", "GM", "HR"],
    counters: [
      { key: "posts", label: "Posts done" },
      { key: "errors", label: "Errors", bad: true },
      { key: "shootHrs", label: "Hours of shoot", unit: "h", step: 0.5 },
      { key: "financeHrs", label: "Hours of finance", unit: "h", step: 0.5 },
      { key: "scripting", label: "Scripting done" },
      { key: "planning", label: "Content planning" },
      { key: "dms", label: "DMs replied" },
      { key: "comments", label: "Comments replied" },
      { key: "stories", label: "Stories posted" },
      { key: "otherApps", label: "Posts in other apps" },
    ],
    taskPlaceholder: "e.g. Schedule Navaratri reel",
  },
  tech: {
    kind: "tech",
    title: "Technical Supporter Data Sheet",
    short: "Technical Support",
    icon: ServerCog,
    employeeSignLabel: "TS",
    paperSignatures: ["TS", "GM", "HR"],
    counters: [
      { key: "errors", label: "Errors", bad: true },
      { key: "serverIssues", label: "Server issues", bad: true },
    ],
    taskPlaceholder: "e.g. NAS backup verification",
  },
  hr: {
    kind: "hr",
    title: "HR Data Sheet",
    short: "HR",
    icon: UserRoundCog,
    employeeSignLabel: "HR",
    paperSignatures: ["GM", "HR"],
    counters: [{ key: "errors", label: "Errors", bad: true }],
    taskPlaceholder: "e.g. Screen Video Editor applicants",
  },
};

export const sheetPeople: { personId: string; kind: SheetKind }[] = [
  { personId: "p-divya", kind: "editor" },
  { personId: "p-meena", kind: "smm" },
  { personId: "p-naveen", kind: "tech" },
  { personId: "p-harini", kind: "hr" },
];

export const kindFor = (personId: string): SheetKind => sheetPeople.find((p) => p.personId === personId)?.kind ?? "editor";

export const SHIFT_MINUTES = 8 * 60;
export const CUTOFF = "19:00";
export const GM_NAME = "Janarthanan";
export const HR_NAME = "Harini Selvam";
