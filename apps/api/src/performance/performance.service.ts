import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@gm/db";
import {
  allows,
  compositeOf,
  achievedOf,
  DEFAULT_PERFORMANCE,
  type Gate,
  type Kra,
  type KraLine,
  type KraMetric,
  type KraTemplateInput,
  type KraTemplateRow,
  kraTemplateInput,
  type LeaderboardRow,
  type MonthScorecardRow,
  OWNER_ROLE,
  type PerformanceSettings,
  performanceSettingsInput,
  type Player,
  type PlayerRatingInput,
  type PlayerRatingRow,
  type PlayerTrait,
  playerOf,
  playerRatingInput,
  type TeamMemberRow,
} from "@gm/shared";
import type { z } from "zod";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { PerformanceMetrics } from "./metrics.js";

const monthName = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const previous = (m: string) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() - 1);
  return d.toISOString().slice(0, 7);
};
type Card = Prisma.MonthScorecardGetPayload<object>;

/**
 * Performance (P5-11): each role's KRAs; the month's scorecard, started by the person's reviewer with what the app
 * knows filled in, finished and shared with them; the A–C rating; the leaderboard. A person's reviewer is their
 * manager, the head of their department, or HR — never themselves (the owner excepted).
 */
@Injectable()
export class PerformanceService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly metrics: PerformanceMetrics,
  ) {}

  private hr(level: "view" | "edit" = "view") {
    return allows(this.tenant.permissions, "hr", level);
  }

  // ─── Rule ───────────────────────────────────────────────────────────

  async settings(): Promise<PerformanceSettings> {
    const s = await this.tenant.db.performanceSettings.findUnique({ where: { agencyId: this.tenant.agencyId } });
    return s ? performanceSettingsInput.parse(s.rule) : DEFAULT_PERFORMANCE;
  }

  async updateSettings(input: z.input<typeof performanceSettingsInput>) {
    const rule = performanceSettingsInput.parse(input);
    await this.tenant.tx(async (tx) => {
      await tx.performanceSettings.upsert({ where: { agencyId: this.tenant.agencyId }, create: { agencyId: this.tenant.agencyId, rule }, update: { rule } });
      await this.audit.record(tx, { action: "update", entity: "performance_settings", after: rule });
    });
    return this.settings();
  }

  // ─── Who reviews whom ───────────────────────────────────────────────

  /** Those who report to the signed-in person, or are in a department they head. */
  private async reports(): Promise<Set<string>> {
    const me = this.tenant.userId ?? "";
    const [heads, profiles] = await Promise.all([
      this.tenant.db.department.findMany({ where: { headId: me }, select: { id: true } }),
      this.tenant.db.employeeProfile.findMany({ select: { userId: true, managerId: true, departmentId: true } }),
    ]);
    const headed = new Set(heads.map((h) => h.id));
    return new Set(profiles.filter((p) => p.userId !== me && (p.managerId === me || (p.departmentId && headed.has(p.departmentId)))).map((p) => p.userId));
  }

  /** Whose months the signed-in person sees: everyone for HR; otherwise their reports. */
  async reviewees(): Promise<Set<string> | "all"> {
    return this.hr() ? "all" : this.reports();
  }

  /** Reviewing (starting, scoring, sharing, rating) needs HR editing or being their reviewer — never on yourself, the owner excepted. */
  private async assertReviews(userId: string) {
    if (userId === this.tenant.userId && this.tenant.role !== OWNER_ROLE) throw new ForbiddenException("Someone else reviews your own month.");
    if (this.hr("edit") || (await this.reports()).has(userId)) return;
    throw new ForbiddenException("You review only the people who report to you.");
  }

  // ─── KRA templates ──────────────────────────────────────────────────

  async templates(): Promise<KraTemplateRow[]> {
    const [rows, profiles, members] = await Promise.all([
      this.tenant.db.kraTemplate.findMany({ orderBy: { name: "asc" } }),
      this.tenant.db.employeeProfile.findMany({ where: { kraTemplateId: { not: null } }, select: { userId: true, kraTemplateId: true } }),
      this.tenant.db.membership.findMany({ where: { agencyId: this.tenant.agencyId }, select: { user: { select: { id: true, name: true } } } }),
    ]);
    const name = new Map(members.map((m) => [m.user.id, m.user.name]));
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      kras: t.kras as Kra[],
      gate: (t.gate as Gate | null) ?? null,
      people: profiles.filter((p) => p.kraTemplateId === t.id && name.has(p.userId)).map((p) => ({ id: p.userId, name: name.get(p.userId)! })),
    }));
  }

  async saveTemplate(id: string | null, input: KraTemplateInput) {
    const t = kraTemplateInput.parse(input);
    const clash = await this.tenant.db.kraTemplate.findFirst({ where: { name: t.name, ...(id && { NOT: { id } }) }, select: { id: true } });
    if (clash) throw new ConflictException(`There is already a template called ${t.name}.`);
    const data = { name: t.name, kras: t.kras, gate: t.gate ?? undefined };
    const row = await this.tenant.tx(async (tx) => {
      const saved = id
        ? await tx.kraTemplate.update({ where: { id }, data: { ...data, gate: t.gate ?? Prisma.DbNull } })
        : await tx.kraTemplate.create({ data: { agencyId: this.tenant.agencyId, ...data } });
      await this.audit.record(tx, {
        action: id ? "update" : "create",
        entity: "kra_template",
        entityId: saved.id,
        after: { name: t.name, kras: t.kras.map((k) => k.name) },
      });
      return saved;
    });
    return (await this.templates()).find((x) => x.id === row.id)!;
  }

  async removeTemplate(id: string) {
    const t = await this.tenant.db.kraTemplate.findFirst({ where: { id } });
    if (!t) throw new NotFoundException("No KRA template with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.employeeProfile.updateMany({ where: { kraTemplateId: id }, data: { kraTemplateId: null } });
      await tx.kraTemplate.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "kra_template", entityId: id, before: { name: t.name } });
    });
    return { removed: true };
  }

  // ─── The team and the month ─────────────────────────────────────────

  /** The people the signed-in person reviews, with their month's scorecard and rating. */
  async team(month: string): Promise<TeamMemberRow[]> {
    const r = await this.reviewees();
    const me = this.tenant.userId ?? "";
    const [members, profiles, templates, cards, ratings] = await Promise.all([
      this.tenant.db.membership.findMany({ where: { agencyId: this.tenant.agencyId }, select: { user: { select: { id: true, name: true } } } }),
      this.tenant.db.employeeProfile.findMany({ select: { userId: true, designation: true, kraTemplateId: true } }),
      this.tenant.db.kraTemplate.findMany({ select: { id: true, name: true } }),
      this.tenant.db.monthScorecard.findMany({ where: { month }, select: { id: true, userId: true, status: true, score: true } }),
      this.tenant.db.playerRating.findMany({ where: { month }, select: { userId: true, player: true } }),
    ]);
    const isOwner = this.tenant.role === OWNER_ROLE;
    return members
      .filter((m) => (r === "all" ? m.user.id !== me || isOwner : r.has(m.user.id)))
      .map((m) => {
        const p = profiles.find((x) => x.userId === m.user.id);
        const t = templates.find((x) => x.id === p?.kraTemplateId);
        const c = cards.find((x) => x.userId === m.user.id);
        return {
          user: m.user,
          designation: p?.designation ?? null,
          template: t ?? null,
          scorecard: c ? { id: c.id, status: c.status as "draft" | "shared", score: c.score } : null,
          player: (ratings.find((x) => x.userId === m.user.id)?.player as Player | undefined) ?? null,
        };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }

  /** The reviewer starts a person's month from their KRAs, with what the app knows filled in. */
  async start(userId: string, month: string) {
    await this.assertReviews(userId);
    if (month > new Date().toISOString().slice(0, 7)) throw new BadRequestException("Only a month that has begun.");
    if (await this.tenant.db.monthScorecard.findFirst({ where: { userId, month }, select: { id: true } }))
      throw new ConflictException(`Their ${monthName(month)} is already started.`);
    const profile = await this.tenant.db.employeeProfile.findFirst({ where: { userId }, select: { kraTemplateId: true } });
    const t = profile?.kraTemplateId ? await this.tenant.db.kraTemplate.findFirst({ where: { id: profile.kraTemplateId } }) : null;
    if (!t) throw new ConflictException("Choose their KRAs on their employee record first.");
    const kras = await this.fill(
      userId,
      month,
      (t.kras as Kra[]).map((k) => ({ ...k, actual: null, auto: !!k.metric, achieved: null })),
    );
    const gate = (t.gate as Gate | null) ?? null;
    const c = compositeOf(kras, gate);
    const row = await this.tenant.tx(async (tx) => {
      const created = await tx.monthScorecard.create({
        data: {
          agencyId: this.tenant.agencyId,
          userId,
          month,
          templateName: t.name,
          kras,
          gate: gate ?? undefined,
          raw: c.raw,
          score: c.score,
          gated: c.gated,
          reviewerId: this.tenant.userId ?? null,
        },
      });
      await this.audit.record(tx, { action: "create", entity: "scorecard", entityId: created.id, after: { month, template: t.name } });
      return created;
    });
    return this.scorecard(row.id);
  }

  /** Fills each KRA on a figure the app knows. */
  private async fill(userId: string, month: string, kras: KraLine[]) {
    const wanted = [...new Set(kras.filter((k) => k.auto && k.metric).map((k) => k.metric as KraMetric))];
    const figures = await this.metrics.forMonth(userId, month, wanted);
    return kras.map((k) => {
      const actual = k.auto && k.metric ? (figures[k.metric] ?? null) : k.actual;
      return { ...k, actual, achieved: achievedOf({ ...k, actual }) };
    });
  }

  async scorecard(id: string): Promise<MonthScorecardRow> {
    const c = await this.tenant.db.monthScorecard.findFirst({ where: { id } });
    if (!c) throw new NotFoundException("No scorecard with that id.");
    const own = c.userId === this.tenant.userId;
    if (!(own && c.status === "shared")) {
      const r = await this.reviewees();
      if (r !== "all" && !r.has(c.userId) && !(own && this.tenant.role === OWNER_ROLE)) throw new NotFoundException("No scorecard with that id.");
    }
    return (await this.present([c]))[0]!;
  }

  /** The reviewer enters what was achieved (or corrects a figure the app filled in) while it is a draft. */
  async update(id: string, input: { actuals: Record<string, number | null>; note: string }) {
    const c = await this.draft(id);
    const kras = (c.kras as unknown as KraLine[]).map((k) => {
      if (!(k.key in input.actuals)) return k;
      const actual = input.actuals[k.key] ?? null;
      return { ...k, actual, auto: false, achieved: achievedOf({ ...k, actual }) };
    });
    await this.save(c, kras, input.note);
    return this.scorecard(id);
  }

  /** Fills the app's figures again (after more work is approved, say). */
  async refresh(id: string) {
    const c = await this.draft(id);
    await this.save(c, await this.fill(c.userId, c.month, c.kras as unknown as KraLine[]), c.note);
    return this.scorecard(id);
  }

  private async save(c: Card, kras: KraLine[], note: string) {
    const r = compositeOf(kras, (c.gate as Gate | null) ?? null);
    await this.tenant.tx(async (tx) => {
      await tx.monthScorecard.update({
        where: { id: c.id },
        data: { kras: kras as unknown as Prisma.InputJsonValue, raw: r.raw, score: r.score, gated: r.gated, note },
      });
      await this.audit.record(tx, { action: "update", entity: "scorecard", entityId: c.id, after: { month: c.month, score: r.score } });
    });
  }

  private async draft(id: string) {
    const c = await this.tenant.db.monthScorecard.findFirst({ where: { id } });
    if (!c) throw new NotFoundException("No scorecard with that id.");
    await this.assertReviews(c.userId);
    if (c.status !== "draft") throw new ConflictException("It is shared — open it again to change it.");
    return c;
  }

  /** Shared with the person, who is told and may reply. */
  async share(id: string) {
    const c = await this.draft(id);
    if ((c.kras as unknown as KraLine[]).some((k) => k.actual === null)) throw new ConflictException("Enter what was achieved on every KRA first.");
    await this.tenant.tx(async (tx) => {
      await tx.monthScorecard.update({ where: { id }, data: { status: "shared", sharedAt: new Date(), reviewerId: this.tenant.userId ?? c.reviewerId } });
      await this.audit.record(tx, { action: "approve", entity: "scorecard", entityId: id, after: { month: c.month, score: c.score } });
      await this.notifications.notify(
        tx,
        { users: [c.userId] },
        { kind: "scorecard_shared", title: `Your scorecard for ${monthName(c.month)}: ${c.score}`, link: `/app/performance?scorecard=${id}` },
      );
    });
    return this.scorecard(id);
  }

  async reopen(id: string) {
    const c = await this.tenant.db.monthScorecard.findFirst({ where: { id } });
    if (!c) throw new NotFoundException("No scorecard with that id.");
    await this.assertReviews(c.userId);
    await this.tenant.tx(async (tx) => {
      await tx.monthScorecard.update({ where: { id }, data: { status: "draft", sharedAt: null } });
      await this.audit.record(tx, { action: "reopen", entity: "scorecard", entityId: id, after: { month: c.month } });
    });
    return this.scorecard(id);
  }

  /** The person's reply to their shared scorecard. */
  async reply(id: string, text: string) {
    const c = await this.tenant.db.monthScorecard.findFirst({ where: { id, userId: this.tenant.userId ?? "", status: "shared" } });
    if (!c) throw new NotFoundException("No scorecard of yours with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.monthScorecard.update({ where: { id }, data: { reply: text } });
      await this.audit.record(tx, { action: "update", entity: "scorecard", entityId: id, after: { reply: true } });
      if (c.reviewerId)
        await this.notifications.notify(
          tx,
          { users: [c.reviewerId] },
          { kind: "scorecard_shared", title: `A reply on a scorecard for ${monthName(c.month)}`, body: text, link: `/app/performance?scorecard=${id}` },
        );
    });
    return this.scorecard(id);
  }

  /** The signed-in person's shared scorecards. */
  async mine(): Promise<MonthScorecardRow[]> {
    const rows = await this.tenant.db.monthScorecard.findMany({ where: { userId: this.tenant.userId ?? "", status: "shared" }, orderBy: { month: "desc" } });
    return this.present(rows);
  }

  /** The month's shared scores, ranked, with the change from the month before. */
  async leaderboard(month: string): Promise<LeaderboardRow[]> {
    const s = await this.settings();
    if (s.leaderboard === "managers") {
      const r = await this.reviewees();
      if (r !== "all" && !r.size) throw new ForbiddenException("The leaderboard is for managers and HR.");
    }
    const [now, before, members] = await Promise.all([
      this.tenant.db.monthScorecard.findMany({ where: { month, status: "shared" }, orderBy: { score: "desc" } }),
      this.tenant.db.monthScorecard.findMany({ where: { month: previous(month), status: "shared" }, select: { userId: true, score: true } }),
      this.tenant.db.membership.findMany({ where: { agencyId: this.tenant.agencyId }, select: { user: { select: { id: true, name: true } } } }),
    ]);
    const name = new Map(members.map((m) => [m.user.id, m.user.name]));
    return now
      .filter((c) => name.has(c.userId))
      .map((c, i) => {
        const b = before.find((x) => x.userId === c.userId);
        return {
          rank: i + 1,
          user: { id: c.userId, name: name.get(c.userId)! },
          template: c.templateName,
          score: c.score,
          change: b ? Math.round((c.score - b.score) * 10) / 10 : null,
        };
      });
  }

  // ─── A–C rating ─────────────────────────────────────────────────────

  async rate(userId: string, input: PlayerRatingInput) {
    const r = playerRatingInput.parse(input);
    await this.assertReviews(userId);
    const player = playerOf(r.ratings, await this.settings());
    const data = { ratings: r.ratings, player, note: r.note, ratedBy: this.tenant.userId ?? null };
    await this.tenant.tx(async (tx) => {
      await tx.playerRating.upsert({
        where: { agencyId_userId_month: { agencyId: this.tenant.agencyId, userId, month: r.month } },
        create: { agencyId: this.tenant.agencyId, userId, month: r.month, ...data },
        update: data,
      });
      await this.audit.record(tx, { action: "update", entity: "player_rating", entityId: userId, after: { month: r.month, player } });
    });
    return (await this.ratings(r.month)).find((x) => x.user.id === userId)!;
  }

  /** Ratings of the people the signed-in person reviews; their own too when the agency shows them. */
  async ratings(month: string): Promise<PlayerRatingRow[]> {
    const [r, s] = await Promise.all([this.reviewees(), this.settings()]);
    const me = this.tenant.userId ?? "";
    const rows = await this.tenant.db.playerRating.findMany({ where: { month } });
    const members = await this.tenant.db.membership.findMany({
      where: { agencyId: this.tenant.agencyId },
      select: { user: { select: { id: true, name: true } } },
    });
    const name = new Map(members.map((m) => [m.user.id, m.user.name]));
    const raters = new Map(members.map((m) => [m.user.id, m.user.name]));
    return rows
      .filter((x) => name.has(x.userId) && (x.userId === me ? s.showOwnRating || this.tenant.role === OWNER_ROLE : r === "all" || r.has(x.userId)))
      .map((x) => ({
        user: { id: x.userId, name: name.get(x.userId)! },
        month: x.month,
        ratings: x.ratings as Record<PlayerTrait, number>,
        player: x.player as Player,
        note: x.note,
        ratedBy: x.ratedBy ? (raters.get(x.ratedBy) ?? null) : null,
      }));
  }

  // ─── Reading ────────────────────────────────────────────────────────

  private async present(rows: Card[]): Promise<MonthScorecardRow[]> {
    const ids = [...new Set(rows.flatMap((r) => [r.userId, r.reviewerId]).filter((x): x is string => !!x))];
    const people = ids.length ? await this.tenant.db.user.findMany({ where: { id: { in: ids } }, select: { id: true, name: true } }) : [];
    const name = new Map(people.map((p) => [p.id, p.name]));
    return rows.map((c) => ({
      id: c.id,
      month: c.month,
      user: { id: c.userId, name: name.get(c.userId) ?? "" },
      template: c.templateName,
      kras: c.kras as unknown as KraLine[],
      gate: (c.gate as Gate | null) ?? null,
      raw: c.raw,
      score: c.score,
      gated: c.gated,
      status: c.status as "draft" | "shared",
      reviewer: c.reviewerId ? { id: c.reviewerId, name: name.get(c.reviewerId) ?? "" } : null,
      note: c.note,
      reply: c.reply,
      sharedAt: c.sharedAt?.toISOString() ?? null,
    }));
  }
}
