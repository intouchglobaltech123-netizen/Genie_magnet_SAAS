"use client";

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  BadgeCheck,
  Boxes,
  Briefcase,
  CalendarCheck2,
  CheckCircle2,
  Circle,
  Eye,
  FileText,
  GraduationCap,
  Lock,
  LogOut,
  Mail,
  Phone,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  UserCheck,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogBody } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/ui/feedback";
import { assets, personById, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import type { Person } from "@/lib/types";
import { cn, fmtDate, inr } from "@/lib/utils";
import { accessSystems, addMonths, documentsFor, performanceFor, probationMonths, trainingFor } from "./data";

const longDate = { day: "numeric", month: "short", year: "numeric" } as const;

export function ProfileSheet({
  person,
  onOpenChange,
  onExitStarted,
  exitStarted,
}: {
  person: Person | null;
  onOpenChange: (open: boolean) => void;
  onExitStarted: (id: string) => void;
  exitStarted: boolean;
}) {
  return (
    <Dialog open={!!person} onOpenChange={onOpenChange}>
      <DialogContent side="right" className="max-w-2xl">
        {person && <ProfileBody key={person.id} person={person} exitStarted={exitStarted} onExitStarted={onExitStarted} />}
      </DialogContent>
    </Dialog>
  );
}

function ProfileBody({
  person,
  exitStarted,
  onExitStarted,
}: {
  person: Person;
  exitStarted: boolean;
  onExitStarted: (id: string) => void;
}) {
  const manager = person.managerId ? personById(person.managerId) : null;
  const status = exitStarted ? "notice" : person.status;
  return (
    <>
      <DialogHeader className="border-b border-border pb-5">
        <div className="flex items-start gap-4">
          <Avatar name={person.name} size="xl" />
          <div className="min-w-0 space-y-1">
            <DialogTitle>{person.name}</DialogTitle>
            <DialogDescription>
              {person.role} · {person.department}
            </DialogDescription>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <StatusBadge status={status} />
              <Badge tone={person.type === "employee" ? "accent" : "neutral"}>
                {person.type === "employee" ? "Employee" : "Freelancer"}
              </Badge>
              {manager && <Badge tone="outline">Reports to {manager.name}</Badge>}
            </div>
          </div>
        </div>
      </DialogHeader>
      <DialogBody className="pt-4">
        <Tabs defaultValue="overview">
          <TabsList className="scrollbar-thin w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="documents">Documents</TabsTrigger>
            <TabsTrigger value="assets">Assets</TabsTrigger>
            <TabsTrigger value="training">Training</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="lifecycle">Lifecycle</TabsTrigger>
          </TabsList>
          <TabsContent value="overview">
            <OverviewTab person={person} />
          </TabsContent>
          <TabsContent value="documents">
            <DocumentsTab person={person} />
          </TabsContent>
          <TabsContent value="assets">
            <AssetsTab person={person} />
          </TabsContent>
          <TabsContent value="training">
            <TrainingTab person={person} />
          </TabsContent>
          <TabsContent value="performance">
            <PerformanceTab person={person} />
          </TabsContent>
          <TabsContent value="lifecycle">
            <LifecycleTab person={person} exitStarted={exitStarted} onExitStarted={onExitStarted} />
          </TabsContent>
        </Tabs>
      </DialogBody>
    </>
  );
}

export function StatusBadge({ status }: { status: Person["status"] }) {
  if (status === "on-leave")
    return (
      <Badge tone="info" dot>
        On leave
      </Badge>
    );
  if (status === "notice")
    return (
      <Badge tone="danger" dot>
        Exit in progress
      </Badge>
    );
  return (
    <Badge tone="success" dot>
      Active
    </Badge>
  );
}

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5 text-body">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function OverviewTab({ person }: { person: Person }) {
  const manager = person.managerId ? personById(person.managerId) : null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <a
          href={`mailto:${person.email}`}
          onClick={(e) => {
            e.preventDefault();
            navigator.clipboard?.writeText(person.email).catch(() => {});
            toast.success("Email copied", { description: person.email });
          }}
          className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border p-3 text-body hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <Mail className="size-4 text-muted-foreground" />
          <span className="truncate">{person.email}</span>
        </a>
        <button
          type="button"
          onClick={() => toast.success("Calling via WhatsApp", { description: person.phone })}
          className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-border p-3 text-left text-body hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/35"
        >
          <Phone className="size-4 text-muted-foreground" />
          <span className="tabular">{person.phone}</span>
        </button>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border px-4">
        <InfoRow label="Role">{person.role}</InfoRow>
        <InfoRow label="Department">{person.department}</InfoRow>
        <InfoRow label="Manager">
          {manager ? (
            <span className="inline-flex items-center gap-2">
              <Avatar name={manager.name} size="xs" />
              {manager.name}
            </span>
          ) : (
            "—"
          )}
        </InfoRow>
        <InfoRow label="Joined">{fmtDate(person.joinedOn, longDate)}</InfoRow>
        <InfoRow label={person.type === "employee" ? "Monthly CTC" : "Rate (per hour)"}>
          <span className="tabular">
            {person.monthlyCtc ? inr(person.monthlyCtc) : inr(person.hourlyCost)}
          </span>
        </InfoRow>
        <InfoRow label="Utilisation this week">
          <span className={cn("tabular", person.utilisation > 1 ? "text-danger" : "")}>
            {Math.round(person.utilisation * 100)}%
          </span>
        </InfoRow>
      </div>
      <div>
        <div className="mb-2 text-body font-medium text-muted-foreground">Skills</div>
        <div className="flex flex-wrap gap-1.5">
          {person.skills.map((s) => (
            <Badge key={s} tone="neutral" className="px-2.5 py-1 text-body">
              {s}
            </Badge>
          ))}
        </div>
      </div>
    </div>
  );
}

function DocumentsTab({ person }: { person: Person }) {
  const docs = documentsFor(person);
  const log = useDemo((s) => s.log);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2.5 rounded-xl border border-warning/30 bg-warning-soft px-3.5 py-2.5 text-body text-warning">
        <Lock className="size-4 shrink-0" />
        <span>
          <b className="font-semibold">Restricted · HR &amp; Founder only.</b> Numbers are masked; every view is logged to
          the audit trail.
        </span>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border">
        {docs.map((d) => (
          <div key={d.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-muted text-muted-foreground">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-body font-medium">
                {d.label}
                <Lock className="size-3 text-muted-foreground" />
              </div>
              <div className="font-mono text-body tracking-wide text-muted-foreground tabular">{d.value}</div>
            </div>
            {d.verified ? (
              <Badge tone="success">
                <BadgeCheck /> Verified
              </Badge>
            ) : (
              <Badge tone="warning">Pending verification</Badge>
            )}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={`View ${d.label}`}
              onClick={() => {
                log(`Restricted document viewed: ${person.name} — ${d.label}`, "warning");
                toast("Access logged", {
                  description: `${d.label} for ${person.name} opened by Janarthanan (Founder).`,
                });
              }}
            >
              <Eye />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssetsTab({ person }: { person: Person }) {
  const mine = assets.filter((a) => a.custodianId === person.id);
  if (!mine.length)
    return (
      <EmptyState compact icon={Boxes} title="No assets in custody" description="Checked-out equipment will appear here." />
    );
  const total = mine.reduce((s, a) => s + a.purchaseValue, 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-body">
        <span className="text-muted-foreground">
          {mine.length} item{mine.length > 1 ? "s" : ""} in custody
        </span>
        <span className="font-medium tabular">Purchase value {inr(total)}</span>
      </div>
      <div className="divide-y divide-border rounded-xl border border-border">
        {mine.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-4 py-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-primary-soft text-primary">
              <Boxes className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-body font-medium">{a.name}</div>
              <div className="text-body text-muted-foreground">
                <span className="font-mono">{a.tag}</span> · {a.category} · {a.condition}
              </div>
            </div>
            <span className="text-body tabular text-muted-foreground">{inr(a.purchaseValue)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrainingTab({ person }: { person: Person }) {
  const [items, setItems] = useState(trainingFor(person));
  return (
    <div className="space-y-2.5">
      {items.map((t, i) => (
        <div key={t.title} className="rounded-xl border border-border p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex size-9 items-center justify-center rounded-lg bg-info-soft text-info">
              <GraduationCap className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-body font-medium">{t.title}</div>
              <div className="text-body text-muted-foreground">
                {t.provider}
                {t.due && t.status !== "completed" ? ` · due ${fmtDate(t.due)}` : ""}
              </div>
            </div>
            {t.status === "completed" ? (
              <Badge tone="success">Completed</Badge>
            ) : t.status === "in-progress" ? (
              <Badge tone="info">In progress</Badge>
            ) : (
              <Button
                size="xs"
                variant="soft"
                onClick={() => {
                  setItems((xs) => xs.map((x, j) => (j === i ? { ...x, status: "in-progress", progress: 5 } : x)));
                  toast.success("Reminder sent", { description: `${person.name.split(" ")[0]} was nudged on WhatsApp to start “${t.title}”.` });
                }}
              >
                Nudge to start
              </Button>
            )}
          </div>
          <Progress
            className="mt-3"
            value={t.progress}
            tone={t.status === "completed" ? "success" : "info"}
          />
        </div>
      ))}
    </div>
  );
}

function PerformanceTab({ person }: { person: Person }) {
  const p = performanceFor(person);
  if (!p.score)
    return <EmptyState compact icon={TrendingUp} title="No scorecard yet" description={p.note} />;
  const tone = p.score >= 80 ? "success" : p.score >= 70 ? "warning" : "danger";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border p-4">
          <div className="text-body text-muted-foreground">Q3 composite</div>
          <div className="mt-1 text-heading font-semibold tabular">{p.score}</div>
          <Progress value={p.score} tone={tone} className="mt-2" />
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="text-body text-muted-foreground">Player rating</div>
          <div className="mt-1.5">
            <Badge tone={p.rating.startsWith("A") ? "success" : p.rating.startsWith("C") ? "danger" : "warning"} className="text-body">
              {p.rating}
            </Badge>
          </div>
        </div>
        <div className="rounded-xl border border-border p-4">
          <div className="text-body text-muted-foreground">vs last quarter</div>
          <div className={cn("mt-1 flex items-center gap-1 text-heading font-semibold tabular", p.trend >= 0 ? "text-success" : "text-danger")}>
            {p.trend >= 0 ? <TrendingUp className="size-5" /> : <TrendingDown className="size-5" />}
            {p.trend > 0 ? "+" : ""}
            {p.trend}
          </div>
        </div>
      </div>
      <div className="flex gap-3 rounded-xl bg-muted/60 p-4 text-body">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <p>{p.note}</p>
      </div>
      <Button variant="outline" size="sm" asChild>
        <Link href="/performance">Open full KRA scorecard →</Link>
      </Button>
    </div>
  );
}

function LifecycleTab({
  person,
  exitStarted,
  onExitStarted,
}: {
  person: Person;
  exitStarted: boolean;
  onExitStarted: (id: string) => void;
}) {
  const log = useDemo((s) => s.log);
  const custody = assets.filter((a) => a.custodianId === person.id);
  const confirmOn = addMonths(person.joinedOn, probationMonths);
  const confirmed = confirmOn <= TODAY;

  const groups = [
      {
        title: "Handover of work & approvals",
        items: ["Open tasks & videos reassigned", "Pending approvals delegated", "Client contacts introduced to successor"],
      },
      {
        title: "Asset return",
        items: custody.length ? custody.map((a) => `${a.tag} · ${a.name}`) : ["No assets in custody — confirm nil return"],
      },
      { title: "Access revocation", items: accessSystems.map((s) => `Revoke ${s}`) },
      { title: "HR closure", items: ["Full & Final settlement computed", "Relieving & experience letter issued", "Exit interview recorded"] },
  ];
  const allItems = groups.flatMap((g) => g.items.map((i) => `${g.title}::${i}`));
  const [done, setDone] = useState<Set<string>>(new Set());
  const progress = Math.round((done.size / allItems.length) * 100);

  const steps = [
    { label: "Joined", date: person.joinedOn, icon: Briefcase, done: true, desc: person.type === "employee" ? "Offer accepted · onboarding checklist completed" : "Freelance agreement signed" },
    ...(person.type === "employee"
      ? [
          { label: `Probation (${probationMonths} months)`, date: person.joinedOn, icon: CalendarCheck2, done: true, desc: `Reviewed at 45 days and 90 days by ${person.managerId ? personById(person.managerId).name : "Founder"}` },
          { label: "Confirmed", date: confirmOn, icon: UserCheck, done: confirmed, desc: confirmed ? "Confirmation letter issued" : "Confirmation review due" },
        ]
      : []),
    ...(exitStarted ? [{ label: "Exit initiated", date: TODAY, icon: LogOut, done: true, desc: "Notice period · 30 days" }] : []),
  ];

  return (
    <div className="space-y-5">
      <ol className="relative space-y-0">
        {steps.map((s, i) => (
          <li key={s.label} className="relative flex gap-3 pb-5 last:pb-0">
            {i < steps.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-24px)] w-px bg-border" />}
            <span
              className={cn(
                "relative z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border",
                s.label === "Exit initiated"
                  ? "border-danger/30 bg-danger-soft text-danger"
                  : s.done
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-border bg-card text-muted-foreground",
              )}
            >
              <s.icon className="size-4" />
            </span>
            <div className="pt-1">
              <div className="flex flex-wrap items-center gap-x-2 text-body font-medium">
                {s.label}
                <span className="text-body font-normal text-muted-foreground tabular">{fmtDate(s.date, longDate)}</span>
              </div>
              <div className="text-body text-muted-foreground">{s.desc}</div>
            </div>
          </li>
        ))}
      </ol>

      {!exitStarted ? (
        <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="text-body">
            <div className="font-medium">Offboarding</div>
            <div className="text-muted-foreground">Starts a guided exit checklist with asset return and access revocation.</div>
          </div>
          <Button
            variant="danger"
            size="sm"
            className="shrink-0"
            onClick={() => {
              onExitStarted(person.id);
              log(`Exit initiated for ${person.name} — offboarding checklist created`, "danger");
              toast.warning(`Exit initiated for ${person.name}`, {
                description: `${allItems.length} checklist items assigned to Harini Selvam (HR) and Naveen Raj (IT).`,
              });
            }}
          >
            <LogOut /> Initiate exit
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-border">
          <div className="border-b border-border p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-body font-semibold">
                <ShieldAlert className="size-4 text-danger" /> Exit checklist
              </div>
              <span className="text-body font-medium tabular text-muted-foreground">
                {done.size}/{allItems.length} · {progress}%
              </span>
            </div>
            <Progress value={progress} tone={progress === 100 ? "success" : "warning"} className="mt-3" />
          </div>
          <div className="divide-y divide-border">
            {groups.map((g) => {
              const gDone = g.items.every((i) => done.has(`${g.title}::${i}`));
              return (
                <div key={g.title} className="p-4">
                  <div className="mb-2.5 flex items-center gap-2 text-body font-medium">
                    {gDone ? <CheckCircle2 className="size-4 text-success" /> : <Circle className="size-4 text-muted-foreground" />}
                    {g.title}
                  </div>
                  <div className="space-y-2 pl-6">
                    {g.items.map((i) => {
                      const k = `${g.title}::${i}`;
                      return (
                        <label key={k} className="flex cursor-pointer items-center gap-2.5 text-body">
                          <Checkbox
                            checked={done.has(k)}
                            onCheckedChange={(v) => {
                              const n = new Set(done);
                              if (v) n.add(k);
                              else n.delete(k);
                              setDone(n);
                              if (n.size === allItems.length) {
                                log(`Offboarding completed for ${person.name}`, "success");
                                toast.success(`Offboarding complete for ${person.name}`, { description: "F&F released to Payroll for next run." });
                              }
                            }}
                          />
                          <span className={cn(done.has(k) && "text-muted-foreground line-through")}>{i}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
