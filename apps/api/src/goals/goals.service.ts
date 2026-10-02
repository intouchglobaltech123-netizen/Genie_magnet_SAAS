import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import {
  allows,
  cascade,
  type CascadeInputs,
  cascadeInputs,
  type CascadeView,
  type CheckInInput,
  checkInInput,
  DEFAULT_GOAL_SETTINGS,
  expectedProgress,
  type GoalInput,
  type GoalMetric,
  type GoalRow,
  type GoalSettings,
  goalInput,
  goalProgress,
  goalSettingsInput,
  goalStatus,
} from "@gm/shared";
import { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { GoalMetrics } from "./goal-metrics.js";

const IST = 330 * 60_000;
const todayIST = () => new Date(Date.now() + IST).toISOString().slice(0, 10);
const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
type Row = Prisma.GoalGetPayload<{ include: { checkIns: true } }>;

/** Which cascade figure becomes which goal's target. */
export const cascadeApply = z.object({
  links: z
    .array(z.object({ goalId: z.uuid(), figure: z.enum(["newNeeded", "deals", "proposals", "leads", "requiredVideos", "hires"]) }))
    .min(1, "Choose at least one goal")
    .max(20),
});

/**
 * Goals (P5-13): the company's, each department's serving them, each person's serving those — with what the app knows
 * filled in, check-ins, and the revenue cascade worked from the agency's own year. Those who may see goals see them
 * all; everyone sees their own and what they serve; owners check in on their own.
 */
@Injectable()
export class GoalsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly metrics: GoalMetrics,
  ) {}

  private may(level: "view" | "edit") {
    return allows(this.tenant.permissions, "reports", level);
  }

  async settings(): Promise<GoalSettings> {
    const s = await this.tenant.db.goalSettings.findUnique({ where: { agencyId: this.tenant.agencyId } });
    return s ? goalSettingsInput.parse(s.rule) : DEFAULT_GOAL_SETTINGS;
  }

  async updateSettings(input: z.input<typeof goalSettingsInput>) {
    const rule = goalSettingsInput.parse(input);
    if (rule.atRisk > rule.onTrack)
      throw new BadRequestException({ message: "At risk starts below on track.", issues: [{ path: "atRisk", message: "Below on track" }] });
    await this.tenant.tx(async (tx) => {
      await tx.goalSettings.upsert({ where: { agencyId: this.tenant.agencyId }, create: { agencyId: this.tenant.agencyId, rule }, update: { rule } });
      await this.audit.record(tx, { action: "update", entity: "goal_settings", after: rule });
    });
    return this.settings();
  }

  // ─── The tree ───────────────────────────────────────────────────────

  async list(): Promise<GoalRow[]> {
    const rows = await this.tenant.db.goal.findMany({
      include: { checkIns: { orderBy: { createdAt: "desc" }, take: 30 } },
      orderBy: [{ level: "asc" }, { createdAt: "asc" }],
    });
    let visible = rows;
    if (!this.may("view")) {
      // Their own goals, and what each serves up to the company's.
      const me = this.tenant.userId ?? "";
      const keep = new Set<string>();
      const byId = new Map(rows.map((r) => [r.id, r]));
      for (const r of rows.filter((x) => x.ownerIds.includes(me)))
        for (let g: Row | undefined = r; g && !keep.has(g.id); g = g.parentId ? byId.get(g.parentId) : undefined) keep.add(g.id);
      visible = rows.filter((r) => keep.has(r.id));
    }
    return this.present(visible);
  }

  async get(id: string) {
    const g = (await this.list()).find((x) => x.id === id);
    if (!g) throw new NotFoundException("No goal with that id.");
    return g;
  }

  private async check(g: z.output<typeof goalInput>, id: string | null) {
    if (g.parentId) {
      if (g.parentId === id)
        throw new BadRequestException({ message: "A goal cannot serve itself.", issues: [{ path: "parentId", message: "Choose another goal" }] });
      const parent = await this.tenant.db.goal.findFirst({ where: { id: g.parentId }, select: { level: true } });
      if (!parent)
        throw new BadRequestException({ message: "Choose one of your goals.", issues: [{ path: "parentId", message: "Choose the goal it serves" }] });
      const order = ["company", "department", "person"];
      if (order.indexOf(parent.level) > order.indexOf(g.level))
        throw new BadRequestException({
          message: `A ${g.level} goal serves a company or department goal.`,
          issues: [{ path: "parentId", message: "Choose a goal above it" }],
        });
    }
    if (g.departmentId && !(await this.tenant.db.department.findFirst({ where: { id: g.departmentId }, select: { id: true } })))
      throw new BadRequestException({ message: "Choose one of your departments.", issues: [{ path: "departmentId", message: "Choose the department" }] });
    if (g.ownerIds.length) {
      const n = await this.tenant.db.membership.count({ where: { agencyId: this.tenant.agencyId, userId: { in: g.ownerIds } } });
      if (n !== new Set(g.ownerIds).size)
        throw new BadRequestException({ message: "Choose owners in your team.", issues: [{ path: "ownerIds", message: "Choose people in your team" }] });
    }
  }

  private data(g: z.output<typeof goalInput>) {
    return {
      parentId: g.parentId,
      level: g.level,
      title: g.title,
      departmentId: g.departmentId,
      type: g.type,
      ownerIds: [...new Set(g.ownerIds)],
      measure: g.measure,
      unit: g.unit,
      baseline: g.baseline,
      target: g.target,
      actual: g.actual,
      metric: g.metric,
      startDate: utc(g.startDate),
      dueDate: utc(g.dueDate),
      cadence: g.cadence,
      smart: g.smart,
    };
  }

  async create(input: GoalInput) {
    const g = goalInput.parse(input);
    await this.check(g, null);
    const row = await this.tenant.tx(async (tx) => {
      const created = await tx.goal.create({ data: { agencyId: this.tenant.agencyId, ...this.data(g), createdBy: this.tenant.userId ?? null } });
      await this.audit.record(tx, { action: "create", entity: "goal", entityId: created.id, after: { title: g.title, level: g.level, target: g.target } });
      return created;
    });
    return this.get(row.id);
  }

  async update(id: string, input: GoalInput) {
    const g = goalInput.parse(input);
    const before = await this.tenant.db.goal.findFirst({ where: { id } });
    if (!before) throw new NotFoundException("No goal with that id.");
    await this.check(g, id);
    // Never under one of its own goals.
    for (let p = g.parentId; p; p = (await this.tenant.db.goal.findFirst({ where: { id: p }, select: { parentId: true } }))?.parentId ?? null)
      if (p === id)
        throw new BadRequestException({ message: "A goal cannot serve one of its own.", issues: [{ path: "parentId", message: "Choose another goal" }] });
    await this.tenant.tx(async (tx) => {
      await tx.goal.update({ where: { id }, data: this.data(g) });
      await this.audit.record(tx, {
        action: "update",
        entity: "goal",
        entityId: id,
        before: { title: before.title, target: before.target, dueDate: day(before.dueDate) },
        after: { title: g.title, target: g.target, dueDate: g.dueDate },
      });
    });
    return this.get(id);
  }

  async remove(id: string) {
    const g = await this.tenant.db.goal.findFirst({ where: { id } });
    if (!g) throw new NotFoundException("No goal with that id.");
    if (await this.tenant.db.goal.findFirst({ where: { parentId: id }, select: { id: true } }))
      throw new ConflictException("Goals serve this one — move or remove them first.");
    await this.tenant.tx(async (tx) => {
      await tx.goal.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "goal", entityId: id, before: { title: g.title } });
    });
    return { removed: true };
  }

  /** An update, breakthrough or breakdown, by the goal's owner or someone who keeps goals; a breakdown tells whoever owns the goal it serves. */
  async checkIn(id: string, input: CheckInInput) {
    const c = checkInInput.parse(input);
    const g = await this.tenant.db.goal.findFirst({ where: { id } });
    if (!g) throw new NotFoundException("No goal with that id.");
    const me = this.tenant.userId ?? "";
    if (!this.may("edit") && !g.ownerIds.includes(me)) throw new ForbiddenException("Its owners check in on it.");
    if (c.value !== undefined && g.metric) throw new BadRequestException("This goal follows a figure the app knows — check in without a figure.");
    const parent = g.parentId ? await this.tenant.db.goal.findFirst({ where: { id: g.parentId }, select: { ownerIds: true } }) : null;
    await this.tenant.tx(async (tx) => {
      await tx.goalCheckIn.create({ data: { agencyId: this.tenant.agencyId, goalId: id, by: me, kind: c.kind, note: c.note, value: c.value ?? null } });
      if (c.value !== undefined) await tx.goal.update({ where: { id }, data: { actual: c.value } });
      await this.audit.record(tx, { action: "update", entity: "goal", entityId: id, after: { checkIn: c.kind, value: c.value ?? null } });
      if (c.kind === "breakdown")
        await this.notifications.notify(
          tx,
          { users: [...(parent?.ownerIds ?? []), ...g.ownerIds] },
          { kind: "goal_breakdown", title: `Breakdown on “${g.title}”`, body: c.note, link: `/app/goals?goal=${id}` },
        );
    });
    return this.get(id);
  }

  // ─── The revenue cascade ────────────────────────────────────────────

  async cascadeView(): Promise<CascadeView> {
    const [s, revenueGoal] = await Promise.all([
      this.tenant.db.goalSettings.findUnique({ where: { agencyId: this.tenant.agencyId } }),
      this.tenant.db.goal.findFirst({ where: { level: "company", unit: "inr" }, orderBy: [{ type: "asc" }, { createdAt: "asc" }], select: { target: true } }),
    ]);
    const { history, basis } = await this.metrics.history(revenueGoal?.target ?? null, todayIST());
    return { history, basis, saved: s?.cascade ? cascadeInputs.parse(s.cascade) : null };
  }

  async saveCascade(input: CascadeInputs) {
    const v = cascadeInputs.parse(input);
    await this.tenant.tx(async (tx) => {
      await tx.goalSettings.upsert({
        where: { agencyId: this.tenant.agencyId },
        create: { agencyId: this.tenant.agencyId, rule: DEFAULT_GOAL_SETTINGS, cascade: v },
        update: { cascade: v },
      });
      await this.audit.record(tx, { action: "update", entity: "revenue_cascade", after: { revenueTarget: v.revenueTarget } });
    });
    return this.cascadeView();
  }

  /** Sets goals' targets from the saved cascade: the new sales, deals, proposals, leads, videos or hires it works out. */
  async applyCascade(input: z.input<typeof cascadeApply>) {
    const { links } = cascadeApply.parse(input);
    const view = await this.cascadeView();
    if (!view.saved) throw new ConflictException("Save the cascade first.");
    const out = cascade(view.saved);
    const goals = await this.tenant.db.goal.findMany({ where: { id: { in: links.map((l) => l.goalId) } } });
    if (goals.length !== new Set(links.map((l) => l.goalId)).size) throw new NotFoundException("Choose your goals.");
    await this.tenant.tx(async (tx) => {
      for (const l of links) {
        const g = goals.find((x) => x.id === l.goalId)!;
        const target = out[l.figure];
        await tx.goal.update({ where: { id: g.id }, data: { target } });
        await tx.goalCheckIn.create({
          data: {
            agencyId: this.tenant.agencyId,
            goalId: g.id,
            by: this.tenant.userId ?? "",
            kind: "update",
            note: `Target set to ${target} from the revenue cascade.`,
          },
        });
        await this.audit.record(tx, {
          action: "update",
          entity: "goal",
          entityId: g.id,
          before: { target: g.target },
          after: { target, from: "revenue cascade" },
        });
      }
    });
    return this.list();
  }

  // ─── Reading ────────────────────────────────────────────────────────

  private async present(rows: Row[]): Promise<GoalRow[]> {
    const [s, deps, members] = await Promise.all([
      this.settings(),
      this.tenant.db.department.findMany({ select: { id: true, name: true } }),
      this.tenant.db.membership.findMany({ where: { agencyId: this.tenant.agencyId }, select: { user: { select: { id: true, name: true } } } }),
    ]);
    const name = new Map(members.map((m) => [m.user.id, m.user.name]));
    const today = todayIST();
    return Promise.all(
      rows.map(async (g) => {
        const startDate = day(g.startDate);
        const dueDate = day(g.dueDate);
        const until = today < dueDate ? today : dueDate;
        const actual = g.metric ? await this.metrics.figure(g.metric as GoalMetric, startDate, until < startDate ? startDate : until) : g.actual;
        const shape = { baseline: g.baseline, target: g.target, actual, startDate, dueDate };
        return {
          id: g.id,
          parentId: g.parentId,
          level: g.level as GoalRow["level"],
          title: g.title,
          department: deps.find((d) => d.id === g.departmentId) ?? null,
          type: g.type as GoalRow["type"],
          owners: g.ownerIds.filter((o) => name.has(o)).map((o) => ({ id: o, name: name.get(o)! })),
          measure: g.measure,
          unit: g.unit as GoalRow["unit"],
          baseline: g.baseline,
          target: g.target,
          actual,
          metric: (g.metric as GoalMetric | null) ?? null,
          startDate,
          dueDate,
          cadence: g.cadence as GoalRow["cadence"],
          smart: g.smart as GoalRow["smart"],
          progress: Math.round(goalProgress(shape) * 1000) / 1000,
          expected: Math.round(expectedProgress(shape, today) * 1000) / 1000,
          status: goalStatus(shape, today, s),
          checkIns: g.checkIns.map((c) => ({
            id: c.id,
            at: c.createdAt.toISOString(),
            by: name.get(c.by) ?? "",
            kind: c.kind as GoalRow["checkIns"][number]["kind"],
            note: c.note,
            value: c.value,
          })),
        };
      }),
    );
  }
}
