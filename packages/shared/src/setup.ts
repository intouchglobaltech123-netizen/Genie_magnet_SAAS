// Setting up a new workspace (P6-06): the set-up wizard — the agency questionnaire's essentials and what they make
// (packages, this year's goals, the suites worth having, the team) — and sample data to try things with, removed in
// one go.
import type { SuiteKey } from "./plans.js";

/** Sample data in the workspace: what was added, when and by whom. */
export interface SampleData {
  clients: number;
  leads: number;
  videos: number;
  addedAt: string;
  addedBy: { id: string; name: string | null };
}

/** DELETE /agency/setup/sample: what went, and the codes of sample clients kept because invoices were issued to them. */
export interface SampleRemoved {
  clients: number;
  leads: number;
  videos: number;
  kept: string[];
}

export interface SuiteAdvice {
  key: SuiteKey;
  why: string;
}

/** GET /agency/setup/wizard */
export interface SetupWizard {
  /** The agency questionnaire; null until it is started. Its required sections are the essentials. */
  questionnaire: { id: string; requiredDone: boolean } | null;
  /** Packages in the answers' packages table, and the agency's packages. */
  packages: { inAnswers: number; made: number };
  /** This year's revenue target from the answers, and the goals the agency has. */
  goals: { target: number | null; made: number };
  /** The suites worth having, from the answers. */
  suites: SuiteAdvice[];
  /** People in the answers' team table; people on the team now (the owner included); invitations waiting. */
  team: { inAnswers: number; onTeam: number; invited: number };
  sample: SampleData | null;
}

/** What the agency questionnaire's essentials say, as far as the suites go. */
export interface SuiteAnswers {
  services: string[];
  packages: { price: number | null; shootDays: number | null }[];
  team: number;
  goal: boolean;
}

/** The suites worth having, each with why, from the agency questionnaire's essentials. Advice only: the plan decides. */
export function recommendSuites(a: SuiteAnswers): SuiteAdvice[] {
  const out: SuiteAdvice[] = [];
  if (a.goal) out.push({ key: "management", why: "You set a main goal: goals, the revenue cascade and regular reviews keep the team on it." });
  if (a.team >= 3) out.push({ key: "people", why: `${a.team} people on the team: attendance, leave, payroll and reviews in one place.` });
  if (a.packages.some((p) => (p.price ?? 0) > 0))
    out.push({ key: "finance", why: "You sell packages for a monthly fee: true costing shows what each video and client really earns." });
  if (a.services.includes("Video production") || a.packages.some((p) => (p.shootDays ?? 0) > 0))
    out.push({ key: "operations", why: "You shoot videos: keep track of cameras and kit, and run shoots and launches as projects with tasks." });
  if (a.services.some((s) => s === "Social media management" || s === "Personal branding"))
    out.push({ key: "genie", why: "You write a lot of content: Genie Assistant drafts scripts, captions and messages for you to edit." });
  return out;
}
