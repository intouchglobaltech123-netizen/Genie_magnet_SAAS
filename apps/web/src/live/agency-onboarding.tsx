"use client";

import Link from "next/link";
import { ArrowLeft, Landmark, Package, Play, Sparkles, Users } from "lucide-react";
import { toast } from "sonner";
import { type AnswerValue, isAnswered } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/ui/card";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { errorMessage } from "./api";
import { AnswerText } from "./onboarding";
import { inr } from "./packages";
import { startFor } from "./files";
import { QuestionnaireForm } from "./questionnaire";
import { useAgencyOnboarding, useCan, usePackagesFromAnswers, useSaveAnswer, useStartAgencyOnboarding } from "./queries";

type Rows = Record<string, string>[];
const rows = (v: AnswerValue | undefined) => (Array.isArray(v) && v.length && typeof v[0] === "object" ? (v as Rows) : []);

/** Growth OS Client Fitment Map: effort to serve against return. */
function quadrant(effort?: string, ret?: string) {
  if (!effort || !ret) return null;
  if (ret === "High") return effort === "Low" ? "Amazing" : "Bread-winning";
  return effort === "Low" ? "Convenience" : "Dangerous";
}
const QUADRANT_TONE = { Amazing: "success", "Bread-winning": "info", Convenience: "neutral", Dangerous: "danger" } as const;

/** What the agency questionnaire sets up (P1-25): business stage, packages, main goal, team roles, and the fitment map. */
function Outputs({ id, answers }: { id: string; answers: Record<string, AnswerValue> }) {
  const can = useCan();
  const make = usePackagesFromAnswers(id);
  const packages = rows(answers.a4);
  const team = rows(answers.a20);
  const customers = rows(answers.a5);
  const goal = [
    ["Aspiration", answers.a13],
    ["Revenue this year so far", answers.a14],
    ["Revenue target this year", answers.a14b],
  ] as const;
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Business stage" description="Fills in the agency profile.">
        {isAnswered(answers.a2) ? (
          <p className="text-body">
            <Badge tone="accent">{answers.a2 as string}</Badge> — set on{" "}
            <Link href="/app/settings/agency" className="text-primary hover:underline">
              Agency profile
            </Link>
            .
          </p>
        ) : (
          <p className="text-body text-muted-foreground">Waiting for the answer.</p>
        )}
      </SectionCard>
      <SectionCard
        title="Packages"
        description="Your packages table can become your packages, ready for proposals and agreements."
        actions={
          can("settings", "edit") &&
          packages.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              disabled={make.isPending}
              onClick={() =>
                make.mutate(undefined, {
                  onSuccess: (r) => toast.success(r.added.length ? `Added ${r.added.join(", ")}` : "All of these packages are already there"),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              <Package />
              Add as packages
            </Button>
          )
        }
      >
        {packages.length ? (
          <ul className="space-y-1 text-body">
            {packages.map((p, i) => (
              <li key={i}>
                <span className="font-medium">{p.name || "—"}</span> · {p.price ? inr(Number(p.price)) : "no price"} a month · {p.videos || 0} videos,{" "}
                {p.posts || 0} posts
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">Waiting for the packages table.</p>
        )}
      </SectionCard>
      <SectionCard title="Main goal" description="The Business Aspiration and this year's revenue cascade.">
        <dl className="space-y-2 text-body">
          {goal.map(([label, v]) => (
            <div key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd>{v && isAnswered(v) ? typeof v === "string" && /^\d+$/.test(v) ? inr(Number(v)) : <AnswerText value={v} /> : "—"}</dd>
            </div>
          ))}
        </dl>
      </SectionCard>
      <SectionCard
        title="Team and approvals"
        description="Who does what — invite each person with the matching role."
        actions={
          team.length > 0 && (
            <Button size="sm" variant="secondary" asChild>
              <Link href="/app/settings/team">
                <Users />
                Open Team
              </Link>
            </Button>
          )
        }
      >
        {team.length ? (
          <ul className="space-y-1 text-body">
            {team.map((m, i) => (
              <li key={i}>
                <span className="font-medium">{m.name || "—"}</span> · {m.role || "role not given"}
                {m.approves && <span className="text-muted-foreground"> · approves {m.approves.toLowerCase()}</span>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">Waiting for the team table.</p>
        )}
      </SectionCard>
      <SectionCard title="Client Fitment Map" description="Your customer types by effort to serve and return." className="lg:col-span-2">
        {customers.length ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {customers.map((c, i) => {
              const q = quadrant(c.effort, c.return);
              return (
                <li key={i} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2.5 text-body">
                  <span>
                    <span className="font-medium">{c.type || "—"}</span>
                    <span className="block text-muted-foreground">
                      {c.count || "?"} clients · {c.share || "?"}% of revenue · effort {c.effort?.toLowerCase() ?? "?"}, return {c.return?.toLowerCase() ?? "?"}
                    </span>
                  </span>
                  {q && <Badge tone={QUADRANT_TONE[q]}>{q}</Badge>}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-body text-muted-foreground">Waiting for the customers table.</p>
        )}
      </SectionCard>
    </div>
  );
}

export function LiveAgencyOnboarding() {
  const can = useCan();
  const onboarding = useAgencyOnboarding();
  const start = useStartAgencyOnboarding();
  const save = useSaveAnswer(onboarding.data?.id ?? "");
  const canAnswer = can("settings", "edit");
  const header = (
    <>
      <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
        <Link href="/app/onboarding">
          <ArrowLeft />
          Onboarding
        </Link>
      </Button>
      <PageHeader
        title="Your agency questionnaire"
        description="About your own agency: answer the essentials first; the rest builds your goals, Fitment Map and functional assessment. Re-run it at each strategic review."
      />
    </>
  );
  if (onboarding.isPending) return <SkeletonRows rows={8} />;
  if (onboarding.error) return <Alert tone="danger">{errorMessage(onboarding.error)}</Alert>;
  if (!onboarding.data)
    return (
      <>
        {header}
        <EmptyState
          icon={Landmark}
          title="Not started yet"
          description={
            canAnswer
              ? "About 15 minutes for the essentials. Your answers set your business stage and packages, and draft your goals and Fitment Map."
              : "The owner or a manager answers it."
          }
          action={
            canAnswer && (
              <Button disabled={start.isPending} onClick={() => start.mutate(undefined, { onError: (e) => toast.error(errorMessage(e)) })}>
                <Play />
                Start
              </Button>
            )
          }
        />
      </>
    );
  const o = onboarding.data;
  const answers = Object.fromEntries(Object.entries(o.answers).map(([k, a]) => [k, a.value]));
  return (
    <>
      {header}
      <Tabs defaultValue={canAnswer ? "answer" : "outputs"}>
        <TabsList>
          {canAnswer && <TabsTrigger value="answer">Answer</TabsTrigger>}
          <TabsTrigger value="outputs">
            <Sparkles className="size-3.5" />
            What it sets up
          </TabsTrigger>
        </TabsList>
        {canAnswer && (
          <TabsContent value="answer">
            <QuestionnaireForm
              key={o.id}
              sections={o.definition.sections}
              initial={answers}
              windowDays={o.windowDays}
              dueOn={o.window.dueOn}
              mode="agency"
              save={save}
              upload={startFor("onboarding", o.id)}
              files={o.files}
            />
          </TabsContent>
        )}
        <TabsContent value="outputs">
          <Outputs id={o.id} answers={answers} />
        </TabsContent>
      </Tabs>
    </>
  );
}
