"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, Clock, ExternalLink, Hourglass, MessageCircle, SearchX, Sparkles, Wallet } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { CategoryBadge } from "@/components/shared/video-bits";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, SectionCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { agreements, clients, personById } from "@/lib/mock/core";
import { healthFactors, recoveryActions } from "@/lib/mock/crm";
import { cn, fmtDate, inr, inrCompact } from "@/lib/utils";
import { pillarsByClient } from "@/features/content/data";
import { useGenie } from "@/features/genie/store";
import { ClientPlatforms } from "@/features/integrations/platform-bits";
import { useLifecycle } from "./clients-view";
import type { LifecyclePhase, StepState } from "./lifecycle";

export function ClientPage({ id }: { id: string }) {
  const c = clients.find((x) => x.id === id);
  if (!c) {
    return (
      <Card className="p-5">
        <EmptyState
          icon={SearchX}
          title="Client not found"
          action={
            <Button asChild variant="secondary">
              <Link href="/clients">
                <ArrowLeft /> Clients
              </Link>
            </Button>
          }
        />
      </Card>
    );
  }
  return <Profile id={id} />;
}

function Profile({ id }: { id: string }) {
  const c = clients.find((x) => x.id === id)!;
  const phases = useLifecycle(id);
  const setAskOpen = useGenie((s) => s.setAskOpen);
  const owner = personById(c.accountOwnerId);
  const mine = agreements.filter((a) => a.clientId === id);
  const approver = c.contacts.find((x) => x.approver) ?? c.contacts[0]!;
  const waiting = phases.flatMap((p) => p.steps.filter((s) => s.state === "waiting").map((s) => ({ phase: p, step: s })));

  return (
    <div className="space-y-6">
      <PageHeader
        className="mb-0"
        eyebrow={
          <Link href="/clients" className="inline-flex items-center gap-1 rounded-sm hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
            <ArrowLeft className="size-3.5" /> Clients
          </Link>
        }
        title={c.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
            <CategoryBadge category={c.category} />
            {c.industry} · {c.city} · client since {fmtDate(c.since, { month: "short", year: "numeric" })} · account owner {owner.name}
          </span>
        }
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => toast("WhatsApp group opened", { description: `${c.name} × Genie Magnet — ${c.contacts.length + 3} members` })}>
              <MessageCircle /> WhatsApp group
            </Button>
            {id === "c-kaveri" && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/portal">
                  <ExternalLink /> Client Hub
                </Link>
              </Button>
            )}
            <Button size="sm" variant="soft" onClick={() => setAskOpen(true)}>
              <Sparkles /> Ask Genie
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Monthly value" value={inrCompact(c.monthlyValue)} icon={Wallet} tone="gold" hint={mine[0]?.packageName} />
        <StatCard label="Health" value={c.health} icon={Check} tone={c.health >= 75 ? "success" : c.health >= 55 ? "warning" : "danger"} hint="value vs effort, reviewed every 45 days" />
        <StatCard label="Outstanding" value={c.outstanding ? inrCompact(c.outstanding) : "₹0"} icon={Clock} tone={c.outstanding ? "warning" : "success"} hint={c.outstanding ? "see Billing" : "nothing due"} />
        <StatCard label="Waiting on client" value={waiting.length} icon={Hourglass} tone={waiting.length ? "warning" : "success"} hint="approval gates open now" />
      </div>

      <LifecycleTracker phases={phases} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
        <SectionCard title="Waiting on the client" description="Approval gates where work pauses until the client responds. Genie Assistant reminds after 2 days.">
          {waiting.length ? (
            <ul className="space-y-2">
              {waiting.map(({ phase, step }) => (
                <li key={phase.id + step.label} className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-3 text-body">
                  <Hourglass className="size-4 shrink-0 text-accent-strong" />
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{step.label}</div>
                    <div className="text-muted-foreground">
                      {phase.name}
                      {phase.period ? ` · ${phase.period}` : ""}
                      {step.note ? ` · ${step.note}` : ""}
                    </div>
                  </div>
                  <Button size="xs" variant="ghost" asChild>
                    <Link href={phase.href}>
                      Open <ArrowUpRight />
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body text-muted-foreground">Nothing is waiting on {approver.name.split(" ")[0]} right now.</p>
          )}
        </SectionCard>
        <SectionCard title="Contacts and approvers" description="Approvers can approve topics, scripts and videos — in the Client Hub or by WhatsApp button.">
          <ul className="space-y-2">
            {c.contacts.map((p) => (
              <li key={p.email} className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3 text-body">
                <div className="min-w-0 flex-1">
                  <div className="font-medium">
                    {p.name} <span className="font-normal text-muted-foreground">· {p.title}</span>
                  </div>
                  <div className="text-muted-foreground">
                    {p.phone} · {p.email}
                  </div>
                </div>
                {p.approver && <Badge tone="success">Approver</Badge>}
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <Tabs defaultValue="agreements">
        <TabsList>
          <TabsTrigger value="agreements">Agreements</TabsTrigger>
          <TabsTrigger value="platforms">Platforms</TabsTrigger>
          <TabsTrigger value="content">Content pillars</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
        </TabsList>
        <TabsContent value="agreements" className="space-y-3">
          {mine.map((a) => (
            <Link key={a.id} href={`/agreements/${a.id}`} className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35">
              <Card className="flex flex-wrap items-center gap-4 p-4 transition group-hover:border-primary/40">
                <div className="min-w-0 flex-1">
                  <div className="text-body font-semibold">{a.title}</div>
                  <div className="text-body text-muted-foreground">
                    {a.packageName} · {inr(a.monthlyFee)}/mo · {a.units.map((u) => `${u.perCycle} ${u.label.toLowerCase()}`).join(", ")} · {fmtDate(a.startDate, { month: "short", year: "numeric" })} – {fmtDate(a.endDate, { month: "short", year: "numeric" })}
                  </div>
                </div>
                <StatusBadge status={a.status.replace("-", " ")} />
              </Card>
            </Link>
          ))}
        </TabsContent>
        <TabsContent value="platforms">
          <Card className="p-4">
            <ClientPlatforms clientId={id} />
          </Card>
        </TabsContent>
        <TabsContent value="content">
          <Card className="p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(pillarsByClient[id] ?? []).map((p, i) => (
                <div key={p} className="rounded-xl border border-border p-3.5">
                  <div className="text-body text-muted-foreground">Pillar {i + 1}</div>
                  <div className="text-body font-semibold">{p}</div>
                </div>
              ))}
            </div>
            <Button size="sm" variant="ghost" className="mt-3" asChild>
              <Link href="/content">
                Ideas, topics and scripts <ArrowUpRight />
              </Link>
            </Button>
          </Card>
        </TabsContent>
        <TabsContent value="health">
          <HealthTab id={id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

const STEP_STYLE: Record<StepState, string> = {
  done: "border-success/30 bg-success-soft/50",
  active: "border-primary/40 bg-primary-soft/50",
  waiting: "border-accent bg-accent-soft/70",
  upcoming: "border-border bg-card",
};

function LifecycleTracker({ phases }: { phases: LifecyclePhase[] }) {
  return (
    <Card>
      <CardHeader className="flex-wrap">
        <div>
          <CardTitle>Client lifecycle</CardTitle>
          <CardDescription>Win and Onboard happen once; Plan, Produce and Deliver repeat every month. Updated from the records — nobody ticks it by hand.</CardDescription>
        </div>
        <div className="flex flex-wrap gap-3 text-body text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-success" /> Done
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" /> In progress
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-accent" /> Waiting on client
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="scrollbar-thin -mx-1 overflow-x-auto px-1 pb-1">
          <ol className="grid min-w-[900px] grid-cols-5 gap-3">
            {phases.map((p, i) => (
              <li key={p.id} className="min-w-0">
                <Link
                  href={p.href}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-body transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35",
                    p.state === "done" ? "bg-success text-success-foreground" : p.state === "waiting" ? "bg-accent text-primary" : p.state === "active" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {i + 1} · {p.name}
                    </span>
                    <span className="block truncate opacity-85">
                      {p.module}
                      {p.period ? ` · ${p.period}` : ""}
                    </span>
                  </span>
                  <ArrowUpRight className="size-3.5 shrink-0 opacity-80" />
                </Link>
                <ul className="mt-2 space-y-1.5">
                  {p.steps.map((s) => (
                    <li key={s.label} className={cn("rounded-lg border px-2.5 py-2 text-body", STEP_STYLE[s.state], s.gate && "border-2")}>
                      <div className="flex items-center gap-1.5 font-medium">
                        {s.state === "done" ? <Check className="size-3.5 text-success" /> : s.state === "waiting" ? <Hourglass className="size-3.5 text-accent-strong" /> : s.state === "active" ? <Clock className="size-3.5 text-primary" /> : null}
                        <span className="min-w-0">{s.label}</span>
                      </div>
                      {(s.note || s.gate) && (
                        <div className="mt-0.5 text-muted-foreground">
                          {s.gate && "Client gate"}
                          {s.gate && s.note && " · "}
                          {s.note}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}

function HealthTab({ id }: { id: string }) {
  const f = healthFactors[id]!;
  const rows = [
    { label: "Billing value", v: f.billing },
    { label: "Profitability", v: f.profitability },
    { label: "Payment cycle", v: f.payment },
    { label: "Repeat business", v: f.repeat },
    { label: "Sales effort (lower is better)", v: 100 - f.salesEffort },
    { label: "Delivery effort (lower is better)", v: 100 - f.deliveryEffort },
  ];
  const actions = recoveryActions[id];
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 [&>*]:min-w-0">
      <Card className="p-4">
        <ul className="space-y-2.5">
          {rows.map((r) => (
            <li key={r.label} className="grid grid-cols-[minmax(0,180px)_1fr_auto] items-center gap-3 text-body">
              <span className="truncate">{r.label}</span>
              <Progress value={r.v} tone={r.v >= 70 ? "success" : r.v >= 45 ? "warning" : "danger"} />
              <span className="tabular text-muted-foreground">{r.v}</span>
            </li>
          ))}
        </ul>
        <Button size="sm" variant="ghost" className="mt-3" asChild>
          <Link href="/client-health">
            Client Fitment Map <ArrowUpRight />
          </Link>
        </Button>
      </Card>
      {actions && (
        <SectionCard title="Recovery plan" description="Agreed actions from the last review">
          <ul className="space-y-1.5 text-body">
            {actions.map((a) => (
              <li key={a} className="flex items-start gap-2">
                <span className="mt-2 size-1 shrink-0 rounded-full bg-muted-foreground/60" /> {a}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
}
