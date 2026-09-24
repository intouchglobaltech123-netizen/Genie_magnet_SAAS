export const LMS = "https://lms.geniemagnet.in/course";

export interface Module {
  id: string;
  title: string;
  hours: number;
  slug: string;
}

export interface Path {
  id: string;
  role: string;
  description: string;
  owner: string;
  modules: Module[];
}

export const paths: Path[] = [
  {
    id: "path-editor",
    role: "Video Editor",
    description: "From rough cut to client-ready master, the Genie Magnet way.",
    owner: "Divya Lakshmi",
    modules: [
      { id: "ve-1", title: "GM editing SOP — 9 steps", hours: 2, slug: "gm-editing-sop" },
      { id: "ve-2", title: "Premiere Pro: reels workflow", hours: 4, slug: "premiere-reels-workflow" },
      { id: "ve-3", title: "DaVinci Resolve colour basics", hours: 5, slug: "davinci-colour-basics" },
      { id: "ve-4", title: "Motion text & Tamil captions", hours: 3, slug: "motion-text-tamil-captions" },
      { id: "ve-5", title: "Internal QC checklist", hours: 1, slug: "internal-qc-checklist" },
    ],
  },
  {
    id: "path-smm",
    role: "Social Media Manager",
    description: "Plan, publish and report for regional brands on Instagram and YouTube.",
    owner: "Meena Ravi",
    modules: [
      { id: "sm-1", title: "Content calendar planning", hours: 2, slug: "content-calendar-planning" },
      { id: "sm-2", title: "Instagram hooks that work in Tamil", hours: 3, slug: "instagram-hooks-tamil" },
      { id: "sm-3", title: "Meta Ads Manager — boosting reels", hours: 4, slug: "meta-ads-boosting" },
      { id: "sm-4", title: "Monthly client report", hours: 2, slug: "monthly-client-report" },
    ],
  },
  {
    id: "path-camera",
    role: "Camera",
    description: "Kit discipline, lighting and audio for single- and dual-cam shoots.",
    owner: "Vignesh Kumar",
    modules: [
      { id: "ca-1", title: "Kit checklist & VP backup", hours: 1, slug: "kit-checklist-vp-backup" },
      { id: "ca-2", title: "Three-point lighting on location", hours: 3, slug: "three-point-lighting" },
      { id: "ca-3", title: "Dual-camera interview setup", hours: 3, slug: "dual-camera-interviews" },
      { id: "ca-4", title: "Lav & shotgun audio", hours: 2, slug: "lav-shotgun-audio" },
      { id: "ca-5", title: "Drone safety & DGCA rules", hours: 2, slug: "drone-safety-dgca" },
    ],
  },
  {
    id: "path-sales",
    role: "Sales",
    description: "Discovery to signed agreement for recurring video retainers.",
    owner: "Priya Venkatesh",
    modules: [
      { id: "sa-1", title: "Discovery call framework", hours: 2, slug: "discovery-call-framework" },
      { id: "sa-2", title: "Packaging & pricing retainers", hours: 2, slug: "packaging-pricing-retainers" },
      { id: "sa-3", title: "Handling discount requests", hours: 1, slug: "handling-discounts" },
      { id: "sa-4", title: "CRM hygiene & follow-ups", hours: 1, slug: "crm-hygiene" },
    ],
  },
  {
    id: "path-hr",
    role: "HR",
    description: "Hiring, onboarding, attendance and payroll compliance in Tamil Nadu.",
    owner: "Harini Selvam",
    modules: [
      { id: "hr-1", title: "Structured hiring & scorecards", hours: 2, slug: "structured-hiring" },
      { id: "hr-2", title: "Onboarding week-one plan", hours: 1, slug: "onboarding-week-one" },
      { id: "hr-3", title: "Attendance, leave & LOP rules", hours: 2, slug: "attendance-leave-lop" },
      { id: "hr-4", title: "PF, ESI & professional tax basics", hours: 3, slug: "pf-esi-pt-basics" },
    ],
  },
];

export type AssignStatus = "Not started" | "In progress" | "Completed" | "Overdue";

export interface Assignment {
  id: string;
  personId: string;
  moduleId: string;
  assignedOn: string;
  due: string;
  progress: number; // 0..100
  status: AssignStatus;
}

export const assignments: Assignment[] = [
  { id: "as-1", personId: "p-surya", moduleId: "ve-3", assignedOn: "2026-09-01", due: "2026-09-20", progress: 40, status: "Overdue" },
  { id: "as-2", personId: "p-surya", moduleId: "ve-4", assignedOn: "2026-09-10", due: "2026-10-05", progress: 15, status: "In progress" },
  { id: "as-3", personId: "p-divya", moduleId: "ve-3", assignedOn: "2026-08-20", due: "2026-09-15", progress: 100, status: "Completed" },
  { id: "as-4", personId: "f-rahul", moduleId: "ve-1", assignedOn: "2026-09-18", due: "2026-09-30", progress: 0, status: "Not started" },
  { id: "as-5", personId: "p-meena", moduleId: "sm-3", assignedOn: "2026-09-05", due: "2026-09-28", progress: 65, status: "In progress" },
  { id: "as-6", personId: "p-vignesh", moduleId: "ca-5", assignedOn: "2026-09-02", due: "2026-09-22", progress: 50, status: "Overdue" },
  { id: "as-7", personId: "p-vignesh", moduleId: "ca-4", assignedOn: "2026-08-12", due: "2026-08-31", progress: 100, status: "Completed" },
  { id: "as-8", personId: "p-priya", moduleId: "sa-3", assignedOn: "2026-09-20", due: "2026-10-03", progress: 0, status: "Not started" },
  { id: "as-9", personId: "p-harini", moduleId: "hr-4", assignedOn: "2026-09-08", due: "2026-10-10", progress: 30, status: "In progress" },
  { id: "as-10", personId: "p-naveen", moduleId: "ve-1", assignedOn: "2026-09-15", due: "2026-10-15", progress: 10, status: "In progress" },
  { id: "as-11", personId: "p-karthik", moduleId: "ca-3", assignedOn: "2026-08-25", due: "2026-09-10", progress: 100, status: "Completed" },
  { id: "as-12", personId: "f-lavanya", moduleId: "sm-2", assignedOn: "2026-09-12", due: "2026-09-26", progress: 80, status: "In progress" },
];

export const SKILLS = [
  "Premiere Pro",
  "DaVinci colour",
  "Motion text",
  "Scripting",
  "Cinematography",
  "Lighting",
  "Instagram strategy",
  "Meta Ads",
  "Client handling",
  "Storage/IT",
] as const;

export type Skill = (typeof SKILLS)[number];

/** Scores 1–5 per person, in SKILLS order. */
export const skillMatrix: Record<string, number[]> = {
  "p-jana": [2, 1, 1, 5, 3, 2, 4, 3, 5, 1],
  "p-ashwin": [2, 1, 1, 3, 2, 2, 3, 2, 5, 2],
  "p-karthik": [3, 2, 2, 5, 4, 4, 3, 1, 4, 1],
  "p-vignesh": [2, 2, 1, 2, 5, 5, 1, 1, 2, 3],
  "p-divya": [5, 4, 5, 2, 2, 2, 2, 1, 3, 2],
  "p-surya": [4, 2, 3, 2, 2, 1, 2, 1, 2, 2],
  "p-meena": [2, 1, 2, 3, 1, 1, 5, 4, 4, 1],
  "p-priya": [1, 1, 1, 3, 1, 1, 4, 5, 5, 1],
  "p-harini": [1, 1, 1, 2, 1, 1, 2, 1, 3, 2],
  "p-naveen": [2, 1, 1, 1, 1, 1, 1, 1, 2, 5],
  "f-rahul": [5, 3, 3, 2, 2, 2, 1, 1, 2, 2],
  "f-ajay": [3, 5, 2, 1, 3, 3, 1, 1, 2, 2],
};

export const scoreLabel = ["", "Aware", "Learning", "Independent", "Strong", "Can teach"];
