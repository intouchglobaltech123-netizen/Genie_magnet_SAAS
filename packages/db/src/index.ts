import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export * from "./generated/prisma/client.js";
export { forAgency, withAgency, TenancyError, type TenantClient, type TenantTx } from "./tenancy.js";
export { ensureDefaultRoles } from "./roles.js";

/**
 * Database client for the API and worker. `connectionString` must be the genie_app role
 * (DATABASE_URL) so row-level security always applies. Use forAgency()/withAgency() for queries.
 */
export function createPrisma(connectionString: string) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
