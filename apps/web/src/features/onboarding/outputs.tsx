"use client";

import Link from "next/link";
import { ArrowRight, Check, Hourglass, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { categoryMeta } from "@/components/shared/video-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn, inrCompact, pct } from "@/lib/utils";
import { bfaScores, quadrantFor, type Quadrant, type SectionProgress } from "./engine";
import { useOnboarding, type LiveRespondent } from "./store";
import type { Answers, TableValue } from "./templates";

const list = (a: Answers, k: string) => (Array.isArray(a[k]) ? (a[k] as string[]) : []);
const text = (a: Answers, k: string) => (typeof a[k] === "string" ? (a[k] as string) : "");
const rows = (a: Answers, k: string) => (Array.isArray(a[k]) && typeof (a[k] as unknown[])[0] === "object" ? (a[k] as TableValue) : []);

export function Waiting({ section, className }: { section: string; className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5 rounded-xl border border-dashed border-border-strong bg-surface-secondary p-4 text-body text-muted-foreground", className)}>
      <Hourglass className="size-4 shrink-0" />
      <span>
        Waiting for answers · <span className="font-medium text-text-secondary">{section}</span>. Builds automatically once it is answered.
      </span>
    </div>
  );
}

const done = (secs: SectionProgress[], id: string) => secs.find((s) => s.section.id === id)?.complete ?? false;
const partly = (secs: SectionProgress[], id: string) => (secs.find((s) => s.section.id === id)?.answered ?? 0) > 0;

// ───────────────────────────── Client outputs ─────────────────────────────

export function BusinessCanvas({ answers, sections }: { answers: Answers; sections: SectionProgress[] }) {
  const products = rows(answers, "c18").map((r) => r.name).filter(Boolean);
  const competitors = rows(answers, "c19").map((r) => r.name).filter(Boolean);
  const blocks: { title: string; chips?: string[]; body?: string; from: string; ready: boolean; wide?: boolean }[] = [
    { title: "Customers", chips: list(answers, "c7"), body: text(answers, "c9") || text(answers, "c8"), from: "Business model and customers", ready: partly(sections, "model") },
    { title: "Problems we solve", body: text(answers, "c13"), from: "Needs, problems and desires", ready: !!text(answers, "c13") },
    { title: "Deep desires", body: text(answers, "c16"), from: "Needs, problems and desires", ready: !!text(answers, "c16") },
    { title: "Products and services", chips: products, from: "Products and services", ready: products.length > 0 },
    { title: "Channels", chips: list(answers, "c23"), from: "Marketing and sales today", ready: list(answers, "c23").length > 0 },
    { title: "Competitors", chips: competitors, from: "Competition and positioning", ready: competitors.length > 0 },
    { title: "Why us", chips: list(answers, "c20"), from: "Competition and positioning", ready: list(answers, "c20").length > 0 },
    { title: "Goals for this engagement", body: text(answers, "c26"), from: "Goals for this engagement", ready: done(sections, "goals"), wide: true },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {blocks.map((b) => (
        <div key={b.title} className={cn("rounded-xl border p-3.5", b.ready ? "border-border bg-surface" : "border-dashed border-border-strong bg-surface-secondary", b.wide && "sm:col-span-2 xl:col-span-4")}>
          <div className="text-body font-semibold text-text-primary">{b.title}</div>
          {b.ready ? (
            <>
              {!!b.chips?.length && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {b.chips.map((x) => (
                    <Badge key={x} tone="outline">
                      {x}
                    </Badge>
                  ))}
                </div>
              )}
              {b.body && <p className="mt-1.5 text-body text-muted-foreground">{b.body}</p>}
            </>
          ) : (
            <p className="mt-1 inline-flex items-center gap-1.5 text-body text-muted-foreground">
              <Hourglass className="size-3.5 shrink-0" /> From “{b.from}”
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

export function ProductMatrix({ answers }: { answers: Answers }) {
  const items = rows(answers, "c18").filter((r) => r.name);
  if (!items.length) return <Waiting section="Products and services" />;
  const avgMargin = items.reduce((s, r) => s + Number(r.margin || 0), 0) / items.length;
  const cell = (effort: string, highMargin: boolean) =>
    items.filter((r) => r.effort === effort && Number(r.margin || 0) >= avgMargin === highMargin);
  const quads = [
    { effort: "Low", high: true, title: "High margin · low effort", note: "Lead with these in content", tone: "border-success/35 bg-success-soft/40" },
    { effort: "High", high: true, title: "High margin · high effort", note: "Show the value to justify the price", tone: "border-primary/25 bg-primary-soft/40" },
    { effort: "Low", high: false, title: "Low margin · low effort", note: "Use as entry offers", tone: "border-warning/30 bg-warning-soft/40" },
    { effort: "High", high: false, title: "Low margin · high effort", note: "Promote less, or review the price", tone: "border-danger/25 bg-danger-soft/40" },
  ];
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {quads.map((q) => (
          <div key={q.title} className={cn("min-h-28 rounded-xl border p-3.5", q.tone)}>
            <div className="text-body font-semibold">{q.title}</div>
            <div className="text-body text-muted-foreground">{q.note}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cell(q.effort, q.high).map((r) => (
                <span key={r.name} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2 py-1 text-body">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground tabular">
                    {r.margin}% · {r.share || "—"}% rev
                  </span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-body text-muted-foreground">
        Margin is compared with the average across products ({avgMargin.toFixed(0)}%). Effort comes from the client&apos;s answer.
      </p>
    </div>
  );
}

export function ContentPillars({ r, sections }: { r: LiveRespondent; sections: SectionProgress[] }) {
  const patch = useOnboarding((s) => s.patch);
  if (!done(sections, "needs") || !r.pillars) return <Waiting section="Needs, problems and desires" />;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Badge tone={r.pillarsApproved ? "success" : "gold"}>
          {r.pillarsApproved ? (
            <>
              <Check /> Approved by account manager
            </>
          ) : (
            <>
              <Sparkles /> Genie Assistant draft · needs approval
            </>
          )}
        </Badge>
        {!r.pillarsApproved && (
          <Button
            size="xs"
            onClick={() => {
              patch(r.id, { pillarsApproved: true });
              toast.success("Content pillars approved", { description: "They now guide the idea bank and topic suggestions in Content." });
            }}
          >
            <Check /> Approve pillars
          </Button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {r.pillars.map((p, i) => (
          <div key={p.title} className="rounded-xl border border-border bg-surface p-3.5">
            <div className="text-body font-medium text-muted-foreground">Pillar {i + 1}</div>
            <div className="text-body font-semibold">{p.title}</div>
            <div className="mt-1 text-body text-muted-foreground">e.g. “{p.example}”</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────────────────────────── Agency outputs ─────────────────────────────

const quadOrder: Quadrant[] = ["Amazing", "Bread-winning", "Convenience", "Dangerous"];
const quadTone: Record<Quadrant, string> = {
  Amazing: "border-success/35 bg-success-soft/40",
  "Bread-winning": "border-primary/25 bg-primary-soft/40",
  Convenience: "border-warning/30 bg-warning-soft/40",
  Dangerous: "border-danger/25 bg-danger-soft/40",
};

export function FitmentMapOutput({ answers }: { answers: Answers }) {
  const types = rows(answers, "a5").filter((r) => r.type);
  if (!types.length) return <Waiting section="Customers: effort vs return" />;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {quadOrder.map((q) => {
          const inQ = types.filter((t) => quadrantFor(t.effort, t.return) === q);
          const share = inQ.reduce((s, t) => s + Number(t.share || 0), 0);
          return (
            <div key={q} className={cn("rounded-xl border p-3.5", quadTone[q])}>
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-body font-semibold">
                  {categoryMeta[q].letter} · {q}
                </div>
                <span className="text-body tabular text-muted-foreground">{share}% of revenue</span>
              </div>
              <div className="text-body text-muted-foreground">{categoryMeta[q].desc}</div>
              <ul className="mt-2 space-y-1">
                {inQ.map((t) => (
                  <li key={t.type} className="text-body">
                    <span className="font-medium">{t.type}</span>{" "}
                    <span className="text-muted-foreground tabular">
                      · {t.count} · {t.billing ? inrCompact(Number(t.billing)) : "—"}/yr
                    </span>
                  </li>
                ))}
                {!inQ.length && <li className="text-body text-muted-foreground">No customer types here</li>}
              </ul>
            </div>
          );
        })}
      </div>
      <Button variant="ghost" size="xs" asChild>
        <Link href="/client-health">
          Place each client on the map <ArrowRight />
        </Link>
      </Button>
    </div>
  );
}

export function BfaScorecard({ answers }: { answers: Answers }) {
  const s = bfaScores(rows(answers, "a7"));
  if (!s.answered) return <Waiting section="Business Functional Assessment" />;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-border bg-surface p-3.5">
          <div className="text-body text-muted-foreground">BFA score</div>
          <div className="text-heading font-semibold tabular text-primary dark:text-text-primary">{pct(s.overall)}</div>
          <div className="text-body text-muted-foreground">{s.answered} of 7 functions assessed</div>
        </div>
        <div className="rounded-xl border border-warning/30 bg-warning-soft/40 p-3.5">
          <div className="text-body text-muted-foreground">Founder-dependency index</div>
          <div className="text-heading font-semibold tabular text-warning">{pct(s.founderDependency)}</div>
          <div className="text-body text-muted-foreground">Functions that still depend on the owner</div>
        </div>
      </div>
      <ul className="space-y-2.5">
        {s.list.map((f) => (
          <li key={f.fn} className="grid grid-cols-[minmax(0,150px)_1fr_auto] items-center gap-3 text-body">
            <span className="truncate font-medium">{f.fn}</span>
            <Progress value={(f.score / 4) * 100} tone={f.score >= 3 ? "success" : f.score === 2 ? "warning" : "danger"} />
            <span className="flex items-center gap-1.5">
              <span className="tabular text-muted-foreground">{f.score}/4</span>
              {f.ownerDependent && <Badge tone="warning">Owner</Badge>}
              {f.action && <Badge tone="outline">{f.action}</Badge>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AgencySetupSummary({ answers }: { answers: Answers }) {
  const packages = rows(answers, "a4").filter((r) => r.name);
  const team = rows(answers, "a20").filter((r) => r.name);
  const current = Number(text(answers, "a14") || 0);
  const target = Number(text(answers, "a14b") || 0);
  const items = [
    { label: "Packages set up", value: String(packages.length), sub: packages.map((p) => p.name).join(" · "), href: "/agreements" },
    { label: "Team invited", value: String(team.length), sub: team.map((t) => t.name.split(" ")[0]).join(" · "), href: "/settings" },
    {
      label: "Revenue goal",
      value: target ? inrCompact(target) : "—",
      sub: target ? `From ${inrCompact(current)} today · ${pct(target ? current / target : 0)} of the way` : "",
      href: "/goals",
    },
  ];
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {items.map((i) => (
        <Link key={i.label} href={i.href} className="group rounded-xl border border-border bg-surface p-3.5 transition hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
          <div className="flex items-center justify-between text-body text-muted-foreground">
            {i.label} <ArrowRight className="size-3.5 opacity-0 transition group-hover:opacity-100" />
          </div>
          <div className="text-heading font-semibold tabular text-primary dark:text-text-primary">{i.value}</div>
          <div className="truncate text-body text-muted-foreground">{i.sub}</div>
        </Link>
      ))}
    </div>
  );
}
