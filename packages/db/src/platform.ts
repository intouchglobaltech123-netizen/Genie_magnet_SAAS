import type { PrismaClient } from "./generated/prisma/client.js";
import type { TenantTx } from "./tenancy.js";

/**
 * The platform's own short transactions (ADR 0011). `app.platform` lets them see the platform settings, every
 * agency's subscription and the list of agencies (policies platform_only, platform_subscriptions and
 * platform_agencies) — nothing else. An agency's figures are counted inside the agency itself.
 */
export function asPlatform<T>(prisma: PrismaClient, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.platform', 'on', TRUE)`;
    return fn(tx);
  });
}
