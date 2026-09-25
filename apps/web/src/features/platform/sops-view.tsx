"use client";

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BookCheck,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  FileText,
  GitBranch,
  ListChecks,
  PenLine,
  Plus,
  Search,
  ShieldAlert,
  StickyNote,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { complianceEvents, evidenceMeta, sops as seedSops, type Evidence, type Sop, type SopStatus } from "@/features/platform/sops-data";
import { cn, fmtDate } from "@/lib/utils";

const statusMeta: Record<SopStatus, { label: string; tone: BadgeTone }> = {
  published: { label: "Published", tone: "success" },
  "in-review": { label: "In review", tone: "warning" },
  draft: { label: "Draft", tone: "neutral" },
};

const evidenceIcon: Record<Evidence, typeof Camera> = {
  photo: Camera,
  file: Upload,
  note: StickyNote,
  timestamp: Clock,
  signature: PenLine,
  check: CheckCircle2,
};

function bump(v: string) {
  const [maj, min] = v.replace("v", "").split(".").map(Number);
  return `v${maj}.${(min ?? 0) + 1}`;
}

export function SopsView() {
  const [sops, setSops] = useState<Sop[]>(seedSops);
  const [q, setQ] = useState("");
  const [area, setArea] = useState<string>("All");
  const [openId, setOpenId] = useState<string | null>(null);
  const open = sops.find((s) => s.id === openId) ?? null;

  const areas = ["All", ...Array.from(new Set(seedSops.map((s) => s.area)))];
  const list = sops.filter(
    (s) => (area === "All" || s.area === area) && (q === "" || `${s.title} ${s.code} ${s.owner}`.toLowerCase().includes(q.toLowerCase())),
  );

  const runs = sops.reduce((s, x) => s + x.runsThisMonth, 0);
  const fails = sops.reduce((s, x) => s + x.failures, 0);
  const exceptions = complianceEvents.filter((e) => e.kind === "exception").length;

  const update = (id: string, patch: Partial<Sop>) => setSops((all) => all.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  return (
    <>
      <PageHeader
        depth="preview"
        title="SOPs & Checklists"
        description="Versioned standard operating procedures with mandatory evidence and doer → checker → approver sign-off."
        actions={
          <Button
            variant="accent"
            size="sm"
            onClick={() => {
              const id = `sop-new-${Date.now()}`;
              setSops((all) => [
                {
                  ...seedSops[5],
                  id,
                  code: "SOP-NEW-01",
                  title: "Untitled SOP",
                  area: "HR",
                  owner: "Janarthanan",
                  reviewer: "Ashwin",
                  version: "v0.1",
                  status: "draft",
                  updated: "2026-09-25",
                  summary: "New draft — add steps and checklist items.",
                  history: [{ version: "v0.1", date: "2026-09-25", by: "Janarthanan", note: "Draft created" }],
                  activeRuns: 0,
                  runsThisMonth: 0,
                  failures: 0,
                },
                ...all,
              ]);
              setOpenId(id);
              toast.success("Draft SOP created");
            }}
          >
            <Plus /> New SOP
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Published SOPs" value={sops.filter((s) => s.status === "published").length} icon={BookCheck} tone="success" hint={`${sops.length} total`} />
        <StatCard label="Checklist runs · Sep" value={runs} icon={ListChecks} tone="accent" hint={`${sops.reduce((s, x) => s + x.activeRuns, 0)} in progress`} />
        <StatCard label="Failures · Sep" value={fails} icon={AlertTriangle} tone="danger" hint={`${(((runs - fails) / Math.max(1, runs)) * 100).toFixed(1)}% pass rate`} />
        <StatCard label="Approved exceptions" value={exceptions} icon={ShieldAlert} tone="warning" hint="Documented deviations" />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-border p-4">
            <div className="relative w-full max-w-64">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search SOPs" aria-label="Search SOPs" className="pl-9" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {areas.map((a) => (
                <button
                  key={a}
                  onClick={() => setArea(a)}
                  aria-pressed={area === a}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 text-body font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30",
                    area === a ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
          <Table>
            <THead>
              <TR>
                <TH>SOP</TH>
                <TH>Owner · Reviewer</TH>
                <TH>Version</TH>
                <TH>Applies to</TH>
                <TH>Status</TH>
                <TH className="text-right">Updated</TH>
              </TR>
            </THead>
            <TBody>
              {list.map((s) => (
                <TR
                  key={s.id}
                  className="cursor-pointer focus-visible:bg-primary-soft/40 focus-visible:outline-none"
                  tabIndex={0}
                  aria-label={`Open ${s.code} ${s.title}`}
                  onClick={() => setOpenId(s.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setOpenId(s.id);
                    }
                  }}
                >
                  <TD className="max-w-[320px]">
                    <div className="font-mono text-body text-muted-foreground">{s.code}</div>
                    <div className="truncate font-medium">{s.title}</div>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Avatar name={s.owner} size="sm" />
                      <div className="text-body leading-tight">
                        <div>{s.owner}</div>
                        <div className="text-muted-foreground">{s.reviewer}</div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <Badge tone="outline" className="font-mono">
                      {s.version}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex max-w-[220px] flex-wrap gap-1">
                      {s.roles.slice(0, 2).map((r) => (
                        <Badge key={r}>{r}</Badge>
                      ))}
                      {s.roles.length > 2 && <Badge tone="outline">+{s.roles.length - 2}</Badge>}
                    </div>
                  </TD>
                  <TD>
                    <Badge tone={statusMeta[s.status].tone} dot>
                      {statusMeta[s.status].label}
                    </Badge>
                  </TD>
                  <TD className="text-right text-muted-foreground tabular">{fmtDate(s.updated)}</TD>
                </TR>
              ))}
              {list.length === 0 && (
                <TR>
                  <TD colSpan={6} className="p-4">
                    <EmptyState
                      compact
                      icon={Search}
                      title="No SOPs match"
                      description="Try a different search term or area filter."
                    />
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </Card>

        <ComplianceCard sops={sops} />
      </div>

      <SopSheet
        sop={open}
        onClose={() => setOpenId(null)}
        onPublish={(id, note, migrate) => {
          const s = sops.find((x) => x.id === id)!;
          const v = s.status === "published" ? bump(s.version) : s.version.startsWith("v0") ? "v1.0" : s.version;
          update(id, {
            version: v,
            status: "published",
            updated: "2026-09-25",
            history: [{ version: v, date: "2026-09-25", by: "Janarthanan", note: note || "Published" }, ...s.history],
          });
          toast.success(`${s.code} ${v} published`, {
            description: migrate
              ? `${s.activeRuns} active run${s.activeRuns === 1 ? "" : "s"} migrated to ${v}`
              : `${s.activeRuns} active run${s.activeRuns === 1 ? "" : "s"} stay on ${s.version} until complete`,
          });
        }}
        onStatus={(id, status) => {
          update(id, { status });
          toast.success(status === "in-review" ? "Sent to reviewer" : "Status updated");
        }}
      />
    </>
  );
}

function ComplianceCard({ sops }: { sops: Sop[] }) {
  const withRuns = sops.filter((s) => s.runsThisMonth > 0);
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Compliance · September</CardTitle>
          <CardDescription>Checklist pass rate by SOP</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {withRuns.length === 0 && (
          <EmptyState compact icon={ListChecks} title="No checklist runs yet" description="Pass rates appear once SOP checklists are run this month." />
        )}
        {withRuns.map((s) => {
          const rate = ((s.runsThisMonth - s.failures) / s.runsThisMonth) * 100;
          return (
            <div key={s.id}>
              <div className="flex items-center justify-between text-body">
                <span className="truncate">{s.area}</span>
                <span className="tabular text-muted-foreground">
                  {s.runsThisMonth - s.failures}/{s.runsThisMonth} · <span className={cn("font-medium", rate < 90 ? "text-warning" : "text-success")}>{rate.toFixed(0)}%</span>
                </span>
              </div>
              <Progress value={rate} tone={rate < 90 ? "warning" : "success"} className="mt-1" />
            </div>
          );
        })}
        <div className="border-t border-border pt-3">
          <div className="mb-2 text-body font-semibold uppercase tracking-wider text-muted-foreground">Failures & exceptions</div>
          <div className="space-y-2.5">
            {complianceEvents.map((e) => (
              <div key={e.text} className="flex gap-2.5 text-body">
                <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", e.kind === "failure" ? "bg-danger" : "bg-warning")} />
                <div>
                  <div>{e.text}</div>
                  <div className="text-body text-muted-foreground">
                    {e.sop} · {e.who} · {fmtDate(e.date)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function SopSheet({
  sop,
  onClose,
  onPublish,
  onStatus,
}: {
  sop: Sop | null;
  onClose: () => void;
  onPublish: (id: string, note: string, migrate: boolean) => void;
  onStatus: (id: string, s: SopStatus) => void;
}) {
  const [publishing, setPublishing] = useState(false);
  const [note, setNote] = useState("");
  const [migrate, setMigrate] = useState(false);
  const [done, setDone] = useState<Record<string, boolean>>({});

  const groups = useMemo(() => {
    if (!sop) return [];
    const m = new Map<string, Sop["checklist"]>();
    sop.checklist.forEach((c) => m.set(c.group ?? "Checklist", [...(m.get(c.group ?? "Checklist") ?? []), c]));
    return [...m.entries()];
  }, [sop]);

  const close = () => {
    setPublishing(false);
    setNote("");
    setMigrate(false);
    setDone({});
    onClose();
  };

  return (
    <Dialog open={!!sop} onOpenChange={(o) => !o && close()}>
      {sop && (
        <DialogContent side="right" className="max-w-2xl">
          <DialogHeader>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-body text-muted-foreground">{sop.code}</span>
              <Badge tone="outline" className="font-mono">
                {sop.version}
              </Badge>
              <Badge tone={statusMeta[sop.status].tone} dot>
                {statusMeta[sop.status].label}
              </Badge>
            </div>
            <DialogTitle>{sop.title}</DialogTitle>
            <DialogDescription>{sop.summary}</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <div className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                ["Doer", sop.doer],
                ["Checker", sop.checker],
                ["Approver", sop.approver],
              ].map(([k, v]) => (
                <div key={k} className="min-w-0 rounded-xl border border-border p-3">
                  <div className="text-body font-medium uppercase tracking-wider text-muted-foreground">{k}</div>
                  <div className="mt-0.5 truncate text-body font-medium" title={v}>
                    {v}
                  </div>
                </div>
              ))}
            </div>

            <Tabs defaultValue="steps">
              <TabsList>
                <TabsTrigger value="steps">Steps · {sop.steps.length}</TabsTrigger>
                <TabsTrigger value="checklist">Checklist · {sop.checklist.length}</TabsTrigger>
                <TabsTrigger value="history">Versions · {sop.history.length}</TabsTrigger>
              </TabsList>
              <TabsContent value="steps">
                <ol className="relative space-y-4 border-l border-border pl-5">
                  {sop.steps.map((s, i) => (
                    <li key={s.title} className="relative">
                      <span className="absolute -left-[31px] top-0 inline-flex size-5 items-center justify-center rounded-full border border-border bg-card text-body font-semibold tabular">
                        {i + 1}
                      </span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-body font-medium">{s.title}</span>
                        <Badge>{s.role}</Badge>
                      </div>
                      <p className="mt-0.5 text-body text-muted-foreground">{s.detail}</p>
                    </li>
                  ))}
                </ol>
              </TabsContent>
              <TabsContent value="checklist" className="space-y-4">
                <div className="flex items-center justify-between rounded-xl bg-muted/60 px-3 py-2 text-body">
                  <span className="text-muted-foreground">Preview a run — tick items to see evidence prompts</span>
                  <span className="font-medium tabular">
                    {Object.values(done).filter(Boolean).length}/{sop.checklist.length}
                  </span>
                </div>
                {groups.map(([g, items]) => (
                  <div key={g}>
                    <div className="mb-1.5 text-body font-semibold uppercase tracking-wider text-muted-foreground">{g}</div>
                    <div className="divide-y divide-border rounded-xl border border-border">
                      {items.map((c) => {
                        const Icon = evidenceIcon[c.evidence];
                        const key = `${g}-${c.item}`;
                        return (
                          <button
                            key={key}
                            role="checkbox"
                            aria-checked={!!done[key]}
                            onClick={() => setDone((d) => ({ ...d, [key]: !d[key] }))}
                            className="flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-left text-body transition first:rounded-t-xl last:rounded-b-xl hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/30 sm:flex-nowrap"
                          >
                            <span
                              aria-hidden
                              className={cn(
                                "inline-flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition",
                                done[key] ? "border-success bg-success text-primary-foreground" : "border-input bg-card",
                              )}
                            >
                              {done[key] && <Check className="size-3.5" strokeWidth={3} />}
                            </span>
                            <span className={cn("min-w-0 flex-1", done[key] && "text-muted-foreground line-through")}>{c.item}</span>
                            {c.mandatory && <Badge tone="danger">Mandatory</Badge>}
                            <span className="inline-flex w-28 shrink-0 items-center gap-1 text-body text-muted-foreground">
                              <Icon className="size-3.5 shrink-0" /> <span className="truncate">{evidenceMeta[c.evidence].label}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="history">
                <div className="space-y-3">
                  {sop.history.map((h, i) => (
                    <div key={h.version + h.date} className="flex gap-3">
                      <span className={cn("mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-lg", i === 0 ? "bg-primary-soft text-primary" : "bg-muted text-muted-foreground")}>
                        <GitBranch className="size-3.5" />
                      </span>
                      <div className="text-body">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-medium">{h.version}</span>
                          {i === 0 && <Badge tone="accent">Current</Badge>}
                          <span className="text-body text-muted-foreground">
                            {fmtDate(h.date, { day: "numeric", month: "short", year: "numeric" })} · {h.by}
                          </span>
                        </div>
                        <div className="text-muted-foreground">{h.note}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>
            </Tabs>

            {publishing && (
              <div className="mt-5 space-y-3 rounded-xl border border-primary/30 bg-primary-soft/40 p-4">
                <div className="text-body font-semibold">
                  Publish {sop.status === "published" ? bump(sop.version) : sop.version.startsWith("v0") ? "v1.0" : sop.version}
                </div>
                <Field label="Change note">
                  <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed? e.g. Added drone battery check to kit list" aria-label="Change note" />
                </Field>
                <div className="rounded-lg bg-card p-3 text-body">
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span>
                      <span className="font-medium">{sop.activeRuns} active run{sop.activeRuns === 1 ? "" : "s"}</span> are using {sop.version}. Work already in progress keeps
                      its version — so evidence stays valid — unless you migrate it.
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 pl-6">
                    <Checkbox id="sop-migrate-runs" checked={migrate} onCheckedChange={(c) => setMigrate(c === true)} />
                    <label htmlFor="sop-migrate-runs" className="cursor-pointer">
                      Migrate active runs to the new version
                    </label>
                  </div>
                </div>
              </div>
            )}
          </DialogBody>
          <DialogFooter className="justify-between">
            <div className="flex gap-2">
              {sop.status === "draft" && (
                <Button variant="secondary" size="sm" onClick={() => onStatus(sop.id, "in-review")}>
                  Send for review
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {publishing ? (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setPublishing(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="accent"
                    size="sm"
                    onClick={() => {
                      onPublish(sop.id, note, migrate);
                      setPublishing(false);
                      setNote("");
                    }}
                  >
                    Confirm publish
                  </Button>
                </>
              ) : (
                <Button variant="accent" size="sm" onClick={() => setPublishing(true)}>
                  <GitBranch /> Publish new version
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
