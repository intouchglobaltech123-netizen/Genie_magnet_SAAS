import { BadRequestException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import type { TenantTx } from "@gm/db";
import { LIMIT_LABEL, type PlanPage, type PlatformSettings, type UsageNow } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PlatformSettingsService } from "../platform/platform-settings.service.js";
import { currentTenant, TenantDb } from "../tenancy/tenant-context.js";
import { EntitlementsService } from "./entitlements.js";

const DAY = 86_400_000;
const addMonth = (d: Date) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours(), d.getUTCMinutes()));

/** What an agency uses now (ADR 0011): counted inside the agency, only the numbers leave it. */
export async function usageOf(db: TenantTx, agencyId: string, now = new Date()): Promise<UsageNow & { invited: number }> {
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const [members, clientRoles, clients, ai, files, invited] = await Promise.all([
    db.membership.findMany({ where: { agencyId }, select: { role: true } }),
    db.role.findMany({ where: { isClient: true }, select: { key: true } }),
    db.client.count(),
    db.aiUsage.count({ where: { createdAt: { gte: monthStart } } }),
    db.fileObject.aggregate({ where: { status: "ready" }, _sum: { size: true } }),
    db.invitation.findMany({ where: { agencyId, status: "pending", expiresAt: { gt: now } }, select: { role: true } }),
  ]);
  const client = new Set(clientRoles.map((r) => r.key));
  return {
    users: members.filter((m) => !client.has(m.role)).length,
    clients,
    aiDrafts: ai,
    storageBytes: Number(files._sum.size ?? 0),
    invited: invited.filter((i) => !client.has(i.role ?? "")).length,
  };
}

/**
 * The agency's plan (P6-02, P6-03, ADR 0011): what it has and uses, choosing a plan, the limits checked where things
 * are added, the trial a new agency starts with, and the daily check that ends an unpaid trial.
 */
@Injectable()
export class PlanService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly entitlements: EntitlementsService,
    private readonly platform: PlatformSettingsService,
  ) {}

  private ctx() {
    const ctx = currentTenant();
    if (!ctx) throw new UnauthorizedException("Sign in and choose an agency first.");
    return ctx;
  }

  async page(): Promise<PlanPage> {
    const ctx = this.ctx();
    const [entitlements, settings, used] = await Promise.all([
      this.entitlements.load(ctx),
      this.platform.get(),
      this.tenant.tx((tx) => usageOf(tx, ctx.agencyId)),
    ]);
    const { invited: _invited, ...usage } = used;
    return {
      brandName: settings.brandName,
      entitlements,
      usage,
      plans: settings.plans
        .filter((p) => p.offered)
        .map((p) => ({ key: p.key, name: p.name, description: p.description, suites: p.suites, limits: p.limits, priceInr: p.priceInr, priceUsd: p.priceUsd })),
    };
  }

  /**
   * The owner chooses a plan. Until the billing provider is set up (P6-04) it starts at once, for a month; a
   * downgrade hides suites the new plan does not have, keeping their data.
   */
  async choose(planKey: string) {
    const settings = await this.platform.get();
    const plan = settings.plans.find((p) => p.key === planKey && p.offered);
    if (!plan) throw new BadRequestException({ message: "Choose one of the plans offered.", issues: [{ path: "plan", message: "Choose a plan" }] });
    const ctx = this.ctx();
    const agencyId = ctx.agencyId;
    await this.tenant.tx(async (tx) => {
      const before = await tx.subscription.findUnique({ where: { agencyId } });
      const data = { planKey, status: "active", trialEndsAt: null, currentPeriodEnd: addMonth(new Date()), graceUntil: null };
      await tx.subscription.upsert({ where: { agencyId }, create: { agencyId, ...data }, update: data });
      await this.audit.record(tx, {
        action: "update",
        entity: "subscription",
        entityId: agencyId,
        before: before ? { plan: before.planKey, status: before.status } : null,
        after: { plan: planKey, status: "active" },
      });
    });
    ctx.entitlements = undefined;
    return this.page();
  }

  /** Room for `adding` more people or clients on the plan; refused, naming the plan, when it is full. */
  async assertRoom(kind: "users" | "clients", adding = 1) {
    const ctx = this.ctx();
    const ent = await this.entitlements.load(ctx);
    const limit = ent.limits[kind];
    if (limit === null) return;
    const used = await this.tenant.tx((tx) => usageOf(tx, ctx.agencyId));
    const taken = kind === "users" ? used.users + used.invited : used.clients;
    if (taken + adding > limit)
      throw new ForbiddenException(
        `Your plan (${ent.plan?.name ?? "—"}) allows ${limit} ${LIMIT_LABEL[kind].toLowerCase()}, and ${taken} ${taken === 1 ? "is" : "are"} already taken${kind === "users" && used.invited ? ", counting invitations not yet accepted" : ""}. The owner can choose a larger plan in Settings → Plan.`,
      );
  }

  /** A new agency's trial of the platform's trial plan (from sign-up). */
  static async startTrial(tx: TenantTx, agencyId: string, settings: PlatformSettings) {
    if (await tx.subscription.findUnique({ where: { agencyId } })) return;
    await tx.subscription.create({
      data: { agencyId, planKey: settings.trialPlan, status: "trialing", trialEndsAt: new Date(Date.now() + settings.trialDays * DAY) },
    });
  }

  /**
   * Each morning: a reminder three days before the trial ends; an unpaid trial that has ended turns the workspace
   * read-only; a paid period renews (pretend billing until P6-04).
   */
  async daily(tx: TenantTx, now = new Date()) {
    const agencyId = this.tenant.agencyId;
    const sub = await tx.subscription.findUnique({ where: { agencyId } });
    if (!sub) return { skipped: "no plan" };
    const tell = (title: string, body: string) =>
      this.notifications.notify(tx, { can: { area: "settings", level: "edit" } }, { kind: "billing", title, body, link: "/app/settings/plan" });
    if (sub.status === "trialing" && sub.trialEndsAt) {
      const left = Math.ceil((sub.trialEndsAt.getTime() - now.getTime()) / DAY);
      if (left <= 0) {
        await tx.subscription.update({ where: { agencyId }, data: { status: "expired" } });
        await tell("The trial has ended", "Choose a plan in Settings → Plan to keep working. Everything can still be read and exported.");
        return { trial: "ended" };
      }
      if (left === 3) await tell("The trial ends in 3 days", "Choose a plan in Settings → Plan to keep working without a break.");
      return { trial: `${left} days left` };
    }
    if (sub.status === "active" && sub.provider === "outbox" && sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
      await tx.subscription.update({ where: { agencyId }, data: { currentPeriodEnd: addMonth(sub.currentPeriodEnd) } });
      return { renewed: true };
    }
    return { status: sub.status };
  }
}
