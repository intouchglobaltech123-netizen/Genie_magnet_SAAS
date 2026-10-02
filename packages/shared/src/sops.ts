// SOPs and checklists (P5-17): how the agency does each thing — its steps and checklist — in versions approved before
// they are used; who does it, who checks it and who approves it; linked to the agency's PSS and to a KRA; and each run
// of the checklist, checked, with failures counted in the reviews and in the person's KRAs.
import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);

export const sopInput = z.object({
  title: text(160).min(3, "Name the SOP"),
  departmentId: z.uuid().nullable().default(null),
  /** Who keeps it up to date. */
  ownerId: z.string().max(64).nullable().default(null),
  /** The PSS line it serves, as the agency's own PSS names it. */
  pssRef: text(200).default(""),
  /** The KRA it serves: a template and one of its KRAs. */
  kraTemplateId: z.uuid().nullable().default(null),
  kraKey: z.string().max(40).nullable().default(null),
  /** Who does it (any of them), who checks each run, who approves each version. */
  doerIds: z.array(z.string().min(1).max(64)).max(100).default([]),
  checkerId: z.string().max(64).nullable().default(null),
  approverId: z.string().max(64).nullable().default(null),
  active: z.boolean().default(true),
});
export type SopInput = z.input<typeof sopInput>;

export const sopVersionInput = z.object({
  purpose: text(1000).default(""),
  scope: text(1000).default(""),
  steps: z
    .array(z.object({ text: text(500).min(1, "Write the step") }))
    .max(60)
    .default([]),
  checklist: z
    .array(z.object({ key: z.string().min(1).max(40), text: text(300).min(1, "Write the check") }))
    .max(60)
    .default([]),
  /** What changed from the version before. */
  changeNote: text(500).default(""),
});
export type SopVersionInput = z.input<typeof sopVersionInput>;

export const SOP_VERSION_STATUSES = ["draft", "in_review", "approved", "superseded"] as const;
export type SopVersionStatus = (typeof SOP_VERSION_STATUSES)[number];
export const SOP_VERSION_STATUS_LABEL: Record<SopVersionStatus, string> = {
  draft: "Draft",
  in_review: "Waiting for approval",
  approved: "In use",
  superseded: "Replaced",
};

export const RUN_RESULTS = ["done", "not_done", "na"] as const;
export type RunResult = (typeof RUN_RESULTS)[number];
export const RUN_RESULT_LABEL: Record<RunResult, string> = { done: "Done", not_done: "Not done", na: "Does not apply" };

export const sopRunInput = z.object({
  items: z
    .array(z.object({ key: z.string().min(1).max(40), result: z.enum(RUN_RESULTS), note: text(300).default("") }))
    .min(1)
    .max(60),
  /** What it was run for: "Shoot at Lakshmi Textiles, 5 Oct". */
  about: text(200).default(""),
  note: text(1000).default(""),
});
export type SopRunInput = z.input<typeof sopRunInput>;

export const sopCheckInput = z
  .object({ passed: z.boolean(), note: text(500).default("") })
  .refine((c) => c.passed || !!c.note, { path: ["note"], message: "Say what was wrong" });

export const SOP_RUN_STATUSES = ["submitted", "passed", "failed"] as const;
export type SopRunStatus = (typeof SOP_RUN_STATUSES)[number];

// ─── Rows ─────────────────────────────────────────────────────────────

export interface SopVersionRow {
  id: string;
  number: number;
  status: SopVersionStatus;
  purpose: string;
  scope: string;
  steps: { text: string }[];
  checklist: { key: string; text: string }[];
  changeNote: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

export interface SopRow {
  id: string;
  title: string;
  department: { id: string; name: string } | null;
  owner: { id: string; name: string } | null;
  pssRef: string;
  kra: { templateId: string; template: string; key: string; name: string } | null;
  doers: { id: string; name: string }[];
  checker: { id: string; name: string } | null;
  approver: { id: string; name: string } | null;
  active: boolean;
  /** The version in use. */
  current: SopVersionRow | null;
  /** A newer version being worked on, when there is one. */
  draft: SopVersionRow | null;
  versions?: Pick<SopVersionRow, "id" | "number" | "status" | "changeNote" | "approvedAt">[];
  /** This month's runs: how many, and how many failed. */
  runs: { month: number; failed: number };
}

export interface SopRunRow {
  id: string;
  sop: { id: string; title: string };
  version: number;
  by: { id: string; name: string };
  about: string;
  items: { key: string; text: string; result: RunResult; note: string }[];
  note: string;
  status: SopRunStatus;
  checkedBy: string | null;
  checkNote: string | null;
  createdAt: string;
}
