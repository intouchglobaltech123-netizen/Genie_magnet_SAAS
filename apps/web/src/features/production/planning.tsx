"use client";

import { useMemo, useState } from "react";
import { eachDayOfInterval, parseISO } from "date-fns";
import { AlertTriangle, CalendarCheck2, CalendarRange, CheckCircle2, Gauge, Palmtree, Shuffle, Sparkles, UserX, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Tooltip } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { clientById, personById, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import type { Video } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Segmented } from "./bits";
import {
  backwardPlan,
  CAPACITY_PEOPLE,
  CLIENT_COLOR,
  capacityCell,
  clientDot,
  fmt,
  HOLIDAYS,
  isDone,
  isWorkingDay,
  scoreCandidate,
  shiftIso,
  stageIdx,
  toIso,
  weekUtil,
  WEEKS,
  type PlanStep,
} from "./lib";
import { useProduction, useProductionHydration } from "./store";

export function PlanningView() {
  useProductionHydration();
  const log = useDemo((s) => s.log);
  const [weekId, setWeekId] = useState("w40");
  const [reassigned, setReassigned] = useState(false);
  const week = WEEKS.find((w) => w.id === weekId)!;

  const utils = CAPACITY_PEOPLE.map((id) => ({ id, ...weekUtil(id, week.days) }));
  const totalBooked = utils.reduce((a, u) => a + u.booked, 0);
  const totalAvail = utils.reduce((a, u) => a + u.avail, 0);
  const overloaded = utils.filter((u) => u.util > 1);

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <CalendarRange className="size-3.5" /> Client Delivery · Module 14
          </span>
        }
        depth="preview"
        title="Planning & Capacity"
        description="See who is free, who is overloaded and who is on leave — then plan backwards from the publish date so every video lands on time."
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Team utilisation" value={`${Math.round((totalBooked / totalAvail) * 100)}%`} icon={Gauge} tone="accent" hint={`${week.label}`} />
        <StatCard label="Booked hours" value={`${Math.round(totalBooked)}h`} icon={CalendarCheck2} tone="info" hint={`of ${totalAvail}h available`} />
        <StatCard label="Overloaded" value={overloaded.length} icon={AlertTriangle} tone="danger" hint={overloaded.map((u) => personById(u.id).name.split(" ")[0]).join(", ") || "nobody"} />
        <StatCard label="On leave / holiday" value={weekId === "w39" ? "1 person" : "1 holiday"} icon={Palmtree} tone="warning" hint={weekId === "w39" ? "Naveen · 25–26 Sep" : "Gandhi Jayanti · 2 Oct"} />
      </div>

      <div className="grid gap-5 2xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Team capacity</CardTitle>
              <CardDescription>Booked vs available hours per day · employees 8h, freelancers 6h</CardDescription>
            </div>
            <Segmented value={weekId} onChange={setWeekId} options={WEEKS.map((w) => ({ value: w.id, label: w.label }))} />
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto scrollbar-thin">
              <div className="min-w-[720px]">
                <div className="grid grid-cols-[180px_repeat(6,minmax(0,1fr))_120px] gap-1.5 pb-1.5 text-body font-medium uppercase tracking-wider text-muted-foreground">
                  <span />
                  {week.days.map((d) => (
                    <span key={d} className={cn("text-center", d === TODAY && "text-primary")}>
                      {fmt(d, "EEE d")}
                    </span>
                  ))}
                  <span className="text-right">Week</span>
                </div>
                {CAPACITY_PEOPLE.map((pid) => {
                  const p = personById(pid);
                  const u = weekUtil(pid, week.days);
                  return (
                    <div key={pid} className="grid grid-cols-[180px_repeat(6,minmax(0,1fr))_120px] items-center gap-1.5 py-[3px]">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar name={p.name} size="sm" />
                        <div className="min-w-0 leading-tight">
                          <div className="truncate text-body font-medium">{p.name}</div>
                          <div className="truncate text-body text-muted-foreground">{p.role}</div>
                        </div>
                      </div>
                      {week.days.map((d) => (
                        <HeatCell key={d} pid={pid} day={d} />
                      ))}
                      <div className="pl-2">
                        <div className="flex justify-between text-body">
                          <span className="tabular text-muted-foreground">{u.booked}h</span>
                          <span className={cn("font-semibold tabular", u.util > 1 ? "text-danger" : u.util > 0.85 ? "text-warning" : "text-foreground")}>
                            {Math.round(u.util * 100)}%
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", u.util > 1 ? "bg-danger" : u.util > 0.85 ? "bg-warning" : "bg-primary")}
                            style={{ width: `${Math.min(100, u.util * 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-border pt-3 text-body text-muted-foreground">
              <Legend cls="bg-primary/20" label="< 70%" />
              <Legend cls="bg-primary/45" label="70–100%" />
              <Legend cls="bg-danger/35" label="Over 100%" />
              <Legend cls="bg-[repeating-linear-gradient(135deg,var(--color-warning-soft)_0_4px,transparent_4px_8px)] border border-warning/30" label="Leave" />
              <Legend cls="bg-muted" label="Holiday / Sunday" />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader>
              <div>
                <CardTitle>Exceptions</CardTitle>
                <CardDescription>What needs a decision this week</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <div className="rounded-xl border border-danger/25 bg-danger-soft/50 p-3">
                <div className="flex items-center gap-2 text-body font-semibold text-danger">
                  <AlertTriangle className="size-4" /> Divya Lakshmi at 125% on Mon–Tue
                </div>
                <p className="mt-1 text-body text-foreground/80">Diwali ad edit + Navaratri v3 revision overlap. Surya has 3h free on Tue.</p>
                <Button
                  size="xs"
                  variant="outline"
                  className="mt-2"
                  onClick={() => {
                    log("Planner: SLS-0926-01 v3 revision moved from Divya Lakshmi to Surya Prakash (Tue 29 Sep)", "accent");
                    toast.success("Rebalanced", { description: "SLS-0926-01 revision → Surya Prakash, Tue 29 Sep. Divya back to 100%." });
                  }}
                >
                  <Shuffle /> Move revision to Surya
                </Button>
              </div>
              <div className={cn("rounded-xl border p-3", reassigned ? "border-success/25 bg-success-soft/40" : "border-warning/25 bg-warning-soft/50")}>
                <div className={cn("flex items-center gap-2 text-body font-semibold", reassigned ? "text-success" : "text-warning")}>
                  {reassigned ? <CheckCircle2 className="size-4" /> : <UserX className="size-4" />} Naveen Raj — sick leave 25–26 Sep
                </div>
                <p className="mt-1 text-body text-foreground/80">
                  {reassigned ? "Backup verification for KVR-0926-07 and UNR-0926-02 reassigned to Surya Prakash." : "2 footage-backup tasks (KVR-0926-07, UNR-0926-02) need reassignment — editing is blocked until VP."}
                </p>
                {!reassigned && (
                  <Button
                    size="xs"
                    variant="outline"
                    className="mt-2"
                    onClick={() => {
                      setReassigned(true);
                      log("Naveen Raj's 2 backup tasks reassigned to Surya Prakash (leave cover)", "success");
                      toast.success("2 tasks reassigned to Surya Prakash");
                    }}
                  >
                    <Shuffle /> Reassign to Surya
                  </Button>
                )}
              </div>
              <div className="rounded-xl border border-border p-3">
                <div className="flex items-center gap-2 text-body font-semibold">
                  <Palmtree className="size-4 text-accent-strong" /> Gandhi Jayanti · Fri 2 Oct
                </div>
                <p className="mt-1 text-body text-muted-foreground">Studio closed. NVD-0926-03 due 2 Oct — plan below shifts client approval to Thu 1 Oct.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <BackwardPlanner />
    </div>
  );
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("size-3 rounded-[4px]", cls)} />
      {label}
    </span>
  );
}

function HeatCell({ pid, day }: { pid: string; day: string }) {
  const c = capacityCell(pid, day);
  if (c.holiday)
    return (
      <Tooltip content={`${c.holiday} — studio closed`}>
        <div className="flex h-10 items-center justify-center rounded-lg bg-muted text-body text-muted-foreground">Holiday</div>
      </Tooltip>
    );
  if (c.leave)
    return (
      <Tooltip content="Sick leave (approved by Harini)">
        <div className="flex h-10 items-center justify-center rounded-lg border border-warning/30 bg-[repeating-linear-gradient(135deg,var(--color-warning-soft)_0_4px,transparent_4px_8px)] text-body font-medium text-warning">
          Leave
        </div>
      </Tooltip>
    );
  const u = c.booked / c.available;
  const style = u > 1 ? { backgroundColor: "color-mix(in srgb, var(--color-danger) 32%, transparent)" } : { backgroundColor: `color-mix(in srgb, var(--color-primary) ${Math.round(10 + u * 38)}%, transparent)` };
  return (
    <Tooltip
      content={
        <div>
          <div className="font-medium">
            {c.booked}h / {c.available}h · {Math.round(u * 100)}%
          </div>
          {c.items.map((i) => (
            <div key={i} className="opacity-80">
              • {i}
            </div>
          ))}
        </div>
      }
    >
      <div className={cn("flex h-10 items-center justify-center rounded-lg text-body font-medium tabular transition hover:ring-2 hover:ring-primary/40", u > 1 && "text-danger", day === TODAY && "ring-1 ring-primary/60")} style={style}>
        {c.booked}h
      </div>
    </Tooltip>
  );
}

// ─────────────────────────── Backward planner ───────────────────────────

function stepDone(v: Video, key: string) {
  const i = stageIdx(v.stage);
  return (
    {
      script: i >= 2,
      shoot: i >= 3,
      backup: v.videoProtection,
      edit: i >= 5,
      qc: i >= 6,
      approval: i >= 8,
      publish: i >= 9,
    } as Record<string, boolean>
  )[key];
}

function firstOpenStart(v: Video, plan: PlanStep[]) {
  return plan.find((s) => !stepDone(v, s.key))?.start;
}

function earliestFeasible(v: Video) {
  let d = TODAY;
  for (let i = 0; i < 60; i++) {
    if (isWorkingDay(d)) {
      const start = firstOpenStart(v, backwardPlan(v, d));
      if (!start || start >= TODAY) return d;
    }
    d = shiftIso(d, 1);
  }
  return d;
}

function BackwardPlanner() {
  const videos = useDemo((s) => s.videos);
  const candidates = videos.filter((v) => !isDone(v));
  const [videoId, setVideoId] = useState(candidates.find((v) => v.id === "v-nvd-3")?.id ?? candidates[0]?.id ?? "");
  const v = videos.find((x) => x.id === videoId);
  if (!v) return null;
  return (
    <PlannerBody
      key={v.id}
      v={v}
      options={candidates.map((x) => ({ value: x.id, label: `${x.code} · ${x.title}` }))}
      onVideo={setVideoId}
      allVideos={videos}
    />
  );
}

function PlannerBody({ v, options, onVideo, allVideos }: { v: Video; options: { value: string; label: string }[]; onVideo: (id: string) => void; allVideos: Video[] }) {
  const updateVideo = useDemo((s) => s.updateVideo);
  const log = useDemo((s) => s.log);
  const approved = useProduction((s) => s.approvedPlans[v.id]);
  const approvePlan = useProduction((s) => s.approvePlan);
  const [publish, setPublish] = useState(v.publishDate);
  const [assign, setAssign] = useState<Record<string, string>>({});

  const plan = useMemo(() => (publish ? backwardPlan(v, publish) : []), [v, publish]);
  const scored = useMemo(
    () =>
      Object.fromEntries(
        plan.map((s) => [
          s.key,
          s.candidates
            .map((pid) => ({ pid, ...scoreCandidate(pid, v, s.key, s.start, allVideos) }))
            .sort((a, b) => (a.blocked === b.blocked ? b.score - a.score : a.blocked ? 1 : -1)),
        ]),
      ),
    [plan, v, allVideos],
  );
  const pick = (key: string) => assign[key] ?? scored[key]?.[0]?.pid ?? "";

  if (!publish) return null;
  const start = plan[0]?.start ?? publish;
  const days = eachDayOfInterval({ start: parseISO(start), end: parseISO(publish) }).map(toIso);
  const openStart = firstOpenStart(v, plan);
  const late = !!openStart && openStart < TODAY;
  const holidayPublish = HOLIDAYS[publish] || (!isWorkingDay(publish) ? "Sunday" : "");
  const suggested = late || holidayPublish ? earliestFeasible(v) : null;
  const c = clientById(v.clientId);

  return (
    <Card className="mt-5">
      <CardHeader className="flex-col gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="flex items-center gap-2">
            <CardTitle>Backward plan</CardTitle>
            <Badge tone="accent">
              <Sparkles /> Auto-scheduled
            </Badge>
          </div>
          <CardDescription>Pick a video and its publish date — the plan works backwards, skipping Sundays and holidays, and suggests who should do each step.</CardDescription>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <div className="mb-1 text-body font-medium text-muted-foreground">Video</div>
            <Select className="h-9 w-80 text-body" value={v.id} onValueChange={onVideo} options={options} />
          </div>
          <div>
            <div className="mb-1 text-body font-medium text-muted-foreground">Publish date</div>
            <Input type="date" value={publish} onChange={(e) => setPublish(e.target.value)} className="w-40" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {(late || holidayPublish) && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-danger/25 bg-danger-soft/60 px-4 py-3">
            <AlertTriangle className="size-4 shrink-0 text-danger" />
            <div className="min-w-0 flex-1 text-body">
              <b className="font-semibold text-danger">{holidayPublish ? `Publish date falls on ${holidayPublish}.` : "Not feasible from today."}</b>{" "}
              <span className="text-foreground/80">
                {late && `The first open step would have to start ${fmt(openStart!, "EEE d MMM")}, which is already past. `}
                Earliest realistic publish date is <b className="font-semibold">{fmt(suggested!, "EEE, d MMM")}</b>.
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={() => setPublish(suggested!)}>
              <Wand2 /> Use {fmt(suggested!)}
            </Button>
          </div>
        )}

        <div className="overflow-x-auto scrollbar-thin">
          <div className="min-w-[980px]">
            <div className="grid grid-cols-[220px_1fr_280px] items-end gap-4 border-b border-border pb-2">
              <span className="text-body font-medium uppercase tracking-wider text-muted-foreground">Step</span>
              <div className="grid" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
                {days.map((d) => (
                  <div key={d} className={cn("text-center text-body leading-tight", !isWorkingDay(d) ? "text-muted-foreground/50" : "text-muted-foreground", d === TODAY && "font-semibold text-primary")}>
                    <div>{fmt(d, "EEEEE")}</div>
                    <div className="tabular">{fmt(d, "d")}</div>
                  </div>
                ))}
              </div>
              <span className="text-body font-medium uppercase tracking-wider text-muted-foreground">Suggested owner</span>
            </div>
            {plan.map((s) => {
              const done = stepDone(v, s.key);
              const a = days.indexOf(s.start);
              const b = days.indexOf(s.end);
              const list = scored[s.key] ?? [];
              const chosen = list.find((x) => x.pid === pick(s.key)) ?? list[0];
              const past = !done && s.start < TODAY;
              return (
                <div key={s.key} className="grid grid-cols-[220px_1fr_280px] items-center gap-4 border-b border-border py-2.5 last:border-0">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-body font-medium">
                      {done && <CheckCircle2 className="size-3.5 text-success" />}
                      {s.label}
                    </div>
                    <div className="text-body text-muted-foreground">
                      {s.days ? `${s.days} day${s.days === 1 ? "" : "s"} · ` : ""}
                      {s.start === s.end ? fmt(s.start, "EEE d MMM") : `${fmt(s.start, "d MMM")} → ${fmt(s.end, "d MMM")}`}
                    </div>
                  </div>
                  <div className="relative grid h-8" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
                    {days.map((d) => (
                      <div key={d} className={cn("h-full border-l border-border/60 first:border-l-0", !isWorkingDay(d) && "bg-muted/70", d === TODAY && "bg-primary-soft/60")} />
                    ))}
                    <div
                      className={cn(
                        "absolute inset-y-1 flex items-center rounded-md px-2 text-body font-medium",
                        done ? "bg-success-soft text-success" : past ? "bg-danger/80 text-white" : s.key === "publish" ? "bg-primary text-primary-foreground" : "text-white",
                      )}
                      style={{
                        left: `calc(${(a / days.length) * 100}% + 2px)`,
                        width: `calc(${((b - a + 1) / days.length) * 100}% - 4px)`,
                        ...(!done && !past && s.key !== "publish" ? { backgroundColor: CLIENT_COLOR[v.clientId] } : {}),
                      }}
                    >
                      <span className="truncate">{s.key === "publish" ? "Live" : done ? "Done" : s.label.split(" ")[0]}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {done ? (
                      <span className="text-body text-muted-foreground">Completed</span>
                    ) : (
                      <>
                        <Select
                          className="h-8 w-40 text-body"
                          value={pick(s.key)}
                          onValueChange={(pid) => setAssign((x) => ({ ...x, [s.key]: pid }))}
                          options={list.map((x) => ({ value: x.pid, label: `${personById(x.pid).name.split(" ")[0]} · ${Math.round(x.score * 100)}` }))}
                        />
                        {chosen && (
                          <Tooltip content={chosen.reasons.join(" · ")}>
                            <span className="flex flex-wrap gap-1">
                              {chosen.blocked ? (
                                <Badge tone="danger">Unavailable</Badge>
                              ) : chosen.overloaded ? (
                                <Badge tone="warning">Overloaded</Badge>
                              ) : (
                                <Badge tone="success">Available</Badge>
                              )}
                            </span>
                          </Tooltip>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 md:flex-row md:items-center">
          <div className="flex-1 text-body text-muted-foreground">
            <span className="mr-2 inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={clientDot(v.clientId)} />
              {c.name}
            </span>
            Suggestions weigh skill fit (45%), availability that week (35%) and client familiarity (20%).
            {approved && (
              <span className="ml-2 font-medium text-success">
                Plan approved for {fmt(approved.publish, "d MMM")}.
              </span>
            )}
          </div>
          <Button
            variant="accent"
            disabled={late || !!holidayPublish}
            onClick={() => {
              const assignees = Object.fromEntries(plan.filter((s) => !stepDone(v, s.key)).map((s) => [s.key, pick(s.key)]));
              approvePlan(v.id, publish, assignees);
              updateVideo(v.id, { dueDate: publish, publishDate: publish });
              log(`Backward plan approved for ${v.code} — publish ${fmt(publish, "d MMM")}, ${Object.keys(assignees).length} tasks assigned`, "success");
              toast.success("Plan approved", { description: `${v.code} publishes ${fmt(publish, "EEE d MMM")} · tasks created on the calendar` });
            }}
          >
            <CalendarCheck2 /> Approve plan
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
