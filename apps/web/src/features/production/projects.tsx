"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { AlertOctagon, ArrowRight, CalendarClock, ChevronRight, FolderKanban, ListTodo, Plus } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarStack } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { StageBadge, UrgencyIcon } from "@/components/shared/video-bits";
import { agreements, clientById, cycles, daysBetween, personById, TODAY } from "@/lib/mock/core";
import { roleLabels } from "@/lib/nav";
import { useDemo } from "@/lib/store";
import type { Role } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ClientTag, Segmented } from "./bits";
import { fmt, tasksFor, type GenTask, type TaskStatus } from "./lib";
import { useProduction, useProductionHydration } from "./store";

const ROLE_PERSON: Record<Role, string> = { founder: "p-jana", manager: "p-ashwin", editor: "p-divya", finance: "p-ashwin", hr: "p-harini", client: "p-ashwin" };
const statusMeta: Record<TaskStatus, { label: string; tone: BadgeTone }> = {
  done: { label: "Done", tone: "success" },
  "in-progress": { label: "In progress", tone: "accent" },
  todo: { label: "To do", tone: "neutral" },
  blocked: { label: "Blocked", tone: "danger" },
};
const prioTone: Record<GenTask["priority"], BadgeTone> = { High: "danger", Medium: "warning", Low: "outline" };
const dotCls: Record<TaskStatus, string> = { done: "bg-success", "in-progress": "bg-primary", todo: "bg-muted-foreground/25", blocked: "bg-danger" };

export function ProjectsView() {
  useProductionHydration();
  const role = useDemo((s) => s.role);
  const videos = useDemo((s) => s.videos);
  const taskDone = useProduction((s) => s.taskDone);
  const toggleTask = useProduction((s) => s.toggleTask);
  const log = useDemo((s) => s.log);
  const [mode, setMode] = useState<"all" | "mine">("all");
  const [cycleLabel, setCycleLabel] = useState("Sep 2026");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "v-kvr-5": true });
  const [picked, setPicked] = useState<string | null>(null);

  const allTasks = useMemo(
    () =>
      videos.flatMap((v) =>
        tasksFor(v).map((t) => (taskDone[t.id] ? { ...t, status: "done" as TaskStatus } : t)),
      ),
    [videos, taskDone],
  );

  const projects = useMemo(
    () =>
      cycles
        .filter((c) => c.label === cycleLabel)
        .map((cy) => {
          const ag = agreements.find((a) => a.id === cy.agreementId)!;
          const vids = videos.filter((v) => v.cycleId === cy.id);
          const tasks = allTasks.filter((t) => vids.some((v) => v.id === t.videoId));
          return { cy, ag, vids, tasks };
        })
        .filter((p) => p.vids.length),
    [cycleLabel, videos, allTasks],
  );

  const owners = [...new Set(allTasks.map((t) => t.ownerId))];
  const me = picked ?? (owners.includes(ROLE_PERSON[role]) ? ROLE_PERSON[role] : "p-divya");

  const scoped = projects.flatMap((p) => p.tasks);
  const open = scoped.filter((t) => t.status !== "done");
  const blocked = scoped.filter((t) => t.status === "blocked");
  const dueWeek = open.filter((t) => daysBetween(TODAY, t.due) >= 0 && daysBetween(TODAY, t.due) <= 7);
  const mine = allTasks.filter((t) => t.ownerId === me && t.status !== "done").sort((a, b) => a.due.localeCompare(b.due));

  const toggle = (t: GenTask, val: boolean) => {
    toggleTask(t.id, val);
    const v = videos.find((x) => x.id === t.videoId)!;
    if (val) log(`${personById(t.ownerId).name} completed “${t.name}” for ${v.code}`, "success");
    toast.success(val ? `${t.name} marked done` : `${t.name} reopened`, { description: v.code });
  };

  return (
    <div>
      <PageHeader
        eyebrow={
          <span className="inline-flex items-center gap-1.5">
            <FolderKanban className="size-3.5" /> Client Delivery · Module 13
          </span>
        }
        depth="preview"
        title="Projects & Tasks"
        description="Every agreement × cycle is a project. Every deliverable gets the same seven tasks — one accountable owner each, with dependencies."
        actions={
          <Button variant="accent" onClick={() => toast.success("Task template applied", { description: "7 tasks generated for each new deliverable in Oct 2026 cycles" })}>
            <Plus /> Generate Oct tasks
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Active projects" value={projects.length} icon={FolderKanban} tone="accent" hint={cycleLabel} />
        <StatCard label="Open tasks" value={open.length} icon={ListTodo} tone="info" hint={`of ${scoped.length}`} />
        <StatCard label="Blocked" value={blocked.length} icon={AlertOctagon} tone="danger" hint="waiting on a dependency" />
        <StatCard label="Due in 7 days" value={dueWeek.length} icon={CalendarClock} tone="warning" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented
          value={mode}
          onChange={setMode}
          options={[
            { value: "all", label: "All projects" },
            { value: "mine", label: <>My tasks <span className="tabular text-muted-foreground">{mine.length}</span></> },
          ]}
        />
        {mode === "all" && (
          <Segmented
            value={cycleLabel}
            onChange={setCycleLabel}
            options={[
              { value: "Sep 2026", label: "Sep 2026" },
              { value: "Oct 2026", label: "Oct 2026" },
            ]}
          />
        )}
        {mode === "mine" && (
          <div className="flex items-center gap-2 text-body text-muted-foreground">
            <Avatar name={personById(me).name} size="sm" />
            <Select className="h-8 w-52 text-body" value={me} onValueChange={setPicked} options={owners.map((o) => ({ value: o, label: personById(o).name }))} />
            <span>accountable tasks · signed in as {roleLabels[role].label}</span>
          </div>
        )}
      </div>

      {mode === "mine" ? (
        <Card>
          <Table>
            <THead>
              <TR>
                <TH className="w-10" />
                <TH>Task</TH>
                <TH>Deliverable</TH>
                <TH>Depends on</TH>
                <TH>Priority</TH>
                <TH>Due</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {mine.map((t) => {
                const v = videos.find((x) => x.id === t.videoId)!;
                return (
                  <TR key={t.id}>
                    <TD>
                      <Checkbox checked={false} onCheckedChange={(c) => toggle(t, !!c)} />
                    </TD>
                    <TD className="font-medium">{t.name}</TD>
                    <TD>
                      <Link href={`/production/${v.id}`} className="hover:text-primary">
                        <span className="font-mono text-body text-muted-foreground">{v.code}</span> {v.title}
                      </Link>
                    </TD>
                    <TD className="text-muted-foreground">{t.dependsOn ?? "—"}</TD>
                    <TD>
                      <Badge tone={prioTone[t.priority]}>{t.priority}</Badge>
                    </TD>
                    <TD className={cn("tabular", daysBetween(TODAY, t.due) < 0 && "font-medium text-danger")}>{fmt(t.due)}</TD>
                    <TD>
                      <Badge tone={statusMeta[t.status].tone} dot>
                        {statusMeta[t.status].label}
                      </Badge>
                    </TD>
                  </TR>
                );
              })}
              {!mine.length && (
                <TR>
                  <TD colSpan={7} className="py-10 text-center text-muted-foreground">
                    Nothing open for {personById(me).name}. Switch role in the top bar to see another person’s list.
                  </TD>
                </TR>
              )}
            </TBody>
          </Table>
        </Card>
      ) : (
        <div className="space-y-4">
          {!projects.length && <Card className="py-14 text-center text-body text-muted-foreground">No deliverables planned for {cycleLabel} yet.</Card>}
          {projects.map(({ cy, ag, vids, tasks }) => {
            const c = clientById(cy.clientId);
            const done = tasks.filter((t) => t.status === "done").length;
            return (
              <Card key={cy.id} className="overflow-hidden">
                <div className="flex flex-wrap items-center gap-4 border-b border-border px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <ClientTag clientId={c.id} />
                      <span className="text-body text-muted-foreground">{cy.label} cycle</span>
                    </div>
                    <div className="mt-1 text-subheading font-semibold tracking-tight">{ag.title}</div>
                  </div>
                  <div className="w-48">
                    <div className="mb-1 flex justify-between text-body text-muted-foreground">
                      <span>Tasks</span>
                      <span className="tabular">
                        {done}/{tasks.length}
                      </span>
                    </div>
                    <Progress value={(done / Math.max(1, tasks.length)) * 100} tone="success" />
                  </div>
                  <div className="text-right text-body">
                    <div className="text-muted-foreground">Deliverables</div>
                    <div className="font-semibold tabular">
                      {cy.delivered}/{cy.promised}
                    </div>
                  </div>
                  <Tooltip content={`Account owner: ${personById(c.accountOwnerId).name}`}>
                    <span>
                      <Avatar name={personById(c.accountOwnerId).name} size="md" />
                    </span>
                  </Tooltip>
                </div>
                <Table>
                  <THead>
                    <TR>
                      <TH className="w-8" />
                      <TH>Deliverable / task</TH>
                      <TH>Accountable</TH>
                      <TH>Contributors</TH>
                      <TH>Depends on</TH>
                      <TH>Priority</TH>
                      <TH>Due</TH>
                      <TH>Status</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {vids.map((v) => {
                      const vt = tasks.filter((t) => t.videoId === v.id);
                      const isOpen = !!expanded[v.id];
                      return (
                        <Fragment key={v.id}>
                          <TR className="cursor-pointer bg-muted/20" onClick={() => setExpanded((e) => ({ ...e, [v.id]: !isOpen }))}>
                            <TD>
                              <ChevronRight className={cn("size-4 text-muted-foreground transition", isOpen && "rotate-90")} />
                            </TD>
                            <TD>
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-body text-muted-foreground">{v.code}</span>
                                <span className="font-medium">{v.title}</span>
                                <UrgencyIcon urgency={v.urgency} />
                              </div>
                            </TD>
                            <TD colSpan={3}>
                              <div className="flex items-center gap-1">
                                {vt.map((t) => (
                                  <Tooltip key={t.id} content={`${t.name} · ${statusMeta[t.status].label}`}>
                                    <span className={cn("h-1.5 w-6 rounded-full", dotCls[t.status])} />
                                  </Tooltip>
                                ))}
                              </div>
                            </TD>
                            <TD />
                            <TD className="tabular text-muted-foreground">{fmt(v.dueDate)}</TD>
                            <TD>
                              <StageBadge stage={v.stage} />
                            </TD>
                          </TR>
                          {isOpen &&
                            vt.map((t) => (
                              <TR key={t.id}>
                                <TD>
                                  <Checkbox checked={t.status === "done"} onCheckedChange={(c) => toggle(t, !!c)} onClick={(e) => e.stopPropagation()} />
                                </TD>
                                <TD className={cn("pl-6", t.status === "done" && "text-muted-foreground line-through")}>{t.name}</TD>
                                <TD>
                                  <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-body">
                                    <Avatar name={personById(t.ownerId).name} size="xs" />
                                    {personById(t.ownerId).name}
                                  </span>
                                </TD>
                                <TD>{t.contributors.length ? <AvatarStack names={t.contributors.map((x) => personById(x).name)} size="xs" /> : <span className="text-muted-foreground">—</span>}</TD>
                                <TD className="text-body text-muted-foreground">
                                  {t.dependsOn ? (
                                    <span className="inline-flex items-center gap-1">
                                      <ArrowRight className="size-3" /> {t.dependsOn}
                                    </span>
                                  ) : (
                                    "—"
                                  )}
                                </TD>
                                <TD>
                                  <Badge tone={prioTone[t.priority]}>{t.priority}</Badge>
                                </TD>
                                <TD className={cn("tabular", t.status !== "done" && daysBetween(TODAY, t.due) < 0 && "font-medium text-danger")}>{fmt(t.due)}</TD>
                                <TD>
                                  <Badge tone={statusMeta[t.status].tone} dot>
                                    {statusMeta[t.status].label}
                                  </Badge>
                                </TD>
                              </TR>
                            ))}
                        </Fragment>
                      );
                    })}
                  </TBody>
                </Table>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
