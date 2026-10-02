"use client";

import { createContext, useContext, useEffect, useId, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  CloudCheck,
  Link2,
  Loader2,
  Lock,
  PartyPopper,
  Paperclip,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  type AnswerValue,
  type Answers,
  FILE_REF,
  fileRef,
  isAnswered,
  progressOf,
  type Question,
  type Section,
  type TableColumn,
  type UploadStart,
  visibleQuestions,
} from "@gm/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { errorMessage } from "./api";
import { UploadButton } from "./files";
import { fmtDate } from "./format";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35";
const cellCls =
  "h-8 w-full min-w-0 rounded-md border border-input bg-surface px-2 text-body text-text-primary placeholder:text-text-muted/70 hover:border-secondary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15";

type Q = Question & { optionLabels?: string[] };
type TableValue = Record<string, string>[];
type SaveState = { saving?: boolean; error?: string; saved?: boolean };

/** Uploading for files questions: how an upload starts here, and the files already uploaded (by id). */
interface FileContext {
  start?: (meta: { name: string; mime: string; size: number }) => Promise<UploadStart>;
  files: Record<string, { name: string; url: string | null }>;
}
const Files = createContext<FileContext>({ files: {} });

// ─── One question ─────────────────────────────────────────────────────

export function QuestionField({
  q,
  value,
  onChange,
  index,
  showInternal,
  state,
}: {
  q: Q;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  index: number;
  showInternal?: boolean;
  state?: SaveState;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const done = isAnswered(value);
  return (
    <div className="space-y-2.5">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-body font-semibold tabular",
            done ? "bg-success-soft text-success" : "bg-muted text-muted-foreground",
          )}
          aria-hidden
        >
          {done ? <Check className="size-3.5" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <div id={labelId} className="text-body font-semibold text-text-primary">
            {q.label}
            {q.optional && <span className="ml-1.5 font-normal text-muted-foreground">(optional)</span>}
          </div>
          {q.help && <p className="mt-0.5 text-body text-muted-foreground">{q.help}</p>}
          {showInternal && (q.feeds || q.mapsTo) && (
            <Badge tone="outline" className="mt-1.5 whitespace-normal">
              Used for: {q.feeds ?? q.mapsTo}
            </Badge>
          )}
        </div>
        <span className="shrink-0 text-body" aria-live="polite">
          {state?.saving ? (
            <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />
          ) : state?.error ? (
            <AlertCircle className="size-4 text-danger" aria-label="Not saved" />
          ) : state?.saved ? (
            <CloudCheck className="size-4 text-success" aria-label="Saved" />
          ) : null}
        </span>
      </div>
      <div className="sm:pl-9">
        <Control q={q} value={value} onChange={onChange} labelId={labelId} inputId={id} />
        {state?.error && <p className="mt-1.5 text-body text-danger">{state.error}</p>}
      </div>
    </div>
  );
}

function Control({
  q,
  value,
  onChange,
  labelId,
  inputId,
}: {
  q: Q;
  value: AnswerValue | undefined;
  onChange: (v: AnswerValue) => void;
  labelId: string;
  inputId: string;
}) {
  const str = typeof value === "string" ? value : "";
  const arr = Array.isArray(value) && (value.length === 0 || typeof value[0] === "string") ? (value as string[]) : [];
  const label = (o: string) => q.optionLabels?.[q.options?.indexOf(o) ?? -1] ?? o;

  switch (q.type) {
    case "text":
      return <Input id={inputId} aria-labelledby={labelId} value={str} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "long":
      return (
        <Textarea
          id={inputId}
          aria-labelledby={labelId}
          value={str}
          placeholder={q.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-24"
        />
      );
    case "file":
      return (
        <FileControl value={typeof value === "string" ? value.split(/\s+/).filter(Boolean) : arr} onChange={onChange} labelId={labelId} inputId={inputId} />
      );
    case "number":
      return (
        <Input
          id={inputId}
          aria-labelledby={labelId}
          inputMode="decimal"
          value={str}
          placeholder={q.placeholder}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.-]/g, ""))}
          className="max-w-40 tabular"
        />
      );
    case "currency":
      return (
        <div className="relative max-w-56">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-body text-muted-foreground">₹</span>
          <Input
            id={inputId}
            aria-labelledby={labelId}
            inputMode="numeric"
            value={str ? Number(str).toLocaleString("en-IN") : ""}
            placeholder={q.placeholder && /^\d+$/.test(q.placeholder) ? Number(q.placeholder).toLocaleString("en-IN") : q.placeholder}
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
            className="pl-7 tabular"
          />
        </div>
      );
    case "choice":
      return (
        <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(q.options ?? []).map((o) => {
            const on = str === o;
            return (
              <button
                key={o}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => onChange(on ? "" : o)}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 text-left transition",
                  FOCUS,
                  on ? "border-primary bg-primary-soft/50 ring-1 ring-primary/20" : "border-border bg-surface hover:border-secondary/40",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
                    on ? "border-primary bg-primary" : "border-border-strong",
                  )}
                >
                  {on && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-body font-medium">{label(o)}</span>
                  {q.optionHelp?.[o] && <span className="block text-body text-muted-foreground">{q.optionHelp[o]}</span>}
                </span>
              </button>
            );
          })}
        </div>
      );
    case "multi": {
      const full = q.max !== undefined && arr.length >= q.max;
      return (
        <div>
          <div role="group" aria-labelledby={labelId} className="flex flex-wrap gap-2">
            {(q.options ?? []).map((o) => {
              const on = arr.includes(o);
              return (
                <button
                  key={o}
                  type="button"
                  aria-pressed={on}
                  disabled={!on && full}
                  onClick={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-body font-medium transition disabled:cursor-not-allowed disabled:opacity-45",
                    FOCUS,
                    on
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border-strong bg-surface text-text-secondary hover:border-secondary/40 hover:text-primary",
                  )}
                >
                  {on && <Check className="size-3.5" />}
                  {label(o)}
                </button>
              );
            })}
          </div>
          {q.max && (
            <p className="mt-1.5 text-body text-muted-foreground">
              Choose up to {q.max} · {arr.length} selected
            </p>
          )}
        </div>
      );
    }
    case "yesno":
      return (
        <div role="radiogroup" aria-labelledby={labelId} className="flex gap-2">
          {["Yes", "No"].map((o) => (
            <Button
              key={o}
              type="button"
              role="radio"
              aria-checked={str === o}
              variant={str === o ? "default" : "outline"}
              size="sm"
              onClick={() => onChange(str === o ? "" : o)}
            >
              {o}
            </Button>
          ))}
        </div>
      );
    case "rating":
      return (
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
          {["1", "2", "3", "4", "5"].map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={str === o}
              onClick={() => onChange(str === o ? "" : o)}
              className={cn(
                "inline-flex size-9 cursor-pointer items-center justify-center rounded-lg border text-body font-semibold tabular transition",
                FOCUS,
                str === o ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-surface hover:border-secondary/40",
              )}
            >
              {o}
            </button>
          ))}
        </div>
      );
    case "table":
      return (
        <TableControl
          q={q}
          value={Array.isArray(value) && value.length && typeof value[0] === "object" ? (value as TableValue) : []}
          onChange={onChange}
          labelId={labelId}
        />
      );
  }
}

/** Uploaded files and links; each upload is added as it finishes. */
function FileControl({ value, onChange, labelId, inputId }: { value: string[]; onChange: (v: AnswerValue) => void; labelId: string; inputId: string }) {
  const ctx = useContext(Files);
  const [names, setNames] = useState<Record<string, string>>({});
  const [link, setLink] = useState("");
  // The latest answer, so files uploaded one after another are all kept.
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);
  const add = () => {
    const url = link.trim();
    if (!url) return;
    onChange([...value, /^https?:\/\//.test(url) ? url : `https://${url}`]);
    setLink("");
  };
  return (
    <div className="space-y-2" role="group" aria-labelledby={labelId}>
      {value.length > 0 && (
        <ul className="space-y-1.5">
          {value.map((v) => {
            const id = FILE_REF.test(v) ? v.slice(5) : null;
            const f = id ? ctx.files[id] : null;
            return (
              <li key={v} className="flex items-center gap-2 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-body">
                {id ? <Paperclip className="size-4 shrink-0 text-muted-foreground" /> : <Link2 className="size-4 shrink-0 text-muted-foreground" />}
                {id ? (
                  f?.url ? (
                    <a href={f.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                      {f.name}
                    </a>
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{names[id] ?? f?.name ?? "Uploaded file"}</span>
                  )
                ) : (
                  <a href={v} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate hover:underline">
                    {v}
                  </a>
                )}
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Remove" onClick={() => onChange(value.filter((x) => x !== v))}>
                  <X />
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2">
        {ctx.start && (
          <UploadButton
            start={ctx.start}
            onUploaded={(id, file) => {
              setNames((n) => ({ ...n, [id]: file.name }));
              current.current = [...current.current, fileRef(id)];
              onChange(current.current);
            }}
          />
        )}
        <div className="flex min-w-60 flex-1 gap-2">
          <Input
            id={inputId}
            value={link}
            placeholder="…or paste a link (Google Drive, Dropbox)"
            onChange={(e) => setLink(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), add())}
          />
          <Button type="button" size="sm" variant="ghost" disabled={!link.trim()} onClick={add}>
            Add link
          </Button>
        </div>
      </div>
    </div>
  );
}

function TableControl({ q, value, onChange, labelId }: { q: Q; value: TableValue; onChange: (v: AnswerValue) => void; labelId: string }) {
  const cols = q.columns ?? [];
  const fixed = q.fixedRows;
  const rows: TableValue = fixed ? fixed.map((label) => value.find((r) => r.row === label) ?? { row: label }) : value.length ? value : [{}];
  const setCell = (i: number, key: string, v: string) => onChange(rows.map((r, j) => (j === i ? { ...r, [key]: v } : r)));

  return (
    <div className="space-y-2">
      <div className="scrollbar-thin overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-body" aria-labelledby={labelId}>
          <thead className="bg-surface-secondary text-left text-muted-foreground">
            <tr>
              {fixed && <th className="px-3 py-2 font-medium" aria-label="Row" />}
              {cols.map((c) => (
                <th key={c.key} className="px-2 py-2 font-medium">
                  {c.label}
                </th>
              ))}
              {!fixed && <th className="w-10" aria-label="Actions" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {rows.map((r, i) => (
              <tr key={fixed ? r.row : i}>
                {fixed && <th className="whitespace-nowrap px-3 py-1.5 text-left font-medium">{r.row}</th>}
                {cols.map((c) => (
                  <td key={c.key} className="px-2 py-1.5">
                    <Cell
                      col={c}
                      value={r[c.key] ?? ""}
                      onChange={(v) => setCell(i, c.key, v)}
                      label={`${c.label}${fixed ? ` · ${r.row}` : ` · row ${i + 1}`}`}
                    />
                  </td>
                ))}
                {!fixed && (
                  <td className="px-1">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Remove row ${i + 1}`}
                      disabled={rows.length === 1}
                      onClick={() => onChange(rows.filter((_, j) => j !== i))}
                    >
                      <Trash2 />
                    </Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!fixed && (
        <Button type="button" size="xs" variant="ghost" onClick={() => onChange([...rows, {}])}>
          <Plus /> Add row
        </Button>
      )}
    </div>
  );
}

function Cell({ col, value, onChange, label }: { col: TableColumn; value: string; onChange: (v: string) => void; label: string }) {
  if (col.type === "select") {
    return (
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={cn(cellCls, "cursor-pointer")}>
        <option value="">—</option>
        {(col.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    );
  }
  const numeric = col.type === "number" || col.type === "currency";
  return (
    <input
      aria-label={label}
      value={col.type === "currency" && value ? Number(value).toLocaleString("en-IN") : value}
      placeholder={col.placeholder}
      inputMode={numeric ? "numeric" : undefined}
      onChange={(e) => onChange(numeric ? e.target.value.replace(/[^\d.]/g, "") : e.target.value)}
      className={cn(cellCls, numeric && "tabular")}
    />
  );
}

// ─── The whole questionnaire ──────────────────────────────────────────

/** Typing waits a moment before saving; a click saves at once. */
const delayFor = (q: Question) => (["choice", "multi", "yesno", "rating"].includes(q.type) ? 0 : 800);

/**
 * One form for every way a questionnaire is answered: `public` — the client's own link; `assisted` — the account
 * manager fills it in with the client on a call; `agency` — the agency answers its own questionnaire. Each answer saves
 * by itself; a problem shows under the question and nothing else is held up.
 */
export function QuestionnaireForm({
  sections,
  initial,
  windowDays,
  dueOn,
  mode,
  save,
  onSaved,
  upload,
  files = {},
}: {
  sections: (Section | (Omit<Section, "questions" | "intro"> & { intro?: string | null; questions: Q[] }))[];
  initial: Answers;
  windowDays: number;
  dueOn?: string | null;
  mode: "public" | "assisted" | "agency";
  save: (key: string, value: AnswerValue) => Promise<unknown>;
  onSaved?: () => void;
  /** Starts an upload for files questions (none: links only). */
  upload?: FileContext["start"];
  files?: FileContext["files"];
}) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const [states, setStates] = useState<Record<string, SaveState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const sects = sections as Section[];
  const prog = progressOf({ sections: sects }, answers);
  const ordered = [...sects.filter((s) => s.when === "required"), ...sects.filter((s) => s.when !== "required")];
  const [active, setActive] = useState(() => prog.next?.section ?? ordered[0]!.key);
  const topRef = useRef<HTMLDivElement>(null);
  const idx = Math.max(
    0,
    ordered.findIndex((s) => s.key === active),
  );
  const current = ordered[idx]!;
  const internal = mode !== "public";
  const progressFor = (key: string) => prog.sections.find((s) => s.key === key)!;

  const change = (q: Question, value: AnswerValue) => {
    setAnswers((a) => ({ ...a, [q.key]: value }));
    clearTimeout(timers.current[q.key]);
    timers.current[q.key] = setTimeout(async () => {
      setStates((s) => ({ ...s, [q.key]: { saving: true } }));
      try {
        await save(q.key, value);
        setStates((s) => ({ ...s, [q.key]: { saved: true } }));
        onSaved?.();
      } catch (e) {
        setStates((s) => ({ ...s, [q.key]: { error: errorMessage(e) } }));
      }
    }, delayFor(q));
  };

  const go = (i: number) => {
    setActive(ordered[i]!.key);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const pending = Object.values(states).some((s) => s.saving);
  const failed = Object.values(states).some((s) => s.error);

  return (
    <Files.Provider value={{ start: upload, files }}>
      <div ref={topRef} className="grid scroll-mt-24 grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card className="p-4">
            <Meter label={mode === "agency" ? "Needed to start" : "Required to start"} icon={Lock} part={prog.required} />
            <div className="my-3 border-t border-border-subtle" />
            <Meter label={`Within ${windowDays} days`} icon={Clock} part={prog.window} hint={dueOn ? `by ${fmtDate(dueOn)}` : undefined} />
          </Card>
          <nav
            aria-label="Sections"
            className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-4 lg:overflow-visible lg:p-0"
          >
            {(["required", "within-window"] as const).map((when) => {
              const list = ordered.filter((s) => (when === "required" ? s.when === "required" : s.when !== "required"));
              if (!list.length) return null;
              return (
                <div key={when} className="flex shrink-0 gap-2 lg:block">
                  <div className="hidden px-1 pb-1.5 text-body font-medium uppercase tracking-wider text-muted-foreground lg:block">
                    {when === "required" ? "Required to start" : `Within ${windowDays} days`}
                  </div>
                  <ul className="flex gap-2 lg:block lg:space-y-1">
                    {list.map((s) => {
                      const p = progressFor(s.key);
                      const on = s.key === current.key;
                      return (
                        <li key={s.key} className="shrink-0">
                          <button
                            type="button"
                            onClick={() => go(ordered.findIndex((x) => x.key === s.key))}
                            aria-current={on ? "step" : undefined}
                            className={cn(
                              "flex w-full cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-lg border px-3 py-2 text-left text-body transition lg:whitespace-normal",
                              FOCUS,
                              on ? "border-primary bg-primary-soft/60 text-primary" : "border-transparent bg-card hover:bg-muted lg:bg-transparent",
                            )}
                          >
                            <span
                              className={cn(
                                "inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                                p.complete ? "bg-success text-success-foreground" : "border border-border-strong text-muted-foreground",
                              )}
                              aria-hidden
                            >
                              {p.complete && <Check className="size-3" />}
                            </span>
                            <span className="min-w-0 flex-1 font-medium">{s.title}</span>
                            <span className="shrink-0 tabular text-muted-foreground">
                              {p.answered}/{p.total}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        </aside>

        <div className="min-w-0 space-y-4">
          {prog.required.complete && (
            <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft/50 p-4">
              <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success ring-1 ring-success/30">
                {prog.complete ? <PartyPopper className="size-4" /> : <CheckCircle2 className="size-4" />}
              </span>
              <div className="min-w-0 text-body">
                <div className="font-semibold text-text-primary">
                  {prog.complete
                    ? "All done — thank you!"
                    : mode === "public"
                      ? "You're all set to start"
                      : mode === "agency"
                        ? "The essentials are in"
                        : "Required sections done — the gate can open"}
                </div>
                <div className="text-muted-foreground">
                  {prog.complete
                    ? "Every section is answered."
                    : `The rest can be answered within ${windowDays} days${dueOn ? ` (by ${fmtDate(dueOn)})` : ""}. Answers are saved — you can close this page and come back any time.`}
                </div>
              </div>
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="border-b border-border-subtle bg-surface-secondary px-5 py-4 sm:px-6">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={current.when === "required" ? "danger" : "info"}>
                  {current.when === "required" ? (
                    <>
                      <Lock /> Required to start
                    </>
                  ) : (
                    <>
                      <Clock /> Within {windowDays} days
                    </>
                  )}
                </Badge>
                <span className="tabular text-body text-muted-foreground">
                  Section {idx + 1} of {ordered.length} · {progressFor(current.key).answered}/{progressFor(current.key).total} answered
                </span>
              </div>
              <h2 className="mt-2 text-subheading font-semibold tracking-tight">{current.title}</h2>
              {current.intro && <p className="mt-0.5 text-body text-muted-foreground">{current.intro}</p>}
              {internal && current.builds && (
                <p className="mt-2 text-body text-muted-foreground">
                  <span className="font-medium text-text-secondary">Builds:</span> {current.builds}
                </p>
              )}
            </div>
            <div className="divide-y divide-border-subtle">
              {visibleQuestions(current, answers).map((q, i) => (
                <div key={q.key} className="px-5 py-5 sm:px-6">
                  <QuestionField q={q} index={i + 1} value={answers[q.key]} onChange={(v) => change(q, v)} showInternal={internal} state={states[q.key]} />
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface-secondary px-5 py-3.5 sm:px-6">
              <span className={cn("inline-flex items-center gap-1.5 text-body", failed ? "text-danger" : "text-muted-foreground")}>
                {pending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving…
                  </>
                ) : failed ? (
                  <>
                    <AlertCircle className="size-4" /> Some answers are not saved — see the questions marked in red
                  </>
                ) : (
                  <>
                    <CloudCheck className="size-4 text-success" /> Saved as you go
                  </>
                )}
              </span>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => go(idx - 1)}>
                  <ArrowLeft /> Back
                </Button>
                {idx < ordered.length - 1 && (
                  <Button size="sm" onClick={() => go(idx + 1)}>
                    Next section <ArrowRight />
                  </Button>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </Files.Provider>
  );
}

function Meter({
  label,
  icon: Icon,
  part,
  hint,
}: {
  label: string;
  icon: typeof Lock;
  part: { answered: number; total: number; complete: boolean };
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-body">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Icon className="size-3.5 text-muted-foreground" /> {label}
        </span>
        <span className="tabular text-muted-foreground">
          {part.answered}/{part.total}
        </span>
      </div>
      <Progress className="mt-2" value={part.total ? (part.answered / part.total) * 100 : 100} tone={part.complete ? "success" : "accent"} />
      {hint && <div className="mt-1.5 text-body text-muted-foreground">{hint}</div>}
    </div>
  );
}
