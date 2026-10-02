import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import { DONE_STAGES, type FinanceMonthRow } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { CostingService } from "./costing.service.js";

const DAY = 86_400_000;
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const ym = (d: Date) => d.toISOString().slice(0, 7);
const shift = (m: string, by: number) => {
  const d = utc(`${m}-01`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return ym(d);
};
const valid = (m: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);

/**
 * The month's money (P5-05): contracted, invoiced, earned by delivering, collected and spent, with the margin — and
 * closing a month, which keeps its figures and stops time and expenses dated in it from changing.
 */
@Injectable()
export class FinanceReportService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly costing: CostingService,
  ) {}

  /** The month's figures as they are now. */
  private async live(month: string): Promise<Omit<FinanceMonthRow, "closed" | "closedAt" | "closedBy">> {
    const start = utc(`${month}-01`);
    const end = utc(`${shift(month, 1)}-01`);
    const last = new Date(end.getTime() - DAY);
    const [agreements, invoices, cycles, payments, paidByHand, summary] = await Promise.all([
      this.tenant.db.agreement.findMany({
        where: { status: { in: ["active", "renewal_due", "paused", "ended"] }, startDate: { lte: last }, endDate: { gte: start } },
        select: { monthlyFee: true },
      }),
      this.tenant.db.invoice.findMany({ where: { status: { in: ["sent", "paid"] }, issueDate: { gte: start, lt: end } }, select: { taxable: true } }),
      this.tenant.db.cycle.findMany({
        where: { month: start },
        select: { id: true, promised: true, carriedIn: true, agreement: { select: { monthlyFee: true } } },
      }),
      this.tenant.db.payment.aggregate({ where: { paidAt: { gte: start, lt: end } }, _sum: { amount: true } }),
      this.tenant.db.invoice.findMany({ where: { status: "paid", paidOn: { gte: start, lt: end } }, select: { id: true, total: true } }),
      this.costing.summary(month),
    ]);
    const delivered = cycles.length
      ? await this.tenant.db.video.groupBy({
          by: ["cycleId"],
          where: { cycleId: { in: cycles.map((c) => c.id) }, stage: { in: [...DONE_STAGES] } },
          _count: { _all: true },
        })
      : [];
    // Paid by hand: invoices marked paid with no online payment recorded.
    const online = paidByHand.length
      ? new Set(
          (await this.tenant.db.payment.findMany({ where: { invoiceId: { in: paidByHand.map((i) => i.id) } }, select: { invoiceId: true } })).map(
            (p) => p.invoiceId,
          ),
        )
      : new Set<string>();
    const earned = cycles.reduce((n, c) => {
      const promised = c.promised + c.carriedIn;
      const done = delivered.find((d) => d.cycleId === c.id)?._count._all ?? 0;
      return n + (promised ? c.agreement.monthlyFee * Math.min(1, done / promised) : c.agreement.monthlyFee);
    }, 0);
    const costs = summary.totalCost;
    return {
      month,
      contracted: agreements.reduce((n, a) => n + a.monthlyFee, 0),
      invoiced: invoices.reduce((n, i) => n + i.taxable, 0),
      earned: Math.round(earned),
      collected: (payments._sum.amount ?? 0) + paidByHand.filter((i) => !online.has(i.id)).reduce((n, i) => n + i.total, 0),
      costs,
      margin: Math.round(earned) - costs,
      marginPct: earned ? Math.round(((earned - costs) / earned) * 100) : null,
    };
  }

  /** Months from `from` to `to` (at most 24), newest first; closed months as they were closed. */
  async report(from: string, to: string): Promise<FinanceMonthRow[]> {
    if (!valid(from) || !valid(to) || from > to) throw new BadRequestException("Give from and to months as YYYY-MM, from first.");
    const months: string[] = [];
    for (let m = to; m >= from && months.length < 24; m = shift(m, -1)) months.push(m);
    const periods = await this.tenant.db.financialPeriod.findMany({ where: { month: { in: months.map((m) => utc(`${m}-01`)) } } });
    const names = await this.tenant.db.user.findMany({
      where: { id: { in: periods.map((p) => p.closedBy).filter((x): x is string => !!x) } },
      select: { id: true, name: true },
    });
    const rows: FinanceMonthRow[] = [];
    for (const month of months) {
      const p = periods.find((x) => ym(x.month) === month);
      const closed = p?.status === "closed";
      const figures = closed ? (p.figures as unknown as Omit<FinanceMonthRow, "closed" | "closedAt" | "closedBy">) : await this.live(month);
      rows.push({
        ...figures,
        month,
        closed,
        closedAt: closed ? p.closedAt.toISOString() : null,
        closedBy: closed ? (names.find((n) => n.id === p.closedBy)?.name ?? null) : null,
      });
    }
    return rows;
  }

  /** Closes a month that has ended: its figures are kept as they are now. */
  async close(month: string) {
    if (!valid(month)) throw new BadRequestException("Give the month as YYYY-MM.");
    if (month >= new Date().toISOString().slice(0, 7)) throw new ConflictException("Only a month that has ended is closed.");
    const existing = await this.tenant.db.financialPeriod.findFirst({ where: { month: utc(`${month}-01`) } });
    if (existing?.status === "closed") throw new ConflictException("This month is already closed.");
    const figures = (await this.live(month)) as unknown as Prisma.InputJsonValue;
    await this.tenant.tx(async (tx) => {
      const data = { status: "closed", figures, closedBy: this.tenant.userId, closedAt: new Date(), reopenedBy: null, reopenedAt: null, reopenReason: null };
      if (existing) await tx.financialPeriod.update({ where: { id: existing.id }, data });
      else await tx.financialPeriod.create({ data: { agencyId: this.tenant.agencyId, month: utc(`${month}-01`), ...data } });
      await this.audit.record(tx, { action: "close", entity: "financial_period", after: { month } });
    });
    return (await this.report(month, month))[0]!;
  }

  async reopen(month: string, reason: string) {
    const existing = valid(month) ? await this.tenant.db.financialPeriod.findFirst({ where: { month: utc(`${month}-01`), status: "closed" } }) : null;
    if (!existing) throw new NotFoundException("That month is not closed.");
    await this.tenant.tx(async (tx) => {
      await tx.financialPeriod.update({
        where: { id: existing.id },
        data: { status: "open", reopenedBy: this.tenant.userId, reopenedAt: new Date(), reopenReason: reason },
      });
      await this.audit.record(tx, { action: "reopen", entity: "financial_period", after: { month, reason } });
    });
    return (await this.report(month, month))[0]!;
  }
}
