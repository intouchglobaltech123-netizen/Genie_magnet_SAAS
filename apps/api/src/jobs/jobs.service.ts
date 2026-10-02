import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantTx } from "@gm/db";
import { DAILY_JOBS, JOB_NAMES, type JobName, type JobStatus } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

type Row = {
  id: string;
  name: string;
  status: string;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  runAt: Date;
  lastError: string | null;
  result: unknown;
  createdAt: Date;
  finishedAt: Date | null;
};

const dateOf = (payload: unknown) => {
  const d = (payload as { date?: unknown } | null)?.date;
  return typeof d === "string" ? d : null;
};

/**
 * The agency's background jobs (ADR 0010): queue one inside the transaction that needs it, see what ran and what
 * failed, and try a failed one again.
 */
@Injectable()
export class JobsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  /**
   * Queues a job in the caller's transaction, so it exists only if the change that needs it is saved. A `key` already
   * queued for the agency is left alone: the same reminder is never queued twice.
   */
  async enqueue(tx: TenantTx, name: JobName, payload: Record<string, unknown>, opts: { key?: string; runAt?: Date; maxAttempts?: number } = {}) {
    await tx.job.createMany({
      data: [
        { agencyId: this.tenant.agencyId, name, payload: payload as Prisma.InputJsonValue, key: opts.key, runAt: opts.runAt, maxAttempts: opts.maxAttempts },
      ],
      skipDuplicates: true,
    });
  }

  private present(j: Row) {
    return {
      id: j.id,
      name: j.name,
      label: JOB_NAMES[j.name as JobName] ?? j.name,
      status: j.status as JobStatus,
      date: dateOf(j.payload),
      attempts: j.attempts,
      maxAttempts: j.maxAttempts,
      runAt: j.runAt.toISOString(),
      lastError: j.lastError,
      result: j.result,
      createdAt: j.createdAt.toISOString(),
      finishedAt: j.finishedAt?.toISOString() ?? null,
    };
  }

  /** The newest first; `failed` lists only the ones that need a look. */
  async list(status?: JobStatus) {
    const rows = await this.tenant.db.job.findMany({ where: status ? { status } : {}, orderBy: { createdAt: "desc" }, take: 100 });
    return rows.map((r) => this.present(r));
  }

  /** How many failed and wait, and the latest run of each daily job. */
  async overview() {
    const [failed, waiting, latest] = await Promise.all([
      this.tenant.db.job.count({ where: { status: "failed" } }),
      this.tenant.db.job.count({ where: { status: { in: ["queued", "running"] } } }),
      Promise.all(DAILY_JOBS.map((name) => this.tenant.db.job.findFirst({ where: { name }, orderBy: { runAt: "desc" } }))),
    ]);
    return {
      failed,
      waiting,
      daily: DAILY_JOBS.map((name, i) => {
        const j = latest[i];
        return {
          name,
          label: JOB_NAMES[name],
          date: j ? dateOf(j.payload) : null,
          status: (j?.status as JobStatus) ?? null,
          finishedAt: j?.finishedAt?.toISOString() ?? null,
        };
      }),
    };
  }

  /** A failed job goes back to the queue with fresh tries. */
  async retry(id: string) {
    const j = await this.tenant.db.job.findFirst({ where: { id } });
    if (!j) throw new NotFoundException("No job with that id.");
    if (j.status !== "failed") throw new ConflictException("Only a failed job can be tried again.");
    await this.tenant.tx(async (tx) => {
      await tx.job.update({ where: { id }, data: { status: "queued", attempts: 0, runAt: new Date(), lockedAt: null, finishedAt: null } });
      await this.audit.record(tx, { action: "retry", entity: "job", entityId: id, after: { name: j.name, date: dateOf(j.payload) } });
    });
    return this.present((await this.tenant.db.job.findFirst({ where: { id } }))!);
  }
}
