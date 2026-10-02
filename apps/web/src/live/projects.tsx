"use client";

import { useState } from "react";
import { CalendarClock, CheckCircle2, Circle, CircleDot, FolderKanban, Hourglass, ListChecks, ListTodo, Pencil, Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  JOINING_TEMPLATE,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  type ProjectDetail,
  type ProjectRow,
  type ProjectStatus,
  type ProjectTemplate,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  TASK_STATUSES,
  type TaskPriority,
  type TaskRow,
  type TaskStatus,
} from "@gm/shared";
import { PageHeader } from "@/components/shared/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, EmptyState, SkeletonRows } from "@/components/ui/feedback";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn, fmtDate } from "@/lib/utils";
import { errorMessage } from "./api";
import { useCan, useClients, useMe, useProject, useProjectAction, useProjects, useProjectSettings, useTaskPeople, useTasks } from "./queries";

const onError = (e: unknown) => toast.error(errorMessage(e));
/** The day in India of a moment the server recorded. */
const istDay = (at: string) => new Date(new Date(at).getTime() + 330 * 60_000).toISOString().slice(0, 10);
const dayFrom = (n: number) => new Date(Date.now() + 330 * 60_000 + n * 86_400_000).toISOString().slice(0, 10);

const PROJECT_TONE: Record<ProjectStatus, BadgeTone> = { active: "accent", on_hold: "warning", done: "success", cancelled: "neutral" };
const PRIORITY_TONE: Record<TaskPriority, BadgeTone> = { high: "danger", medium: "warning", low: "neutral" };

/** Projects and tasks (P5-21): my tasks, the projects I take part in, everyone's tasks, and the task lists. */
export function LiveProjects({ taskId, projectId }: { taskId?: string; projectId?: string }) {
  const can = useCan();
  const mine = useTasks("mine");
  const projects = useProjects();
  const [tab, setTab] = useState(projectId ? "projects" : "mine");
  const [open, setOpen] = useState<string | null>(projectId ?? null);
  const [newTask, setNewTask] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const openTasks = (mine.data ?? []).filter((t) => t.status !== "done");
  return (
    <>
      <PageHeader
        title="Projects and tasks"
        description="Work that is not a video — a website, an event, a new person's joining — as projects of tasks, each with one person accountable, a due day and what it waits for."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => setNewTask(true)}>
              <Plus /> New task
            </Button>
            {can("projects", "edit") && (
              <Button variant="accent" size="sm" onClick={() => setNewProject(true)}>
                <FolderKanban /> New project
              </Button>
            )}
          </>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="My open tasks" value={openTasks.length} icon={ListTodo} tone="accent" />
        <StatCard label="Overdue" value={openTasks.filter((t) => t.overdue).length} icon={CalendarClock} tone={openTasks.some((t) => t.overdue) ? "danger" : "success"} />
        <StatCard label="Waiting to start" value={openTasks.filter((t) => t.blocked).length} icon={Hourglass} tone="warning" hint="For a task before them" />
        <StatCard label="Active projects" value={(projects.data ?? []).filter((p) => p.status === "active").length} icon={FolderKanban} tone="info" />
      </div>
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="mine">
            <ListTodo /> My tasks
          </TabsTrigger>
          <TabsTrigger value="projects">
            <FolderKanban /> Projects
          </TabsTrigger>
          {can("projects", "view") && (
            <TabsTrigger value="everyone">
              <Users /> Everyone&apos;s tasks
            </TabsTrigger>
          )}
          {can("projects", "edit") && (
            <TabsTrigger value="lists">
              <ListChecks /> Task lists
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="mine">
          <MyTasks focus={taskId} onOpenProject={setOpen} />
        </TabsContent>
        <TabsContent value="projects">
          <Projects onOpen={setOpen} />
        </TabsContent>
        {can("projects", "view") && (
          <TabsContent value="everyone">
            <EveryonesTasks onOpenProject={setOpen} />
          </TabsContent>
        )}
        {can("projects", "edit") && (
          <TabsContent value="lists">
            <TaskLists />
          </TabsContent>
        )}
      </Tabs>
      {open && <ProjectPanel id={open} onClose={() => setOpen(null)} />}
      {newTask && <TaskDialog task={null} project={null} onClose={() => setNewTask(false)} />}
      {newProject && <ProjectForm project={null} onClose={() => setNewProject(false)} onSaved={(p) => (setNewProject(false), setTab("projects"), setOpen(p.id))} />}
    </>
  );
}

// ─── Task lines ───────────────────────────────────────────────────────

function StatusButton({ t }: { t: TaskRow }) {
  const act = useProjectAction();
  const next: TaskStatus = t.status === "done" ? "todo" : "done";
  const Icon = t.status === "done" ? CheckCircle2 : t.status === "in_progress" ? CircleDot : Circle;
  return (
    <button
      type="button"
      aria-label={t.status === "done" ? "Reopen" : "Mark done"}
      title={t.blocked ? `Waits for "${t.waitsFor?.title}"` : t.status === "done" ? "Reopen" : "Mark done"}
      disabled={act.isPending || (t.blocked && next === "done")}
      onClick={() => act.mutate({ step: "status", id: t.id, status: next }, { onSuccess: () => toast.success(next === "done" ? "Done" : "Reopened"), onError })}
      className={cn(
        "mt-0.5 shrink-0 cursor-pointer rounded-full text-muted-foreground transition hover:text-primary disabled:cursor-not-allowed disabled:opacity-40",
        t.status === "done" && "text-success",
        t.status === "in_progress" && "text-primary",
      )}
    >
      <Icon className="size-5" />
    </button>
  );
}

function TaskLine({
  t,
  showProject,
  showOwner,
  focus,
  onOpenProject,
  onEdit,
}: {
  t: TaskRow;
  showProject?: boolean;
  showOwner?: boolean;
  focus?: boolean;
  onOpenProject?: (id: string) => void;
  onEdit?: () => void;
}) {
  const act = useProjectAction();
  return (
    <li className={cn("flex items-start gap-3 rounded-xl border border-border bg-card p-3.5", focus && "ring-2 ring-primary/50")}>
      <StatusButton t={t} />
      <div className="min-w-0 flex-1">
        <div className={cn("text-body font-medium", t.status === "done" && "text-muted-foreground line-through")}>{t.title}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-body text-muted-foreground">
          {showProject && t.project && (
            <button type="button" className="cursor-pointer hover:text-foreground hover:underline" onClick={() => onOpenProject?.(t.project!.id)}>
              {t.project.name}
            </button>
          )}
          {showProject && !t.project && <span>{t.source === "commitment" ? "A commitment carried forward" : "On its own"}</span>}
          {t.dueOn && (
            <span className={cn(t.overdue && "font-medium text-danger")}>
              {t.overdue ? "Overdue since" : t.status === "done" ? "Was due" : "Due"} {fmtDate(t.dueOn)}
            </span>
          )}
          {t.blocked && t.waitsFor && <span className="text-warning">Waits for “{t.waitsFor.title}”</span>}
          {t.status === "done" && t.completedAt && <span>Done {fmtDate(istDay(t.completedAt))}</span>}
        </div>
        {t.notes && <div className="mt-1 whitespace-pre-line text-body text-muted-foreground">{t.notes}</div>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {t.priority !== "medium" && <Badge tone={PRIORITY_TONE[t.priority]}>{TASK_PRIORITY_LABEL[t.priority]}</Badge>}
        {showOwner && (
          <span className="inline-flex items-center gap-1.5 text-body">
            <Avatar name={t.owner.name ?? "?"} size="xs" />
            {t.owner.name}
          </span>
        )}
        {t.status !== "done" && !t.blocked && (
          <Select
            className="h-8 w-32"
            aria-label="Status"
            value={t.status}
            onValueChange={(v) => act.mutate({ step: "status", id: t.id, status: v as TaskStatus }, { onError })}
            options={TASK_STATUSES.map((s) => ({ value: s, label: TASK_STATUS_LABEL[s] }))}
          />
        )}
        {onEdit && (
          <Button size="xs" variant="ghost" aria-label="Change the task" onClick={onEdit}>
            <Pencil />
          </Button>
        )}
      </div>
    </li>
  );
}

function MyTasks({ focus, onOpenProject }: { focus?: string; onOpenProject: (id: string) => void }) {
  const q = useTasks("mine");
  const me = useMe().data?.user.id;
  const can = useCan();
  const [editing, setEditing] = useState<TaskRow | null>(null);
  if (q.isPending) return <SkeletonRows rows={5} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const open = q.data.filter((t) => t.status !== "done");
  const done = q.data.filter((t) => t.status === "done");
  return (
    <div className="space-y-5">
      {open.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={ListTodo} title="Nothing on your list" description="Tasks given to you, and the ones you keep for yourself, show here." />
        </Card>
      ) : (
        <ul className="space-y-2">
          {open.map((t) => (
            <TaskLine
              key={t.id}
              t={t}
              showProject
              focus={t.id === focus}
              onOpenProject={onOpenProject}
              onEdit={t.createdBy?.id === me || can("projects", "edit") ? () => setEditing(t) : undefined}
            />
          ))}
        </ul>
      )}
      {done.length > 0 && (
        <div>
          <div className="mb-2 text-body font-medium text-muted-foreground">Done in the last two weeks</div>
          <ul className="space-y-2">
            {done.map((t) => (
              <TaskLine key={t.id} t={t} showProject focus={t.id === focus} onOpenProject={onOpenProject} />
            ))}
          </ul>
        </div>
      )}
      {editing && <TaskDialog task={editing} project={null} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EveryonesTasks({ onOpenProject }: { onOpenProject: (id: string) => void }) {
  const q = useTasks("all");
  const people = useTaskPeople();
  const [who, setWho] = useState("all");
  const [editing, setEditing] = useState<TaskRow | null>(null);
  const can = useCan();
  if (q.isPending) return <SkeletonRows rows={5} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const shown = q.data.filter((t) => who === "all" || t.owner.id === who);
  return (
    <div className="space-y-3">
      <Select
        className="w-56"
        aria-label="Whose tasks"
        value={who}
        onValueChange={setWho}
        options={[{ value: "all", label: "Everyone" }, ...(people.data ?? []).map((p) => ({ value: p.id, label: p.name ?? "—" }))]}
      />
      {shown.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={ListTodo} title="No open tasks" description="Nobody here has a task waiting." />
        </Card>
      ) : (
        <ul className="space-y-2">
          {shown.map((t) => (
            <TaskLine key={t.id} t={t} showProject showOwner onOpenProject={onOpenProject} onEdit={can("projects", "edit") ? () => setEditing(t) : undefined} />
          ))}
        </ul>
      )}
      {editing && <TaskDialog task={editing} project={null} onClose={() => setEditing(null)} />}
    </div>
  );
}

// ─── Projects ─────────────────────────────────────────────────────────

function Projects({ onOpen }: { onOpen: (id: string) => void }) {
  const q = useProjects();
  const [status, setStatus] = useState("open");
  if (q.isPending) return <SkeletonRows rows={4} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  const shown = q.data.filter((p) => status === "all" || (status === "open" ? p.status === "active" || p.status === "on_hold" : p.status === status));
  return (
    <div className="space-y-3">
      <Select
        className="w-48"
        aria-label="Which projects"
        value={status}
        onValueChange={setStatus}
        options={[
          { value: "open", label: "Active and on hold" },
          { value: "all", label: "All projects" },
          ...PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] })),
        ]}
      />
      {shown.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={FolderKanban} title="No projects here" description="Projects you run, take part in, or are joining show here." />
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {shown.map((p) => (
            <ProjectCard key={p.id} p={p} onOpen={() => onOpen(p.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function ProjectCard({ p, onOpen }: { p: ProjectRow; onOpen: () => void }) {
  const pct = p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : 0;
  return (
    <button type="button" onClick={onOpen} className="cursor-pointer text-left">
      <Card className="h-full p-4 transition hover:border-primary/40">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate text-subheading font-semibold">{p.name}</div>
            <div className="text-body text-muted-foreground">
              {p.client ? `${p.client.name} · ` : ""}Run by {p.owner.name}
              {p.dueOn ? ` · due ${fmtDate(p.dueOn)}` : ""}
            </div>
          </div>
          <Badge tone={PROJECT_TONE[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={pct} className="flex-1" tone={p.progress.overdue ? "warning" : "accent"} />
          <span className="text-body tabular text-muted-foreground">
            {p.progress.done} of {p.progress.total}
          </span>
        </div>
        {(p.progress.overdue > 0 || p.progress.blocked > 0) && (
          <div className="mt-2 flex gap-3 text-body">
            {p.progress.overdue > 0 && <span className="text-danger">{p.progress.overdue} overdue</span>}
            {p.progress.blocked > 0 && <span className="text-warning">{p.progress.blocked} waiting</span>}
          </div>
        )}
      </Card>
    </button>
  );
}

function ProjectPanel({ id, onClose }: { id: string; onClose: () => void }) {
  const q = useProject(id);
  const can = useCan();
  const me = useMe().data?.user.id;
  const [editing, setEditing] = useState(false);
  const [task, setTask] = useState<TaskRow | "new" | null>(null);
  const p = q.data;
  const runs = !!p && (can("projects", "edit") || p.owner.id === me);
  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent side="right" className="max-w-2xl">
          {q.isPending ? (
            <div className="p-6">
              <DialogTitle className="sr-only">Loading</DialogTitle>
              <SkeletonRows rows={6} />
            </div>
          ) : q.error || !p ? (
            <div className="p-6">
              <DialogTitle className="sr-only">Not found</DialogTitle>
              <Alert tone="danger">{q.error ? errorMessage(q.error) : "Not found"}</Alert>
            </div>
          ) : (
            <div>
              <div className="border-b border-border p-4 pr-12 sm:p-6 sm:pr-12">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={PROJECT_TONE[p.status]}>{PROJECT_STATUS_LABEL[p.status]}</Badge>
                  {p.client && <span className="text-body text-muted-foreground">{p.client.name}</span>}
                </div>
                <DialogTitle className="mt-2">{p.name}</DialogTitle>
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-body text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Avatar name={p.owner.name ?? "?"} size="xs" /> Run by {p.owner.name}
                  </span>
                  {p.joiner && <span>Joining: {p.joiner.name}</span>}
                  {p.startOn && <span>From {fmtDate(p.startOn)}</span>}
                  {p.dueOn && <span>Due {fmtDate(p.dueOn)}</span>}
                </div>
                {p.description && <p className="mt-3 whitespace-pre-line text-body">{p.description}</p>}
                <div className="mt-4 flex items-center gap-3">
                  <Progress value={p.progress.total ? Math.round((p.progress.done / p.progress.total) * 100) : 0} className="flex-1" />
                  <span className="text-body tabular text-muted-foreground">
                    {p.progress.done} of {p.progress.total} done
                  </span>
                </div>
                {runs && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button size="sm" variant="accent" onClick={() => setTask("new")}>
                      <Plus /> Add a task
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                      <Pencil /> Change the project
                    </Button>
                  </div>
                )}
              </div>
              <div className="p-4 sm:p-6">
                {p.tasks.length === 0 ? (
                  <EmptyState compact icon={ListTodo} title="No tasks yet" description="Add the tasks, each with one person accountable." />
                ) : (
                  <ol className="space-y-2">
                    {p.tasks.map((t) => (
                      <TaskLine key={t.id} t={t} showOwner onEdit={runs || t.createdBy?.id === me ? () => setTask(t) : undefined} />
                    ))}
                  </ol>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      {p && editing && <ProjectForm project={p} onClose={() => setEditing(false)} onSaved={() => setEditing(false)} />}
      {p && task && <TaskDialog task={task === "new" ? null : task} project={p} onClose={() => setTask(null)} />}
    </>
  );
}

// ─── Forms ────────────────────────────────────────────────────────────

function ProjectForm({ project, onClose, onSaved }: { project: ProjectDetail | null; onClose: () => void; onSaved: (p: ProjectDetail) => void }) {
  const act = useProjectAction();
  const me = useMe().data?.user.id ?? "";
  const people = useTaskPeople();
  const clients = useClients();
  const lists = useProjectSettings();
  const [f, setF] = useState(() => ({
    name: project?.name ?? "",
    clientId: project?.client?.id ?? "_none",
    ownerId: project?.owner.id ?? me,
    description: project?.description ?? "",
    startOn: project?.startOn ?? dayFrom(0),
    dueOn: project?.dueOn ?? "",
    status: (project?.status ?? "active") as ProjectStatus,
    templateKey: "_none",
  }));
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const templates = (lists.data?.templates ?? []).filter((t) => t.key !== JOINING_TEMPLATE);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{project ? "Change the project" : "New project"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" className="sm:col-span-2">
            <Input value={f.name} onChange={(e) => set({ name: e.target.value })} placeholder="Website for Kovai Crafts" />
          </Field>
          <Field label="Run by">
            <Select value={f.ownerId} onValueChange={(v) => set({ ownerId: v })} options={(people.data ?? []).map((p) => ({ value: p.id, label: p.name ?? "—" }))} />
          </Field>
          <Field label="For a client">
            <Select
              value={f.clientId}
              onValueChange={(v) => set({ clientId: v })}
              options={[{ value: "_none", label: "No client (our own)" }, ...(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))]}
            />
          </Field>
          <Field label="Starts">
            <Input type="date" value={f.startOn} onChange={(e) => set({ startOn: e.target.value })} />
          </Field>
          <Field label="Due">
            <Input type="date" value={f.dueOn} onChange={(e) => set({ dueOn: e.target.value })} />
          </Field>
          {project ? (
            <Field label="Status" className="sm:col-span-2">
              <Select
                value={f.status}
                onValueChange={(v) => set({ status: v as ProjectStatus })}
                options={PROJECT_STATUSES.map((s) => ({ value: s, label: PROJECT_STATUS_LABEL[s] }))}
              />
            </Field>
          ) : (
            <Field label="Start from a task list" hint="Its tasks go to whoever runs the project, due from the start day" className="sm:col-span-2">
              <Select
                value={f.templateKey}
                onValueChange={(v) => set({ templateKey: v })}
                options={[{ value: "_none", label: "No list: add the tasks myself" }, ...templates.map((t) => ({ value: t.key, label: `${t.name} (${t.tasks.length} tasks)` }))]}
              />
            </Field>
          )}
          <Field label="What it is about" className="sm:col-span-2">
            <Textarea rows={3} value={f.description} onChange={(e) => set({ description: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending || f.name.trim().length < 2 || !f.ownerId}
            onClick={() =>
              act.mutate(
                {
                  step: "project",
                  id: project?.id,
                  body: {
                    ...f,
                    clientId: f.clientId === "_none" ? null : f.clientId,
                    startOn: f.startOn || null,
                    dueOn: f.dueOn || null,
                    templateKey: !project && f.templateKey !== "_none" ? f.templateKey : null,
                  },
                },
                { onSuccess: (p) => (toast.success(project ? "Saved" : "Project started"), onSaved(p as ProjectDetail)), onError },
              )
            }
          >
            {project ? "Save" : "Start it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TaskDialog({ task, project, onClose }: { task: TaskRow | null; project: ProjectDetail | null; onClose: () => void }) {
  const act = useProjectAction();
  const can = useCan();
  const me = useMe().data?.user.id ?? "";
  const people = useTaskPeople();
  const inProject = project ?? null;
  const giveToOthers = !!inProject || can("projects", "edit") || (!!task && task.owner.id !== me);
  const [f, setF] = useState(() => ({
    title: task?.title ?? "",
    notes: task?.notes ?? "",
    ownerId: task?.owner.id ?? (inProject ? inProject.owner.id : me),
    dueOn: task?.dueOn ?? "",
    priority: (task?.priority ?? "medium") as TaskPriority,
    dependsOnId: task?.waitsFor?.id ?? "_none",
  }));
  const set = (patch: Partial<typeof f>) => setF((x) => ({ ...x, ...patch }));
  const others = (inProject?.tasks ?? []).filter((x) => x.id !== task?.id);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{task ? "Change the task" : inProject ? `New task in ${inProject.name}` : "New task for myself"}</DialogTitle>
        </DialogHeader>
        <DialogBody className="grid gap-3 sm:grid-cols-2">
          <Field label="What is to be done" className="sm:col-span-2">
            <Input value={f.title} onChange={(e) => set({ title: e.target.value })} />
          </Field>
          <Field label="Who">
            <Select
              value={f.ownerId}
              disabled={!giveToOthers}
              onValueChange={(v) => set({ ownerId: v })}
              options={(people.data ?? []).map((p) => ({ value: p.id, label: p.name ?? "—" }))}
            />
          </Field>
          <Field label="Due">
            <Input type="date" value={f.dueOn} onChange={(e) => set({ dueOn: e.target.value })} />
          </Field>
          <Field label="Priority">
            <Select value={f.priority} onValueChange={(v) => set({ priority: v as TaskPriority })} options={TASK_PRIORITIES.map((p) => ({ value: p, label: TASK_PRIORITY_LABEL[p] }))} />
          </Field>
          {inProject && (
            <Field label="Waits for">
              <Select
                value={f.dependsOnId}
                onValueChange={(v) => set({ dependsOnId: v })}
                options={[{ value: "_none", label: "Nothing" }, ...others.map((x) => ({ value: x.id, label: x.title }))]}
              />
            </Field>
          )}
          <Field label="Notes" className="sm:col-span-2">
            <Textarea rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
          </Field>
        </DialogBody>
        <DialogFooter>
          {task && (
            <Button
              variant="ghost"
              className="mr-auto"
              disabled={act.isPending}
              onClick={() => act.mutate({ step: "removeTask", id: task.id }, { onSuccess: () => (toast("Task removed"), onClose()), onError })}
            >
              <Trash2 /> Remove
            </Button>
          )}
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            disabled={act.isPending || f.title.trim().length < 2 || !f.ownerId}
            onClick={() =>
              act.mutate(
                {
                  step: "task",
                  id: task?.id,
                  body: {
                    title: f.title,
                    notes: f.notes,
                    ownerId: f.ownerId,
                    dueOn: f.dueOn || null,
                    priority: f.priority,
                    projectId: task ? (task.project?.id ?? null) : (inProject?.id ?? null),
                    dependsOnId: f.dependsOnId === "_none" ? null : f.dependsOnId,
                  },
                },
                { onSuccess: () => (toast.success(task ? "Saved" : "Task added"), onClose()), onError },
              )
            }
          >
            {task ? "Save" : "Add it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Task lists ───────────────────────────────────────────────────────

function TaskLists() {
  const q = useProjectSettings();
  if (q.isPending) return <SkeletonRows rows={4} />;
  if (q.error) return <Alert tone="danger">{errorMessage(q.error)}</Alert>;
  return <TaskListsForm initial={q.data.templates} />;
}

const keyFrom = (name: string, taken: string[]) => {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 34) || "list";
  let key = base;
  for (let i = 2; taken.includes(key); i++) key = `${base}_${i}`;
  return key;
};

function TaskListsForm({ initial }: { initial: ProjectTemplate[] }) {
  const act = useProjectAction();
  const [lists, setLists] = useState(initial);
  const change = (i: number, patch: Partial<ProjectTemplate>) => setLists((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const changeTask = (i: number, k: number, patch: Partial<ProjectTemplate["tasks"][number]>) =>
    change(i, { tasks: lists[i]!.tasks.map((x, j) => (j === k ? { ...x, ...patch } : x)) });
  return (
    <div className="space-y-4">
      <Alert tone="info">
        Start projects from these lists. The joining list becomes each new person&apos;s joining project when they accept their invitation, run by the opening&apos;s
        hiring manager; its tasks for the joiner go to them. Days count from the project&apos;s start (the joining day).
      </Alert>
      {lists.map((l, i) => (
        <Card key={l.key} className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <Field label="List" className="min-w-[220px] flex-1">
              <Input value={l.name} onChange={(e) => change(i, { name: e.target.value })} />
            </Field>
            {l.key === JOINING_TEMPLATE ? (
              <Badge tone="info">Used for each new person</Badge>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => setLists((ls) => ls.filter((_, j) => j !== i))}>
                <Trash2 /> Remove the list
              </Button>
            )}
          </div>
          <ol className="mt-3 space-y-2">
            {l.tasks.map((x, k) => (
              <li key={k} className="grid gap-2 rounded-lg border border-border p-2.5 sm:grid-cols-[2rem_1fr_6rem_9rem_9rem_2.5rem] sm:items-center">
                <span className="text-body tabular text-muted-foreground">{k + 1}.</span>
                <Input aria-label="Task" value={x.title} onChange={(e) => changeTask(i, k, { title: e.target.value })} />
                <Input aria-label="Days after the start" inputMode="numeric" value={String(x.days)} onChange={(e) => changeTask(i, k, { days: Number(e.target.value) || 0 })} />
                <Select
                  aria-label="Who"
                  value={x.to}
                  disabled={l.key !== JOINING_TEMPLATE}
                  onValueChange={(v) => changeTask(i, k, { to: v as "owner" | "joiner" })}
                  options={[
                    { value: "owner", label: l.key === JOINING_TEMPLATE ? "Hiring manager" : "Project's owner" },
                    { value: "joiner", label: "The joiner" },
                  ]}
                />
                <Select
                  aria-label="Waits for"
                  value={x.after ? String(x.after) : "_none"}
                  onValueChange={(v) => changeTask(i, k, { after: v === "_none" ? null : Number(v) })}
                  options={[
                    { value: "_none", label: "Waits for nothing" },
                    ...l.tasks.map((_, j) => ({ value: String(j + 1), label: `Waits for ${j + 1}` })).filter((o) => o.value !== String(k + 1)),
                  ]}
                />
                <Button
                  variant="ghost"
                  size="xs"
                  aria-label="Remove the task"
                  disabled={l.tasks.length === 1}
                  onClick={() =>
                    change(i, {
                      tasks: l.tasks
                        .filter((_, j) => j !== k)
                        .map((t) => ({ ...t, after: t.after === null || t.after === k + 1 ? null : t.after > k + 1 ? t.after - 1 : t.after })),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ol>
          <Button className="mt-2" variant="outline" size="sm" onClick={() => change(i, { tasks: [...l.tasks, { title: "", days: 0, to: "owner", after: null }] })}>
            <Plus /> Add a task
          </Button>
        </Card>
      ))}
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            setLists((ls) => [...ls, { key: keyFrom(`list ${ls.length + 1}`, ls.map((x) => x.key)), name: "New list", tasks: [{ title: "", days: 0, to: "owner", after: null }] }])
          }
        >
          <Plus /> New list
        </Button>
        <Button
          variant="accent"
          disabled={act.isPending}
          onClick={() => act.mutate({ step: "settings", body: { templates: lists } }, { onSuccess: () => toast.success("Task lists saved"), onError })}
        >
          Save the lists
        </Button>
      </div>
    </div>
  );
}
