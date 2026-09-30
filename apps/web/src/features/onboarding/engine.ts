// Onboarding engine rules: visibility, progress, the 7-day window and scoring.
import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { TODAY } from "@/lib/mock/core";
import type { Answer, Answers, Question, QuestionnaireTemplate, Section, SectionWhen, TableValue } from "./templates";

export const REMINDER_DAYS = [2, 5];

export function isAnswered(q: Question, a: Answer | undefined): boolean {
  if (a === undefined) return false;
  if (typeof a === "string") return a.trim().length > 0;
  if (q.type === "table") {
    return (a as TableValue).some((row) => Object.entries(row).some(([k, v]) => k !== "row" && String(v ?? "").trim().length > 0));
  }
  return (a as string[]).length > 0;
}

export function visibleQuestions(section: Section, answers: Answers): Question[] {
  return section.questions.filter((q) => {
    if (!q.showIf) return true;
    const dep = answers[q.showIf.q];
    return Array.isArray(dep) ? (dep as unknown[]).includes(q.showIf.includes) : dep === q.showIf.includes;
  });
}

export interface SectionProgress {
  section: Section;
  answered: number;
  total: number;
  complete: boolean;
}

export function sectionProgress(section: Section, answers: Answers): SectionProgress {
  const qs = visibleQuestions(section, answers);
  const answered = qs.filter((q) => isAnswered(q, answers[q.id])).length;
  return { section, answered, total: qs.length, complete: answered === qs.length };
}

export interface GroupProgress {
  sections: SectionProgress[];
  answered: number;
  total: number;
  done: number;
  complete: boolean;
}

function group(list: SectionProgress[]): GroupProgress {
  const answered = list.reduce((s, p) => s + p.answered, 0);
  const total = list.reduce((s, p) => s + p.total, 0);
  const done = list.filter((p) => p.complete).length;
  return { sections: list, answered, total, done, complete: done === list.length };
}

export function progress(template: QuestionnaireTemplate, answers: Answers) {
  const all = template.sections.map((s) => sectionProgress(s, answers));
  return {
    all,
    required: group(all.filter((p) => p.section.when === "required")),
    later: group(all.filter((p) => p.section.when === "7days")),
  };
}

/** Applies the agency's Settings choices (which sections are required) to a template. */
export function withOverrides(template: QuestionnaireTemplate, overrides: Record<string, SectionWhen>): QuestionnaireTemplate {
  return {
    ...template,
    sections: template.sections.map((s) => ({ ...s, when: overrides[`${template.id}:${s.id}`] ?? s.when })),
  };
}

export type WindowState = "not-sent" | "on-track" | "due-soon" | "overdue" | "complete";

/** Where a respondent is in the "complete within N days" window. */
export function windowState(sentOn: string | undefined, laterComplete: boolean, windowDays: number) {
  if (!sentOn) return { state: "not-sent" as WindowState, day: 0, dueOn: undefined as string | undefined, label: "Not sent yet" };
  const day = differenceInCalendarDays(parseISO(TODAY), parseISO(sentOn));
  const due = new Date(parseISO(sentOn).getTime() + windowDays * 864e5);
  const dueOn = format(due, "d MMM");
  if (laterComplete) return { state: "complete" as WindowState, day, dueOn, label: "All sections answered" };
  if (day > windowDays) return { state: "overdue" as WindowState, day, dueOn, label: `Overdue since ${dueOn} · flagged` };
  if (windowDays - day <= 1) return { state: "due-soon" as WindowState, day, dueOn, label: `Day ${day} of ${windowDays} · due ${dueOn}` };
  return { state: "on-track" as WindowState, day, dueOn, label: `Day ${day} of ${windowDays} · due ${dueOn}` };
}

export const fmtDay = (iso: string) => format(parseISO(iso), "d MMM");

// ───────────────────────────── Scoring (agency) ─────────────────────────────

export type Quadrant = "Amazing" | "Bread-winning" | "Convenience" | "Dangerous";

export function quadrantFor(effort: string | undefined, ret: string | undefined): Quadrant | undefined {
  if (!effort || !ret) return undefined;
  if (effort === "Low" && ret === "High") return "Amazing";
  if (effort === "High" && ret === "High") return "Bread-winning";
  if (effort === "Low" && ret === "Low") return "Convenience";
  return "Dangerous";
}

/** BFA: one point each for consistency, not owner-dependent, high results and a second-line leader. */
export function bfaScores(rows: TableValue | undefined) {
  const list = (rows ?? []).map((r) => {
    const filled = ["consistent", "owner", "results", "leader"].filter((k) => r[k]).length;
    const score = (r.consistent === "Yes" ? 1 : 0) + (r.owner === "No" ? 1 : 0) + (r.results === "High" ? 1 : 0) + (r.leader === "Yes" ? 1 : 0);
    return { fn: r.row, score, filled: filled === 4, ownerDependent: r.owner === "Yes", action: r.action };
  });
  const answered = list.filter((r) => r.filled);
  const founderDependency = answered.length ? answered.filter((r) => r.ownerDependent).length / answered.length : 0;
  const overall = answered.length ? answered.reduce((s, r) => s + r.score, 0) / (answered.length * 4) : 0;
  return { list, answered: answered.length, founderDependency, overall };
}
