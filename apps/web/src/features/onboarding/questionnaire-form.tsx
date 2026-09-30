"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock, CloudCheck, Lock, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { visibleQuestions, type SectionProgress } from "./engine";
import { QuestionField } from "./question-field";
import { useOnboarding, useRespondent } from "./store";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35";

/**
 * One form for every way a questionnaire is answered:
 * `public` — the client's own link; `assisted` — the account manager fills it with the client on a call;
 * `agency` — the agency owner answers the agency questionnaire.
 */
export function QuestionnaireForm({ respondentId, mode }: { respondentId: string; mode: "public" | "assisted" | "agency" }) {
  const live = useRespondent(respondentId)!;
  const setAnswer = useOnboarding((s) => s.setAnswer);
  const { r, template, prog, win, windowDays } = live;
  const ordered = [...prog.required.sections, ...prog.later.sections];
  const firstOpen = ordered.find((p) => !p.complete)?.section.id ?? ordered[0]!.section.id;
  const [active, setActive] = useState(firstOpen);
  const topRef = useRef<HTMLDivElement>(null);
  const wasRequiredDone = useRef(prog.required.complete);

  const idx = ordered.findIndex((p) => p.section.id === active);
  const current = ordered[idx]!;
  const qs = visibleQuestions(current.section, r.answers);
  const internal = mode !== "public";

  useEffect(() => {
    if (prog.required.complete && !wasRequiredDone.current) {
      const title = template.id === "agency" ? "Workspace unlocked" : mode === "public" ? "You're all set — Genie Magnet can start work" : "Required sections done — production can start";
      toast.success(title, {
        description:
          mode === "public"
            ? `The other sections can be completed within ${windowDays} days. We'll send you a reminder on WhatsApp.`
            : `The other sections can be completed within ${windowDays} days. Genie Assistant will send reminders.`,
      });
    }
    wasRequiredDone.current = prog.required.complete;
  }, [prog.required.complete, template.id, windowDays, mode]);

  const go = (i: number) => {
    setActive(ordered[i]!.section.id);
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div ref={topRef} className="scroll-mt-24 grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card className="p-4">
          <GroupMeter label="Required to start" icon={Lock} answered={prog.required.answered} total={prog.required.total} complete={prog.required.complete} />
          <div className="my-3 border-t border-border-subtle" />
          <GroupMeter
            label={`Complete within ${windowDays} days`}
            icon={Clock}
            answered={prog.later.answered}
            total={prog.later.total}
            complete={prog.later.complete}
            hint={win.state === "not-sent" ? undefined : win.label}
          />
        </Card>
        <nav aria-label="Questionnaire sections" className="scrollbar-thin -mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:mx-0 lg:block lg:space-y-4 lg:overflow-visible lg:p-0">
          <SectionGroup title="Required to start" list={prog.required.sections} active={active} onPick={(id) => go(ordered.findIndex((p) => p.section.id === id))} />
          <SectionGroup title={`Within ${windowDays} days`} list={prog.later.sections} active={active} onPick={(id) => go(ordered.findIndex((p) => p.section.id === id))} />
        </nav>
      </aside>

      <div className="min-w-0 space-y-4">
        {prog.required.complete && (
          <div className="flex items-start gap-3 rounded-2xl border border-success/30 bg-success-soft/50 p-4">
            <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-success-soft text-success ring-1 ring-success/30">
              {prog.later.complete ? <PartyPopper className="size-4" /> : <CheckCircle2 className="size-4" />}
            </span>
            <div className="min-w-0 text-body">
              <div className="font-semibold text-text-primary">
                {prog.later.complete
                  ? "All done — thank you!"
                  : template.id === "client"
                    ? mode === "public"
                      ? "You're all set to start"
                      : "Required sections done — the onboarding gate can open"
                    : "Workspace unlocked"}
              </div>
              <div className="text-muted-foreground">
                {prog.later.complete
                  ? "Every section is answered. Your team will build your plan from these answers."
                  : `The remaining ${prog.later.sections.length - prog.later.done} sections can be completed within ${windowDays} days${win.dueOn ? ` (by ${win.dueOn})` : ""}. You can close this page and come back any time — answers are saved.`}
              </div>
            </div>
          </div>
        )}

        <Card className="overflow-hidden">
          <div className="border-b border-border-subtle bg-surface-secondary px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={current.section.when === "required" ? "danger" : "info"}>
                {current.section.when === "required" ? (
                  <>
                    <Lock /> Required to start
                  </>
                ) : (
                  <>
                    <Clock /> Within {windowDays} days
                  </>
                )}
              </Badge>
              <span className="text-body text-muted-foreground tabular">
                Section {idx + 1} of {ordered.length} · {current.answered}/{current.total} answered
              </span>
            </div>
            <h2 className="mt-2 text-subheading font-semibold tracking-tight">{current.section.title}</h2>
            <p className="mt-0.5 text-body text-muted-foreground">{current.section.intro}</p>
            {internal && (
              <p className="mt-2 text-body text-muted-foreground">
                <span className="font-medium text-text-secondary">Builds:</span> {current.section.builds}
              </p>
            )}
          </div>
          <div className="divide-y divide-border-subtle">
            {qs.map((q, i) => (
              <div key={q.id} className="px-5 py-5 sm:px-6">
                <QuestionField q={q} index={i + 1} value={r.answers[q.id]} onChange={(v) => setAnswer(r.id, q.id, v)} showMapping={internal} />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface-secondary px-5 py-3.5 sm:px-6">
            <span className="inline-flex items-center gap-1.5 text-body text-muted-foreground">
              <CloudCheck className="size-4 text-success" /> Saved automatically
              {mode === "assisted" && " · entered by Ashwin"}
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" disabled={idx === 0} onClick={() => go(idx - 1)}>
                <ArrowLeft /> Back
              </Button>
              {idx < ordered.length - 1 ? (
                <Button size="sm" onClick={() => go(idx + 1)}>
                  Next section <ArrowRight />
                </Button>
              ) : (
                <Button
                  size="sm"
                  variant="success"
                  onClick={() =>
                    toast.success(prog.later.complete ? "Questionnaire complete" : "Progress saved", {
                      description: prog.later.complete
                        ? "Everything is answered. The team has been notified."
                        : `Unanswered sections stay open until ${win.dueOn ?? "the due date"}.`,
                    })
                  }
                >
                  <Check /> Finish
                </Button>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function GroupMeter({
  label,
  icon: Icon,
  answered,
  total,
  complete,
  hint,
}: {
  label: string;
  icon: typeof Lock;
  answered: number;
  total: number;
  complete: boolean;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-body">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Icon className="size-3.5 text-muted-foreground" /> {label}
        </span>
        <span className="tabular text-muted-foreground">
          {answered}/{total}
        </span>
      </div>
      <Progress className="mt-2" value={total ? (answered / total) * 100 : 0} tone={complete ? "success" : "accent"} />
      {hint && <div className="mt-1.5 text-body text-muted-foreground">{hint}</div>}
    </div>
  );
}

function SectionGroup({ title, list, active, onPick }: { title: string; list: SectionProgress[]; active: string; onPick: (id: string) => void }) {
  return (
    <div className="flex shrink-0 gap-2 lg:block">
      <div className="hidden px-1 pb-1.5 text-body font-medium uppercase tracking-wider text-muted-foreground lg:block">{title}</div>
      <ul className="flex gap-2 lg:block lg:space-y-1">
        {list.map((p) => {
          const on = p.section.id === active;
          return (
            <li key={p.section.id} className="shrink-0">
              <button
                type="button"
                onClick={() => onPick(p.section.id)}
                aria-current={on ? "step" : undefined}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2.5 whitespace-nowrap rounded-lg border px-3 py-2 text-left text-body transition lg:whitespace-normal",
                  FOCUS,
                  on ? "border-primary bg-primary-soft/60 text-primary" : "border-transparent bg-card hover:bg-muted lg:bg-transparent",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-body font-semibold",
                    p.complete ? "bg-success text-success-foreground" : "border border-border-strong text-muted-foreground",
                  )}
                  aria-hidden
                >
                  {p.complete ? <Check className="size-3" /> : null}
                </span>
                <span className="min-w-0 flex-1 font-medium">{p.section.title}</span>
                <span className="shrink-0 text-muted-foreground tabular">
                  {p.answered}/{p.total}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
