import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantTx } from "@gm/db";
import {
  allows,
  DEFAULT_PROJECT_TEMPLATES,
  JOINING_TEMPLATE,
  OWNER_ROLE,
  type ProjectDetail,
  type ProjectInput,
  projectInput,
  type ProjectPerson,
  type ProjectRow,
  type ProjectSettingsInput,
  projectSettingsInput,
  type ProjectStatus,
  type ProjectTemplate,
  projectTemplate,
  type TaskInput,
  taskInput,
  type TaskPriority,
  type TaskRow,
  type TaskSource,
  type TaskStatus,
} from "@gm/shared";
import { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const IST = 330 * 60_000;
const today = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const dayDate = (d: string) => new Date(`${d}T00:00:00Z`);
const addDays = (d: string, n: number) => iso(new Date(dayDate(d).getTime() + n * 86_400_000));

const WITH = {
  project: { select: { id: true, name: true, ownerId: true } },
  dependsOn: { select: { id: true, title: true, status: true } },
} satisfies Prisma.TaskInclude;
type TaskWith = Prisma.TaskGetPayload<{ include: typeof WITH }>;

/** The agency's task lists, read defensively: anything unreadable falls back to the starting lists. */
function templatesOf(json: Prisma.JsonValue | undefined): ProjectTemplate[] {
  const parsed = z.array(projectTemplate).safeParse(json);
  return parsed.success ? parsed.data : DEFAULT_PROJECT_TEMPLATES;
}

/** A project's tasks from a task list: due counted from its start, each waiting for the one the list says. */
async function fromTemplate(
  tx: TenantTx,
  agencyId: string,
  projectId: string,
  t: ProjectTemplate,
  o: { owner: string; joiner: string | null; start: string; source: TaskSource; createdBy: string | null },
) {
  const ids: string[] = [];
  for (const [i, x] of t.tasks.entries()) {
    const created = await tx.task.create({
      data: {
        agencyId,
        projectId,
        title: x.title,
        ownerId: x.to === "joiner" && o.joiner ? o.joiner : o.owner,
        dueOn: dayDate(addDays(o.start, x.days)),
        source: o.source,
        position: i,
        createdBy: o.createdBy,
      },
    });
    ids.push(created.id);
  }
  for (const [i, x] of t.tasks.entries())
    if (x.after && ids[x.after - 1]) await tx.task.update({ where: { id: ids[i]! }, data: { dependsOnId: ids[x.after - 1]! } });
}

/**
 * Projects and tasks (P5-21). Everyone sees and moves their own tasks and sees the projects they take part in, and
 * keeps tasks for themselves; those who may edit projects start projects, give tasks to others and keep the task
 * lists, and a project's owner runs its tasks. A task waits for the one before it; a commitment carried forward as a
 * task is done when the task is, and the other way round. Each new person gets a joining project from the joining list.
 */
@Injectable()
export class ProjectsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
  ) {}

  private me() {
    return this.tenant.userId ?? "";
  }

  private may(level: "view" | "edit") {
    return allows(this.tenant.permissions, "projects", level);
  }

  // ─── Task lists ─────────────────────────────────────────────────────

  async settings(): Promise<{ templates: ProjectTemplate[] }> {
    const row = await this.tenant.db.projectSettings.findUnique({ where: { agencyId: this.tenant.agencyId } });
    return { templates: templatesOf(row?.templates) };
  }

  async saveSettings(input: ProjectSettingsInput) {
    const s = projectSettingsInput.parse(input);
    const data = { templates: s.templates as unknown as Prisma.InputJsonValue };
    await this.tenant.tx(async (tx) => {
      await tx.projectSettings.upsert({ where: { agencyId: this.tenant.agencyId }, create: { agencyId: this.tenant.agencyId, ...data }, update: data });
      await this.audit.record(tx, { action: "update", entity: "project_settings", after: { lists: s.templates.map((t) => t.name) } });
    });
    return this.settings();
  }

  /** The joining project for a person who has just accepted their invitation (P5-10's hire), from the joining list. */
  static async joining(tx: TenantTx, agencyId: string, p: { joinerId: string; ownerId: string | null; startOn: string | null; createdBy: string | null }) {
    const t = templatesOf((await tx.projectSettings.findUnique({ where: { agencyId } }))?.templates).find((x) => x.key === JOINING_TEMPLATE);
    if (!t) return;
    if (await tx.project.findFirst({ where: { joinerId: p.joinerId, templateKey: JOINING_TEMPLATE } })) return;
    const owner = p.ownerId ?? (await tx.membership.findFirst({ where: { agencyId, role: OWNER_ROLE }, select: { userId: true } }))?.userId;
    if (!owner) return;
    const joiner = await tx.user.findUnique({ where: { id: p.joinerId }, select: { name: true } });
    const start = p.startOn ?? today();
    const project = await tx.project.create({
      data: {
        agencyId,
        name: `Joining: ${joiner?.name ?? "new team member"}`,
        ownerId: owner,
        joinerId: p.joinerId,
        startOn: dayDate(start),
        templateKey: JOINING_TEMPLATE,
        createdBy: p.createdBy,
      },
    });
    await fromTemplate(tx, agencyId, project.id, t, { owner, joiner: p.joinerId, start, source: "joining", createdBy: p.createdBy });
  }

  /** The team, to give tasks and projects to (client people are not offered). */
  async people(): Promise<ProjectPerson[]> {
    const [members, clientRoles] = await Promise.all([
      this.tenant.db.membership.findMany({ where: { agencyId: this.tenant.agencyId }, select: { role: true, user: { select: { id: true, name: true } } } }),
      this.tenant.db.role.findMany({ where: { isClient: true }, select: { key: true } }),
    ]);
    const clients = new Set(clientRoles.map((r) => r.key));
    return members
      .filter((m) => !clients.has(m.role))
      .map((m) => ({ id: m.user.id, name: m.user.name }))
      .sort((a, b) => (a.name ?? "").localeCompare(b.name ?? ""));
  }

  // ─── Reading ────────────────────────────────────────────────────────

  private async names(ids: (string | null | undefined)[]) {
    const wanted = [...new Set(ids.filter((x): x is string => !!x))];
    const users = wanted.length ? await this.tenant.db.user.findMany({ where: { id: { in: wanted } }, select: { id: true, name: true } }) : [];
    return new Map(users.map((u) => [u.id, u.name]));
  }

  private person(names: Map<string, string | null>, id: string): ProjectPerson;
  private person(names: Map<string, string | null>, id: string | null): ProjectPerson | null;
  private person(names: Map<string, string | null>, id: string | null) {
    return id ? { id, name: names.get(id) ?? null } : null;
  }

  private taskRow(t: TaskWith, names: Map<string, string | null>, now: string): TaskRow {
    const status = t.status as TaskStatus;
    const blocked = status !== "done" && !!t.dependsOn && t.dependsOn.status !== "done";
    return {
      id: t.id,
      title: t.title,
      notes: t.notes,
      project: t.project ? { id: t.project.id, name: t.project.name } : null,
      owner: this.person(names, t.ownerId),
      createdBy: this.person(names, t.createdBy),
      dueOn: t.dueOn ? iso(t.dueOn) : null,
      priority: t.priority as TaskPriority,
      status,
      overdue: status !== "done" && !!t.dueOn && iso(t.dueOn) < now,
      waitsFor: t.dependsOn ? { id: t.dependsOn.id, title: t.dependsOn.title, done: t.dependsOn.status === "done" } : null,
      blocked,
      source: t.source as TaskSource,
      commitmentId: t.commitmentId,
      completedAt: t.completedAt?.toISOString() ?? null,
      completedBy: this.person(names, t.completedBy),
      createdAt: t.createdAt.toISOString(),
    };
  }

  private async taskRows(rows: TaskWith[]) {
    const names = await this.names(rows.flatMap((t) => [t.ownerId, t.createdBy, t.completedBy]));
    const now = today();
    return rows.map((t) => this.taskRow(t, names, now));
  }

  private order(rows: TaskRow[]) {
    const rank = { in_progress: 0, todo: 1, done: 2 } as const;
    return rows.sort(
      (a, b) =>
        rank[a.status] - rank[b.status] ||
        (a.status === "done" ? (b.completedAt ?? "").localeCompare(a.completedAt ?? "") : (a.dueOn ?? "9999").localeCompare(b.dueOn ?? "9999")) ||
        a.createdAt.localeCompare(b.createdAt),
    );
  }

  /** Mine (open, and done in the last fortnight), or — for those who may see every project — everyone's open tasks. */
  async tasks(filter: { scope: "mine" | "all"; ownerId?: string }): Promise<TaskRow[]> {
    if (filter.scope === "all" && !this.may("view")) throw new ForbiddenException("Only those who may see every project see everyone's tasks.");
    const fortnight = new Date(Date.now() - 14 * 86_400_000);
    const where: Prisma.TaskWhereInput =
      filter.scope === "mine"
        ? { ownerId: this.me(), OR: [{ status: { not: "done" } }, { completedAt: { gte: fortnight } }] }
        : { status: { not: "done" }, ...(filter.ownerId && { ownerId: filter.ownerId }) };
    const rows = await this.tenant.db.task.findMany({ where, include: WITH, take: 1000 });
    return this.order(await this.taskRows(rows));
  }

  private visible(): Prisma.ProjectWhereInput {
    const me = this.me();
    return this.may("view") ? {} : { OR: [{ ownerId: me }, { joinerId: me }, { tasks: { some: { ownerId: me } } }] };
  }

  async projects(): Promise<ProjectRow[]> {
    const rows = await this.tenant.db.project.findMany({
      where: this.visible(),
      include: { client: { select: { id: true, name: true } }, tasks: { select: { status: true, dueOn: true, dependsOn: { select: { status: true } } } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });
    const names = await this.names(rows.flatMap((p) => [p.ownerId, p.joinerId]));
    const now = today();
    const rank: Record<string, number> = { active: 0, on_hold: 1, done: 2, cancelled: 3 };
    return rows.map((p) => this.projectRow(p, p.tasks, names, now)).sort((a, b) => rank[a.status]! - rank[b.status]! || b.createdAt.localeCompare(a.createdAt));
  }

  private projectRow(
    p: Prisma.ProjectGetPayload<{ include: { client: { select: { id: true; name: true } } } }>,
    tasks: { status: string; dueOn: Date | null; dependsOn: { status: string } | null }[],
    names: Map<string, string | null>,
    now: string,
  ): ProjectRow {
    const open = tasks.filter((t) => t.status !== "done");
    return {
      id: p.id,
      name: p.name,
      client: p.client,
      owner: this.person(names, p.ownerId),
      joiner: this.person(names, p.joinerId),
      description: p.description,
      startOn: p.startOn ? iso(p.startOn) : null,
      dueOn: p.dueOn ? iso(p.dueOn) : null,
      status: p.status as ProjectStatus,
      progress: {
        total: tasks.length,
        done: tasks.length - open.length,
        overdue: open.filter((t) => t.dueOn && iso(t.dueOn) < now).length,
        blocked: open.filter((t) => t.dependsOn && t.dependsOn.status !== "done").length,
      },
      createdAt: p.createdAt.toISOString(),
    };
  }

  async project(id: string): Promise<ProjectDetail> {
    const p = await this.tenant.db.project.findFirst({
      where: { id, ...this.visible() },
      include: { client: { select: { id: true, name: true } }, tasks: { include: WITH, orderBy: [{ position: "asc" }, { createdAt: "asc" }] } },
    });
    if (!p) throw new NotFoundException("No project of yours with that id.");
    const names = await this.names([p.ownerId, p.joinerId, ...p.tasks.flatMap((t) => [t.ownerId, t.createdBy, t.completedBy])]);
    const now = today();
    return { ...this.projectRow(p, p.tasks, names, now), tasks: p.tasks.map((t) => this.taskRow(t, names, now)) };
  }

  // ─── Projects ───────────────────────────────────────────────────────

  private async assertMember(userId: string, path = "ownerId") {
    if (!(await this.tenant.db.membership.count({ where: { agencyId: this.tenant.agencyId, userId } })))
      throw new BadRequestException({ message: "Choose someone in your team.", issues: [{ path, message: "Choose the person" }] });
  }

  private async assertClient(clientId: string | null) {
    if (clientId && !(await this.tenant.db.client.count({ where: { id: clientId } })))
      throw new BadRequestException({ message: "Choose one of your clients.", issues: [{ path: "clientId", message: "Choose the client" }] });
  }

  async createProject(input: ProjectInput) {
    const p = projectInput.parse(input);
    await this.assertMember(p.ownerId);
    await this.assertClient(p.clientId);
    const template = p.templateKey ? (await this.settings()).templates.find((t) => t.key === p.templateKey) : null;
    if (p.templateKey && !template)
      throw new BadRequestException({ message: "Choose one of your task lists.", issues: [{ path: "templateKey", message: "Choose the list" }] });
    const me = this.me() || null;
    const created = await this.tenant.tx(async (tx) => {
      const row = await tx.project.create({
        data: {
          agencyId: this.tenant.agencyId,
          name: p.name,
          clientId: p.clientId,
          ownerId: p.ownerId,
          description: p.description,
          startOn: p.startOn ? dayDate(p.startOn) : null,
          dueOn: p.dueOn ? dayDate(p.dueOn) : null,
          status: p.status,
          templateKey: template?.key ?? null,
          createdBy: me,
        },
      });
      if (template)
        await fromTemplate(tx, this.tenant.agencyId, row.id, template, {
          owner: p.ownerId,
          joiner: null,
          start: p.startOn ?? today(),
          source: "template",
          createdBy: me,
        });
      await this.audit.record(tx, { action: "create", entity: "project", entityId: row.id, after: { name: p.name, list: template?.name ?? null } });
      await this.notifications.notify(
        tx,
        { users: [p.ownerId] },
        {
          kind: "task_assigned",
          title: `${p.name} is yours to run`,
          body: template ? `${template.tasks.length} tasks from "${template.name}"` : undefined,
          link: `/app/projects?project=${row.id}`,
        },
      );
      return row;
    });
    return this.project(created.id);
  }

  /** Someone who may edit projects, or the project's owner. */
  private async runs(projectId: string) {
    const p = await this.tenant.db.project.findFirst({ where: { id: projectId } });
    if (!p) throw new NotFoundException("No project with that id.");
    if (!this.may("edit") && p.ownerId !== this.me()) throw new ForbiddenException("Only the project's owner, or someone who may edit projects, changes it.");
    return p;
  }

  async updateProject(id: string, input: ProjectInput) {
    const p = projectInput.parse(input);
    const before = await this.runs(id);
    await this.assertMember(p.ownerId);
    await this.assertClient(p.clientId);
    await this.tenant.tx(async (tx) => {
      await tx.project.update({
        where: { id },
        data: {
          name: p.name,
          clientId: p.clientId,
          ownerId: p.ownerId,
          description: p.description,
          startOn: p.startOn ? dayDate(p.startOn) : null,
          dueOn: p.dueOn ? dayDate(p.dueOn) : null,
          status: p.status,
        },
      });
      await this.audit.record(tx, {
        action: "update",
        entity: "project",
        entityId: id,
        before: { name: before.name, status: before.status },
        after: { name: p.name, status: p.status },
      });
      if (p.ownerId !== before.ownerId)
        await this.notifications.notify(
          tx,
          { users: [p.ownerId] },
          { kind: "task_assigned", title: `${p.name} is yours to run`, link: `/app/projects?project=${id}` },
        );
    });
    return this.project(id);
  }

  // ─── Tasks ──────────────────────────────────────────────────────────

  private async one(id: string) {
    const t = await this.tenant.db.task.findFirst({ where: { id }, include: WITH });
    if (!t) throw new NotFoundException("No task with that id.");
    return t;
  }

  private async row(id: string) {
    return (await this.taskRows([await this.one(id)]))[0]!;
  }

  /** Changing a task: someone who may edit projects, the project's owner, or whoever wrote it. */
  private mayChange(t: { createdBy: string | null; project: { ownerId: string } | null }) {
    const me = this.me();
    return this.may("edit") || t.project?.ownerId === me || t.createdBy === me;
  }

  private async assertDependency(projectId: string | null, dependsOnId: string | null, self?: string) {
    if (!dependsOnId) return;
    if (!projectId)
      throw new BadRequestException({ message: "Only a task in a project can wait for another.", issues: [{ path: "dependsOnId", message: "Not here" }] });
    // Walk the chain: it must stay in the project and never come back to this task.
    let at: string | null = dependsOnId;
    for (let steps = 0; at && steps < 200; steps++) {
      if (at === self)
        throw new BadRequestException({
          message: "That would make the tasks wait for each other.",
          issues: [{ path: "dependsOnId", message: "Pick another task" }],
        });
      const d: { projectId: string | null; dependsOnId: string | null } | null = await this.tenant.db.task.findFirst({
        where: { id: at },
        select: { projectId: true, dependsOnId: true },
      });
      if (!d || d.projectId !== projectId)
        throw new BadRequestException({ message: "Pick a task in the same project.", issues: [{ path: "dependsOnId", message: "Pick another task" }] });
      at = d.dependsOnId;
    }
  }

  async createTask(input: TaskInput) {
    const t = taskInput.parse(input);
    const me = this.me();
    if (t.projectId) await this.runs(t.projectId);
    else if (t.ownerId !== me && !this.may("edit")) throw new ForbiddenException("Tasks on their own are for yourself; give tasks to others in a project.");
    await this.assertMember(t.ownerId);
    await this.assertDependency(t.projectId, t.dependsOnId);
    const created = await this.tenant.tx(async (tx) => {
      const position = t.projectId ? await tx.task.count({ where: { projectId: t.projectId } }) : 0;
      const row = await tx.task.create({
        data: {
          agencyId: this.tenant.agencyId,
          projectId: t.projectId,
          title: t.title,
          notes: t.notes,
          ownerId: t.ownerId,
          dueOn: t.dueOn ? dayDate(t.dueOn) : null,
          priority: t.priority,
          dependsOnId: t.dependsOnId,
          position,
          createdBy: me || null,
        },
      });
      await this.notifications.notify(
        tx,
        { users: [t.ownerId] },
        { kind: "task_assigned", title: t.title, body: t.dueOn ? `Due ${t.dueOn}` : undefined, link: `/app/projects?task=${row.id}` },
      );
      return row;
    });
    return this.row(created.id);
  }

  async updateTask(id: string, input: TaskInput) {
    const t = taskInput.parse(input);
    const before = await this.one(id);
    if (!this.mayChange(before)) throw new ForbiddenException("Only the project's owner, whoever wrote the task, or someone who may edit projects changes it.");
    if (t.ownerId !== before.ownerId) {
      await this.assertMember(t.ownerId);
      if (!before.projectId && t.ownerId !== this.me() && !this.may("edit")) throw new ForbiddenException("Give tasks to others in a project.");
    }
    await this.assertDependency(before.projectId, t.dependsOnId, id);
    await this.tenant.tx(async (tx) => {
      await tx.task.update({
        where: { id },
        data: {
          title: t.title,
          notes: t.notes,
          ownerId: t.ownerId,
          dueOn: t.dueOn ? dayDate(t.dueOn) : null,
          priority: t.priority,
          dependsOnId: t.dependsOnId,
        },
      });
      if (t.ownerId !== before.ownerId)
        await this.notifications.notify(tx, { users: [t.ownerId] }, { kind: "task_assigned", title: t.title, link: `/app/projects?task=${id}` });
    });
    return this.row(id);
  }

  async setStatus(id: string, status: TaskStatus) {
    const t = await this.one(id);
    if (t.ownerId !== this.me() && !this.mayChange(t))
      throw new ForbiddenException("Only the person it is for, the project's owner or someone who may edit projects moves it.");
    if (status !== "todo" && t.dependsOn && t.dependsOn.status !== "done") throw new ConflictException(`It waits for "${t.dependsOn.title}" to be done.`);
    if (status === t.status) return this.row(id);
    await this.tenant.tx(async (tx) => {
      await tx.task.update({
        where: { id },
        data: status === "done" ? { status, completedAt: new Date(), completedBy: this.me() || null } : { status, completedAt: null, completedBy: null },
      });
      if (status !== "done") return;
      // A commitment carried forward as this task is done with it.
      if (t.commitmentId) {
        const c = await tx.commitment.findFirst({ where: { id: t.commitmentId, status: "open" } });
        if (c)
          await tx.commitment.update({
            where: { id: c.id },
            data: {
              status: "done",
              mark: "BT",
              doneAt: new Date(),
              history: [
                ...(c.history as unknown[]),
                { mark: "BT", note: "Done as a task", at: new Date().toISOString(), meetingId: null, meeting: null },
              ] as Prisma.InputJsonValue,
            },
          });
      }
      // Whoever waits for it can start.
      const waiting = await tx.task.findMany({ where: { dependsOnId: id, status: { not: "done" } }, select: { id: true, title: true, ownerId: true } });
      for (const w of waiting)
        await this.notifications.notify(
          tx,
          { users: [w.ownerId] },
          { kind: "task_assigned", title: `Ready to start: ${w.title}`, body: `"${t.title}" is done`, link: `/app/projects?task=${w.id}` },
        );
    });
    return this.row(id);
  }

  async removeTask(id: string) {
    const t = await this.one(id);
    if (!this.mayChange(t)) throw new ForbiddenException("Only the project's owner, whoever wrote the task, or someone who may edit projects removes it.");
    await this.tenant.db.task.delete({ where: { id } });
    return { removed: true };
  }

  /** A commitment carried forward as a task: by its owner, or by someone who may edit reviews. */
  async fromCommitment(commitmentId: string) {
    const c = await this.tenant.db.commitment.findFirst({ where: { id: commitmentId }, include: { tasks: { select: { id: true }, take: 1 } } });
    if (!c) throw new NotFoundException("No commitment with that id.");
    const me = this.me();
    if (c.ownerId !== me && !allows(this.tenant.permissions, "reports", "edit"))
      throw new ForbiddenException("Only its owner, or someone who keeps the reviews, makes it a task.");
    if (c.tasks.length) throw new ConflictException("It is already a task.");
    if (c.status === "done") throw new ConflictException("It is done.");
    const owner = c.ownerId ?? me;
    const created = await this.tenant.tx(async (tx) => {
      const row = await tx.task.create({
        data: {
          agencyId: this.tenant.agencyId,
          title: c.text.slice(0, 200),
          ownerId: owner,
          dueOn: c.due,
          source: "commitment",
          commitmentId: c.id,
          createdBy: me || null,
        },
      });
      await this.notifications.notify(
        tx,
        { users: [owner] },
        { kind: "task_assigned", title: row.title, body: "A commitment carried forward as a task", link: `/app/projects?task=${row.id}` },
      );
      return row;
    });
    return this.row(created.id);
  }
}
