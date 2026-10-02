import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { allows, type LearningAssignmentRow, type LearningPathInput, type LearningPathRow, learningPathInput, OWNER_ROLE, type SkillMatrix } from "@gm/shared";
import { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { PerformanceService } from "./performance.service.js";

type Module = { key: string; title: string; hours: number; link: string };
export const skillsInput = z.object({
  skills: z
    .array(z.object({ id: z.uuid().optional(), name: z.string().trim().min(1, "Name the skill").max(80), group: z.string().trim().max(80).default("") }))
    .max(100)
    .refine((s) => new Set(s.map((x) => x.name.toLowerCase())).size === s.length, "Each skill needs its own name"),
});

/**
 * Learning (P5-11): the agency's learning paths, given to people by HR or their reviewer, each module marked done by
 * the person; and the skill matrix, each person's level on each skill as their reviewer sees it.
 */
@Injectable()
export class LearningService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly performance: PerformanceService,
  ) {}

  private hr(level: "view" | "edit" = "view") {
    return allows(this.tenant.permissions, "hr", level);
  }

  private async names() {
    const members = await this.tenant.db.membership.findMany({
      where: { agencyId: this.tenant.agencyId },
      select: { user: { select: { id: true, name: true } } },
    });
    return new Map(members.map((m) => [m.user.id, m.user.name]));
  }

  /** HR, or the person's reviewer — never for yourself, the owner excepted. */
  private async assertLooksAfter(userId: string) {
    if (userId === this.tenant.userId && this.tenant.role !== OWNER_ROLE) throw new ForbiddenException("Someone else does this for you.");
    if (this.hr("edit")) return;
    const r = await this.performance.reviewees();
    if (r === "all" || !r.has(userId)) throw new ForbiddenException("Only HR or their manager does this.");
  }

  // ─── Paths ──────────────────────────────────────────────────────────

  async paths(): Promise<LearningPathRow[]> {
    const [rows, names] = await Promise.all([
      this.tenant.db.learningPath.findMany({ include: { assignments: { select: { completedAt: true } } }, orderBy: { title: "asc" } }),
      this.names(),
    ]);
    return rows.map((p) => {
      const modules = p.modules as Module[];
      return {
        id: p.id,
        title: p.title,
        forRole: p.forRole,
        description: p.description,
        owner: p.ownerId ? { id: p.ownerId, name: names.get(p.ownerId) ?? "" } : null,
        modules,
        hours: modules.reduce((s, m) => s + m.hours, 0),
        assigned: p.assignments.length,
        completed: p.assignments.filter((a) => a.completedAt).length,
      };
    });
  }

  async savePath(id: string | null, input: LearningPathInput) {
    const p = learningPathInput.parse(input);
    if (new Set(p.modules.map((m) => m.key)).size !== p.modules.length) throw new BadRequestException("Each module needs its own key.");
    const data = { title: p.title, forRole: p.forRole, description: p.description, ownerId: p.ownerId, modules: p.modules };
    const row = await this.tenant.tx(async (tx) => {
      const saved = id
        ? await tx.learningPath.update({ where: { id }, data })
        : await tx.learningPath.create({ data: { agencyId: this.tenant.agencyId, ...data } });
      await this.audit.record(tx, {
        action: id ? "update" : "create",
        entity: "learning_path",
        entityId: saved.id,
        after: { title: p.title, modules: p.modules.length },
      });
      return saved;
    });
    return (await this.paths()).find((x) => x.id === row.id)!;
  }

  async removePath(id: string) {
    const p = await this.tenant.db.learningPath.findFirst({ where: { id } });
    if (!p) throw new NotFoundException("No learning path with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.learningPath.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "learning_path", entityId: id, before: { title: p.title } });
    });
    return { removed: true };
  }

  // ─── Assignments ────────────────────────────────────────────────────

  async assign(pathId: string, userIds: string[]) {
    const path = await this.tenant.db.learningPath.findFirst({ where: { id: pathId } });
    if (!path) throw new NotFoundException("No learning path with that id.");
    const names = await this.names();
    for (const u of userIds) {
      if (!names.has(u)) throw new BadRequestException("Choose people in your team.");
      await this.assertLooksAfter(u);
    }
    const existing = await this.tenant.db.learningAssignment.findMany({ where: { pathId, userId: { in: userIds } }, select: { userId: true } });
    const fresh = userIds.filter((u) => !existing.some((e) => e.userId === u));
    if (!fresh.length) throw new ConflictException("They already have this path.");
    await this.tenant.tx(async (tx) => {
      await tx.learningAssignment.createMany({
        data: fresh.map((userId) => ({ agencyId: this.tenant.agencyId, pathId, userId, done: [], assignedBy: this.tenant.userId ?? null })),
      });
      await this.audit.record(tx, {
        action: "create",
        entity: "learning_assignment",
        entityId: pathId,
        after: { path: path.title, people: fresh.map((u) => names.get(u)) },
      });
      await this.notifications.notify(
        tx,
        { users: fresh },
        { kind: "learning_assigned", title: `Learning path: ${path.title}`, body: path.description || undefined, link: "/app/learning" },
      );
    });
    return this.assignments();
  }

  /** The signed-in person's paths, and those of the people they look after (everyone's for HR). */
  async assignments(): Promise<LearningAssignmentRow[]> {
    const r = await this.performance.reviewees();
    const me = this.tenant.userId ?? "";
    const rows = await this.tenant.db.learningAssignment.findMany({
      where: r === "all" ? {} : { userId: { in: [me, ...r] } },
      include: { path: { select: { id: true, title: true, modules: true } } },
      orderBy: { assignedAt: "desc" },
    });
    const names = await this.names();
    return rows
      .filter((a) => names.has(a.userId))
      .map((a) => {
        const modules = a.path.modules as Module[];
        const done = a.done.filter((k) => modules.some((m) => m.key === k));
        return {
          id: a.id,
          user: { id: a.userId, name: names.get(a.userId)! },
          path: { id: a.path.id, title: a.path.title },
          done,
          progress: modules.length ? Math.round((done.length / modules.length) * 100) : 0,
          assignedAt: a.assignedAt.toISOString(),
          completedAt: a.completedAt?.toISOString() ?? null,
        };
      });
  }

  /** The person marks a module of their own path done (or not). */
  async mark(assignmentId: string, key: string, done: boolean) {
    const a = await this.tenant.db.learningAssignment.findFirst({ where: { id: assignmentId }, include: { path: { select: { modules: true, title: true } } } });
    if (!a || (a.userId !== this.tenant.userId && !this.hr("edit"))) throw new NotFoundException("No learning path of yours with that id.");
    const modules = a.path.modules as Module[];
    if (!modules.some((m) => m.key === key)) throw new BadRequestException("That is not one of the path's modules.");
    const next = done ? [...new Set([...a.done, key])] : a.done.filter((k) => k !== key);
    const complete = modules.every((m) => next.includes(m.key));
    await this.tenant.tx(async (tx) => {
      await tx.learningAssignment.update({ where: { id: a.id }, data: { done: next, completedAt: complete ? (a.completedAt ?? new Date()) : null } });
      if (complete && !a.completedAt)
        await this.audit.record(tx, { action: "update", entity: "learning_assignment", entityId: a.id, after: { path: a.path.title, completed: true } });
    });
    return (await this.assignments()).find((x) => x.id === a.id)!;
  }

  // ─── Skill matrix ───────────────────────────────────────────────────

  async matrix(): Promise<SkillMatrix> {
    const r = await this.performance.reviewees();
    const me = this.tenant.userId ?? "";
    const [skills, levels, names] = await Promise.all([
      this.tenant.db.skill.findMany({ orderBy: [{ position: "asc" }, { name: "asc" }] }),
      this.tenant.db.skillLevel.findMany(),
      this.names(),
    ]);
    const visible = [...names.keys()].filter((u) => r === "all" || u === me || r.has(u));
    return {
      skills: skills.map((s) => ({ id: s.id, name: s.name, group: s.group })),
      people: visible
        .map((u) => ({ id: u, name: names.get(u)!, levels: Object.fromEntries(levels.filter((l) => l.userId === u).map((l) => [l.skillId, l.level])) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  /** HR keeps the list of skills; renaming keeps the levels, removing a skill removes its levels. */
  async saveSkills(input: z.input<typeof skillsInput>) {
    const { skills } = skillsInput.parse(input);
    const current = await this.tenant.db.skill.findMany();
    await this.tenant.tx(async (tx) => {
      const keep = skills.filter((s) => s.id).map((s) => s.id!);
      await tx.skill.deleteMany({ where: { id: { in: current.filter((c) => !keep.includes(c.id)).map((c) => c.id) } } });
      // Renames first go through a placeholder name, so swapping two names does not clash.
      for (const s of skills.filter((x) => x.id)) await tx.skill.update({ where: { id: s.id }, data: { name: `~${s.id}` } });
      for (const [i, s] of skills.entries())
        if (s.id) await tx.skill.update({ where: { id: s.id }, data: { name: s.name, group: s.group, position: i } });
        else await tx.skill.create({ data: { agencyId: this.tenant.agencyId, name: s.name, group: s.group, position: i } });
      await this.audit.record(tx, { action: "update", entity: "skills", after: { skills: skills.map((s) => s.name) } });
    });
    return this.matrix();
  }

  async setLevel(userId: string, skillId: string, level: number) {
    await this.assertLooksAfter(userId);
    const skill = await this.tenant.db.skill.findFirst({ where: { id: skillId } });
    if (!skill) throw new NotFoundException("No skill with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.skillLevel.upsert({
        where: { skillId_userId: { skillId, userId } },
        create: { agencyId: this.tenant.agencyId, skillId, userId, level, ratedBy: this.tenant.userId ?? null },
        update: { level, ratedBy: this.tenant.userId ?? null },
      });
      await this.audit.record(tx, { action: "update", entity: "skill_level", entityId: userId, after: { skill: skill.name, level } });
    });
    return this.matrix();
  }
}
