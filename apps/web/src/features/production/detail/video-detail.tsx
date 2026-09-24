"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { ArrowLeft, ArrowRight, Check, ChevronDown, ClipboardCheck, Coins, FileSignature, FileText, Film, Lock, MessagesSquare, PenTool, Camera, Send } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StageBadge, UrgencyIcon, VPBadge } from "@/components/shared/video-bits";
import { agreementById, clientById, cycles, isOverdue, personById } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { VIDEO_STAGES, type Video, type VideoStage } from "@/lib/types";
import { cn, hoursLabel } from "@/lib/utils";
import { ClientTag, GateNotice } from "../bits";
import { canMoveTo, doneSteps, fmt, gateLeaving, NEXT_STAGE, qcCounts, relDue, stageIdx } from "../lib";
import { QcChecklist } from "../qc-checklist";
import { useProductionHydration } from "../store";
import { EditingTab } from "./editing-tab";
import { BriefTab, CostTab, ShootTab } from "./other-tabs";
import { VersionsTab } from "./versions-tab";

export function VideoDetail({ id }: { id: string }) {
  useProductionHydration();
  const v = useDemo((s) => s.videos.find((x) => x.id === id));
  const [tab, setTab] = useState(() => (v && ["Client Review", "Revision", "Approved", "Published"].includes(v.stage) ? "versions" : v?.stage === "Internal QC" ? "qc" : "editing"));

  if (!v) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <Film className="size-8 text-muted-foreground" />
        <div className="text-lg font-semibold">Video not found</div>
        <p className="text-[13px] text-muted-foreground">It may have been removed, or the demo data was reset.</p>
        <Button variant="outline" asChild>
          <Link href="/production">
            <ArrowLeft /> Back to Video Production
          </Link>
        </Button>
      </div>
    );
  }

  const c = clientById(v.clientId);
  const ag = agreementById(v.agreementId);

  return (
    <div>
      <Link href="/production" className="mb-4 inline-flex items-center gap-1.5 text-[13px] text-muted-foreground transition hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Video Production
      </Link>

      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px] font-semibold tracking-wide">{v.code}</span>
            <ClientTag clientId={v.clientId} />
            <StageBadge stage={v.stage} />
            <UrgencyIcon urgency={v.urgency} withLabel />
            <VPBadge on={v.videoProtection} />
          </div>
          <h1 className="text-[26px] font-semibold leading-tight tracking-tight">{v.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-muted-foreground">
            <span>{c.name}</span>
            <span className={cn(isOverdue(v) && "font-medium text-danger")}>
              {fmt(v.dueDate, "EEE, d MMM")} · {relDue(v.dueDate)}
            </span>
            <Link href="/agreements" className="inline-flex items-center gap-1 hover:text-accent">
              <FileSignature className="size-3.5" /> {ag.packageName}
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {(
            [
              ["Editor", v.editorId],
              ["Director", v.directorId],
              ["Camera", v.cameraId],
            ] as const
          ).map(([label, pid]) => (
            <div key={label} className="flex items-center gap-2">
              <Avatar name={personById(pid).name} size="md" />
              <div className="leading-tight">
                <div className="text-[11px] text-muted-foreground">{label}</div>
                <div className="text-[13px] font-medium">{personById(pid).name.split(" ")[0]}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <StageStepper v={v} />

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_300px]">
        <Tabs value={tab} onValueChange={setTab} className="min-w-0">
          <div className="-mx-1 overflow-x-auto px-1 scrollbar-thin">
            <TabsList>
              <TabsTrigger value="editing">
                <PenTool /> Editing sheet
                <span className="ml-0.5 text-[11px] tabular text-muted-foreground">{doneSteps(v)}/9</span>
              </TabsTrigger>
              <TabsTrigger value="qc">
                <ClipboardCheck /> QC
                {qcCounts(v).fail > 0 && <span className="size-1.5 rounded-full bg-danger" />}
              </TabsTrigger>
              <TabsTrigger value="versions">
                <MessagesSquare /> Versions & feedback
                {v.comments.some((x) => !x.resolved) && <span className="size-1.5 rounded-full bg-warning" />}
              </TabsTrigger>
              <TabsTrigger value="brief">
                <FileText /> Brief & script
              </TabsTrigger>
              <TabsTrigger value="shoot">
                <Camera /> Shoot
              </TabsTrigger>
              <TabsTrigger value="cost">
                <Coins /> Cost
              </TabsTrigger>
            </TabsList>
          </div>
          <TabsContent value="editing">
            <EditingTab key={v.id} v={v} />
          </TabsContent>
          <TabsContent value="qc">
            <Card>
              <CardHeader>
                <div>
                  <CardTitle>Internal QC checklist</CardTitle>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">Every check is mandatory. A failure holds the stage and creates a corrective task.</p>
                </div>
              </CardHeader>
              <CardContent>
                <QcChecklist v={v} />
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="versions">
            <VersionsTab key={v.id} v={v} />
          </TabsContent>
          <TabsContent value="brief">
            <BriefTab v={v} />
          </TabsContent>
          <TabsContent value="shoot">
            <ShootTab v={v} />
          </TabsContent>
          <TabsContent value="cost">
            <CostTab v={v} />
          </TabsContent>
        </Tabs>

        <DetailSidebar v={v} />
      </div>
    </div>
  );
}

// ─────────────────────────── Stage stepper ───────────────────────────

function StageStepper({ v }: { v: Video }) {
  const setStage = useDemo((s) => s.setStage);
  const updateVideo = useDemo((s) => s.updateVideo);
  const approveVersion = useDemo((s) => s.approveVersion);
  const publishNewVersion = useDemo((s) => s.publishNewVersion);
  const log = useDemo((s) => s.log);

  const cur = stageIdx(v.stage);
  const next = NEXT_STAGE[v.stage];
  const gate = gateLeaving(v, v.stage);
  const hadRevision = v.revisionsUsed > 0 || v.versions.some((x) => x.status === "changes-requested");

  const advance = () => {
    if (!next) return;
    if (!gate.ok) {
      toast.error(gate.title, { description: gate.reason });
      return;
    }
    if (v.stage === "Internal QC") {
      publishNewVersion(v.id, v.versions.length ? "Revised cut after internal QC" : "First cut after internal QC");
      toast.success(`${v.code} sent to client`, { description: `v${v.versions.length + 1} is in the client portal` });
      return;
    }
    if (v.stage === "Client Review" && v.versions.length) {
      approveVersion(v.id, v.versions.at(-1)!.id);
      toast.success(`${v.code} approved`);
      return;
    }
    if (v.stage === "Approved") {
      updateVideo(v.id, { publishedUrl: `https://instagram.com/reel/${v.code.replace(/-/g, "")}` });
    }
    setStage(v.id, next);
    toast.success(`${v.code} → ${next}`);
  };

  const moveTo = (to: VideoStage) => {
    const g = canMoveTo(v, to);
    if (!g.ok) {
      toast.error(g.title, { description: g.reason });
      return;
    }
    setStage(v.id, to);
    if (stageIdx(to) < cur) log(`${v.code} moved back to ${to}`, "warning");
    toast(`${v.code} → ${to}`);
  };

  return (
    <Card className="p-5">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 scrollbar-thin">
        <ol className="flex min-w-[860px] items-start">
          {VIDEO_STAGES.map((s, i) => {
            const done = i < cur && (s !== "Revision" || hadRevision);
            const skipped = s === "Revision" && i < cur && !hadRevision;
            const current = i === cur;
            const isGate = (s === "Shot" || s === "Editing" || s === "Internal QC") && current && !gate.ok;
            return (
              <li key={s} className="relative flex flex-1 flex-col items-center">
                {i > 0 && (
                  <span
                    className={cn(
                      "absolute right-1/2 top-[13px] h-0.5 w-full -translate-y-1/2",
                      i <= cur ? "bg-accent" : "bg-border",
                    )}
                  />
                )}
                <span
                  className={cn(
                    "relative z-10 inline-flex size-[26px] items-center justify-center rounded-full border-2 text-[11px] font-semibold tabular transition",
                    done && "border-accent bg-accent text-accent-foreground",
                    skipped && "border-dashed border-border bg-card text-muted-foreground",
                    current && !isGate && "border-accent bg-card text-accent ring-4 ring-accent/15",
                    current && isGate && "border-danger bg-card text-danger ring-4 ring-danger/15",
                    !done && !current && !skipped && "border-border bg-card text-muted-foreground",
                  )}
                >
                  {done ? <Check className="size-3.5" strokeWidth={3} /> : isGate ? <Lock className="size-3" /> : i + 1}
                </span>
                <span
                  className={cn(
                    "mt-2 px-1 text-center text-[11.5px] leading-tight",
                    current ? "font-semibold text-foreground" : done ? "text-foreground/80" : "text-muted-foreground",
                    skipped && "italic",
                  )}
                >
                  {s}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          {gate.ok ? (
            <div className="text-[13px] text-muted-foreground">
              {next ? (
                <>
                  Current stage <b className="font-medium text-foreground">{v.stage}</b>. All gates clear — ready for{" "}
                  <b className="font-medium text-foreground">{next}</b>.
                </>
              ) : (
                <>
                  Published{v.publishedUrl ? " · " : ""}
                  {v.publishedUrl && (
                    <a href={v.publishedUrl} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                      {v.publishedUrl.replace("https://", "")}
                    </a>
                  )}
                </>
              )}
            </div>
          ) : (
            <GateNotice gate={gate} />
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                Move to <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Set stage manually</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {VIDEO_STAGES.map((s) => {
                const blocked = !canMoveTo(v, s).ok;
                return (
                  <DropdownMenuItem key={s} disabled={s === v.stage} onSelect={() => moveTo(s)} className={cn(s === v.stage && "opacity-50")}>
                    {blocked ? <Lock /> : s === v.stage ? <Check /> : <span className="size-4" />}
                    {s}
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          {next && (
            <Button variant={gate.ok ? "accent" : "outline"} onClick={advance} className={cn(!gate.ok && "cursor-not-allowed border-danger/30 text-danger")}>
              {!gate.ok ? <Lock /> : v.stage === "Internal QC" ? <Send /> : null}
              {v.stage === "Internal QC" ? "Send to client review" : v.stage === "Client Review" ? "Mark client approved" : `Advance to ${next}`}
              {gate.ok && <ArrowRight />}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─────────────────────────── Sidebar ───────────────────────────

function DetailSidebar({ v }: { v: Video }) {
  const activity = useDemo((s) => s.activity);
  const ag = agreementById(v.agreementId);
  const cycle = cycles.find((c) => c.id === v.cycleId);
  const allowed = ag.revisionsPerDeliverable;

  const feed = useMemo(() => {
    const live = activity.filter((a) => a.text.includes(v.code) || a.text.includes(v.title)).map((a) => ({ id: a.id, at: a.at, text: a.text, tone: a.tone }));
    const synthetic = [
      ...v.versions.map((ver) => ({ id: `s-${ver.id}`, at: ver.createdAt, text: `${ver.by} uploaded ${ver.label}`, tone: "accent" as const })),
      ...v.comments.map((cm) => ({ id: `s-${cm.id}`, at: cm.at, text: `${cm.author} commented${cm.timestamp ? ` at ${cm.timestamp}` : ""}`, tone: undefined })),
      { id: "s-created", at: "2026-09-01T10:00:00", text: `Video planned in ${cycle?.label ?? "cycle"} by Ashwin`, tone: undefined },
    ];
    return [...live, ...synthetic].sort((a, b) => b.at.localeCompare(a.at)).slice(0, 12);
  }, [activity, v, cycle]);

  const rows: [string, React.ReactNode][] = [
    ["Format", v.format],
    ["Aspect", v.aspect],
    ["Platforms", v.platform.join(", ")],
    ["Cycle", cycle?.label ?? "—"],
    ["Package", ag.packageName],
    ["Clip No.", <span key="clip" className="font-mono text-[12px]">{v.clipNo}</span>],
    ["Planned edit", hoursLabel(v.plannedMinutes)],
    ["Logged", hoursLabel(v.loggedMinutes)],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0 text-[13px]">
          {rows.map(([k, val]) => (
            <div key={k} className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-0">
              <span className="text-muted-foreground">{k}</span>
              <span className="truncate text-right font-medium">{val}</span>
            </div>
          ))}
          <div className="pt-3">
            <div className="mb-1.5 flex justify-between text-[12px]">
              <span className="text-muted-foreground">Revisions used</span>
              <span className={cn("font-medium tabular", v.revisionsUsed >= allowed && "text-danger")}>
                {v.revisionsUsed} / {allowed}
              </span>
            </div>
            <Progress value={(v.revisionsUsed / allowed) * 100} tone={v.revisionsUsed >= allowed ? "danger" : v.revisionsUsed ? "warning" : "success"} />
            {v.revisionsUsed >= allowed && <p className="mt-1.5 text-[11.5px] text-danger">Allowance used — further changes need a CR.</p>}
          </div>
          {v.delayReason && (
            <div className="mt-3 rounded-lg bg-warning-soft px-3 py-2 text-[12px] text-warning">
              <b className="font-semibold">Delay:</b> {v.delayReason}
            </div>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="relative space-y-3 border-l border-border pl-4">
            {feed.map((a) => (
              <li key={a.id} className="relative">
                <span
                  className={cn(
                    "absolute -left-[21px] top-1 size-2 rounded-full ring-4 ring-card",
                    a.tone === "success" ? "bg-success" : a.tone === "danger" ? "bg-danger" : a.tone === "warning" ? "bg-warning" : a.tone === "accent" ? "bg-accent" : "bg-muted-foreground/50",
                  )}
                />
                <div className="text-[12.5px] leading-snug">{a.text}</div>
                <div className="mt-0.5 text-[11px] text-muted-foreground">{format(parseISO(a.at), "d MMM, HH:mm")}</div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
