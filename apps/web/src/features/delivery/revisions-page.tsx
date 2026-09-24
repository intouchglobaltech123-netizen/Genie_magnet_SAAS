"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { CheckCheck, Clock, GitPullRequestArrow, Hourglass, IndianRupee, MoreHorizontal, Plus, Send, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StageBadge } from "@/components/shared/video-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemo, type ChangeRequest, type RevisionKind } from "@/lib/store";
import { agreementById, clientById } from "@/lib/mock/core";
import { revisionCauseBaseline, reworkCostBooked, reworkHourlyCost } from "@/lib/mock/delivery";
import { cn, fmtDate, inr } from "@/lib/utils";
import { ClassifyDialog } from "./classify-dialog";
import { kindMeta, statusMeta } from "./revision-meta";

const KINDS: RevisionKind[] = ["agency-correction", "included-revision", "out-of-scope"];

export function RevisionsPage() {
  const videos = useDemo((s) => s.videos);
  const crs = useDemo((s) => s.changeRequests);
  const updateChangeRequest = useDemo((s) => s.updateChangeRequest);
  const publishNewVersion = useDemo((s) => s.publishNewVersion);
  const updateVideo = useDemo((s) => s.updateVideo);
  const log = useDemo((s) => s.log);

  const [classifyOpen, setClassifyOpen] = useState(false);
  const [filter, setFilter] = useState("active");
  const [estimateFor, setEstimateFor] = useState<ChangeRequest | null>(null);
  const [estAmount, setEstAmount] = useState("");
  const [estDays, setEstDays] = useState("");

  const join = (cr: ChangeRequest) => {
    if (cr.videoId.startsWith("new:")) {
      const client = clientById(cr.videoId.slice(4));
      return { video: undefined, client };
    }
    const video = videos.find((v) => v.id === cr.videoId);
    return { video, client: video ? clientById(video.clientId) : undefined };
  };

  const openCount = crs.filter((c) => c.status === "open").length;
  const awaiting = crs.filter((c) => c.status === "awaiting-client");
  const awaitingValue = awaiting.reduce((s, c) => s + (c.estimate ?? 0), 0);

  const sepWithVersions = videos.filter((v) => v.cycleId.endsWith("-09") && v.versions.length > 0);
  const consumed = sepWithVersions.reduce((s, v) => s + v.revisionsUsed, 0);
  const allowanceTotal = sepWithVersions.reduce((s, v) => s + agreementById(v.agreementId).revisionsPerDeliverable, 0);
  const rework = reworkCostBooked + crs.filter((c) => c.kind === "agency-correction").reduce((s, c) => s + (c.estimate ?? 2 * reworkHourlyCost), 0);

  const donut = useMemo(
    () =>
      KINDS.map((k) => ({
        kind: k,
        name: kindMeta[k].label,
        value: revisionCauseBaseline.filter((b) => b.kind === k).reduce((s, b) => s + b.count, 0) + crs.filter((c) => c.kind === k).length,
        color: kindMeta[k].color,
      })),
    [crs],
  );
  const donutTotal = donut.reduce((s, d) => s + d.value, 0);

  const rows = crs.filter((c) =>
    filter === "active" ? ["open", "awaiting-client", "approved"].includes(c.status) : filter === "closed" ? ["done", "rejected"].includes(c.status) : true,
  );

  const inRevision = videos.filter((v) => v.stage === "Revision");

  const setStatus = (cr: ChangeRequest, status: ChangeRequest["status"], msg: string, tone: "success" | "warning" | "accent" | "danger" = "accent") => {
    updateChangeRequest(cr.id, { status });
    const { video, client } = join(cr);
    const label = video?.code ?? client?.name ?? "Request";
    log(`${label}: ${msg}`, tone);
    toast.success(msg, { description: cr.summary });
  };

  const openEstimate = (cr: ChangeRequest) => {
    setEstimateFor(cr);
    setEstAmount(String(cr.estimate ?? 15000));
    setEstDays(String(cr.dateImpactDays ?? 3));
  };

  const sendEstimate = () => {
    if (!estimateFor) return;
    const amount = Number(estAmount) || 0;
    updateChangeRequest(estimateFor.id, { status: "awaiting-client", estimate: amount, dateImpactDays: Number(estDays) || 0 });
    const { client } = join(estimateFor);
    log(`Estimate ${inr(amount)} sent to ${client?.name ?? "client"} for approval`, "warning");
    toast.success("Estimate sent to client", { description: `${inr(amount)} · +${estDays} days · visible in ${client?.name ?? "the client"}'s portal` });
    setEstimateFor(null);
  };

  const sendNextVersion = (id: string) => {
    const v = videos.find((x) => x.id === id);
    if (!v) return;
    const latest = v.versions.at(-1);
    let label: string;
    if (latest && latest.status === "internal") {
      // QC-passed internal cut already exists — send it rather than creating another version.
      label = latest.label;
      updateVideo(id, { stage: "Client Review", versions: v.versions.map((x) => (x.id === latest.id ? { ...x, status: "sent" } : x)) });
      log(`${v.code} ${label} sent to client for review`, "accent");
    } else {
      label = `v${v.versions.length + 1}`;
      publishNewVersion(id, "Addressed client feedback from previous round");
    }
    crs.filter((c) => c.videoId === id && c.status === "open" && c.kind !== "out-of-scope").forEach((c) => updateChangeRequest(c.id, { status: "done" }));
    toast.success(`${label} sent to ${clientById(v.clientId).name}`, { description: "Now waiting in their Client Hub for review" });
  };

  return (
    <div>
      <PageHeader
        eyebrow="Client Delivery · Module 19"
        title="Revisions & Change Requests"
        description="Every piece of client feedback is classified before work starts — so revision allowance, rework cost and extra billing are never argued later."
        actions={
          <Button variant="accent" onClick={() => setClassifyOpen(true)}>
            <Plus /> Classify feedback
          </Button>
        }
      />

      {/* Explanation strip */}
      <div className="mb-6 grid gap-3 md:grid-cols-3">
        {KINDS.map((k) => {
          const m = kindMeta[k];
          const Icon = m.icon;
          return (
            <Card key={k} className="flex gap-3 p-4">
              <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", m.iconCls)}>
                <Icon className="size-4.5" />
              </span>
              <div>
                <div className="text-[14px] font-semibold">{m.label}</div>
                <div className="text-[12.5px] text-muted-foreground">{m.rule}</div>
                <div className="mt-1.5 text-[12px] font-medium">{m.effect}</div>
              </div>
            </Card>
          );
        })}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open requests" value={openCount} icon={GitPullRequestArrow} tone="info" hint="need classification or action" />
        <StatCard label="Awaiting client" value={awaiting.length} icon={Hourglass} tone="warning" hint={`${inr(awaitingValue)} in estimates`} />
        <StatCard label="Allowance consumed · Sep" value={`${consumed} / ${allowanceTotal}`} icon={Undo2} tone="accent" hint="included rounds across reviewed videos" />
        <StatCard label="Rework cost · Sep" value={inr(rework)} icon={IndianRupee} tone="danger" hint="agency corrections, internal only" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader className="items-center">
            <div>
              <CardTitle>Change requests</CardTitle>
              <CardDescription>Joined to video and client · status changes are logged</CardDescription>
            </div>
            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList>
                <TabsTrigger value="active">Active</TabsTrigger>
                <TabsTrigger value="closed">Closed</TabsTrigger>
                <TabsTrigger value="all">All · {crs.length}</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <Table>
            <THead>
              <TR>
                <TH className="pl-5">Video · client</TH>
                <TH>Class</TH>
                <TH>Change</TH>
                <TH className="text-right">Estimate</TH>
                <TH>Status</TH>
                <TH className="pr-5 text-right">Action</TH>
              </TR>
            </THead>
            <TBody>
              {rows.length === 0 && (
                <TR>
                  <TD colSpan={6} className="py-10 text-center text-muted-foreground">
                    Nothing here.
                  </TD>
                </TR>
              )}
              {rows.map((cr) => {
                const { video, client } = join(cr);
                const km = kindMeta[cr.kind];
                const sm = statusMeta[cr.status];
                return (
                  <TR key={cr.id}>
                    <TD className="pl-5">
                      <div className="font-mono text-[11.5px] text-muted-foreground">{video?.code ?? "New request"}</div>
                      <div className="max-w-[200px] truncate font-medium">{video?.title ?? "Client portal request"}</div>
                      <div className="text-[12px] text-muted-foreground">{client?.name}</div>
                    </TD>
                    <TD>
                      <Badge tone={km.tone}>{km.short}</Badge>
                    </TD>
                    <TD className="max-w-[280px]">
                      <div className="line-clamp-2 text-[12.5px]">{cr.summary}</div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground">Logged {fmtDate(cr.createdAt)}</div>
                    </TD>
                    <TD className="text-right tabular">
                      {cr.estimate !== undefined ? (
                        <div>
                          <div className="font-medium">{inr(cr.estimate)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {cr.kind === "agency-correction" ? "rework cost" : `+${cr.dateImpactDays ?? 0} days`}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TD>
                    <TD>
                      <Badge tone={sm.tone} dot>
                        {sm.label}
                      </Badge>
                    </TD>
                    <TD className="pr-5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {cr.status === "open" && cr.kind === "out-of-scope" && (
                          <Button size="xs" variant="soft" onClick={() => openEstimate(cr)}>
                            <Send className="!size-3" /> Send estimate
                          </Button>
                        )}
                        {cr.status === "awaiting-client" && (
                          <Button size="xs" variant="outline" onClick={() => setStatus(cr, "approved", "Client approved the estimate — work unblocked", "success")}>
                            <CheckCheck className="!size-3.5" /> Mark approved
                          </Button>
                        )}
                        {(cr.status === "approved" || (cr.status === "open" && cr.kind !== "out-of-scope")) && (
                          <Button size="xs" variant="outline" onClick={() => setStatus(cr, "done", "Change completed", "success")}>
                            <CheckCheck className="!size-3.5" /> Done
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon-sm" variant="ghost" aria-label="More actions">
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {cr.kind === "out-of-scope" && cr.status !== "done" && (
                              <DropdownMenuItem onSelect={() => openEstimate(cr)}>{cr.status === "open" ? "Send estimate to client" : "Revise estimate"}</DropdownMenuItem>
                            )}
                            {cr.status === "awaiting-client" && (
                              <DropdownMenuItem onSelect={() => setStatus(cr, "rejected", "Client declined — no billable work done", "warning")}>Client rejected</DropdownMenuItem>
                            )}
                            {cr.status !== "open" && (
                              <DropdownMenuItem onSelect={() => setStatus(cr, "open", "Request re-opened")}>Re-open</DropdownMenuItem>
                            )}
                            {video && (
                              <DropdownMenuItem asChild>
                                <Link href={`/production`}>Open in Video Production</Link>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Revision causes</CardTitle>
                <CardDescription>Last 90 days · all clients</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="relative h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={donut} dataKey="value" nameKey="name" innerRadius={52} outerRadius={76} paddingAngle={2} strokeWidth={0}>
                      {donut.map((d) => (
                        <Cell key={d.kind} fill={d.color} />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12 }}
                      itemStyle={{ color: "var(--foreground)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[22px] font-semibold tabular">{donutTotal}</span>
                  <span className="text-[11px] text-muted-foreground">revisions</span>
                </div>
              </div>
              <div className="mt-3 space-y-1.5">
                {donut.map((d) => (
                  <div key={d.kind} className="flex items-center gap-2 text-[12.5px]">
                    <span className="size-2 rounded-full" style={{ background: d.color }} />
                    <span className="flex-1">{d.name}</span>
                    <span className="tabular text-muted-foreground">{Math.round((d.value / donutTotal) * 100)}%</span>
                    <span className="w-6 text-right font-medium tabular">{d.value}</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-border pt-3">
                <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Top root causes</div>
                {[...revisionCauseBaseline]
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 4)
                  .map((c) => (
                    <div key={c.cause} className="flex justify-between py-0.5 text-[12.5px]">
                      <span className="text-muted-foreground">{c.cause}</span>
                      <span className="tabular">{c.count}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div>
                <CardTitle>In revision</CardTitle>
                <CardDescription>Send the next version back to the client</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {inRevision.length === 0 && <p className="text-[12.5px] text-muted-foreground">No videos in revision.</p>}
              {inRevision.map((v) => {
                const allow = agreementById(v.agreementId).revisionsPerDeliverable;
                return (
                  <div key={v.id} className="rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11.5px] text-muted-foreground">{v.code}</span>
                      <StageBadge stage={v.stage} />
                    </div>
                    <div className="mt-1 truncate text-[13px] font-medium">{v.title}</div>
                    <div className="mt-1 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                      <Clock className="size-3" /> Due {fmtDate(v.dueDate)} · rounds {v.revisionsUsed}/{allow}
                    </div>
                    <Button size="xs" variant="soft" className="mt-2.5 w-full" onClick={() => sendNextVersion(v.id)}>
                      <Send className="!size-3" /> Send {v.versions.at(-1)?.status === "internal" ? v.versions.at(-1)?.label : `v${v.versions.length + 1}`} to client
                    </Button>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      </div>

      <ClassifyDialog open={classifyOpen} onOpenChange={setClassifyOpen} />

      <Dialog open={!!estimateFor} onOpenChange={(o) => !o && setEstimateFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send estimate to client</DialogTitle>
            <DialogDescription>{estimateFor?.summary}</DialogDescription>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Estimate (₹, excl. GST)">
                <Input type="number" value={estAmount} onChange={(e) => setEstAmount(e.target.value)} />
              </Field>
              <Field label="Date impact (days)">
                <Input type="number" value={estDays} onChange={(e) => setEstDays(e.target.value)} />
              </Field>
            </div>
            <p className="rounded-xl bg-warning-soft p-3 text-[12.5px] text-warning">
              The client sees this in their Client Hub and must approve it. No billable work starts until they do.
            </p>
          </DialogBody>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEstimateFor(null)}>
              Cancel
            </Button>
            <Button variant="accent" onClick={sendEstimate}>
              <Send /> Send {inr(Number(estAmount) || 0)} estimate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
