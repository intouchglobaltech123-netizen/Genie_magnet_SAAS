import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import type { TenantTx } from "@gm/db";
import { type ChoosePlanResult, LIMIT_LABEL, type PlanCurrency, type PlanPage, type PlatformSettings, type UsageNow } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { ENV, type Env } from "../env.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PlatformSettingsService } from "../platform/platform-settings.service.js";
import { currentTenant, TenantDb } from "../tenancy/tenant-context.js";
import { BillingService, invoiceRow, priceOf } from "./billing.service.js";
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
    private readonly billing: BillingService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private ctx() {
    const ctx = currentTenant();
    if (!ctx) throw new UnauthorizedException("Sign in and choose an agency first.");
    return ctx;
  }

  async page(): Promise<PlanPage> {
    const ctx = this.ctx();
    const [entitlements, settings, used, invoices, agency] = await Promise.all([
      this.entitlements.load(ctx),
      this.platform.get(),
      this.tenant.tx((tx) => usageOf(tx, ctx.agencyId)),
      this.tenant.db.platformInvoice.findMany({ orderBy: [{ issuedOn: "desc" }, { createdAt: "desc" }], take: 60 }),
      this.tenant.db.agency.findUnique({ where: { id: ctx.agencyId }, select: { name: true } }),
    ]);
    const { invited: _invited, ...usage } = used;
    return {
      brandName: settings.brandName,
      entitlements,
      usage,
      plans: settings.plans
        .filter((p) => p.offered)
        .map((p) => ({ key: p.key, name: p.name, description: p.description, suites: p.suites, limits: p.limits, priceInr: p.priceInr, priceUsd: p.priceUsd })),
      billing: { provider: this.billing.provider.kind, currencies: this.billing.provider.currencies() },
      invoices: invoices.map((r) => invoiceRow(r, agency?.name ?? "")),
    };
  }

  /**
   * The owner chooses a plan and pays for it (P6-04): through our payment page, after which the provider's webhook
   * starts the plan and issues our invoice — or at once with pretend billing. A downgrade hides suites the new plan
   * does not have, keeping their data.
   */
  async choose(planKey: string, currency: PlanCurrency): Promise<ChoosePlanResult> {
    const settings = await this.platform.get();
    const plan = settings.plans.find((p) => p.key === planKey && p.offered);
    if (!plan) throw new BadRequestException({ message: "Choose one of the plans offered.", issues: [{ path: "plan", message: "Choose a plan" }] });
    const price = priceOf(settings, planKey, currency);
    if (!price) throw new ConflictException(`${plan.name}'s price in ${currency === "INR" ? "rupees" : "US dollars"} is not set yet.`);
    if (!this.billing.provider.currencies().includes(currency))
      throw new ConflictException(`Paying in ${currency === "INR" ? "rupees" : "US dollars"} is not switched on yet.`);
    const ctx = this.ctx();
    const agencyId = ctx.agencyId;
    const [agency, me, before] = await Promise.all([
      this.tenant.db.agency.findUnique({ where: { id: agencyId }, select: { name: true } }),
      this.tenant.db.user.findUnique({ where: { id: ctx.userId ?? "" }, select: { email: true } }),
      this.tenant.db.subscription.findUnique({ where: { agencyId } }),
    ]);
    const started = await this.billing.provider.subscribe({
      agencyId,
      agencyName: agency?.name ?? "",
      email: me?.email ?? "",
      plan: { key: plan.key, name: plan.name },
      currency,
      charge: price.charge,
      returnUrl: `${this.env.WEB_ORIGIN}/app/settings/plan`,
    });
    await this.tenant.tx((tx) =>
      this.audit.record(tx, {
        action: "update",
        entity: "subscription",
        entityId: agencyId,
        before: before ? { plan: before.planKey, status: before.status } : null,
        after: { plan: planKey, currency, paid: started.paidNow ? "at once" : "on the payment page" },
      }),
    );
    if (started.paidNow) {
      const now = new Date();
      await this.billing.paid({
        agencyId,
        planKey,
        currency,
        provider: started.provider,
        ref: started.ref,
        paymentRef: started.ref,
        periodStart: now,
        periodEnd: addMonth(now),
      });
    }
    ctx.entitlements = undefined;
    return { ...(await this.page()), payUrl: started.payUrl };
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
    // Pretend billing renews by itself, with its invoice; real providers renew through their webhooks.
    if (sub.status === "active" && sub.provider === "outbox" && sub.currentPeriodEnd && sub.currentPeriodEnd < now) {
      const start = sub.currentPeriodEnd;
      const currency: PlanCurrency =
        (await tx.platformInvoice.findFirst({ orderBy: { issuedOn: "desc" }, select: { currency: true } }))?.currency === "USD" ? "USD" : "INR";
      await this.billing.paid({
        agencyId,
        planKey: sub.planKey,
        currency,
        provider: "outbox",
        ref: sub.providerRef ?? `outbox-${agencyId}`,
        paymentRef: `${sub.providerRef ?? "outbox"}:${start.toISOString()}`,
        periodStart: start,
        periodEnd: addMonth(start),
      });
      return { renewed: true };
    }
    return { status: sub.status };
  }
}
