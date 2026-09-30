"use client";

import { useState } from "react";
import { BellRing, CheckCheck, Clock3, Hand, ScrollText, ShieldCheck, Sparkles, Workflow } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AskPanel } from "./ask-panel";
import { insights, type InsightArea } from "./data";
import { InsightCard } from "./insight-card";
import { useGenie } from "./store";

const AREAS: ("All" | InsightArea)[] = ["All", "Delivery", "Clients", "Finance", "Team", "Onboarding", "Content", "Reports"];

export function GeniePage() {
  const status = useGenie((s) => s.status);
  const [area, setArea] = useState<(typeof AREAS)[number]>("All");
  const open = insights.filter((i) => !status[i.id]);
  const done = insights.filter((i) => status[i.id]);
  const filter = (list: typeof insights) => (area === "All" ? list : list.filter((i) => i.area === area));
  const approved = done.filter((i) => status[i.id] === "approved").length;

  return (
    <div>
      <PageHeader
        eyebrow="Platform · Module 45"
        depth="demo"
        title={
          <span className="inline-flex items-center gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-primary-active text-accent ring-1 ring-accent/40">
              <Sparkles className="size-[18px]" />
            </span>
            Genie Assistant
          </span>
        }
        description="Rules watch every module and flag what has slipped. Genie writes the reminder, task or summary; you approve, edit or dismiss. Nothing is sent or changed without a person."
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Waiting for you" value={open.length} icon={Hand} tone={open.length ? "warning" : "success"} hint={`${open.filter((i) => i.severity === "high").length} high priority`} />
        <StatCard label="Drafts ready" value={open.filter((i) => i.draft).length} icon={ScrollText} tone="accent" hint="messages, tasks, summaries" />
        <StatCard label="Approved today" value={approved} icon={CheckCheck} tone="success" hint="logged in the audit trail" />
        <StatCard label="Time saved this week" value="~3.5 h" icon={Clock3} tone="gold" hint="drafting and chasing" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px] [&>*]:min-w-0">
        <div>
          <Tabs defaultValue="inbox">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                <TabsTrigger value="inbox">Inbox · {open.length}</TabsTrigger>
                <TabsTrigger value="done">Done · {done.length}</TabsTrigger>
              </TabsList>
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by area">
                {AREAS.map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={area === a}
                    onClick={() => setArea(a)}
                    className={
                      "cursor-pointer rounded-full border px-2.5 py-1 text-body transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35 " +
                      (area === a ? "border-primary bg-primary text-primary-foreground" : "border-border-strong bg-surface text-muted-foreground hover:text-primary")
                    }
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            <TabsContent value="inbox" className="space-y-3">
              {filter(open).map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
              {!filter(open).length && <EmptyState icon={CheckCheck} title="All clear" description="Nothing waiting for you here. Genie checks again every hour." />}
            </TabsContent>
            <TabsContent value="done" className="space-y-2">
              {filter(done).map((i) => (
                <InsightCard key={i.id} insight={i} />
              ))}
              {!filter(done).length && <EmptyState icon={ScrollText} title="Nothing yet" description="Approved and dismissed items appear here with their audit trail." compact />}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Card className="flex h-[560px] flex-col">
            <CardHeader>
              <div>
                <CardTitle>Ask Genie</CardTitle>
                <CardDescription>Questions about your agency, answered with sources</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="flex min-h-0 flex-1 flex-col">
              <AskPanel className="flex-1" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>How Genie works</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="space-y-3 text-body">
                {[
                  { icon: Workflow, t: "Rules find it", d: "Overdue approvals, capacity, collections, renewals, onboarding — every number comes from your data." },
                  { icon: ScrollText, t: "Genie drafts it", d: "The message, task or summary, in the client's language and your brand voice from onboarding." },
                  { icon: ShieldCheck, t: "You decide", d: "Approve, edit or dismiss. Every action is recorded in the audit log." },
                  { icon: BellRing, t: "It follows up", d: "Reminders repeat on the agreed rhythm until someone responds." },
                ].map((s) => (
                  <li key={s.t} className="flex gap-3">
                    <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
                      <s.icon className="size-4" />
                    </span>
                    <div>
                      <div className="font-semibold">{s.t}</div>
                      <div className="text-muted-foreground">{s.d}</div>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-4 border-t border-border-subtle pt-3 text-body text-muted-foreground">Drafts are written by Claude (Anthropic). Client data is never used to train models.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
