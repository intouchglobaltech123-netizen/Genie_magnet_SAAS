import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { TenantTx } from "@gm/db";
import { DONE_STAGES, packageTotals, type DeliverableInput } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const RUNNING = ["active", "renewal_due", "paused"] as const;
const ym = (d: Date) => d.toISOString().slice(0, 7);
const first = (m: string) => new Date(`${m}-01T00:00:00Z`);
const shift = (m: string, by: number) => {
  const d = first(m);
  d.setUTCMonth(d.getUTCMonth() + by);
  return ym(d);
};
export const thisMonth = () => new Date().toISOString().slice(0, 7);

type AgreementForCycle = { id: string; status: string; startDate: Date; endDate: Date; deliverables: unknown };

/**
 * Monthly cycles (P2-01): one per running agreement per month, promising the agreement's videos for the month (plus any
 * carried in). Delivered counts the month's videos that are approved or published. A past month is closed with a decision
 * on any shortfall — carry it to next month, credit it, or the client gives it up — and the numbers are kept.
 */
@Injectable()
export class CyclesService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  /** The agreement's cycle for the month, made the first time it is needed; null when the agreement does not run then. */
  async ensure(tx: TenantTx, a: AgreementForCycle, month: string) {
    if (!(RUNNING as readonly string[]).includes(a.status)) return null;
    if (month < ym(a.startDate) || month > ym(a.endDate)) return null;
    const existing = await tx.cycle.findUnique({ where: { agreementId_month: { agreementId: a.id, month: first(month) } } });
    if (existing) return existing.id;
    const { videosPerMonth } = packageTotals((a.deliverables as DeliverableInput[]) ?? []);
    const created = await tx.cycle.create({ data: { agencyId: this.tenant.agencyId, agreementId: a.id, month: first(month), promised: videosPerMonth } });
    return created.id;
  }

  /** Cycles for every running agreement in the month (done ahead of the month starting). */
  async generate(month: string) {
    const agreements = await this.tenant.db.agreement.findMany({ where: { status: { in: [...RUNNING] } } });
    const made = await this.tenant.tx(async (tx) => {
      let n = 0;
      for (const a of agreements) {
        const before = await tx.cycle.count({ where: { agreementId: a.id, month: first(month) } });
        if ((await this.ensure(tx, a, month)) && !before) n++;
      }
      if (n) await this.audit.record(tx, { action: "generate", entity: "cycle", after: { month, cycles: n } });
      return n;
    });
    return { month, created: made, cycles: await this.list(month) };
  }

  /** The month's cycles with what is delivered, in the making and not started. */
  async list(month = thisMonth()) {
    const rows = await this.tenant.db.cycle.findMany({
      where: { month: first(month) },
      include: {
        agreement: { select: { id: true, title: true, monthlyFee: true, client: { select: { id: true, name: true, code: true } } } },
        videos: { select: { stage: true } },
      },
      orderBy: { agreement: { client: { name: "asc" } } },
    });
    const now = thisMonth();
    return rows.map((c) => {
      const delivered = c.closedAt ? c.delivered : c.videos.filter((v) => (DONE_STAGES as string[]).includes(v.stage)).length;
      const inMaking = c.videos.filter((v) => !(DONE_STAGES as string[]).includes(v.stage) && v.stage !== "planned").length;
      const planned = c.videos.filter((v) => v.stage === "planned").length;
      const m = ym(c.month);
      return {
        id: c.id,
        month: m,
        agreement: { id: c.agreement.id, title: c.agreement.title, monthlyFee: c.agreement.monthlyFee },
        client: c.agreement.client,
        promised: c.promised,
        carriedIn: c.carriedIn,
        delivered,
        inMaking,
        planned,
        notStarted: Math.max(0, c.promised - delivered - inMaking - planned),
        status: c.closedAt ? "closed" : m > now ? "upcoming" : m === now ? "in_progress" : "reconciling",
        decision: c.decision,
        decisionNote: c.decisionNote,
        credit: c.credit,
        closedAt: c.closedAt,
      };
    });
  }

  /** Closes a past month. A shortfall needs a decision: carry it to next month, credit it, or the client gives it up. */
  async close(id: string, input: { decision?: "carry" | "credit" | "forfeit"; note?: string }) {
    const cycle = (await this.list(await this.monthOf(id))).find((c) => c.id === id)!;
    if (cycle.closedAt) throw new ConflictException("This month is already closed.");
    if (cycle.status === "upcoming" || cycle.status === "in_progress") throw new ConflictException("A month is closed once it is over.");
    const shortfall = Math.max(0, cycle.promised - cycle.delivered);
    if (shortfall && !input.decision)
      throw new BadRequestException({
        message: `${shortfall} videos were not delivered — decide what happens to them.`,
        issues: [{ path: "decision", message: "Choose carry, credit or forfeit" }],
      });
    const credit = shortfall && input.decision === "credit" ? Math.round((cycle.agreement.monthlyFee / Math.max(1, cycle.promised)) * shortfall) : null;
    await this.tenant.tx(async (tx) => {
      await tx.cycle.update({
        where: { id },
        data: {
          status: "closed",
          delivered: cycle.delivered,
          decision: shortfall ? input.decision : null,
          decisionNote: input.note ?? null,
          credit,
          closedAt: new Date(),
          closedBy: this.tenant.userId,
        },
      });
      if (shortfall && input.decision === "carry") {
        const a = await tx.agreement.findUniqueOrThrow({ where: { id: cycle.agreement.id } });
        const nextId = await this.ensure(tx, a, shift(cycle.month, 1));
        if (!nextId) throw new ConflictException("The agreement does not run next month — credit the shortfall instead.");
        await tx.cycle.update({ where: { id: nextId }, data: { carriedIn: { increment: shortfall }, promised: { increment: shortfall } } });
      }
      await this.audit.record(tx, {
        action: "close",
        entity: "cycle",
        entityId: id,
        after: {
          client: cycle.client.name,
          month: cycle.month,
          promised: cycle.promised,
          delivered: cycle.delivered,
          decision: shortfall ? input.decision : null,
          credit,
        },
      });
    });
    return (await this.list(cycle.month)).find((c) => c.id === id)!;
  }

  private async monthOf(id: string) {
    const c = await this.tenant.db.cycle.findFirst({ where: { id }, select: { month: true } });
    if (!c) throw new NotFoundException("No cycle with that id.");
    return ym(c.month);
  }
}
