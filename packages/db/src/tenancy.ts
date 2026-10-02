import type { PrismaClient } from "./generated/prisma/client.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class TenancyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenancyError";
  }
}

function assertAgencyId(agencyId: string) {
  if (!UUID.test(agencyId)) throw new TenancyError("A valid agency id is required for every database call.");
}

/**
 * Client scoped to one agency. Every operation runs in its own transaction that first sets
 * `app.agency_id`, so PostgreSQL row-level security returns and accepts only that agency's rows —
 * even if a query forgets a `where: { agencyId }`.
 */
export function forAgency(prisma: PrismaClient, agencyId: string, userId?: string) {
  assertAgencyId(agencyId);
  return prisma.$extends({
    name: "tenancy",
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, , result] = await prisma.$transaction([
            prisma.$executeRaw`SELECT set_config('app.agency_id', ${agencyId}, TRUE)`,
            prisma.$executeRaw`SELECT set_config('app.user_id', ${userId ?? ""}, TRUE)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}

export type TenantClient = ReturnType<typeof forAgency>;

/** The transaction client inside withAgency(). */
export type TenantTx = Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/**
 * A private questionnaire link (P1-22): finds the one response whose token hash matches, without knowing the agency.
 * Row-level security lets a transaction see a response only when `app.link_token` holds its token hash (policy
 * link_access), so the link reveals nothing else; everything after this runs inside the response's agency as usual.
 */
export async function findQuestionnaireLink(prisma: PrismaClient, tokenHash: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.link_token', ${tokenHash}, TRUE)`;
    return tx.questionnaireResponse.findUnique({ where: { token: tokenHash }, select: { id: true, agencyId: true } });
  });
}

/** Several operations in one transaction, all inside the agency (e.g. create a client with its contacts). */
export async function withAgency<T>(prisma: PrismaClient, agencyId: string, fn: (tx: TenantTx) => Promise<T>, userId?: string): Promise<T> {
  assertAgencyId(agencyId);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.agency_id', ${agencyId}, TRUE)`;
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId ?? ""}, TRUE)`;
    return fn(tx);
  });
}
