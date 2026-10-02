import { Inject, Injectable, Logger, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import { claimJobs, type ClaimedJob, type Prisma, releaseStuckJobs, scheduleJobs, type TenantTx } from "@gm/db";
import { DAILY_JOBS, JOB_NAMES, type JobName, retryDelaySeconds } from "@gm/shared";
import { ENV, type Env } from "../env.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { asSystem, TenantDb } from "../tenancy/tenant-context.js";
import { PaymentsService } from "../payments/payments.service.js";
import { ReportsService } from "../reports/reports.service.js";
import { WhatsAppService } from "../whatsapp/whatsapp.service.js";
import { DailyChecks } from "./daily-checks.service.js";

type Handler = (tx: TenantTx, payload: Record<string, unknown>) => Promise<unknown>;

/** A job left running this long is taken to belong to a runner that stopped. */
const STUCK_MINUTES = 15;
const BATCH = 10;
/** One job's transaction may take this long (the default is 5 seconds). */
const JOB_TIMEOUT_MS = 60_000;

const dayOf = (p: Record<string, unknown>) => {
  if (typeof p.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(p.date)) throw new Error("The job has no valid date.");
  return p.date;
};

/**
 * Runs background jobs (ADR 0010): every few seconds it queues the day's daily jobs for every agency (once an hour is
 * enough to catch new agencies), returns jobs left behind by a stopped runner, and runs whatever is due. Each job runs
 * inside its own agency in one transaction that also marks it done, so its work and its "done" are saved together.
 * A failure is tried again after 1 minute, 5 minutes, 30 minutes and 2 hours; after the last try it stays as failed,
 * the people who may change settings are told, and it can be tried again from Settings → Background jobs.
 */
@Injectable()
export class JobRunner implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger("Jobs");
  private readonly handlers: Record<JobName, Handler>;
  private timer?: NodeJS.Timeout;
  private round?: Promise<number>;
  private scheduledHour = "";

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
    private readonly tenant: TenantDb,
    private readonly notifications: NotificationsService,
    checks: DailyChecks,
    whatsapp: WhatsAppService,
    reports: ReportsService,
    payments: PaymentsService,
  ) {
    this.handlers = {
      "videos.due": (tx, p) => checks.videosDue(tx, dayOf(p)),
      "onboarding.reminders": (tx, p) => checks.onboardingReminders(tx, dayOf(p)),
      "agreements.renewals": (tx, p) => checks.renewals(tx, dayOf(p)),
      "invoices.overdue": (tx, p) => checks.invoicesOverdue(tx, dayOf(p)),
      "cycles.month": (tx, p) => checks.month(tx, dayOf(p)),
      "files.cleanup": (tx) => checks.filesCleanup(tx),
      "whatsapp.send": (tx, p) => whatsapp.send(tx, String(p.messageId)),
      "reports.draft": (tx, p) => reports.draftAll(tx, dayOf(p)),
      "payments.link": (tx, p) => payments.makeLink(tx, String(p.invoiceId)),
      "payments.cancel": (tx, p) => payments.cancelLink(tx, String(p.invoiceId)),
    };
  }

  onApplicationBootstrap() {
    if (!this.env.RUN_JOBS) return;
    this.timer = setInterval(() => void this.tick(), this.env.JOBS_POLL_SECONDS * 1000);
    void this.tick();
    this.log.log(`Running background jobs every ${this.env.JOBS_POLL_SECONDS}s; daily jobs at ${this.env.JOBS_DAILY_AT} UTC`);
  }

  async onApplicationShutdown() {
    clearInterval(this.timer);
    await this.round?.catch(() => 0);
  }

  /** One round (never two at once). Returns how many jobs ran. Tests call it with the time they need. */
  tick(now = new Date()): Promise<number> {
    this.round ??= this.work(now)
      .catch((e: unknown) => {
        this.log.error(`Job round failed: ${e instanceof Error ? e.message : String(e)}`);
        return 0;
      })
      .finally(() => (this.round = undefined));
    return this.round;
  }

  private async work(now: Date) {
    await this.schedule(now);
    await releaseStuckJobs(this.prisma.client, new Date(now.getTime() - STUCK_MINUTES * 60_000));
    let ran = 0;
    for (;;) {
      const jobs = await claimJobs(this.prisma.client, BATCH, now);
      for (const j of jobs) await this.run(j, now);
      ran += jobs.length;
      if (jobs.length < BATCH) return ran;
    }
  }

  /** Today's daily jobs for every agency, due at JOBS_DAILY_AT (at once when that time has passed). */
  private async schedule(now: Date) {
    const hour = now.toISOString().slice(0, 13);
    if (this.scheduledHour === hour) return;
    const day = hour.slice(0, 10);
    const runAt = new Date(`${day}T${this.env.JOBS_DAILY_AT}:00Z`);
    await scheduleJobs(
      this.prisma.client,
      DAILY_JOBS.map((name) => ({ name, key: `${name}:${day}`, payload: { date: day }, runAt })),
    );
    this.scheduledHour = hour;
  }

  private async run(j: ClaimedJob, now: Date) {
    const handler = this.handlers[j.name as JobName] as Handler | undefined;
    const payload = (j.payload ?? {}) as Record<string, unknown>;
    try {
      if (!handler) throw new Error(`There is no job called "${j.name}".`);
      await asSystem(j.agencyId, () =>
        this.tenant.tx(
          async (tx) => {
            const result = await handler(tx, payload);
            await tx.job.update({
              where: { id: j.id },
              data: { status: "done", result: (result ?? {}) as Prisma.InputJsonValue, lockedAt: null, lastError: null, finishedAt: new Date() },
            });
          },
          { timeout: JOB_TIMEOUT_MS },
        ),
      );
    } catch (e) {
      const message = (e instanceof Error ? e.message : String(e)).slice(0, 2000);
      const last = !handler || j.attempts >= j.maxAttempts;
      this.log.warn(`${j.name} for ${j.agencyId} failed (try ${j.attempts} of ${j.maxAttempts}): ${message}`);
      await asSystem(j.agencyId, () =>
        this.tenant.tx(async (tx) => {
          await tx.job.update({
            where: { id: j.id },
            data: last
              ? { status: "failed", lastError: message, lockedAt: null, finishedAt: new Date() }
              : { status: "queued", lastError: message, lockedAt: null, runAt: new Date(now.getTime() + retryDelaySeconds(j.attempts) * 1000) },
          });
          if (last)
            await this.notifications.notify(
              tx,
              { can: { area: "settings", level: "edit" } },
              {
                kind: "job_failed",
                title: `Background work failed: ${JOB_NAMES[j.name as JobName] ?? j.name}`,
                body: message.slice(0, 300),
                link: "/app/settings/jobs",
              },
            );
        }),
      );
    }
  }
}
