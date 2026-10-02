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

/**
 * A client contact's private portal link (P3-01): finds the link whose token hash matches, without knowing the agency.
 * Row-level security shows a link only when `app.portal_token` holds its hash (policy portal_access).
 */
export async function findPortalLink(prisma: PrismaClient, tokenHash: string) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.portal_token', ${tokenHash}, TRUE)`;
    return tx.portalLink.findUnique({ where: { token: tokenHash }, select: { id: true, agencyId: true, clientId: true, contactId: true } });
  });
}

/**
 * WhatsApp's notices arrive at an address carrying a connection's id (P3-07): finds that connection and its agency,
 * without knowing the agency. Row-level security shows a connection only when `app.whatsapp_connection` holds its id.
 */
export async function findWhatsAppConnection(prisma: PrismaClient, id: string) {
  if (!UUID.test(id)) return null;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.whatsapp_connection', ${id}, TRUE)`;
    return tx.whatsAppConnection.findUnique({ where: { id }, select: { id: true, agencyId: true, verifyToken: true, appSecret: true } });
  });
}

/** Razorpay's notices arrive at an address carrying a payment connection's id (P3-10): finds it and its agency. */
export async function findPaymentConnection(prisma: PrismaClient, id: string) {
  if (!UUID.test(id)) return null;
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.payment_connection', ${id}, TRUE)`;
    return tx.paymentConnection.findUnique({ where: { id }, select: { id: true, agencyId: true, webhookSecret: true } });
  });
}

/** Several operations in one transaction, all inside the agency (e.g. create a client with its contacts). */
export async function withAgency<T>(
  prisma: PrismaClient,
  agencyId: string,
  fn: (tx: TenantTx) => Promise<T>,
  userId?: string,
  options?: { timeout?: number },
): Promise<T> {
  assertAgencyId(agencyId);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.agency_id', ${agencyId}, TRUE)`;
    await tx.$executeRaw`SELECT set_config('app.user_id', ${userId ?? ""}, TRUE)`;
    return fn(tx);
  }, options);
}
