"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlarmClock, BellRing, BookOpen, CheckCircle2, ExternalLink, GraduationCap, Plus, Sparkles } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Field, Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Tooltip } from "@/components/ui/tooltip";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StatCard } from "@/components/shared/stat-card";
import { people, personById, TODAY } from "@/lib/mock/core";
import { useDemo } from "@/lib/store";
import { cn, fmtDate } from "@/lib/utils";
import { assignments as seedAssignments, LMS, paths, scoreLabel, skillMatrix, SKILLS, type AssignStatus, type Assignment } from "./data";

const allModules = paths.flatMap((p) => p.modules.map((m) => ({ ...m, role: p.role })));
const moduleById = (id: string) => allModules.find((m) => m.id === id)!;

const statusTone: Record<AssignStatus, "neutral" | "info" | "success" | "danger"> = {
  "Not started": "neutral",
  "In progress": "info",
  Completed: "success",
  Overdue: "danger",
};

const cellBg = (s: number) => `color-mix(in oklab, var(--accent) ${[0, 10, 26, 44, 66, 90][s]}%, transparent)`;

function PathsGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {paths.map((p) => {
        const hrs = p.modules.reduce((s, m) => s + m.hours, 0);
        return (
          <Card key={p.id} className="flex flex-col">
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="inline-flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <GraduationCap className="size-4" />
                </span>
                <div>
                  <CardTitle>{p.role}</CardTitle>
                  <CardDescription>{p.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <ol className="space-y-2">
                {p.modules.map((m, i) => (
                  <li key={m.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-2 text-[13px]">
                    <span className="tabular inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-muted text-[11px] font-semibold text-muted-foreground">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{m.title}</span>
                    <span className="tabular text-[11.5px] text-muted-foreground">{m.hours}h</span>
                    <a
                      href={`${LMS}/${m.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent-soft px-1.5 py-0.5 text-[11px] font-medium text-accent hover:brightness-95"
                    >
                      Open in LMS <ExternalLink className="size-3" />
                    </a>
                  </li>
                ))}
              </ol>
            </CardContent>
            <div className="flex items-center justify-between border-t border-border px-5 py-3 text-[12px] text-muted-foreground">
              <span>
                {p.modules.length} modules · <span className="tabular">{hrs}h</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Avatar name={p.owner} size="xs" /> {p.owner.split(" ")[0]} owns
              </span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function AssignDialog({ open, onOpenChange, onAssign }: { open: boolean; onOpenChange: (o: boolean) => void; onAssign: (a: Assignment) => void }) {
  const [personId, setPersonId] = useState("p-surya");
  const [moduleId, setModuleId] = useState("ve-5");
  const [due, setDue] = useState("2026-10-09");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign training</DialogTitle>
          <DialogDescription>The person gets an LMS enrolment and a WhatsApp nudge with the course link.</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-4">
          <Field label="Person">
            <Select value={personId} onValueChange={setPersonId} options={people.map((p) => ({ value: p.id, label: `${p.name} — ${p.role}` }))} />
          </Field>
          <Field label="Course">
            <Select value={moduleId} onValueChange={setModuleId} options={allModules.map((m) => ({ value: m.id, label: `${m.role} · ${m.title}` }))} />
          </Field>
          <Field label="Due date" hint={`${moduleById(moduleId).hours}h of content · link: ${LMS}/${moduleById(moduleId).slug}`}>
            <Input type="date" value={due} min={TODAY} onChange={(e) => setDue(e.target.value)} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            variant="accent"
            disabled={!due}
            onClick={() => {
              onAssign({ id: `as-${Date.now()}`, personId, moduleId, assignedOn: TODAY, due, progress: 0, status: "Not started" });
              const who = personById(personId).name;
              toast.success(`Assigned to ${who}`, { description: `${moduleById(moduleId).title} · due ${fmtDate(due)}` });
              useDemo.getState().log(`Training “${moduleById(moduleId).title}” assigned to ${who}`, "accent");
              onOpenChange(false);
            }}
          >
            Assign
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignmentsTable({ rows, onAdd }: { rows: Assignment[]; onAdd: () => void }) {
  const [filter, setFilter] = useState<"all" | AssignStatus>("all");
  const [reminded, setReminded] = useState<Record<string, boolean>>({});
  const shown = rows.filter((r) => filter === "all" || r.status === filter);
  const remind = (a: Assignment) => {
    const who = personById(a.personId).name;
    setReminded((r) => ({ ...r, [a.id]: true }));
    toast.success(`Reminder sent to ${who.split(" ")[0]}`, { description: `WhatsApp + email: “${moduleById(a.moduleId).title}” due ${fmtDate(a.due)}` });
  };
  const overdue = rows.filter((r) => r.status === "Overdue");

  return (
    <Card>
      <CardHeader className="flex-col gap-3 sm:flex-row sm:items-center">
        <div>
          <CardTitle>Assignments</CardTitle>
          <CardDescription>Progress syncs nightly from the LMS.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            className="h-8 w-36 text-[13px]"
            value={filter}
            onValueChange={(v) => setFilter(v as typeof filter)}
            options={[{ value: "all", label: "All statuses" }, ...(["Not started", "In progress", "Completed", "Overdue"] as const).map((s) => ({ value: s, label: s }))]}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={!overdue.length}
            onClick={() => {
              overdue.forEach((a) => setReminded((r) => ({ ...r, [a.id]: true })));
              toast.success(`Reminded ${overdue.length} people with overdue training`);
            }}
          >
            <BellRing /> Remind overdue
          </Button>
          <Button variant="accent" size="sm" onClick={onAdd}>
            <Plus /> Assign training
          </Button>
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-2">
        <Table>
          <THead>
            <TR>
              <TH className="pl-5">Person</TH>
              <TH>Course</TH>
              <TH>Assigned</TH>
              <TH>Due</TH>
              <TH>Status</TH>
              <TH className="w-44">Completion</TH>
              <TH className="pr-5 text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {shown.map((a) => {
              const p = personById(a.personId);
              const m = moduleById(a.moduleId);
              return (
                <TR key={a.id}>
                  <TD className="pl-5">
                    <div className="flex items-center gap-2.5">
                      <Avatar name={p.name} size="sm" />
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-[11.5px] text-muted-foreground">{p.type === "freelancer" ? "Freelancer" : p.role}</div>
                      </div>
                    </div>
                  </TD>
                  <TD>
                    <a href={`${LMS}/${m.slug}`} target="_blank" rel="noopener noreferrer" className="group inline-flex items-center gap-1 font-medium hover:text-accent">
                      {m.title}
                      <ExternalLink className="size-3 opacity-0 transition group-hover:opacity-100" />
                    </a>
                    <div className="text-[11.5px] text-muted-foreground">{m.role} path</div>
                  </TD>
                  <TD className="tabular text-muted-foreground">{fmtDate(a.assignedOn)}</TD>
                  <TD className={cn("tabular", a.status === "Overdue" && "font-medium text-danger")}>{fmtDate(a.due)}</TD>
                  <TD>
                    <Badge tone={statusTone[a.status]} dot>
                      {a.status}
                    </Badge>
                  </TD>
                  <TD>
                    <div className="flex items-center gap-2">
                      <Progress value={a.progress} tone={a.status === "Completed" ? "success" : a.status === "Overdue" ? "danger" : "accent"} />
                      <span className="tabular w-9 text-right text-[12px] text-muted-foreground">{a.progress}%</span>
                    </div>
                  </TD>
                  <TD className="pr-5 text-right">
                    {a.status === "Completed" ? (
                      <span className="inline-flex items-center gap-1 text-[12px] text-success">
                        <CheckCircle2 className="size-3.5" /> Done
                      </span>
                    ) : (
                      <Button variant={reminded[a.id] ? "ghost" : "outline"} size="xs" onClick={() => remind(a)}>
                        <BellRing className="size-3.5" /> {reminded[a.id] ? "Sent" : "Send reminder"}
                      </Button>
                    )}
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function SkillMatrix() {
  const [matrix, setMatrix] = useState(skillMatrix);
  const ids = Object.keys(matrix);
  const cycle = (pid: string, i: number) => {
    setMatrix((m) => {
      const row = [...m[pid]!];
      row[i] = (row[i]! % 5) + 1;
      return { ...m, [pid]: row };
    });
  };
  const teamAvg = SKILLS.map((_, i) => ids.reduce((s, id) => s + matrix[id]![i]!, 0) / ids.length);
  const gaps = SKILLS.filter((_, i) => ids.filter((id) => matrix[id]![i]! >= 4).length < 2);

  return (
    <Card>
      <CardHeader className="flex-col gap-3 md:flex-row md:items-center">
        <div>
          <CardTitle>Skill matrix</CardTitle>
          <CardDescription>Click a cell to update a score (1–5). Bus-factor risk where fewer than 2 people score 4+.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted-foreground">
          {[1, 2, 3, 4, 5].map((s) => (
            <span key={s} className="inline-flex items-center gap-1.5">
              <span className={cn("tabular inline-flex size-5 items-center justify-center rounded font-semibold", s >= 4 ? "text-white" : "text-foreground")} style={{ background: cellBg(s) }}>
                {s}
              </span>
              {scoreLabel[s]}
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-0">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-max min-w-full border-separate border-spacing-1 px-4 text-[12px]">
            <thead>
              <tr>
                <th className="sticky left-0 z-10 min-w-[170px] bg-card text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Person</th>
                {SKILLS.map((s) => (
                  <th key={s} className="w-[84px] px-1 pb-1 text-center align-bottom text-[11px] font-medium leading-tight text-muted-foreground">
                    <span className={cn(gaps.includes(s) && "text-warning")}>{s}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ids.map((pid) => {
                const p = personById(pid);
                return (
                  <tr key={pid}>
                    <td className="sticky left-0 z-10 bg-card pr-2">
                      <div className="flex items-center gap-2">
                        <Avatar name={p.name} size="xs" />
                        <span className="truncate font-medium">{p.name}</span>
                      </div>
                    </td>
                    {matrix[pid]!.map((score, i) => (
                      <td key={SKILLS[i]} className="p-0">
                        <Tooltip content={`${p.name.split(" ")[0]} · ${SKILLS[i]}: ${score} — ${scoreLabel[score]}`}>
                          <button
                            onClick={() => cycle(pid, i)}
                            className={cn(
                              "tabular flex h-8 w-full cursor-pointer items-center justify-center rounded-md font-semibold transition hover:ring-2 hover:ring-accent/40",
                              score >= 4 ? "text-white" : "text-foreground",
                            )}
                            style={{ background: cellBg(score) }}
                          >
                            {score}
                          </button>
                        </Tooltip>
                      </td>
                    ))}
                  </tr>
                );
              })}
              <tr>
                <td className="sticky left-0 z-10 bg-card pt-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Team avg</td>
                {teamAvg.map((v, i) => (
                  <td key={SKILLS[i]} className="tabular pt-2 text-center font-semibold">
                    {v.toFixed(1)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        {gaps.length > 0 && (
          <div className="mx-5 mt-3 flex items-start gap-2 rounded-xl bg-warning-soft p-3 text-[12.5px] text-warning">
            <Sparkles className="mt-0.5 size-4 shrink-0" />
            <span>
              Coverage gap: <span className="font-semibold">{gaps.join(", ")}</span> — fewer than two people at “Strong”. Consider assigning the matching LMS path.
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function LearningView() {
  const [rows, setRows] = useState<Assignment[]>(seedAssignments);
  const [assignOpen, setAssignOpen] = useState(false);
  const stats = useMemo(() => {
    const active = rows.filter((r) => r.status !== "Completed").length;
    const done = rows.filter((r) => r.status === "Completed").length;
    const overdue = rows.filter((r) => r.status === "Overdue").length;
    const avg = Math.round(rows.reduce((s, r) => s + r.progress, 0) / rows.length);
    return { active, done, overdue, avg };
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard label="Active assignments" value={stats.active} icon={BookOpen} tone="accent" hint={`${paths.length} role paths`} />
        <StatCard label="Completed (Sep)" value={stats.done} icon={CheckCircle2} tone="success" hint="certificates issued" />
        <StatCard label="Overdue" value={stats.overdue} icon={AlarmClock} tone="danger" hint="reminders pending" />
        <StatCard label="Avg completion" value={`${stats.avg}%`} icon={GraduationCap} tone="info" hint="across all assignments" />
      </div>

      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments">Assignments</TabsTrigger>
          <TabsTrigger value="paths">Training paths</TabsTrigger>
          <TabsTrigger value="skills">Skill matrix</TabsTrigger>
        </TabsList>
        <TabsContent value="assignments" className="mt-6">
          <AssignmentsTable rows={rows} onAdd={() => setAssignOpen(true)} />
        </TabsContent>
        <TabsContent value="paths" className="mt-6">
          <PathsGrid />
        </TabsContent>
        <TabsContent value="skills" className="mt-6">
          <SkillMatrix />
        </TabsContent>
      </Tabs>

      <AssignDialog open={assignOpen} onOpenChange={setAssignOpen} onAssign={(a) => setRows((r) => [a, ...r])} />
    </div>
  );
}
