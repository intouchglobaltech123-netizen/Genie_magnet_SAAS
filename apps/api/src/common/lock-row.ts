import { Prisma, type TenantTx } from "@gm/db";

/**
 * Locks one row until the transaction ends. Take it before reading a JSON column you will change and write
 * back (ticks, checks), so two changes made at the same moment cannot overwrite each other.
 */
export async function lockRow(tx: TenantTx, table: "videos" | "shoots" | "questionnaire_responses", id: string) {
  await tx.$queryRaw`SELECT 1 FROM ${Prisma.raw(`"${table}"`)} WHERE "id" = ${id}::uuid FOR UPDATE`;
}
