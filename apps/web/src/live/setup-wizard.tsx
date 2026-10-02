"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, FlaskConical, Layers, Package, Play, Target, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { type SetupWizard, SUITES, suiteLabel } from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, SkeletonRows } from "@/components/ui/feedback";
import { inr } from "@/lib/utils";
import { errorMessage } from "./api";
import { useCan, useGoalAction, useMe, usePackagesFromAnswers, useSampleAction, useSetupWizard, useStartAgencyOnboarding } from "./queries";

/** One step of the wizard: its number, whether it is done, what it is for, and what to do now. */
function Step({ n, done, title, why, children }: { n: number; done: boolean; title: string; why: string; children?: React.ReactNode }) {
  return (
    <li>
      <Card className="flex gap-4 p-5">
        <span className="mt-0.5 shrink-0">
          {done ? (
            <CheckCircle2 className="size-6 text-success" aria-label="Done" />
          ) : (
            <span className="inline-flex size-6 items-center justify-center rounded-full border border-border-strong text-body font-semibold text-muted-foreground">
              {n}
            </span>
          )}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h2 className="text-subheading font-semibold">{title}</h2>
            <p className="text-body text-muted-foreground">{why}</p>
          </div>
          {children}
        </div>
      </Card>
    </li>
  );
}

/** Set up your workspace (P6-06): the agency questionnaire's essentials, then what they make, step by step. */
export function LiveSetupWizard() {
  const q = useSetupWizard();
  const can = useCan();
  const me = useMe().data;
  const start = useStartAgencyOnboarding();
  const editor = can("settings", "edit");
  if (q.isPending) return <SkeletonRows rows={6} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const w = q.data;
  const essentials = !!w.questionnaire?.requiredDone;
  const planSuites = me?.entitlements?.plan ? me.entitlements.suites : null;
  return (
    <>
      <PageHeader
        title="Set up your workspace"
        description="Answer the essentials about your agency once, and they set up your packages, this year's goals and the suites worth having. About fifteen minutes; everything can be changed later."
      />
      {!editor && (
        <Alert tone="info" className="mb-5">
          The owner or a manager sets up the workspace. You can see how far it has got.
        </Alert>
      )}
      <ol className="space-y-3">
        <Step
          n={1}
          done={essentials}
          title="Answer the essentials about your agency"
          why="Four short sections of your agency questionnaire: about the agency, what you sell and your packages, your main goal, and your team. The deeper sections can wait."
        >
          {editor &&
            (w.questionnaire ? (
              <Button asChild variant={essentials ? "outline" : "accent"} size="sm">
                <Link href="/app/onboarding/agency">
                  {essentials ? "See your answers" : "Carry on answering"} <ArrowRight />
                </Link>
              </Button>
            ) : (
              <Button
                variant="accent"
                size="sm"
                disabled={start.isPending}
                onClick={() => start.mutate(undefined, { onSuccess: () => void q.refetch(), onError: (e) => toast.error(errorMessage(e)) })}
              >
                <Play /> Start the questionnaire
              </Button>
            ))}
        </Step>
        <PackagesStep w={w} editor={editor} />
        <GoalsStep w={w} editor={editor} planSuites={planSuites} />
        <Step
          n={4}
          done={false}
          title="The suites worth having"
          why="On top of sales, clients, delivery, the portal and invoices, which every plan has. From your answers:"
        >
          {!w.suites.length ? (
            <p className="text-body text-muted-foreground">
              {essentials ? "Your answers do not point to any add-on suite yet." : "Shown once the essentials are answered."}
            </p>
          ) : (
            <ul className="space-y-2">
              {w.suites.map((s) => {
                const has = !planSuites || planSuites.includes(s.key);
                return (
                  <li key={s.key} className="flex flex-wrap items-start gap-2 text-body">
                    <Layers className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 flex-1">
                      <span className="font-medium">{suiteLabel(s.key)}</span> — {s.why}
                    </span>
                    <Badge tone={has ? "success" : "warning"}>{has ? "In your plan" : "Not in your plan"}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-body text-muted-foreground">
            {SUITES.length - w.suites.length > 0 && w.suites.length > 0 ? "The others can wait until you need them. " : ""}
            Plans and what each one has are in{" "}
            <Link href="/app/settings/plan" className="text-primary hover:underline">
              Settings → Plan
            </Link>
            .
          </p>
        </Step>
        <Step
          n={5}
          done={w.team.onTeam > 1 || w.team.invited > 0}
          title="Invite your team"
          why={
            w.team.inAnswers
              ? `Your answers name ${w.team.inAnswers} ${w.team.inAnswers === 1 ? "person" : "people"}. Invite each with the role that fits; they set their own password.`
              : "Invite each person with the role that fits; they set their own password."
          }
        >
          <p className="text-body text-muted-foreground">
            {w.team.onTeam} on the team{w.team.invited ? `, ${w.team.invited} invited` : ""}.
          </p>
          {editor && (
            <Button asChild variant="outline" size="sm">
              <Link href="/app/settings/team">
                <Users /> Open Team
              </Link>
            </Button>
          )}
        </Step>
        <SampleStep w={w} editor={editor} />
      </ol>
      <div className="mt-6 flex justify-end">
        <Button asChild variant="accent">
          <Link href="/app">
            Go to Home <ArrowRight />
          </Link>
        </Button>
      </div>
    </>
  );
}

function PackagesStep({ w, editor }: { w: SetupWizard; editor: boolean }) {
  const make = usePackagesFromAnswers(w.questionnaire?.id ?? "");
  const q = useSetupWizard();
  return (
    <Step
      n={2}
      done={w.packages.made > 0}
      title="Your packages"
      why="What you sell each month, with its videos, posts and shoot days: proposals, agreements, quotas and invoices start from here."
    >
      <p className="text-body text-muted-foreground">
        {w.packages.made ? `${w.packages.made} ${w.packages.made === 1 ? "package" : "packages"} set up.` : "None set up yet."}
        {w.packages.inAnswers ? ` ${w.packages.inAnswers} in your answers.` : ""}
      </p>
      {editor && (
        <div className="flex flex-wrap gap-2">
          {w.packages.inAnswers > 0 && (
            <Button
              size="sm"
              variant={w.packages.made ? "outline" : "accent"}
              disabled={make.isPending}
              onClick={() =>
                make.mutate(undefined, {
                  onSuccess: (r) => (
                    void q.refetch(),
                    toast.success(r.added.length ? `Added ${r.added.join(", ")}` : "All of these packages are already there")
                  ),
                  onError: (e) => toast.error(errorMessage(e)),
                })
              }
            >
              <Package /> Make them your packages
            </Button>
          )}
          <Button asChild size="sm" variant="ghost">
            <Link href="/app/settings/packages">Open Packages</Link>
          </Button>
        </div>
      )}
    </Step>
  );
}

function GoalsStep({ w, editor, planSuites }: { w: SetupWizard; editor: boolean; planSuites: string[] | null }) {
  const act = useGoalAction();
  const q = useSetupWizard();
  const inPlan = !planSuites || planSuites.includes("management");
  return (
    <Step
      n={3}
      done={w.goals.made > 0}
      title="This year's goals"
      why="Your revenue target for the financial year becomes the agency's goal, with a goal for each quarter you gave, and the reason behind it."
    >
      <p className="text-body text-muted-foreground">
        {w.goals.target ? `Your target: ${inr(w.goals.target)} this financial year.` : "Waiting for this year's revenue target in your answers."}
        {w.goals.made ? ` ${w.goals.made} ${w.goals.made === 1 ? "goal" : "goals"} set.` : ""}
      </p>
      {!inPlan ? (
        <p className="text-body text-muted-foreground">Goals are in the Management suite, which is not in your plan.</p>
      ) : (
        editor && (
          <div className="flex flex-wrap gap-2">
            {w.goals.target !== null && (
              <Button
                size="sm"
                variant={w.goals.made ? "outline" : "accent"}
                disabled={act.isPending}
                onClick={() =>
                  act.mutate(
                    { step: "fromQuestionnaire" },
                    { onSuccess: () => (void q.refetch(), toast.success("This year's goals are set")), onError: (e) => toast.error(errorMessage(e)) },
                  )
                }
              >
                <Target /> {w.goals.made ? "Update the goals from the answers" : "Set this year's goals"}
              </Button>
            )}
            <Button asChild size="sm" variant="ghost">
              <Link href="/app/goals">Open Goals</Link>
            </Button>
          </div>
        )
      )}
    </Step>
  );
}

function SampleStep({ w, editor }: { w: SetupWizard; editor: boolean }) {
  const act = useSampleAction();
  const [confirm, setConfirm] = useState(false);
  const s = w.sample;
  return (
    <Step
      n={6}
      done={false}
      title="Try it with sample data (optional)"
      why="Three sample clients, four leads along the pipeline and four videos, all marked “(sample)”, to try things before your own are in. Remove them in one go when you are ready."
    >
      {s ? (
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="info">
            <FlaskConical className="size-3.5" /> {s.clients} clients, {s.leads} leads and {s.videos} videos to try with
          </Badge>
          {editor && (
            <Button size="sm" variant="outline" onClick={() => setConfirm(true)}>
              <Trash2 /> Remove the sample data
            </Button>
          )}
        </div>
      ) : (
        editor && (
          <Button
            size="sm"
            variant="outline"
            disabled={act.isPending}
            onClick={() => act.mutate({ step: "add" }, { onSuccess: () => toast.success("Sample data added"), onError: (e) => toast.error(errorMessage(e)) })}
          >
            <FlaskConical /> Add sample data
          </Button>
        )
      )}
      <Dialog open={confirm} onOpenChange={setConfirm}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Remove the sample data?</DialogTitle>
            <DialogDescription>
              The sample clients, leads and videos go, with everything made for those clients since — agreements, videos, shoots, topics, portal links. A sample
              client you issued an invoice to stays, with its invoices, for your GST records.
            </DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirm(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={act.isPending}
              onClick={() =>
                act.mutate(
                  { step: "remove" },
                  {
                    onSuccess: (r) => {
                      setConfirm(false);
                      if (r && "kept" in r && r.kept.length)
                        toast(`Sample data removed, except ${r.kept.join(", ")}, kept with the invoices issued to ${r.kept.length === 1 ? "it" : "them"}`);
                      else toast.success("Sample data removed");
                    },
                    onError: (e) => toast.error(errorMessage(e)),
                  },
                )
              }
            >
              <Trash2 /> Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Step>
  );
}
