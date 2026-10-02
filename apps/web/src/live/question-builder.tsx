"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Languages, Pencil, Plus, Rocket, Save, Trash2, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import {
  CANVAS_BLOCKS,
  type ChecklistItem,
  LANGUAGES,
  MAPPABLE_FIELDS,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPES,
  type Question,
  type QuestionnaireDefinition,
  questionnaireDefinition,
  type QuestionnaireKind,
  type QuestionType,
  type Section,
  type TableColumn,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, SectionCard } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { Field, FormSection, Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { ApiError, errorMessage } from "./api";
import { fmtDate } from "./format";
import { useAgency, useCan, useQuestionnaire, useQuestionnaireStep } from "./queries";

/** A key from a label, unique among `taken`: "Business type" → business_type, business_type_2… */
function keyFor(label: string, taken: Set<string>) {
  const base =
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40) || "q";
  let k = base;
  for (let i = 2; taken.has(k); i++) k = `${base}_${i}`;
  return k;
}
const lines = (s: string) =>
  s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
const move = <T,>(list: T[], i: number, by: number) => {
  const next = [...list];
  const [item] = next.splice(i, 1);
  next.splice(i + by, 0, item!);
  return next;
};

// ─── One question ─────────────────────────────────────────────────────

function QuestionDialog({
  kind,
  initial,
  earlier,
  taken,
  languages,
  onSave,
  onClose,
}: {
  kind: QuestionnaireKind;
  initial: Question | null;
  /** Questions before this one (for "show only when"). */
  earlier: Question[];
  taken: Set<string>;
  languages: string[];
  onSave: (q: Question) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState<Question>(() => initial ?? { key: "", label: "", type: "text" });
  const [options, setOptions] = useState(() => (initial?.options ?? []).join("\n"));
  const [rows, setRows] = useState(() => (initial?.fixedRows ?? []).join("\n"));
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Question>) => setQ((x) => ({ ...x, ...patch }));
  const choices = q.type === "choice" || q.type === "multi";
  const fields = MAPPABLE_FIELDS.filter((f) => f.target === kind && (f.types as readonly string[]).includes(q.type));
  const branchOn = earlier.filter((e) => e.type === "choice" || e.type === "multi");
  const branchQuestion = branchOn.find((e) => e.key === q.showIf?.key);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const out: Question = {
      ...q,
      key: initial?.key ?? keyFor(q.label, taken),
      label: q.label.trim(),
      options: choices ? lines(options) : undefined,
      max: q.type === "multi" ? q.max : undefined,
      columns: q.type === "table" ? q.columns : undefined,
      fixedRows: q.type === "table" && lines(rows).length ? lines(rows) : undefined,
      mapsTo: fields.some((f) => f.key === q.mapsTo) ? q.mapsTo : undefined,
    };
    if (out.label.length < 3) return setError("Write the question (at least 3 characters).");
    if (choices && (out.options?.length ?? 0) < 2) return setError("Give at least two options, one per line.");
    if (out.type === "table" && !out.columns?.length) return setError("Give the table at least one column.");
    onSave(out);
  };

  const setColumn = (i: number, patch: Partial<TableColumn>) => set({ columns: (q.columns ?? []).map((c, j) => (j === i ? { ...c, ...patch } : c)) });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>{initial ? "Change the question" : "New question"}</DialogTitle>
            <DialogDescription>Changes go into the draft. Onboarding already started keeps the questions it began with.</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-5">
            <FormSection title="The question">
              <Field label="Question" required>
                <Textarea rows={2} value={q.label} onChange={(e) => set({ label: e.target.value })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Help under the question">
                  <Input value={q.help ?? ""} onChange={(e) => set({ help: e.target.value || undefined })} />
                </Field>
                <Field label="Example in the box">
                  <Input value={q.placeholder ?? ""} onChange={(e) => set({ placeholder: e.target.value || undefined })} />
                </Field>
                <Field label="Kind of answer">
                  <Select
                    aria-label="Kind of answer"
                    value={q.type}
                    onValueChange={(type) =>
                      set({
                        type: type as QuestionType,
                        ...(type === "table" && !q.columns?.length && { columns: [{ key: "item", label: "Item", type: "text" }] }),
                      })
                    }
                    options={QUESTION_TYPES.map((t) => ({ value: t, label: QUESTION_TYPE_LABELS[t] }))}
                  />
                </Field>
                <label className="flex items-center gap-2 self-end pb-2 text-body">
                  <Checkbox checked={!!q.optional} onCheckedChange={(v) => set({ optional: v === true || undefined })} />
                  Can be left empty
                </label>
              </div>
              {choices && (
                <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
                  <Field label="Options" hint="One per line." required>
                    <Textarea rows={5} value={options} onChange={(e) => setOptions(e.target.value)} />
                  </Field>
                  {q.type === "multi" && (
                    <Field label="At most" hint="Leave empty for any.">
                      <Input type="number" min={1} value={q.max ?? ""} onChange={(e) => set({ max: Number(e.target.value) || undefined })} />
                    </Field>
                  )}
                </div>
              )}
              {q.type === "table" && (
                <div className="space-y-2">
                  <div className="text-body font-medium text-text-secondary">Columns</div>
                  {(q.columns ?? []).map((c, i) => (
                    <div key={i} className="grid grid-cols-[1fr_130px_1fr_32px] items-center gap-2">
                      <Input aria-label="Column name" value={c.label} onChange={(e) => setColumn(i, { label: e.target.value })} />
                      <Select
                        aria-label="Column kind"
                        value={c.type}
                        onValueChange={(type) => setColumn(i, { type: type as TableColumn["type"] })}
                        options={[
                          { value: "text", label: "Text" },
                          { value: "number", label: "Number" },
                          { value: "currency", label: "Amount (₹)" },
                          { value: "select", label: "Choice" },
                        ]}
                      />
                      {c.type === "select" ? (
                        <Input
                          aria-label="Choices, separated by commas"
                          placeholder="High, Low"
                          value={(c.options ?? []).join(", ")}
                          onChange={(e) =>
                            setColumn(i, {
                              options: e.target.value
                                .split(",")
                                .map((x) => x.trim())
                                .filter(Boolean),
                            })
                          }
                        />
                      ) : (
                        <span />
                      )}
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label="Remove the column"
                        disabled={(q.columns ?? []).length === 1}
                        onClick={() => set({ columns: (q.columns ?? []).filter((_, j) => j !== i) })}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const cols = q.columns ?? [];
                      set({ columns: [...cols, { key: keyFor(`column ${cols.length + 1}`, new Set(cols.map((c) => c.key))), label: "", type: "text" }] });
                    }}
                  >
                    <Plus />
                    Add a column
                  </Button>
                  <Field label="Fixed rows" hint="Optional: rows that are always there, one per line (e.g. the business functions).">
                    <Textarea rows={3} value={rows} onChange={(e) => setRows(e.target.value)} />
                  </Field>
                </div>
              )}
            </FormSection>

            <FormSection title="What it is for" description="Seen by your team, never by the client.">
              <Field label="Used for">
                <Input value={q.feeds ?? ""} onChange={(e) => set({ feeds: e.target.value || undefined })} placeholder="e.g. Content pillars" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Fills in" hint={fields.length ? undefined : "No field takes this kind of answer."}>
                  <Select
                    aria-label="Fills in"
                    value={q.mapsTo ?? "_none"}
                    disabled={!fields.length}
                    onValueChange={(v) => set({ mapsTo: v === "_none" ? undefined : (v as Question["mapsTo"]) })}
                    options={[{ value: "_none", label: "Nothing" }, ...fields.map((f) => ({ value: f.key, label: f.label }))]}
                  />
                </Field>
                {kind === "client" && (
                  <Field label="Business Canvas block">
                    <Select
                      aria-label="Business Canvas block"
                      value={q.canvas ?? "_none"}
                      onValueChange={(v) => set({ canvas: v === "_none" ? undefined : (v as Question["canvas"]) })}
                      options={[{ value: "_none", label: "Not on the canvas" }, ...CANVAS_BLOCKS.map((b) => ({ value: b.key, label: b.label }))]}
                    />
                  </Field>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Show only when" hint={branchOn.length ? "An earlier choice question's answer includes…" : "Needs an earlier choice question."}>
                  <Select
                    aria-label="Show only when"
                    value={q.showIf?.key ?? "_always"}
                    disabled={!branchOn.length}
                    onValueChange={(k) => {
                      const on = branchOn.find((e) => e.key === k);
                      set({ showIf: on ? { key: on.key, includes: on.options![0]! } : undefined });
                    }}
                    options={[{ value: "_always", label: "Always shown" }, ...branchOn.map((e) => ({ value: e.key, label: e.label }))]}
                  />
                </Field>
                {branchQuestion && (
                  <Field label="…this option">
                    <Select
                      aria-label="Option"
                      value={q.showIf!.includes}
                      onValueChange={(includes) => set({ showIf: { key: branchQuestion.key, includes } })}
                      options={branchQuestion.options!.map((o) => ({ value: o, label: o }))}
                    />
                  </Field>
                )}
              </div>
            </FormSection>

            {languages.length > 0 && (
              <FormSection title="Translations" description="The client sees these when they choose that language; anything left empty shows in English.">
                {languages.map((code) => {
                  const lang = code as keyof NonNullable<Question["translations"]>;
                  const t = q.translations?.[lang] ?? {};
                  const setT = (patch: Record<string, unknown>) => set({ translations: { ...q.translations, [lang]: { ...t, ...patch } } });
                  return (
                    <div key={code} className="space-y-3 rounded-lg border border-border-subtle p-3">
                      <div className="inline-flex items-center gap-1.5 text-body font-medium">
                        <Languages className="size-4" />
                        {LANGUAGES.find((l) => l.code === code)?.label ?? code}
                      </div>
                      <Field label="Question">
                        <Input value={t.label ?? ""} onChange={(e) => setT({ label: e.target.value || undefined })} />
                      </Field>
                      <Field label="Help">
                        <Input value={t.help ?? ""} onChange={(e) => setT({ help: e.target.value || undefined })} />
                      </Field>
                      {choices && (
                        <Field label="Options" hint="In the same order as the English options, one per line.">
                          <Textarea
                            rows={4}
                            value={(t.options ?? []).join("\n")}
                            onChange={(e) => setT({ options: e.target.value ? e.target.value.split("\n") : undefined })}
                          />
                        </Field>
                      )}
                    </div>
                  );
                })}
              </FormSection>
            )}
            {error && <Alert tone="danger">{error}</Alert>}
          </DialogBody>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{initial ? "Keep the change" : "Add the question"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── A section ────────────────────────────────────────────────────────

function SectionEditor({
  kind,
  section,
  index,
  count,
  all,
  canEdit,
  languages,
  issues,
  onChange,
  onMove,
  onRemove,
}: {
  kind: QuestionnaireKind;
  section: Section;
  index: number;
  count: number;
  all: QuestionnaireDefinition;
  canEdit: boolean;
  languages: string[];
  issues: Record<string, string>;
  onChange: (s: Section) => void;
  onMove: (by: number) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const before = all.sections.slice(0, index).flatMap((s) => s.questions);
  const taken = new Set(all.sections.flatMap((s) => s.questions.map((q) => q.key)));
  const set = (patch: Partial<Section>) => onChange({ ...section, ...patch });
  const sectionIssues = Object.entries(issues).filter(([p]) => p.startsWith(`sections.${index}.`));

  return (
    <Card className="p-4">
      <fieldset disabled={!canEdit} className="space-y-3">
        <div className="flex flex-wrap items-start gap-2">
          <Input aria-label="Section title" value={section.title} onChange={(e) => set({ title: e.target.value })} className="min-w-48 flex-1 font-semibold" />
          <Select
            aria-label="When"
            className="w-56"
            value={section.when}
            onValueChange={(when) => set({ when: when as Section["when"] })}
            options={[
              { value: "required", label: "Required before work starts" },
              { value: "within-window", label: "Within the window (days)" },
            ]}
          />
          <div className="flex gap-1">
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Move the section up" disabled={index === 0} onClick={() => onMove(-1)}>
              <ArrowUp />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Move the section down" disabled={index === count - 1} onClick={() => onMove(1)}>
              <ArrowDown />
            </Button>
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove the section" disabled={count === 1} onClick={onRemove}>
              <Trash2 />
            </Button>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            aria-label="Introduction"
            placeholder="A line for the client about this section"
            value={section.intro ?? ""}
            onChange={(e) => set({ intro: e.target.value || undefined })}
          />
          <Input
            aria-label="What it builds"
            placeholder="What your team builds from it"
            value={section.builds ?? ""}
            onChange={(e) => set({ builds: e.target.value || undefined })}
          />
        </div>
        <ol className="divide-y divide-border-subtle rounded-lg border border-border">
          {section.questions.map((q, i) => (
            <li key={q.key} className="flex items-start gap-2 p-2.5">
              <span className="mt-0.5 w-6 shrink-0 text-right tabular text-muted-foreground">{i + 1}.</span>
              <div className="min-w-0 flex-1">
                <div className="text-body font-medium">{q.label}</div>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge tone="outline">{QUESTION_TYPE_LABELS[q.type]}</Badge>
                  {q.optional && <Badge tone="neutral">Optional</Badge>}
                  {q.showIf && <Badge tone="info">Only when {q.showIf.includes}</Badge>}
                  {q.mapsTo && <Badge tone="accent">Fills {MAPPABLE_FIELDS.find((f) => f.key === q.mapsTo)?.label}</Badge>}
                  {Object.keys(q.translations ?? {}).map((l) => (
                    <Badge key={l} tone="gold">
                      {LANGUAGES.find((x) => x.code === l)?.label ?? l}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="flex shrink-0 gap-0.5">
                <Button type="button" size="icon-sm" variant="ghost" aria-label={`Change “${q.label}”`} onClick={() => setEditing({ index: i })}>
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => set({ questions: move(section.questions, i, -1) })}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Move down"
                  disabled={i === section.questions.length - 1}
                  onClick={() => set({ questions: move(section.questions, i, 1) })}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Remove “${q.label}”`}
                  disabled={section.questions.length === 1}
                  onClick={() => set({ questions: section.questions.filter((_, j) => j !== i) })}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ol>
        {sectionIssues.map(([p, m]) => (
          <p key={p} className="text-body text-danger">
            {m}
          </p>
        ))}
        <Button type="button" size="sm" variant="ghost" onClick={() => setEditing({ index: null })}>
          <Plus />
          Add a question
        </Button>
      </fieldset>
      {editing && (
        <QuestionDialog
          kind={kind}
          initial={editing.index === null ? null : section.questions[editing.index]!}
          earlier={[...before, ...section.questions.slice(0, editing.index ?? section.questions.length)]}
          taken={taken}
          languages={languages}
          onClose={() => setEditing(null)}
          onSave={(q) => {
            set({ questions: editing.index === null ? [...section.questions, q] : section.questions.map((x, j) => (j === editing.index ? q : x)) });
            setEditing(null);
          }}
        />
      )}
    </Card>
  );
}

// ─── The checklist ────────────────────────────────────────────────────

function ChecklistEditor({ def, canEdit, onChange }: { def: QuestionnaireDefinition; canEdit: boolean; onChange: (c: ChecklistItem[]) => void }) {
  const questions = def.sections.flatMap((s) => s.questions);
  const set = (i: number, patch: Partial<ChecklistItem>) => onChange(def.checklist.map((c, j) => (j === i ? { ...c, ...patch } : c)));
  return (
    <SectionCard title="Checklist before production starts" description="Mandatory items must be done before the gate opens. Items can tick themselves.">
      <fieldset disabled={!canEdit} className="space-y-2">
        {def.checklist.map((c, i) => (
          <div key={c.key} className="grid items-center gap-2 rounded-lg border border-border p-2.5 md:grid-cols-[1fr_200px_1fr_auto_auto]">
            <Input aria-label="Item" value={c.label} onChange={(e) => set(i, { label: e.target.value })} />
            <Select
              aria-label="Ticks"
              value={c.tick.kind}
              onValueChange={(kind) =>
                set(i, {
                  tick:
                    kind === "answer"
                      ? { kind, key: questions[0]!.key }
                      : kind === "section"
                        ? { kind, key: def.sections[0]!.key }
                        : { kind: kind as "manual" | "agreement" | "approver" },
                })
              }
              options={[
                { value: "manual", label: "By hand" },
                { value: "answer", label: "When a question is answered" },
                { value: "section", label: "When a section is answered" },
                { value: "agreement", label: "When an agreement is signed" },
                { value: "approver", label: "When a contact approves the work" },
              ]}
            />
            {c.tick.kind === "answer" ? (
              <Select
                aria-label="Question"
                value={c.tick.key}
                onValueChange={(key) => set(i, { tick: { kind: "answer", key } })}
                options={questions.map((q) => ({ value: q.key, label: q.label }))}
              />
            ) : c.tick.kind === "section" ? (
              <Select
                aria-label="Section"
                value={c.tick.key}
                onValueChange={(key) => set(i, { tick: { kind: "section", key } })}
                options={def.sections.map((s) => ({ value: s.key, label: s.title }))}
              />
            ) : (
              <span />
            )}
            <label className="flex items-center gap-1.5 text-body">
              <Checkbox checked={c.mandatory} onCheckedChange={(v) => set(i, { mandatory: v === true })} />
              Mandatory
            </label>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={`Remove ${c.label}`}
              onClick={() => onChange(def.checklist.filter((_, j) => j !== i))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange([
              ...def.checklist,
              { key: keyFor("item", new Set(def.checklist.map((c) => c.key))), label: "", mandatory: false, tick: { kind: "manual" } },
            ])
          }
        >
          <Plus />
          Add an item
        </Button>
      </fieldset>
    </SectionCard>
  );
}

// ─── The builder ──────────────────────────────────────────────────────

function Editor({ kind, base, hasDraft, canEdit }: { kind: QuestionnaireKind; base: QuestionnaireDefinition; hasDraft: boolean; canEdit: boolean }) {
  const step = useQuestionnaireStep(kind);
  const agency = useAgency();
  const [def, setDef] = useState<QuestionnaireDefinition>(base);
  const dirty = JSON.stringify(def) !== JSON.stringify(base);
  const parsed = questionnaireDefinition.safeParse(def);
  const issues = parsed.success ? {} : Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message]));
  const [serverIssues, setServerIssues] = useState<Record<string, string>>({});
  const languages = (agency.data?.languages ?? []).filter((l) => l !== "en");
  const run = (v: Parameters<typeof step.mutate>[0], done: string) =>
    step.mutate(v, {
      onSuccess: () => {
        setServerIssues({});
        toast.success(done);
      },
      onError: (e) =>
        e instanceof ApiError && e.body.issues
          ? setServerIssues(Object.fromEntries(e.body.issues.map((i) => [i.path, i.message])))
          : toast.error(errorMessage(e)),
    });
  const all = { ...issues, ...serverIssues };

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center justify-end gap-2 rounded-xl border border-border bg-background/95 px-4 py-3 backdrop-blur print:hidden">
          <span className="mr-auto text-body text-muted-foreground">
            {dirty ? "Unsaved changes" : hasDraft ? "The draft is saved — publish it to use it for new onboarding." : "No changes."}
          </span>
          {dirty && (
            <Button variant="ghost" onClick={() => setDef(base)}>
              <Undo2 />
              Undo changes
            </Button>
          )}
          {hasDraft && !dirty && (
            <Button variant="ghost" disabled={step.isPending} onClick={() => run({ step: "discard" }, "Draft discarded")}>
              <Trash2 />
              Discard the draft
            </Button>
          )}
          <Button
            variant="secondary"
            disabled={!dirty || !parsed.success || step.isPending}
            onClick={() => run({ step: "save", definition: def }, "Draft saved")}
          >
            <Save />
            Save draft
          </Button>
          <Button disabled={!hasDraft || dirty || step.isPending} onClick={() => run({ step: "publish" }, "Published — new onboarding uses these questions")}>
            <Rocket />
            Publish
          </Button>
        </div>
      )}
      {Object.keys(all).length > 0 && (
        <Alert tone="danger" title="Fix these before saving">
          <ul className="list-disc pl-4">
            {Object.entries(all)
              .slice(0, 8)
              .map(([p, m]) => (
                <li key={p}>{m}</li>
              ))}
          </ul>
        </Alert>
      )}
      {def.sections.map((s, i) => (
        <SectionEditor
          key={s.key}
          kind={kind}
          section={s}
          index={i}
          count={def.sections.length}
          all={def}
          canEdit={canEdit}
          languages={languages}
          issues={all}
          onChange={(next) => setDef({ ...def, sections: def.sections.map((x, j) => (j === i ? next : x)) })}
          onMove={(by) => setDef({ ...def, sections: move(def.sections, i, by) })}
          onRemove={() => setDef({ ...def, sections: def.sections.filter((_, j) => j !== i) })}
        />
      ))}
      {canEdit && (
        <Button
          variant="secondary"
          onClick={() => {
            const sectionKey = keyFor("section", new Set(def.sections.map((s) => s.key)));
            const questionKey = keyFor("question", new Set(def.sections.flatMap((s) => s.questions.map((q) => q.key))));
            setDef({
              ...def,
              sections: [
                ...def.sections,
                { key: sectionKey, title: "New section", when: "within-window", questions: [{ key: questionKey, label: "New question", type: "long" }] },
              ],
            });
          }}
        >
          <Plus />
          Add a section
        </Button>
      )}
      {kind === "client" && <ChecklistEditor def={def} canEdit={canEdit} onChange={(checklist) => setDef({ ...def, checklist })} />}
    </div>
  );
}

function KindEditor({ kind }: { kind: QuestionnaireKind }) {
  const can = useCan();
  const q = useQuestionnaire(kind);
  if (q.isPending) return <SkeletonRows rows={8} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const { published, draft, versions } = q.data;
  const base = (draft ?? published)!;
  return (
    <div className="space-y-4">
      <p className="text-body text-muted-foreground">
        Version {published?.version} is used for new onboarding
        {published?.publishedAt && ` (published ${fmtDate(published.publishedAt)})`}. {draft && <Badge tone="warning">Draft for version {draft.version}</Badge>}{" "}
        {versions.length > 1 &&
          `Earlier versions: ${versions
            .slice(1)
            .map((v) => `${v.version} (${v.responses} in use)`)
            .join(", ")}.`}
      </p>
      {/* A saved draft or a new version starts the editor again from what is on the server. */}
      <Editor key={`${base.id}-${base.updatedAt}`} kind={kind} base={base.definition} hasDraft={!!draft} canEdit={can("settings", "edit")} />
    </div>
  );
}

export function LiveQuestionBuilder() {
  const [kind, setKind] = useState<QuestionnaireKind>("client");
  return (
    <>
      <PageHeader
        title="Onboarding questions"
        description="What new clients — and your own agency — are asked. They start from the Growth OS question sets; change, reorder, translate and add your own. Changes go into a draft and are used once published."
      />
      <Tabs value={kind} onValueChange={(v) => setKind(v as QuestionnaireKind)}>
        <TabsList>
          <TabsTrigger value="client">Client questionnaire</TabsTrigger>
          <TabsTrigger value="agency">Agency questionnaire</TabsTrigger>
        </TabsList>
        <TabsContent value="client" className={cn(kind !== "client" && "hidden")}>
          <KindEditor kind="client" />
        </TabsContent>
        <TabsContent value="agency" className={cn(kind !== "agency" && "hidden")}>
          <KindEditor kind="agency" />
        </TabsContent>
      </Tabs>
    </>
  );
}
