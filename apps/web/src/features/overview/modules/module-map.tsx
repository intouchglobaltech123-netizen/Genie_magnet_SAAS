"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ClipboardCopy, PencilLine, RotateCcw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import type { Depth } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { depthMeta, MODULE_GROUPS, modules, type ModuleRow } from "./data";
import { useModuleFeedback, type Verdict } from "./feedback-store";

type Filter = "all" | Depth;
type FbFilter = "any" | "pending" | Verdict;

const verdictMeta: Record<Verdict, { label: string; icon: typeof Check; on: string }> = {
  approve: { label: "Approve", icon: Check, on: "border-success/40 bg-success-soft text-success" },
  change: { label: "Change needed", icon: PencilLine, on: "border-warning/40 bg-warning-soft text-warning" },
  remove: { label: "Remove", icon: Trash2, on: "border-danger/40 bg-danger-soft text-danger" },
};

export function ModuleMap() {
  const { items, setVerdict, setNote, clear } = useModuleFeedback();
  const [filter, setFilter] = useState<Filter>("all");
  const [fb, setFb] = useState<FbFilter>("any");
  const [q, setQ] = useState("");

  useEffect(() => {
    useModuleFeedback.persist.rehydrate();
  }, []);

  const counts = useMemo(
    () => ({
      all: modules.length,
      demo: modules.filter((m) => m.depth === "demo").length,
      preview: modules.filter((m) => m.depth === "preview").length,
      planned: modules.filter((m) => m.depth === "planned").length,
    }),
    [],
  );

  const tally = {
    approve: modules.filter((m) => items[m.no]?.verdict === "approve").length,
    change: modules.filter((m) => items[m.no]?.verdict === "change").length,
    remove: modules.filter((m) => items[m.no]?.verdict === "remove").length,
  };
  const reviewed = tally.approve + tally.change + tally.remove;

  const visible = modules.filter((m) => {
    if (filter !== "all" && m.depth !== filter) return false;
    const v = items[m.no]?.verdict;
    if (fb === "pending" && v) return false;
    if (fb !== "any" && fb !== "pending" && v !== fb) return false;
    if (q) {
      const s = q.toLowerCase();
      return m.name.toLowerCase().includes(s) || m.summary.toLowerCase().includes(s) || String(m.no) === s;
    }
    return true;
  });

  const exportText = () => {
    const lines = [
      "Agency OS — Module review with Janarthanan",
      `Reviewed ${reviewed}/47 · ${tally.approve} approved · ${tally.change} change${tally.change === 1 ? "" : "s"} · ${tally.remove} remove`,
      "",
    ];
    (["change", "remove", "approve"] as Verdict[]).forEach((v) => {
      const list = modules.filter((m) => items[m.no]?.verdict === v);
      if (!list.length) return;
      lines.push(`${verdictMeta[v].label.toUpperCase()} (${list.length})`);
      list.forEach((m) => lines.push(`  ${m.no}. ${m.name}${items[m.no]?.note ? ` — ${items[m.no]!.note}` : ""}`));
      lines.push("");
    });
    const pending = modules.filter((m) => !items[m.no]?.verdict);
    if (pending.length) lines.push(`NOT YET REVIEWED (${pending.length}): ${pending.map((m) => m.no).join(", ")}`);
    const text = lines.join("\n");
    navigator.clipboard
      .writeText(text)
      .then(() => toast.success("Feedback summary copied", { description: `${reviewed} modules reviewed — paste into WhatsApp or email` }))
      .catch(() => toast.error("Clipboard blocked by browser"));
  };

  return (
    <div>
      <PageHeader
        eyebrow="Blueprint · MODULES.md"
        title="Module map"
        description="All 47 modules of Agency OS and how deep this demo goes. Mark each one during the walkthrough — feedback is saved on this device."
        actions={
          <>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                clear();
                toast("Feedback cleared");
              }}
              disabled={!reviewed}
            >
              <RotateCcw /> Reset
            </Button>
            <Button variant="accent" size="sm" onClick={exportText}>
              <ClipboardCopy /> Export feedback
            </Button>
          </>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(["demo", "preview", "planned"] as Depth[]).map((d) => (
          <button
            key={d}
            onClick={() => setFilter(filter === d ? "all" : d)}
            aria-pressed={filter === d}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-3 rounded-2xl border bg-card p-5 text-left shadow-card transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
              filter === d ? "border-primary ring-2 ring-primary/15" : "border-border",
            )}
          >
            <div className="min-w-0">
              <Badge tone={depthMeta[d].tone}>{depthMeta[d].label}</Badge>
              <div className="mt-2 text-body text-muted-foreground">{depthMeta[d].desc}</div>
            </div>
            <span className="text-heading font-semibold tabular">{counts[d]}</span>
          </button>
        ))}
      </div>

      <div className="sticky top-14 z-10 -mx-4 mb-5 border-b border-border bg-background/85 px-4 py-3 backdrop-blur-xl lg:-mx-8 lg:px-8">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="scrollbar-thin inline-flex h-9 max-w-full items-center gap-0.5 self-start overflow-x-auto rounded-lg bg-muted p-1 lg:self-auto" role="group" aria-label="Filter by depth">
            {(["all", "demo", "preview", "planned"] as Filter[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={cn(
                  "h-7 shrink-0 cursor-pointer rounded-md px-3 text-body font-medium capitalize text-muted-foreground transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                  filter === f && "bg-card text-foreground shadow-sm",
                )}
              >
                {f} <span className="ml-0.5 text-muted-foreground tabular">{counts[f]}</span>
              </button>
            ))}
          </div>
          <div className="relative lg:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search modules or #" className="pl-9" />
          </div>
          <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
            <div className="flex items-center gap-2 text-body">
              <div className="flex h-2 w-28 overflow-hidden rounded-full bg-muted sm:w-40" aria-hidden>
                <div className="bg-success transition-all" style={{ width: `${(tally.approve / 47) * 100}%` }} />
                <div className="bg-warning transition-all" style={{ width: `${(tally.change / 47) * 100}%` }} />
                <div className="bg-danger transition-all" style={{ width: `${(tally.remove / 47) * 100}%` }} />
              </div>
              <span className="text-muted-foreground tabular">{reviewed}/47</span>
            </div>
            {(
              [
                ["any", `All`],
                ["approve", `${tally.approve} approved`],
                ["change", `${tally.change} ${tally.change === 1 ? "change" : "changes"}`],
                ["remove", `${tally.remove} remove`],
                ["pending", `${47 - reviewed} pending`],
              ] as [FbFilter, string][]
            ).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setFb(fb === k ? "any" : k)}
                aria-pressed={fb === k}
                className={cn(
                  "h-7 cursor-pointer rounded-full border px-2.5 text-body font-medium transition tabular focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                  fb === k ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface text-muted-foreground hover:border-primary/40 hover:text-primary",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {MODULE_GROUPS.map((g) => {
          const list = visible.filter((m) => m.group === g.id);
          if (!list.length) return null;
          return (
            <section key={g.id}>
              <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <h2 className="text-subheading font-semibold tracking-tight">{g.title}</h2>
                <span className="text-body text-muted-foreground">
                  Modules {g.range} · {g.desc}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((m) => (
                  <ModuleCard
                    key={m.no}
                    m={m}
                    verdict={items[m.no]?.verdict}
                    note={items[m.no]?.note ?? ""}
                    onVerdict={(v) => {
                      const next = items[m.no]?.verdict === v ? undefined : v;
                      setVerdict(m.no, next);
                      if (next) toast.success(`#${m.no} ${m.name}`, { description: verdictMeta[next].label });
                    }}
                    onNote={(n) => setNote(m.no, n)}
                  />
                ))}
              </div>
            </section>
          );
        })}
        {!visible.length && (
          <EmptyState
            icon={Search}
            title="No modules match these filters"
            description="Try a different search term, depth or feedback filter."
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFilter("all");
                  setFb("any");
                  setQ("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}

function ModuleCard({
  m,
  verdict,
  note,
  onVerdict,
  onNote,
}: {
  m: ModuleRow;
  verdict?: Verdict;
  note: string;
  onVerdict: (v: Verdict) => void;
  onNote: (n: string) => void;
}) {
  const dm = depthMeta[m.depth];
  return (
    <Card
      className={cn(
        "flex flex-col p-5 transition",
        verdict === "approve" && "border-success/40",
        verdict === "change" && "border-warning/50",
        verdict === "remove" && "border-danger/40 opacity-75",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-body font-semibold tabular",
            m.depth === "demo" ? "bg-primary-soft text-primary" : m.depth === "preview" ? "bg-info-soft text-info" : "bg-muted text-muted-foreground",
          )}
        >
          {m.no}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className={cn("text-body font-semibold leading-snug", verdict === "remove" && "line-through")}>{m.name}</h3>
            <Tooltip content={dm.desc}>
              <span className="shrink-0">
                <Badge tone={dm.tone}>{dm.label}</Badge>
              </span>
            </Tooltip>
          </div>
          <p className="mt-0.5 text-body text-muted-foreground">{m.summary}</p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5 pl-11">
        {m.routes.length ? (
          m.routes.map((r) => (
            <Link
              key={r.href}
              href={r.href}
              className="inline-flex items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-body text-muted-foreground transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
            >
              {r.title} <ArrowUpRight className="size-3" />
            </Link>
          ))
        ) : (
          <span className="text-body text-muted-foreground">No screen yet</span>
        )}
      </div>

      <div className="mt-auto pt-3">
        <div className="flex gap-1.5 border-t border-border pt-3">
          {(Object.keys(verdictMeta) as Verdict[]).map((v) => {
            const vm = verdictMeta[v];
            const on = verdict === v;
            return (
              <button
                key={v}
                onClick={() => onVerdict(v)}
                aria-pressed={on}
                className={cn(
                  "inline-flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-center gap-1 rounded-md border px-1.5 text-body font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                  on ? vm.on : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <vm.icon className="size-3.5 shrink-0" />
                <span className="truncate">{vm.label}</span>
              </button>
            );
          })}
        </div>
        {(verdict === "change" || verdict === "remove") && (
          <Input
            autoFocus={!note}
            value={note}
            onChange={(e) => onNote(e.target.value)}
            placeholder={verdict === "change" ? "What should change?" : "Why remove? (optional)"}
            className="mt-2 h-8 text-body"
          />
        )}
      </div>
    </Card>
  );
}
