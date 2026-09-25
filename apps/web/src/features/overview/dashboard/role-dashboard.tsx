"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { StageBadge, UrgencyIcon } from "@/components/shared/video-bits";
import { Progress } from "@/components/ui/progress";
import { clientById, clients, daysBetween, isOverdue, TODAY } from "@/lib/mock/core";
import { roleLabels } from "@/lib/nav";
import { useDemo } from "@/lib/store";
import type { Role } from "@/lib/types";
import { cn, fmtDate, inr } from "@/lib/utils";
import { EDIT_STEPS } from "@/lib/types";
import { todayLabel } from "./founder-dashboard";
import { RevenueHero } from "./kpis";
import { PipelineByStageCard, RevenueTrendCard } from "./charts";
import { ActivityFeedCard, WeekShootsCard, WorkloadCard } from "./side-cards";

function MyVideos() {
  const videos = useDemo((s) => s.videos).filter((v) => v.editorId === "p-divya");
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>My videos</CardTitle>
          <CardDescription>{videos.length} assigned to you this cycle</CardDescription>
        </div>
        <Button variant="outline" size="xs" asChild>
          <Link href="/daily-sheet">
            <ClipboardList /> Daily sheet
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="divide-y divide-border">
        {videos.map((v) => {
          const done = EDIT_STEPS.filter((s) => v.editSteps[s]).length;
          const days = daysBetween(TODAY, v.dueDate);
          return (
            <Link key={v.id} href={`/production/${v.id}`} className="flex items-center gap-3 py-3 first:pt-0 hover:opacity-90">
              <UrgencyIcon urgency={v.urgency} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-body font-medium">{v.title}</div>
                <div className="text-body text-muted-foreground">
                  <span className="font-mono">{v.code}</span> · {clientById(v.clientId).name}
                </div>
              </div>
              <div className="hidden w-32 sm:block">
                <div className="mb-1 text-body text-muted-foreground tabular">{done}/9 edit steps</div>
                <Progress value={(done / 9) * 100} />
              </div>
              <StageBadge stage={v.stage} />
              <span className={cn("w-20 text-right text-body tabular", isOverdue(v) ? "font-medium text-danger" : days <= 1 ? "text-warning" : "text-muted-foreground")}>
                {isOverdue(v) ? `${-days}d late` : days === 0 ? "Due today" : `Due ${fmtDate(v.dueDate)}`}
              </span>
            </Link>
          );
        })}
      </CardContent>
    </Card>
  );
}

function Receivables() {
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Receivables</CardTitle>
          <CardDescription>Outstanding by client</CardDescription>
        </div>
        <Button variant="ghost" size="xs" asChild>
          <Link href="/billing">
            Billing <ArrowRight />
          </Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {clients
          .filter((c) => c.outstanding > 0)
          .sort((a, b) => b.outstanding - a.outstanding)
          .map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-body">
              <span className="font-medium">{c.name}</span>
              <span className={cn("font-semibold tabular", c.outstanding >= 100000 && "text-danger")}>{inr(c.outstanding)}</span>
            </div>
          ))}
      </CardContent>
    </Card>
  );
}

export function RoleDashboard({ role }: { role: Exclude<Role, "founder" | "client"> }) {
  const me = roleLabels[role];
  const first = me.person.split(" ")[0];
  const desc: Record<typeof role, string> = {
    manager: "Here's how delivery and the team look today.",
    editor: "Your queue for today — rush items first.",
    finance: "Collections and billing at a glance.",
    hr: "Team availability and workload for the week.",
  };
  return (
    <div className="space-y-6">
      <PageHeader eyebrow={todayLabel} title={`Good morning, ${first}`} description={desc[role]} />
      {role === "editor" && (
        <div className="grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
          <div className="xl:col-span-8">
            <MyVideos />
          </div>
          <div className="xl:col-span-4">
            <ActivityFeedCard limit={6} />
          </div>
        </div>
      )}
      {role === "manager" && (
        <div className="grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
          <div className="xl:col-span-4">
            <PipelineByStageCard />
          </div>
          <div className="xl:col-span-4">
            <WorkloadCard />
          </div>
          <div className="xl:col-span-4">
            <WeekShootsCard />
          </div>
        </div>
      )}
      {role === "finance" && (
        <div className="grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
          <div className="xl:col-span-4">
            <RevenueHero />
          </div>
          <div className="xl:col-span-8">
            <RevenueTrendCard />
          </div>
          <div className="xl:col-span-6">
            <Receivables />
          </div>
        </div>
      )}
      {role === "hr" && (
        <div className="grid gap-4 xl:grid-cols-12 [&>*]:min-w-0">
          <div className="xl:col-span-6">
            <WorkloadCard />
          </div>
          <div className="xl:col-span-6">
            <ActivityFeedCard limit={6} />
          </div>
        </div>
      )}
    </div>
  );
}
