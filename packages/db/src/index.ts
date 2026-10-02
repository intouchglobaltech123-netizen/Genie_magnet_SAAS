import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client.js";

export * from "./generated/prisma/client.js";
export {
  findPortalLink,
  findQuestionnaireLink,
  findWhatsAppConnection,
  forAgency,
  withAgency,
  TenancyError,
  type TenantClient,
  type TenantTx,
} from "./tenancy.js";
export { claimJobs, releaseStuckJobs, scheduleJobs, type ClaimedJob, type ScheduledJob } from "./jobs.js";
export { ensureDefaultQuestionnaires, ensureDefaultRoles, ensureDefaultStages, setUpAgencyDefaults } from "./defaults.js";

/**
 * Database client for the API and worker. `connectionString` must be the genie_app role
 * (DATABASE_URL) so row-level security always applies. Use forAgency()/withAgency() for queries.
 */
export function createPrisma(connectionString: string) {
  // UTC for every session too (see migration 20261022000100_utc): times are stored without a zone and read as UTC.
  return new PrismaClient({ adapter: new PrismaPg({ connectionString, options: "-c TimeZone=UTC" }) });
}
