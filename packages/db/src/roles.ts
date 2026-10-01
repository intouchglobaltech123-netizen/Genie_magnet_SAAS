import { DEFAULT_ROLE_DEFINITIONS } from "@gm/shared";
import type { Prisma } from "./generated/prisma/client.js";
import type { TenantTx } from "./tenancy.js";

/**
 * Gives an agency the default roles it does not have yet (P1-11). Run when an agency is created and by the
 * seed; existing roles — and any changes the agency made to them — are left as they are.
 */
export async function ensureDefaultRoles(tx: TenantTx, agencyId: string) {
  await tx.role.createMany({
    data: DEFAULT_ROLE_DEFINITIONS.map((r) => ({
      agencyId,
      key: r.key,
      name: r.name,
      description: r.description,
      permissions: r.permissions as Prisma.InputJsonObject,
      isClient: r.isClient,
    })),
    skipDuplicates: true,
  });
}
