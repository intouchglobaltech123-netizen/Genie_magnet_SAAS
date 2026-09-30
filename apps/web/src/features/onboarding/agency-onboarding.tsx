"use client";

import Link from "next/link";
import { ArrowRight, Building2, CalendarClock, Check, Clock, Lock, Map as MapIcon } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, SectionCard } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { fmtDay } from "./engine";
import { AgencySetupSummary, BfaScorecard, FitmentMapOutput, Waiting } from "./outputs";
import { useRespondent } from "./store";
import { agencyTemplate } from "./templates";

export function AgencyOnboarding() {
  const { r, prog, win, windowDays } = useRespondent("agency")!;
  const challengesDone = prog.all.find((p) => p.section.id === "challenges")?.complete;

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Building2 className="size-5" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-subheading font-semibold">Genie Magnet · agency questionnaire</h2>
                <Badge tone={prog.required.complete ? "success" : "warning"}>{prog.required.complete ? "Workspace unlocked" : "Setup in progress"}</Badge>
              </div>
              <p className="mt-0.5 text-body text-muted-foreground">
                {agencyTemplate.version} · started by {r.contact} on {fmtDay(r.sentOn!)} · required sections answered the same day. In the SaaS, every new agency answers this at sign-up.
              </p>
            </div>
          </div>
          <div className="grid w-full shrink-0 grid-cols-2 gap-3 lg:w-[420px]">
            <MeterBox icon={Lock} label="Required to start" answered={prog.required.answered} total={prog.required.total} complete={prog.required.complete} note="Unlocks the workspace" />
            <MeterBox
              icon={Clock}
              label={`Within ${windowDays} days`}
              answered={prog.later.answered}
              total={prog.later.total}
              complete={prog.later.complete}
              note={win.label}
              warn={win.state === "due-soon" || win.state === "overdue"}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle bg-surface-secondary px-5 py-3">
          <div className="flex flex-wrap gap-1.5">
            {prog.all.map((p) => (
              <span
                key={p.section.id}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-body",
                  p.complete ? "border-success/30 bg-success-soft/50 text-success" : p.answered ? "border-border bg-surface" : "border-dashed border-border-strong text-muted-foreground",
                )}
              >
                {p.complete && <Check className="size-3.5" />}
                {p.section.title}
                {!p.complete && (
                  <span className="tabular text-muted-foreground">
                    {p.answered}/{p.total}
                  </span>
                )}
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => toast.success("Re-run scheduled", { description: "The agency questionnaire reopens at the 45-day strategic review on 10 Oct, to measure progress." })}
            >
              <CalendarClock /> Re-run at next strategic review
            </Button>
            <Button size="sm" asChild>
              <Link href="/onboarding/agency">
                Continue questionnaire <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </Card>

      <SectionCard title="Set up from the required answers" description="Packages, team roles and the revenue goal were created from the first four sections.">
        <AgencySetupSummary answers={r.answers} />
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2 [&>*]:min-w-0">
        <SectionCard
          title="Client Fitment Map"
          description="Customer types by effort to serve and return"
          actions={
            <Badge tone="outline">
              <MapIcon /> Growth OS
            </Badge>
          }
        >
          <FitmentMapOutput answers={r.answers} />
        </SectionCard>
        <SectionCard title="Business Functional Assessment" description="Seven functions: consistency, owner dependency, results and second-line leaders">
          <BfaScorecard answers={r.answers} />
        </SectionCard>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Strategic Road Map and first 90-day plan</CardTitle>
            <CardDescription>Genie Assistant drafts it from the challenges and BFA; Janarthanan reviews and publishes it.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>{challengesDone ? <p className="text-body">Ready to draft.</p> : <Waiting section="Challenges and priorities" />}</CardContent>
      </Card>
    </div>
  );
}

function MeterBox({
  icon: Icon,
  label,
  answered,
  total,
  complete,
  note,
  warn,
}: {
  icon: typeof Lock;
  label: string;
  answered: number;
  total: number;
  complete: boolean;
  note: string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface-secondary p-3">
      <div className="flex items-center justify-between gap-2 text-body">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Icon className="size-3.5 text-muted-foreground" /> {label}
        </span>
        <span className="tabular text-muted-foreground">
          {answered}/{total}
        </span>
      </div>
      <Progress className="mt-2" value={total ? (answered / total) * 100 : 0} tone={complete ? "success" : warn ? "warning" : "accent"} />
      <div className={cn("mt-1 truncate text-body", warn ? "text-warning" : "text-muted-foreground")}>{note}</div>
    </div>
  );
}
