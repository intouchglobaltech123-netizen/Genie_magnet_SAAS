import { Injectable } from "@nestjs/common";
import { forAgency } from "@gm/db";
import { type Entitlements, NO_LIMITS, type PlatformSettings, SUITE_KEYS, type SubscriptionStatus } from "@gm/shared";
import { PlatformSettingsService } from "../platform/platform-settings.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { TenantContext } from "../tenancy/tenant-context.js";

type SubscriptionRow = {
  planKey: string;
  status: string;
  trialEndsAt: Date | null;
  currentPeriodEnd: Date | null;
  graceUntil: Date | null;
};

const READ_ONLY = {
  trial: "The trial has ended — choose a plan in Settings → Plan to keep working. Everything can still be read and exported.",
  payment: "A payment is still due after the grace period — pay it in Settings → Plan to keep working. Everything can still be read and exported.",
  ended: "The subscription has ended — choose a plan in Settings → Plan to keep working. Everything can still be read and exported.",
};

/** What an agency has (ADR 0011): no subscription means every suite and no limits. */
export function entitlementsOf(sub: SubscriptionRow | null, settings: PlatformSettings, now = new Date()): Entitlements {
  if (!sub)
    return {
      plan: null,
      status: null,
      suites: [...SUITE_KEYS],
      limits: NO_LIMITS,
      readOnly: false,
      readOnlyReason: null,
      trialEndsAt: null,
      currentPeriodEnd: null,
      graceUntil: null,
    };
  const plan = settings.plans.find((p) => p.key === sub.planKey);
  const status = sub.status as SubscriptionStatus;
  const reason =
    status === "expired" || (status === "trialing" && sub.trialEndsAt && sub.trialEndsAt < now)
      ? READ_ONLY.trial
      : status === "past_due" && sub.graceUntil && sub.graceUntil < now
        ? READ_ONLY.payment
        : status === "cancelled" && (!sub.currentPeriodEnd || sub.currentPeriodEnd < now)
          ? READ_ONLY.ended
          : null;
  return {
    plan: { key: sub.planKey, name: plan?.name ?? sub.planKey },
    status,
    suites: plan ? [...plan.suites] : [],
    limits: plan?.limits ?? NO_LIMITS,
    readOnly: !!reason,
    readOnlyReason: reason,
    trialEndsAt: sub.trialEndsAt?.toISOString() ?? null,
    currentPeriodEnd: sub.currentPeriodEnd?.toISOString() ?? null,
    graceUntil: sub.graceUntil?.toISOString() ?? null,
  };
}

/** The request's agency's entitlements, read once and kept on the request. */
@Injectable()
export class EntitlementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly platform: PlatformSettingsService,
  ) {}

  async load(ctx: TenantContext): Promise<Entitlements> {
    if (ctx.entitlements) return ctx.entitlements;
    const sub = await forAgency(this.prisma.client, ctx.agencyId, ctx.userId).subscription.findUnique({ where: { agencyId: ctx.agencyId } });
    ctx.entitlements = entitlementsOf(sub, await this.platform.get());
    return ctx.entitlements;
  }
}
