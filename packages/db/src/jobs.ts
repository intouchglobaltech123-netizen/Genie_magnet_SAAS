import type { PrismaClient } from "./generated/prisma/client.js";
import type { TenantTx } from "./tenancy.js";

/** A job taken by the runner; it then runs inside its own agency. */
export interface ClaimedJob {
  id: string;
  agencyId: string;
  name: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
}

/** A job to queue for every agency (the daily sweeps). */
export interface ScheduledJob {
  name: string;
  key: string;
  payload: Record<string, unknown>;
  runAt: Date;
}

/**
 * The job runner's own short transactions (ADR 0010). `app.job_runner` lets them see the jobs table and the list of
 * agencies across agencies (policies job_runner and job_runner_agencies) — nothing else. The work itself always runs
 * inside the job's agency.
 */
function asRunner<T>(prisma: PrismaClient, fn: (tx: TenantTx) => Promise<T>): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.job_runner', 'on', TRUE)`;
    return fn(tx);
  });
}

/** Takes up to `limit` jobs that are due and marks them running; other runners skip them (SKIP LOCKED). */
export function claimJobs(prisma: PrismaClient, limit: number, now = new Date()): Promise<ClaimedJob[]> {
  return asRunner(
    prisma,
    (tx) => tx.$queryRaw<ClaimedJob[]>`
      UPDATE "jobs" SET "status" = 'running', "locked_at" = ${now}, "attempts" = "attempts" + 1
      WHERE "id" IN (
        SELECT "id" FROM "jobs" WHERE "status" = 'queued' AND "run_at" <= ${now}
        ORDER BY "run_at" LIMIT ${limit} FOR UPDATE SKIP LOCKED
      )
      RETURNING "id", "agency_id" AS "agencyId", "name", "payload", "attempts", "max_attempts" AS "maxAttempts"`,
  );
}

/**
 * Jobs left running by a runner that stopped (a restart or a crash) go back to the queue — or become an exception
 * when they have had all their tries.
 */
export function releaseStuckJobs(prisma: PrismaClient, lockedBefore: Date): Promise<number> {
  return asRunner(
    prisma,
    (tx) => tx.$executeRaw`
      UPDATE "jobs" SET
        "status" = CASE WHEN "attempts" >= "max_attempts" THEN 'failed' ELSE 'queued' END,
        "locked_at" = NULL,
        "last_error" = COALESCE("last_error", 'The job runner stopped while this was running.'),
        "finished_at" = CASE WHEN "attempts" >= "max_attempts" THEN now() ELSE NULL END
      WHERE "status" = 'running' AND "locked_at" < ${lockedBefore}`,
  );
}

/** Queues the same jobs for every agency; a key already queued for an agency is left alone. Returns how many were added. */
export function scheduleJobs(prisma: PrismaClient, jobs: ScheduledJob[]): Promise<number> {
  return asRunner(prisma, async (tx) => {
    const agencies = await tx.agency.findMany({ select: { id: true } });
    const data = agencies.flatMap((a) => jobs.map((j) => ({ agencyId: a.id, name: j.name, key: j.key, payload: j.payload as object, runAt: j.runAt })));
    if (!data.length) return 0;
    return (await tx.job.createMany({ data, skipDuplicates: true })).count;
  });
}
