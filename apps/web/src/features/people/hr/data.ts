import type { Person } from "@/lib/types";
import { classify, compositeFor, otherComposites, playerMeta, playerParams, scorecardTrend } from "../performance/data";

export const departments = [
  "All",
  "Management",
  "Sales & Marketing",
  "Production",
  "Post-Production",
  "Social Media",
  "HR & Admin",
  "Technology",
] as const;

/** Last 4 digits used for masked sensitive identifiers. */
const docSuffix: Record<string, { aadhaar: string; pan: string; bank: string; bankName: string }> = {
  "p-jana": { aadhaar: "1107", pan: "4K", bank: "0931", bankName: "Karur Vysya Bank" },
  "p-ashwin": { aadhaar: "5520", pan: "8M", bank: "2210", bankName: "Indian Bank" },
  "p-priya": { aadhaar: "7314", pan: "2P", bank: "6618", bankName: "HDFC Bank" },
  "p-karthik": { aadhaar: "4821", pan: "9Q", bank: "1044", bankName: "State Bank of India" },
  "p-vignesh": { aadhaar: "3390", pan: "6L", bank: "7752", bankName: "Canara Bank" },
  "p-divya": { aadhaar: "8016", pan: "3D", bank: "4409", bankName: "ICICI Bank" },
  "p-surya": { aadhaar: "2275", pan: "1S", bank: "8830", bankName: "City Union Bank" },
  "p-meena": { aadhaar: "6643", pan: "5R", bank: "3127", bankName: "Axis Bank" },
  "p-harini": { aadhaar: "9152", pan: "7H", bank: "5561", bankName: "Karur Vysya Bank" },
  "p-naveen": { aadhaar: "0478", pan: "2N", bank: "9904", bankName: "Indian Overseas Bank" },
};

export function documentsFor(p: Person) {
  const s = docSuffix[p.id] ?? { aadhaar: "6720", pan: "3F", bank: "1188", bankName: "State Bank of India" };
  const isEmployee = p.type === "employee";
  return [
    { key: "aadhaar", label: "Aadhaar card", value: `XXXX-XXXX-${s.aadhaar}`, verified: true, updated: p.joinedOn },
    { key: "pan", label: "PAN card", value: `XXXXX${s.aadhaar.slice(0, 2)}${s.pan}`, verified: true, updated: p.joinedOn },
    {
      key: "offer",
      label: isEmployee ? "Offer letter" : "Freelance agreement",
      value: isEmployee ? `GM/HR/OL/${p.joinedOn.slice(0, 4)}/${p.id.slice(2, 5).toUpperCase()}` : `GM/FL/${p.joinedOn.slice(0, 4)}/${p.id.slice(2, 5).toUpperCase()}`,
      verified: true,
      updated: p.joinedOn,
    },
    { key: "bank", label: "Bank details", value: `${s.bankName} · A/c XXXXXX${s.bank}`, verified: p.id !== "p-naveen", updated: p.joinedOn },
  ];
}

export interface TrainingItem {
  title: string;
  provider: string;
  status: "completed" | "in-progress" | "assigned";
  progress: number;
  due?: string;
}

const trainingByDept: Record<string, TrainingItem[]> = {
  "Post-Production": [
    { title: "Genie Magnet editing SOP v3 — 7-step flow", provider: "Internal LMS", status: "completed", progress: 100 },
    { title: "Colour grading fundamentals in DaVinci", provider: "LMS · Ajay Krishnan", status: "in-progress", progress: 60, due: "2026-10-15" },
    { title: "Reels hooks: first 3 seconds", provider: "Internal LMS", status: "assigned", progress: 0, due: "2026-10-30" },
  ],
  Production: [
    { title: "Dual-cam shoot kit checklist", provider: "Internal LMS", status: "completed", progress: 100 },
    { title: "Lighting for testimonials", provider: "YouTube playlist · curated", status: "in-progress", progress: 45, due: "2026-10-10" },
    { title: "Client on-set etiquette", provider: "Founder session", status: "completed", progress: 100 },
  ],
  "Social Media": [
    { title: "Meta Business Suite scheduling", provider: "Meta Blueprint", status: "completed", progress: 100 },
    { title: "Monthly client reporting template", provider: "Internal LMS", status: "in-progress", progress: 70, due: "2026-10-05" },
    { title: "Community management playbook", provider: "Internal LMS", status: "assigned", progress: 0, due: "2026-10-25" },
  ],
  default: [
    { title: "Agency OS onboarding", provider: "Internal LMS", status: "completed", progress: 100 },
    { title: "Company values & customer categories (A/B/C/D)", provider: "Founder session", status: "completed", progress: 100 },
    { title: "POSH awareness", provider: "External · 1 hour", status: "in-progress", progress: 50, due: "2026-10-20" },
  ],
};

export function trainingFor(p: Person): TrainingItem[] {
  return trainingByDept[p.department] ?? trainingByDept.default;
}

const perfNotes: Record<string, string> = {
  "p-jana": "Founder — not rated in KRA cycle.",
  "p-ashwin": "Consistent weekly reviews; delivery on-time rate 91%.",
  "p-priya": "Closed ₹4.2L in new retainers in Q3; proposal TAT 1.5 days.",
  "p-karthik": "Scripts approved first-pass 78%; strong team coaching.",
  "p-vignesh": "Kit checklist compliance 96%; usable-footage-first-time at 78% — lighting training assigned.",
  "p-divya": "QC first-pass 90%; running above 100% utilisation.",
  "p-surya": "Quality gate triggered — QC first-pass 72% this quarter, composite capped at 70.",
  "p-meena": "Client reports on time only 60% — right at the quality-gate threshold.",
  "p-harini": "Hiring TAT improved; payroll errors zero in Q3.",
  "p-naveen": "Ticket closure slow; currently on sick leave.",
};

export function performanceFor(p: Person) {
  const score = compositeFor(p.id);
  const params = playerParams[p.id];
  if (score == null || !params) {
    if (p.id === "p-jana") return { score: 0, rating: "—", trend: 0, note: perfNotes["p-jana"] };
    return { score: 78, rating: "Freelancer · Preferred", trend: 0, note: "Rated per assignment: on-time 90%, rework 8%." };
  }
  return {
    score: Math.round(score),
    rating: playerMeta[classify(params)].label,
    trend: scorecardTrend[p.id] ?? otherComposites[p.id]?.trend ?? 0,
    note: perfNotes[p.id] ?? "",
  };
}

export const accessSystems = ["Google Workspace", "Shared Drive", "LMS", "Hikvision attendance"];

export const probationMonths = 6;

export function addMonths(iso: string, months: number) {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}
