// The onboarding engine (P1-21 to P1-25): each agency's questions, how answers are checked, progress, the checklist,
// the gate that lets production start, reminders, and what the answers fill in. Everything here is shared by the API
// (which enforces it) and the web app (which shows the same rules while people type).
import { z } from "zod";
import { BUSINESS_STAGES, QUESTION_TYPES, type QuestionType, SECTION_WHEN } from "./enums.js";
import { GROWTH_OS_AGENCY_SET, GROWTH_OS_CLIENT_SET, type GrowthOsSet } from "./onboarding-sets.js";
import { LANGUAGE_CODES } from "./schemas.js";

export const QUESTIONNAIRE_KINDS = ["client", "agency"] as const;
export type QuestionnaireKind = (typeof QUESTIONNAIRE_KINDS)[number];

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  text: "Short answer",
  long: "Long answer",
  number: "Number",
  currency: "Amount (₹)",
  choice: "One choice",
  multi: "Several choices",
  yesno: "Yes or no",
  rating: "Rating 1–5",
  table: "Table",
  file: "Files (links for now)",
};

/** Fields an answer can fill in (answer-to-field mapping). Only answers of a matching type can fill each one. */
export const MAPPABLE_FIELDS = [
  { key: "client.stage", label: "Client profile → business stage", target: "client", types: ["choice"], options: BUSINESS_STAGES },
  { key: "client.industry", label: "Client profile → industry", target: "client", types: ["text"] },
  { key: "client.city", label: "Client profile → city", target: "client", types: ["text"] },
  { key: "client.legalName", label: "Client billing → name on invoices", target: "client", types: ["text"] },
  { key: "client.gstin", label: "Client billing → GSTIN", target: "client", types: ["text"] },
  { key: "client.billingAddress", label: "Client billing → address", target: "client", types: ["text", "long"] },
  { key: "agency.businessStage", label: "Agency profile → business stage", target: "agency", types: ["choice"], options: BUSINESS_STAGES },
  { key: "agency.city", label: "Agency profile → city", target: "agency", types: ["text"] },
  { key: "agency.website", label: "Agency profile → website", target: "agency", types: ["text"] },
] as const satisfies readonly { key: string; label: string; target: QuestionnaireKind; types: readonly QuestionType[]; options?: readonly string[] }[];
export type MappableField = (typeof MAPPABLE_FIELDS)[number]["key"];
const MAPPABLE_KEYS = MAPPABLE_FIELDS.map((f) => f.key) as [MappableField, ...MappableField[]];

/** Blocks of the Business Canvas a client's answers are drafted into (P1-25). */
export const CANVAS_BLOCKS = [
  { key: "segments", label: "Customer segments" },
  { key: "value", label: "Value propositions" },
  { key: "channels", label: "Channels" },
  { key: "relationships", label: "Customer relationships" },
  { key: "revenue", label: "Revenue streams" },
  { key: "competition", label: "Competition and positioning" },
  { key: "opportunities", label: "Growth opportunities" },
] as const;
export type CanvasBlock = (typeof CANVAS_BLOCKS)[number]["key"];
const CANVAS_KEYS = CANVAS_BLOCKS.map((b) => b.key) as [CanvasBlock, ...CanvasBlock[]];

// ─── The question format ──────────────────────────────────────────────

const key = z.string().regex(/^[a-z0-9_]+$/, "Lower-case letters, digits and _ only");
const text = (max: number) => z.string().trim().max(max, `Keep it under ${max} characters`);

export const tableColumn = z.object({
  key: z.string().regex(/^[A-Za-z0-9_]+$/, "Letters, digits and _ only"),
  label: text(60).min(1, "Name the column"),
  type: z.enum(["text", "number", "currency", "select"]).default("text"),
  options: z.array(text(60).min(1)).max(20).optional(),
  placeholder: text(80).optional(),
});
export type TableColumn = z.infer<typeof tableColumn>;

const translation = z.object({
  label: text(300).optional(),
  help: text(500).optional(),
  placeholder: text(120).optional(),
  /** In the same order as the question's options. */
  options: z.array(text(120)).optional(),
});
export type QuestionTranslation = z.infer<typeof translation>;

export const questionSchema = z.object({
  key,
  label: text(300).min(3, "Write the question (at least 3 characters)"),
  help: text(500).optional(),
  placeholder: text(120).optional(),
  type: z.enum(QUESTION_TYPES),
  options: z.array(text(120).min(1)).max(30).optional(),
  /** A short explanation shown under an option. */
  optionHelp: z.record(z.string(), text(200)).optional(),
  /** Most choices allowed (several choices). */
  max: z.number().int().min(1).max(30).optional(),
  columns: z.array(tableColumn).max(10).optional(),
  /** Rows that are always there (e.g. the seven business functions). */
  fixedRows: z.array(text(80).min(1)).max(20).optional(),
  /** Can be left empty without holding up completion. */
  optional: z.boolean().optional(),
  /** What the answer is used for, shown to the agency (never to the client). */
  feeds: text(200).optional(),
  /** A field the answer fills in. */
  mapsTo: z.enum(MAPPABLE_KEYS).optional(),
  /** The Business Canvas block the answer is drafted into. */
  canvas: z.enum(CANVAS_KEYS).optional(),
  /** Shown only when an earlier choice question's answer includes this option. */
  showIf: z.object({ key, includes: z.string().min(1) }).optional(),
  /** By language code, e.g. { ta: { label: "…" } }. */
  translations: z.partialRecord(z.enum(LANGUAGE_CODES), translation).optional(),
});
export type Question = z.infer<typeof questionSchema>;

export const sectionSchema = z.object({
  key,
  title: text(120).min(2, "Name the section"),
  intro: text(500).optional(),
  /** What the agency builds from it (shown to the agency). */
  builds: text(200).optional(),
  /** Needed before work starts, or within the agency's window (default 7 days). */
  when: z.enum(SECTION_WHEN),
  questions: z.array(questionSchema).min(1, "A section needs at least one question").max(40),
  translations: z.partialRecord(z.enum(LANGUAGE_CODES), z.object({ title: text(120).optional(), intro: text(500).optional() })).optional(),
});
export type Section = z.infer<typeof sectionSchema>;

/** How a checklist item ticks: by hand, or by itself from an answer, a whole section, a signed agreement or an approver. */
export const checklistTick = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("manual") }),
  z.object({ kind: z.literal("answer"), key }),
  z.object({ kind: z.literal("section"), key }),
  z.object({ kind: z.literal("agreement") }),
  z.object({ kind: z.literal("approver") }),
]);
export type ChecklistTick = z.infer<typeof checklistTick>;

export const checklistItem = z.object({
  key,
  label: text(120).min(2, "Name the item"),
  detail: text(300).optional(),
  /** Mandatory items must be done before the gate opens. */
  mandatory: z.boolean(),
  tick: checklistTick,
});
export type ChecklistItem = z.infer<typeof checklistItem>;

/** One version of a questionnaire. */
export const questionnaireDefinition = z
  .object({
    name: text(120).min(2),
    audience: text(300).optional(),
    sections: z.array(sectionSchema).min(1, "Keep at least one section").max(30),
    /** Client onboarding only: what has to be done before production starts. */
    checklist: z.array(checklistItem).max(40).default([]),
  })
  .superRefine((d, ctx) => {
    const seen = new Map<string, Question>();
    const sectionKeys = new Set<string>();
    d.sections.forEach((s, si) => {
      if (sectionKeys.has(s.key)) ctx.addIssue({ code: "custom", path: ["sections", si, "key"], message: "Two sections have this key" });
      sectionKeys.add(s.key);
      s.questions.forEach((q, qi) => {
        const path = ["sections", si, "questions", qi];
        if (seen.has(q.key)) ctx.addIssue({ code: "custom", path: [...path, "key"], message: "Two questions have this key" });
        if ((q.type === "choice" || q.type === "multi") && (q.options?.length ?? 0) < 2)
          ctx.addIssue({ code: "custom", path: [...path, "options"], message: "Give at least two options" });
        if (q.type === "table" && !q.columns?.length)
          ctx.addIssue({ code: "custom", path: [...path, "columns"], message: "Give the table at least one column" });
        if (q.mapsTo) {
          const field = MAPPABLE_FIELDS.find((f) => f.key === q.mapsTo)!;
          if (!(field.types as readonly string[]).includes(q.type))
            ctx.addIssue({
              code: "custom",
              path: [...path, "mapsTo"],
              message: `Only a ${field.types.map((t) => QUESTION_TYPE_LABELS[t].toLowerCase()).join(" or ")} can fill this`,
            });
        }
        if (q.showIf) {
          const on = seen.get(q.showIf.key);
          if (!on || (on.type !== "choice" && on.type !== "multi") || !on.options?.includes(q.showIf.includes))
            ctx.addIssue({ code: "custom", path: [...path, "showIf"], message: "Show it after an earlier choice question, on one of its options" });
        }
        seen.set(q.key, q);
      });
    });
    d.checklist.forEach((c, ci) => {
      if (c.tick.kind === "answer" && !seen.has(c.tick.key))
        ctx.addIssue({ code: "custom", path: ["checklist", ci, "tick"], message: "That question is not in the questionnaire" });
      if (c.tick.kind === "section" && !sectionKeys.has(c.tick.key))
        ctx.addIssue({ code: "custom", path: ["checklist", ci, "tick"], message: "That section is not in the questionnaire" });
    });
  });
export type QuestionnaireDefinition = z.output<typeof questionnaireDefinition>;

// ─── Growth OS starting sets ──────────────────────────────────────────

/** Answers that fill a field, and Business Canvas blocks, for the Growth OS questions. */
const MAPS: Record<string, MappableField> = { c6: "client.stage", a2: "agency.businessStage" };
const CANVAS: Record<string, CanvasBlock> = {
  c7: "segments",
  c8: "segments",
  c9: "segments",
  c10: "segments",
  c11: "segments",
  c12: "opportunities",
  c13: "value",
  c14: "value",
  c15: "relationships",
  c16: "relationships",
  c17: "opportunities",
  c18: "revenue",
  c19: "competition",
  c20: "competition",
  c22: "channels",
  c23: "channels",
  c25: "channels",
};

function fromGrowthOs(set: GrowthOsSet, checklist: ChecklistItem[]): QuestionnaireDefinition {
  return {
    name: set.name,
    audience: set.audience,
    sections: set.sections.map((s) => ({
      key: s.id,
      title: s.title,
      intro: s.intro,
      builds: s.builds,
      when: s.when === "required" ? "required" : "within-window",
      questions: s.questions.map((q) => ({
        key: q.id,
        label: q.label,
        ...(q.help && { help: q.help }),
        ...(q.placeholder && { placeholder: q.placeholder }),
        type: q.type,
        ...(q.options && { options: [...q.options] }),
        ...(q.optionHelp && { optionHelp: q.optionHelp }),
        ...(q.max && { max: q.max }),
        ...(q.columns && { columns: q.columns.map((c) => ({ ...c, type: c.type ?? "text" })) }),
        ...(q.fixedRows && { fixedRows: [...q.fixedRows] }),
        feeds: q.maps,
        ...(MAPS[q.id] && { mapsTo: MAPS[q.id] }),
        ...(CANVAS[q.id] && { canvas: CANVAS[q.id] }),
        ...(q.showIf && { showIf: { key: q.showIf.q, includes: q.showIf.includes } }),
      })),
    })),
    checklist,
  };
}

/** What has to be done for a new client before production starts (Growth OS default, editable). */
export const DEFAULT_CLIENT_CHECKLIST: ChecklistItem[] = [
  { key: "agreement", label: "Agreement signed", mandatory: true, tick: { kind: "agreement" } },
  { key: "contacts", label: "Client contacts captured", mandatory: true, tick: { kind: "answer", key: "c2" } },
  { key: "brand", label: "Brand assets received", mandatory: true, tick: { kind: "answer", key: "c29" } },
  { key: "social", label: "Social media access", mandatory: false, tick: { kind: "answer", key: "c31" } },
  { key: "brief", label: "Creative brief completed", detail: "The goals section, answered.", mandatory: true, tick: { kind: "section", key: "goals" } },
  { key: "deliverables", label: "Deliverables confirmed", detail: "The client has agreed what is made each month.", mandatory: true, tick: { kind: "manual" } },
  { key: "approver", label: "Approval authority named", mandatory: true, tick: { kind: "approver" } },
  { key: "channel", label: "Communication channel set", detail: "A WhatsApp group with the client.", mandatory: false, tick: { kind: "manual" } },
  { key: "billing", label: "Billing information", mandatory: true, tick: { kind: "answer", key: "c33" } },
  { key: "files", label: "Required files uploaded", mandatory: false, tick: { kind: "manual" } },
];

export const DEFAULT_QUESTIONNAIRES: Record<QuestionnaireKind, QuestionnaireDefinition> = {
  client: fromGrowthOs(GROWTH_OS_CLIENT_SET, DEFAULT_CLIENT_CHECKLIST),
  agency: fromGrowthOs(GROWTH_OS_AGENCY_SET, []),
};

// ─── Answers ──────────────────────────────────────────────────────────

/** A text answer, a list of choices, or table rows (fixed rows carry their label in `row`). */
export type AnswerValue = string | string[] | Record<string, string>[];
export type Answers = Record<string, AnswerValue>;

export const answerInput = z.object({
  value: z.union([z.string().max(10_000), z.array(z.string().max(500)).max(50), z.array(z.record(z.string(), z.string().max(1000))).max(100)]),
});

/** Is there an answer worth keeping (a table counts once one of its cells is filled in)? */
export function isAnswered(value: AnswerValue | undefined | null): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (!value.length) return false;
  if (typeof value[0] === "string") return true;
  return (value as Record<string, string>[]).some((r) => Object.entries(r).some(([k, v]) => k !== "row" && v.trim()));
}

/**
 * Checks an answer against its question and returns it cleaned up, or the problem in plain words. An empty answer
 * comes back as `null` (the answer is cleared).
 */
export function checkAnswer(q: Question, value: AnswerValue): { value: AnswerValue | null; error?: undefined } | { error: string; value?: undefined } {
  if (!isAnswered(value)) return { value: null };
  const one = (v: AnswerValue) => (typeof v === "string" ? v.trim() : null);
  switch (q.type) {
    case "text":
    case "long":
    case "file": {
      const s = one(value);
      if (s === null) return { error: "Expected text" };
      if (q.type === "text" && s.length > 500) return { error: "Keep it under 500 characters" };
      return { value: s };
    }
    case "number": {
      const s = one(value)?.replace(/,/g, "");
      if (!s || !/^-?\d+(\.\d+)?$/.test(s)) return { error: "Enter a number" };
      return { value: s };
    }
    case "currency": {
      const s = one(value)?.replace(/[₹,\s]/g, "");
      if (!s || !/^\d+$/.test(s)) return { error: "Enter an amount in whole rupees" };
      return { value: s };
    }
    case "yesno": {
      const s = one(value);
      return s === "Yes" || s === "No" ? { value: s } : { error: "Answer yes or no" };
    }
    case "rating": {
      const s = one(value);
      return s && /^[1-5]$/.test(s) ? { value: s } : { error: "Choose from 1 to 5" };
    }
    case "choice": {
      const s = one(value);
      return s && q.options?.includes(s) ? { value: s } : { error: "Choose one of the options" };
    }
    case "multi": {
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string")) return { error: "Choose from the options" };
      const picked = [...new Set(value as string[])];
      if (picked.some((v) => !q.options?.includes(v))) return { error: "Choose from the options" };
      if (q.max && picked.length > q.max) return { error: `Choose at most ${q.max}` };
      return { value: picked };
    }
    case "table": {
      if (!Array.isArray(value) || value.some((r) => typeof r !== "object")) return { error: "Expected table rows" };
      const cols = new Map((q.columns ?? []).map((c) => [c.key, c]));
      const rows: Record<string, string>[] = [];
      for (const [i, raw] of (value as Record<string, string>[]).entries()) {
        const row: Record<string, string> = {};
        if (q.fixedRows) {
          if (!q.fixedRows.includes(raw.row ?? "")) return { error: `Row ${i + 1} is not one of the table's rows` };
          row.row = raw.row!;
        }
        for (const [k, v] of Object.entries(raw)) {
          if (k === "row") continue;
          const col = cols.get(k);
          if (!col) return { error: `Row ${i + 1} has a column the table does not have` };
          const cell = String(v).trim();
          if (!cell) continue;
          if (col.type === "number" && !/^-?\d+(\.\d+)?$/.test(cell.replace(/,/g, ""))) return { error: `${col.label}, row ${i + 1}: enter a number` };
          if (col.type === "currency" && !/^\d+$/.test(cell.replace(/[₹,\s]/g, ""))) return { error: `${col.label}, row ${i + 1}: enter an amount in rupees` };
          if (col.type === "select" && col.options && !col.options.includes(cell)) return { error: `${col.label}, row ${i + 1}: choose one of the options` };
          row[k] = col.type === "currency" ? cell.replace(/[₹,\s]/g, "") : col.type === "number" ? cell.replace(/,/g, "") : cell;
        }
        if (q.fixedRows || Object.keys(row).length) rows.push(row);
      }
      return isAnswered(rows) ? { value: rows } : { value: null };
    }
  }
}

// ─── Progress, checklist and gate ─────────────────────────────────────

/** The questions a person sees, given the answers so far (branching). */
export function visibleQuestions(section: Section, answers: Answers) {
  return section.questions.filter((q) => {
    if (!q.showIf) return true;
    const a = answers[q.showIf.key];
    return Array.isArray(a) ? (a as string[]).includes(q.showIf.includes) : a === q.showIf.includes;
  });
}

export interface PartProgress {
  answered: number;
  total: number;
  complete: boolean;
}

export interface Progress {
  required: PartProgress;
  window: PartProgress;
  sections: (PartProgress & { key: string; when: Section["when"] })[];
  /** Every question that counts is answered. */
  complete: boolean;
  /** The first unanswered question, where the link opens. */
  next: { section: string; question: string } | null;
}

/** What is answered: optional questions and questions hidden by branching never count. */
export function progressOf(d: Pick<QuestionnaireDefinition, "sections">, answers: Answers): Progress {
  const part = () => ({ answered: 0, total: 0, complete: true });
  const required = part();
  const window = part();
  let next: Progress["next"] = null;
  const sections = d.sections.map((s) => {
    const counted = visibleQuestions(s, answers).filter((q) => !q.optional);
    const answered = counted.filter((q) => isAnswered(answers[q.key])).length;
    const sum = s.when === "required" ? required : window;
    sum.answered += answered;
    sum.total += counted.length;
    if (!next) {
      const open = visibleQuestions(s, answers).find((q) => !isAnswered(answers[q.key]));
      if (open && (s.when === "required" || required.answered === required.total)) next = { section: s.key, question: open.key };
    }
    return { key: s.key, when: s.when, answered, total: counted.length, complete: answered === counted.length };
  });
  required.complete = required.answered === required.total;
  window.complete = window.answered === window.total;
  if (!next) {
    // Every required question is answered; the first open within-window question, if any.
    for (const s of d.sections) {
      const open = visibleQuestions(s, answers).find((q) => !isAnswered(answers[q.key]));
      if (open) {
        next = { section: s.key, question: open.key };
        break;
      }
    }
  }
  return { required, window, sections, complete: required.complete && window.complete, next };
}

export interface ChecklistState extends ChecklistItem {
  done: boolean;
  /** Ticked by itself (from an answer, a section, the agreement or an approver), not by hand. */
  auto: boolean;
  at?: string;
  by?: string | null;
}

/** Where each checklist item stands, given the answers, the hand ticks and the client's records. */
export function checklistOf(
  d: Pick<QuestionnaireDefinition, "sections" | "checklist">,
  answers: Answers,
  manual: Record<string, { at: string; by: string | null }>,
  facts: { agreement: boolean; approver: boolean },
): ChecklistState[] {
  const progress = progressOf(d, answers);
  return d.checklist.map((item) => {
    const t = item.tick;
    if (t.kind === "manual") return { ...item, auto: false, done: !!manual[item.key], at: manual[item.key]?.at, by: manual[item.key]?.by ?? null };
    const done =
      t.kind === "answer"
        ? isAnswered(answers[t.key])
        : t.kind === "section"
          ? !!progress.sections.find((s) => s.key === t.key)?.complete
          : t.kind === "agreement"
            ? facts.agreement
            : facts.approver;
    return { ...item, auto: true, done };
  });
}

/** The gate opens when the required sections and the mandatory checklist items are done, or by an approved exception. */
export function gateOf(progress: Progress, checklist: ChecklistState[], exception: boolean) {
  const missing = [
    ...(progress.required.complete ? [] : [`${progress.required.total - progress.required.answered} required answers`]),
    ...checklist.filter((c) => c.mandatory && !c.done).map((c) => c.label),
  ];
  return { open: !missing.length || exception, byException: exception && missing.length > 0, missing };
}

// ─── The window and reminders ─────────────────────────────────────────

const DAY = 86_400_000;
const dayOf = (iso: string) => Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));

export type WindowState = "not_sent" | "on_track" | "due_soon" | "overdue" | "complete";

/**
 * The window runs from the day the link was shared (day 1) for the agency's number of days. Due soon in its last two
 * days; overdue (flagged) after it while within-window answers are still open.
 */
export function windowOf(sentAt: string | null, windowDays: number, complete: boolean, today: string) {
  if (complete) return { state: "complete" as WindowState, day: null, dueOn: null };
  if (!sentAt) return { state: "not_sent" as WindowState, day: null, dueOn: null };
  const start = dayOf(sentAt.slice(0, 10));
  const day = Math.floor((dayOf(today) - start) / DAY) + 1;
  const dueOn = new Date(start + (windowDays - 1) * DAY).toISOString().slice(0, 10);
  const state: WindowState = day > windowDays ? "overdue" : day >= windowDays - 1 ? "due_soon" : "on_track";
  return { state, day, dueOn };
}

/** Reminder days that have come and are not sent yet; none once complete. */
export function dueReminders(reminderDays: number[], day: number | null, sent: number[], complete: boolean) {
  if (complete || day === null) return [];
  return reminderDays.filter((d) => d <= day && !sent.includes(d));
}

// ─── Languages ────────────────────────────────────────────────────────

/** The questionnaire as the client sees it in `lang`: translated where a translation exists, English otherwise. */
export function translated(d: Pick<QuestionnaireDefinition, "sections">, lang: string): Section[] {
  if (lang === "en") return d.sections;
  return d.sections.map((s) => {
    const st = s.translations?.[lang as keyof NonNullable<Section["translations"]>];
    return {
      ...s,
      title: st?.title || s.title,
      intro: st?.intro || s.intro,
      questions: s.questions.map((q) => {
        const t = q.translations?.[lang as keyof NonNullable<Question["translations"]>];
        return t ? { ...q, label: t.label || q.label, help: t.help || q.help, placeholder: t.placeholder || q.placeholder } : q;
      }),
    };
  });
}

/** Option labels in `lang`, in the same order as the options (answers always store the original option). */
export function optionLabels(q: Question, lang: string) {
  const t = q.translations?.[lang as keyof NonNullable<Question["translations"]>]?.options;
  return (q.options ?? []).map((o, i) => (t?.[i] ? t[i]! : o));
}

/** Languages with at least one translated question, plus English. */
export function languagesOf(d: Pick<QuestionnaireDefinition, "sections">) {
  const langs = new Set<string>(["en"]);
  for (const s of d.sections) for (const q of s.questions) for (const l of Object.keys(q.translations ?? {})) langs.add(l);
  return [...langs];
}

// ─── API inputs ───────────────────────────────────────────────────────

export const startOnboardingInput = z.object({ mode: z.enum(["link", "assisted"]).optional() });
export const onboardingUpdate = z.object({ mode: z.enum(["link", "assisted"]).optional(), language: z.enum(LANGUAGE_CODES).optional() });
export const checklistTickInput = z.object({ done: z.boolean() });
export const onboardingException = z.object({ reason: z.string().trim().min(5, "Say why production can start before onboarding is complete").max(500) });
export const reminderSent = z.object({ day: z.number().int().min(1).max(60), channel: z.enum(["whatsapp", "email", "in_app"]).default("whatsapp") });
export const publicLanguage = z.object({ language: z.enum(LANGUAGE_CODES) });
