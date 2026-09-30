"use client";

import { useId } from "react";
import { Check, FileUp, Paperclip, Plus, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { isAnswered } from "./engine";
import type { Answer, Question, TableColumn, TableValue } from "./templates";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35";
const SAMPLE_FILES = ["Logo_primary.png", "Logo_white.svg", "Brand_colours_and_fonts.pdf", "Brand_guide.pdf", "Product_photos.zip"];

const cellCls =
  "h-8 w-full min-w-0 rounded-md border border-input bg-surface px-2 text-body text-text-primary placeholder:text-text-muted/70 hover:border-secondary/40 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/15";

export function QuestionField({
  q,
  value,
  onChange,
  showMapping,
  index,
}: {
  q: Question;
  value: Answer | undefined;
  onChange: (v: Answer) => void;
  showMapping?: boolean;
  index: number;
}) {
  const id = useId();
  const labelId = `${id}-label`;
  const done = isAnswered(q, value);

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
          </div>
          {q.help && <p className="mt-0.5 text-body text-muted-foreground">{q.help}</p>}
          {showMapping && (
            <Badge tone="outline" className="mt-1.5">
              Saves to: {q.maps}
            </Badge>
          )}
        </div>
      </div>
      <div className="sm:pl-9">
        <Control q={q} value={value} onChange={onChange} labelId={labelId} inputId={id} />
      </div>
    </div>
  );
}

function Control({ q, value, onChange, labelId, inputId }: { q: Question; value: Answer | undefined; onChange: (v: Answer) => void; labelId: string; inputId: string }) {
  const str = typeof value === "string" ? value : "";
  const arr = Array.isArray(value) && (value.length === 0 || typeof value[0] === "string") ? (value as string[]) : [];

  switch (q.type) {
    case "text":
      return <Input id={inputId} aria-labelledby={labelId} value={str} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} />;
    case "long":
      return <Textarea id={inputId} aria-labelledby={labelId} value={str} placeholder={q.placeholder} onChange={(e) => onChange(e.target.value)} className="min-h-24" />;
    case "number":
      return (
        <Input
          id={inputId}
          aria-labelledby={labelId}
          inputMode="numeric"
          value={str}
          placeholder={q.placeholder}
          onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ""))}
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
            placeholder={q.placeholder ? Number(q.placeholder).toLocaleString("en-IN") : undefined}
            onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
            className="pl-7 tabular"
          />
        </div>
      );
    case "choice":
      return (
        <div role="radiogroup" aria-labelledby={labelId} className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {q.options!.map((o) => {
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
                <span className={cn("mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full border", on ? "border-primary bg-primary" : "border-border-strong")}>
                  {on && <span className="size-1.5 rounded-full bg-primary-foreground" />}
                </span>
                <span className="min-w-0">
                  <span className="block text-body font-medium">{o}</span>
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
            {q.options!.map((o) => {
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
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-surface text-text-secondary hover:border-secondary/40 hover:text-primary",
                  )}
                >
                  {on && <Check className="size-3.5" />}
                  {o}
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
            <Button key={o} type="button" role="radio" aria-checked={str === o} variant={str === o ? "default" : "outline"} size="sm" onClick={() => onChange(o)}>
              {o}
            </Button>
          ))}
        </div>
      );
    case "rating":
      return (
        <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-1.5">
          {Array.from({ length: 10 }, (_, i) => String(i + 1)).map((o) => (
            <button
              key={o}
              type="button"
              role="radio"
              aria-checked={str === o}
              onClick={() => onChange(o)}
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
    case "file":
      return <FileControl files={arr} onChange={onChange} labelId={labelId} />;
    case "table":
      return <TableControl q={q} value={Array.isArray(value) && value.length && typeof value[0] === "object" ? (value as TableValue) : []} onChange={onChange} labelId={labelId} />;
  }
}

function FileControl({ files, onChange, labelId }: { files: string[]; onChange: (v: Answer) => void; labelId: string }) {
  const next = SAMPLE_FILES.find((f) => !files.includes(f));
  return (
    <div className="space-y-2" aria-labelledby={labelId} role="group">
      {files.map((f) => (
        <div key={f} className="flex items-center gap-3 rounded-xl border border-border bg-surface p-2.5">
          <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
            <Paperclip className="size-4" />
          </span>
          <div className="min-w-0 flex-1 text-body">
            <div className="truncate font-medium">{f}</div>
            <div className="text-muted-foreground">Uploaded · saved to the brand kit</div>
          </div>
          <Button size="icon-sm" variant="ghost" aria-label={`Remove ${f}`} onClick={() => onChange(files.filter((x) => x !== f))}>
            <X />
          </Button>
        </div>
      ))}
      {next && (
        <button
          type="button"
          onClick={() => onChange([...files, next])}
          className={cn(
            "flex w-full cursor-pointer flex-col items-center gap-1.5 rounded-xl border border-dashed border-border-strong bg-surface-secondary p-5 text-center text-body text-muted-foreground transition hover:border-primary hover:bg-primary-soft/40",
            FOCUS,
          )}
        >
          <FileUp className="size-5" />
          <span>
            <span className="font-medium text-primary">Click to upload</span> — logo, brand guide, photos (demo adds a sample file)
          </span>
        </button>
      )}
    </div>
  );
}

function TableControl({ q, value, onChange, labelId }: { q: Question; value: TableValue; onChange: (v: Answer) => void; labelId: string }) {
  const cols = q.columns!;
  const fixed = q.fixedRows;
  const rows: TableValue = fixed
    ? fixed.map((label) => value.find((r) => r.row === label) ?? { row: label })
    : value.length
      ? value
      : [{}];

  const setCell = (i: number, key: string, v: string) => {
    const next = rows.map((r, j) => (j === i ? { ...r, [key]: v } : r));
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <div className="scrollbar-thin overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[560px] text-body" aria-labelledby={labelId}>
          <thead className="bg-surface-secondary text-left text-muted-foreground">
            <tr>
              {fixed && <th className="px-3 py-2 font-medium">Function</th>}
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
                    <Cell col={c} value={r[c.key] ?? ""} onChange={(v) => setCell(i, c.key, v)} label={`${c.label}${fixed ? ` · ${r.row}` : ` · row ${i + 1}`}`} />
                  </td>
                ))}
                {!fixed && (
                  <td className="px-1">
                    <Button size="icon-sm" variant="ghost" aria-label={`Remove row ${i + 1}`} disabled={rows.length === 1} onClick={() => onChange(rows.filter((_, j) => j !== i))}>
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
        {col.options!.map((o) => (
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
