import { Injectable } from "@nestjs/common";
import type { CascadeInputs, CascadeView, GoalMetric } from "@gm/shared";
import { TenantDb } from "../tenancy/tenant-context.js";

const DAY = 86_400_000;
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const round2 = (n: number) => Math.round(n * 100) / 100;
type Deliverable = { perMonth: number; kind?: string };

/**
 * The figures goals follow (P5-13), from a goal's start to today, and the revenue cascade's inputs as the agency's
 * own last year has them.
 */
@Injectable()
export class GoalMetrics {
  constructor(private readonly tenant: TenantDb) {}

  /** A figure from `from` to `to` (both days included). */
  async figure(metric: GoalMetric, from: string, to: string): Promise<number> {
    const a = utc(from);
    const b = new Date(utc(to).getTime() + DAY);
    const db = this.tenant.db;
    switch (metric) {
      case "invoiced":
        return (
          (await db.invoice.aggregate({ where: { status: { in: ["sent", "paid"] }, issueDate: { gte: a, lt: b } }, _sum: { taxable: true } }))._sum.taxable ?? 0
        );
      case "collected": {
        const [online, paid] = await Promise.all([
          db.payment.aggregate({ where: { paidAt: { gte: a, lt: b } }, _sum: { amount: true } }),
          db.invoice.findMany({ where: { status: "paid", paidOn: { gte: a, lt: b } }, select: { id: true, total: true } }),
        ]);
        // Paid by hand: invoices marked paid with no online payment recorded.
        const withPayment = new Set(
          paid.length
            ? (await db.payment.findMany({ where: { invoiceId: { in: paid.map((i) => i.id) } }, select: { invoiceId: true } })).map((p) => p.invoiceId)
            : [],
        );
        return (online._sum.amount ?? 0) + paid.filter((i) => !withPayment.has(i.id)).reduce((s, i) => s + i.total, 0);
      }
      case "contracted_monthly": {
        const now = utc(to);
        const running = await db.agreement.findMany({
          where: { status: { in: ["active", "renewal_due"] }, startDate: { lte: now }, endDate: { gte: now } },
          select: { monthlyFee: true },
        });
        return running.reduce((s, r) => s + r.monthlyFee, 0);
      }
      case "clients_won":
        return db.proposal.count({ where: { status: "accepted", decidedAt: { gte: a, lt: b } } });
      case "proposals_sent":
        return db.proposal.count({ where: { sentAt: { gte: a, lt: b } } });
      case "leads":
        return db.lead.count({ where: { createdAt: { gte: a, lt: b } } });
      case "videos_approved": {
        const firsts = await db.videoStageChange.groupBy({ by: ["videoId"], where: { to: "approved" }, _min: { at: true } });
        return firsts.filter((f) => f._min.at && f._min.at >= a && f._min.at < b).length;
      }
      case "headcount":
        return db.membership.count({ where: { agencyId: this.tenant.agencyId } });
    }
  }

  /** The cascade's inputs from the last twelve months, each with how it was found. */
  /**
   * The cascade's figures from the agency's own year; where the app has no history yet, from what the agency
   * questionnaire says (this year's revenue so far and target, and its customers' average billing).
   */
  async history(
    revenueTarget: number | null,
    today: string,
    stated: { target: number | null; current: number | null; avgBilling: number | null } = { target: null, current: null, avgBilling: null },
  ): Promise<Pick<CascadeView, "history" | "basis">> {
    const db = this.tenant.db;
    const now = utc(today);
    const yearAgo = new Date(now.getTime() - 365 * DAY);
    const quarterAgo = new Date(now.getTime() - 90 * DAY);
    const [running, ended, newDeals, decided, leads, editing, approvedRecently] = await Promise.all([
      db.agreement.findMany({
        where: { status: { in: ["active", "renewal_due"] }, startDate: { lte: now }, endDate: { gte: now } },
        select: { monthlyFee: true, deliverables: true },
      }),
      db.agreement.findMany({ where: { endDate: { gte: yearAgo, lt: now }, status: { in: ["ended", "active", "renewal_due"] } }, select: { id: true } }),
      db.agreement.findMany({ where: { createdAt: { gte: yearAgo }, renewsId: null, status: { not: "draft" } }, select: { monthlyFee: true } }),
      db.proposal.groupBy({ by: ["status"], where: { decidedAt: { gte: yearAgo }, status: { in: ["accepted", "declined"] } }, _count: { _all: true } }),
      db.lead.findMany({ where: { createdAt: { gte: yearAgo } }, select: { id: true, _count: { select: { proposals: true } } } }),
      db.videoTimeLog.groupBy({ by: ["userId"], where: { date: { gte: quarterAgo } }, _sum: { minutes: true } }),
      db.videoStageChange.groupBy({ by: ["videoId"], where: { to: "approved", at: { gte: quarterAgo } }, _min: { at: true } }),
    ]);
    const basis: CascadeView["basis"] = {};
    const usual = "No history yet — a usual figure; change it";

    let baseBook = running.reduce((s, r) => s + r.monthlyFee, 0) * 12;
    basis.baseBook = `${running.length} running ${running.length === 1 ? "agreement" : "agreements"}, for a year`;
    if (!running.length && stated.current) {
      baseBook = stated.current;
      basis.baseBook = "The agency questionnaire: this year's revenue so far, for a year";
    }

    let retention = 0.85;
    if (ended.length) {
      const renewed = await db.agreement.count({ where: { renewsId: { in: ended.map((e) => e.id) } } });
      retention = round2(renewed / ended.length);
      basis.retention = `${renewed} of ${ended.length} agreements that ended in the last year renewed`;
    } else basis.retention = usual;
    basis.churn = usual;

    let avgDeal = 300_000;
    if (newDeals.length) {
      avgDeal = Math.round((newDeals.reduce((s, d) => s + d.monthlyFee, 0) / newDeals.length) * 12);
      basis.avgDeal = `${newDeals.length} new ${newDeals.length === 1 ? "client" : "clients"} in the last year, for a year`;
    } else if (stated.avgBilling) {
      avgDeal = stated.avgBilling;
      basis.avgDeal = "The agency questionnaire: its customers' average billing a year";
    } else basis.avgDeal = usual;

    const won = decided.find((d) => d.status === "accepted")?._count._all ?? 0;
    const lost = decided.find((d) => d.status === "declined")?._count._all ?? 0;
    let winRate = 0.25;
    if (won + lost) {
      winRate = round2(Math.max(0.01, won / (won + lost)));
      basis.winRate = `${won} of ${won + lost} proposals decided in the last year were accepted`;
    } else basis.winRate = usual;

    let proposalRate = 0.3;
    if (leads.length) {
      const proposed = leads.filter((l) => l._count.proposals > 0).length;
      proposalRate = round2(Math.max(0.01, proposed / leads.length));
      basis.proposalRate = `${proposed} of ${leads.length} leads in the last year got a proposal`;
    } else basis.proposalRate = usual;
    basis.costPerLead = "What a lead costs you in advertising — enter it";

    const editors = editing.length || 1;
    const minutes = editing.reduce((s, e) => s + (e._sum.minutes ?? 0), 0);
    const productiveHours = editing.length ? Math.round(minutes / 60 / 3 / editing.length) || 150 : 150;
    basis.editors = editing.length ? `${editing.length} logged editing time in the last three months` : usual;
    basis.productiveHours = editing.length ? "Editing hours logged a month each, over the last three months" : usual;

    let hoursPerVideo = 6;
    const approved = approvedRecently.filter((v) => v._min.at && v._min.at >= quarterAgo).map((v) => v.videoId);
    if (approved.length) {
      const spent = await db.videoTimeLog.aggregate({ where: { videoId: { in: approved } }, _sum: { minutes: true } });
      const h = (spent._sum.minutes ?? 0) / 60 / approved.length;
      if (h > 0) {
        hoursPerVideo = round2(h);
        basis.hoursPerVideo = `Editing time on the ${approved.length} videos approved in the last three months`;
      }
    }
    basis.hoursPerVideo ??= usual;

    const perClient = running.map((r) => (r.deliverables as Deliverable[]).filter((d) => (d.kind ?? "video") === "video").reduce((s, d) => s + d.perMonth, 0));
    const currentLoad = perClient.reduce((s, n) => s + n, 0);
    const videosPerClient = perClient.length ? round2(currentLoad / perClient.length) : 8;
    basis.currentLoad = `Videos a month promised across the ${running.length} running agreements`;
    basis.videosPerClient = perClient.length ? "The running agreements' average" : usual;

    basis.revenueTarget = revenueTarget
      ? "The company's revenue goal"
      : stated.target
        ? "The agency questionnaire: this year's revenue target"
        : "No company revenue goal yet — a quarter more than the book";
    const history: CascadeInputs = {
      revenueTarget: revenueTarget ?? stated.target ?? Math.round(baseBook * 1.25),
      baseBook,
      retention,
      churn: 0.05,
      avgDeal,
      winRate,
      proposalRate,
      costPerLead: 0,
      editors,
      productiveHours,
      hoursPerVideo,
      videosPerClient,
      currentLoad,
    };
    return { history, basis };
  }
}
