import { Injectable } from "@nestjs/common";
import type { AgeingBuckets, AgeingReport } from "@gm/shared";
import { InvoicesService } from "../invoices/invoices.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const DAY = 86_400_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const ym = (d: Date) => d.toISOString().slice(0, 7);
const shift = (m: string, by: number) => {
  const d = new Date(`${m}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + by);
  return ym(d);
};
const monthsBetween = (a: string, b: string) => (Number(b.slice(0, 4)) - Number(a.slice(0, 4))) * 12 + Number(b.slice(5, 7)) - Number(a.slice(5, 7));
const zero = (): AgeingBuckets => ({ notDue: 0, d1to30: 0, d31to60: 0, d61to90: 0, over90: 0, total: 0 });

/** Which month an agreement bills on a day, and for how many months, from its billing terms — or nothing. */
export function billingDue(a: { billing: string; startDate: Date; endDate: Date }, date: string): { period: string; months: number } | null {
  const b = a.billing.toLowerCase();
  const month = date.slice(0, 7);
  const start = ym(a.startDate);
  const end = ym(a.endDate);
  if (/quarter/.test(b) && /advance/.test(b)) {
    const n = monthsBetween(start, month);
    if (n < 0 || n % 3 !== 0 || month > end || date < day(a.startDate)) return null;
    return { period: month, months: Math.min(3, monthsBetween(month, end) + 1) };
  }
  if (/month/.test(b) && /arrear/.test(b)) {
    const prev = shift(month, -1);
    return prev >= start && prev <= end ? { period: prev, months: 1 } : null;
  }
  if (/month/.test(b) && /advance/.test(b)) {
    if (month < start || month > end || date < day(a.startDate)) return null;
    return { period: month, months: 1 };
  }
  // Other terms (a 50% advance, a one-off) are invoiced by hand.
  return null;
}

/**
 * Collections (P5-04): each agreement's invoice is drafted by itself on its billing day — monthly or quarterly in
 * advance, monthly in arrears — for finance to check and issue (job `invoices.schedule`, when the agency leaves it on);
 * and the ageing of what clients owe.
 */
@Injectable()
export class CollectionsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly invoices: InvoicesService,
  ) {}

  /** The drafts due on a day. Each runs in its own transaction, so one agreement's problem does not hold the others. */
  async draftDue(date: string) {
    const settings = await this.tenant.db.invoiceSettings.findUnique({ where: { agencyId: this.tenant.agencyId }, select: { autoDraft: true } });
    if (!settings) return { skipped: "no invoice settings yet" };
    if (!settings.autoDraft) return { skipped: "switched off" };
    const agreements = await this.tenant.db.agreement.findMany({
      where: { status: { in: ["active", "renewal_due"] } },
      select: { id: true, billing: true, startDate: true, endDate: true, title: true },
    });
    let made = 0;
    const problems: string[] = [];
    for (const a of agreements) {
      const due = billingDue(a, date);
      if (!due) continue;
      const exists = await this.tenant.db.invoice.findFirst({
        where: { agreementId: a.id, period: due.period, status: { not: "cancelled" } },
        select: { id: true },
      });
      if (exists) continue;
      try {
        await this.invoices.fromAgreement(a.id, due.period, due.months);
        made++;
      } catch (e) {
        problems.push(`${a.title}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
    return { made, problems: problems.slice(0, 10) };
  }

  async ageing(): Promise<AgeingReport> {
    const invoices = await this.tenant.db.invoice.findMany({
      where: { status: "sent" },
      select: {
        id: true,
        number: true,
        total: true,
        dueDate: true,
        payLinkUrl: true,
        payLinkStatus: true,
        client: {
          select: {
            id: true,
            name: true,
            code: true,
            contacts: { where: { approver: true }, select: { name: true, phone: true }, orderBy: { name: "asc" }, take: 1 },
          },
        },
      },
      orderBy: { dueDate: "asc" },
    });
    const paid = invoices.length
      ? await this.tenant.db.payment.groupBy({ by: ["invoiceId"], where: { invoiceId: { in: invoices.map((i) => i.id) } }, _sum: { amount: true } })
      : [];
    const today = new Date(`${day(new Date())}T00:00:00Z`).getTime();
    const totals = zero();
    const byClient = new Map<string, AgeingReport["clients"][number]>();
    for (const i of invoices) {
      const balance = i.total - (paid.find((p) => p.invoiceId === i.id)?._sum.amount ?? 0);
      if (balance <= 0) continue;
      const late = i.dueDate ? Math.floor((today - i.dueDate.getTime()) / DAY) : 0;
      const bucket: keyof AgeingBuckets = late <= 0 ? "notDue" : late <= 30 ? "d1to30" : late <= 60 ? "d31to60" : late <= 90 ? "d61to90" : "over90";
      let row = byClient.get(i.client.id);
      if (!row) {
        row = { client: { id: i.client.id, name: i.client.name, code: i.client.code }, contact: i.client.contacts[0] ?? null, buckets: zero(), invoices: [] };
        byClient.set(i.client.id, row);
      }
      for (const b of [row.buckets, totals]) {
        b[bucket] += balance;
        b.total += balance;
      }
      row.invoices.push({
        id: i.id,
        number: i.number,
        balance,
        dueDate: i.dueDate ? day(i.dueDate) : null,
        daysOverdue: Math.max(0, late),
        payUrl: i.payLinkStatus === "created" ? i.payLinkUrl : null,
      });
    }
    return { totals, clients: [...byClient.values()].sort((a, b) => b.buckets.total - a.buckets.total) };
  }
}
