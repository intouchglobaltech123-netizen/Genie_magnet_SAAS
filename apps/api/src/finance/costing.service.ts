import { BadRequestException, Injectable } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import {
  type ClientCostRow,
  type CostBreakdown,
  type CostingSummary,
  type CostRateInput,
  type CostRateRow,
  type CostSettings,
  type CostSettingsInput,
  perHourCost,
  type VideoCostRow,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { ProductionSettingsService } from "../production/production-settings.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const DAY = 86_400_000;
const IST = 330 * 60_000;
const day = (d: Date) => d.toISOString().slice(0, 10);
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const round = (n: number) => Math.round(n);
const RUNNING = ["active", "renewal_due", "paused", "ended"] as const;

type Rate = { monthlyCost: number; hoursPerMonth: number; effectiveFrom: Date };
type Log = { userId: string; date: Date; minutes: number };

const empty = (): CostBreakdown => ({ labour: 0, shoots: 0, expenses: 0, overhead: 0, total: 0, rework: 0, hours: 0 });
const finish = (c: CostBreakdown): CostBreakdown => {
  const r = { ...c, labour: round(c.labour), shoots: round(c.shoots), expenses: round(c.expenses), overhead: round(c.overhead), rework: round(c.rework) };
  return { ...r, total: r.labour + r.shoots + r.expenses + r.overhead, hours: Math.round(c.hours * 10) / 10 };
};

function monthRange(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new BadRequestException("Give the month as YYYY-MM.");
  const start = utc(`${month}-01`);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return { start, end, last: new Date(end.getTime() - DAY) };
}

/**
 * True costing (P5-01, P5-03): what each video and client really costs. Labour is the time logged on it at each
 * person's cost rate on that day; a shoot's crew time and kit are shared across its videos — the kit at its items' cost
 * per hour for the hours recorded when they came back from the shoot (P5-20), or else its kit list's day rate; approved expenses
 * go to the video or client they are for; overheads (the month's figure plus unallocated expenses) are shared by hours.
 * Time logged while a video was in revision is shown as rework. Revenue is the agreement's monthly fee — per video,
 * shared across the month's promised videos.
 */
@Injectable()
export class CostingService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly production: ProductionSettingsService,
  ) {}

  // ─── Rates and settings ─────────────────────────────────────────────

  async rates(): Promise<CostRateRow[]> {
    const [members, rows] = await Promise.all([
      this.tenant.db.membership.findMany({ where: { agencyId: this.tenant.agencyId }, select: { role: true, user: { select: { id: true, name: true } } } }),
      this.tenant.db.personCostRate.findMany({ orderBy: { effectiveFrom: "desc" } }),
    ]);
    const today = utc(day(new Date()));
    return members
      .map((m) => {
        const history = rows.filter((r) => r.userId === m.user.id);
        const current = history.find((r) => r.effectiveFrom <= today) ?? null;
        return {
          user: { id: m.user.id, name: m.user.name, role: m.role },
          hourly: current ? round(current.monthlyCost / current.hoursPerMonth) : null,
          current: current ? { monthlyCost: current.monthlyCost, hoursPerMonth: current.hoursPerMonth, effectiveFrom: day(current.effectiveFrom) } : null,
          history: history.map((r) => ({ monthlyCost: r.monthlyCost, hoursPerMonth: r.hoursPerMonth, effectiveFrom: day(r.effectiveFrom) })),
        };
      })
      .sort((a, b) => a.user.name.localeCompare(b.user.name));
  }

  /** A person's cost from a day on (replacing one set for the same day). The audit log records that it changed, not the amount. */
  async setRate(userId: string, input: CostRateInput) {
    const member = await this.tenant.db.membership.findFirst({
      where: { agencyId: this.tenant.agencyId, userId },
      select: { user: { select: { name: true } } },
    });
    if (!member) throw new BadRequestException("That person is not in this agency.");
    const effectiveFrom = utc(input.effectiveFrom);
    await this.tenant.tx(async (tx) => {
      await tx.personCostRate.upsert({
        where: { agencyId_userId_effectiveFrom: { agencyId: this.tenant.agencyId, userId, effectiveFrom } },
        create: {
          agencyId: this.tenant.agencyId,
          userId,
          monthlyCost: input.monthlyCost,
          hoursPerMonth: input.hoursPerMonth,
          effectiveFrom,
          createdBy: this.tenant.userId,
        },
        update: { monthlyCost: input.monthlyCost, hoursPerMonth: input.hoursPerMonth },
      });
      await this.audit.record(tx, { action: "update", entity: "cost_rate", entityId: userId, after: { person: member.user.name, from: input.effectiveFrom } });
    });
    return this.rates();
  }

  async settings(): Promise<CostSettings> {
    const [row, p] = await Promise.all([this.tenant.db.costSettings.findUnique({ where: { agencyId: this.tenant.agencyId } }), this.production.get()]);
    const rates = (row?.kitRates ?? {}) as Record<string, number>;
    return { kits: p.kits.map((k) => ({ key: k.key, name: k.name, dailyRate: rates[k.key] ?? 0 })), monthlyOverhead: row?.monthlyOverhead ?? 0 };
  }

  async updateSettings(input: CostSettingsInput) {
    const before = await this.settings();
    const data = { kitRates: input.kitRates as Prisma.InputJsonValue, monthlyOverhead: input.monthlyOverhead };
    await this.tenant.tx(async (tx) => {
      await tx.costSettings.upsert({ where: { agencyId: this.tenant.agencyId }, create: { agencyId: this.tenant.agencyId, ...data }, update: data });
      await this.audit.record(tx, {
        action: "update",
        entity: "cost_settings",
        before: { monthlyOverhead: before.monthlyOverhead, kitRates: Object.fromEntries(before.kits.map((k) => [k.key, k.dailyRate])) },
        after: { monthlyOverhead: input.monthlyOverhead, kitRates: input.kitRates },
      });
    });
    return this.settings();
  }

  // ─── The month's costs ──────────────────────────────────────────────

  private async compute(month: string) {
    const { start, end, last } = monthRange(month);
    const [settingsRow, rateRows, cycles, monthVideoLogs, monthShootLogs, monthExpenses, agreements, monthShoots] = await Promise.all([
      this.tenant.db.costSettings.findUnique({ where: { agencyId: this.tenant.agencyId } }),
      this.tenant.db.personCostRate.findMany({ orderBy: { effectiveFrom: "desc" } }),
      this.tenant.db.cycle.findMany({
        where: { month: start },
        select: { id: true, promised: true, carriedIn: true, agreement: { select: { monthlyFee: true } } },
      }),
      this.tenant.db.videoTimeLog.findMany({ where: { date: { gte: start, lt: end } }, select: { videoId: true, userId: true, date: true, minutes: true } }),
      this.tenant.db.shootTimeLog.findMany({ where: { date: { gte: start, lt: end } }, select: { shootId: true, userId: true, date: true, minutes: true } }),
      this.tenant.db.expense.findMany({
        where: { status: "approved", date: { gte: start, lt: end } },
        select: { amount: true, videoId: true, clientId: true },
      }),
      this.tenant.db.agreement.findMany({
        where: { status: { in: [...RUNNING] }, startDate: { lte: last }, endDate: { gte: start } },
        select: { clientId: true, monthlyFee: true, package: { select: { name: true } } },
      }),
      this.tenant.db.shoot.findMany({ where: { date: { gte: start, lt: end } }, select: { id: true, kit: true, date: true } }),
    ]);
    const kitRates = (settingsRow?.kitRates ?? {}) as Record<string, number>;
    const ratesOf = new Map<string, Rate[]>();
    for (const r of rateRows) ratesOf.set(r.userId, [...(ratesOf.get(r.userId) ?? []), r]);
    const rateOn = (l: Log) => ratesOf.get(l.userId)?.find((r) => r.effectiveFrom <= l.date);
    /** Rupees for a piece of logged time, at the person's rate on its day (nothing without a rate). */
    const cost = (l: Log) => {
      const rate = rateOn(l);
      return rate ? (rate.monthlyCost / rate.hoursPerMonth) * (l.minutes / 60) : 0;
    };
    /** Hours logged in the month by people without a rate on that day. */
    const missing = new Map<string, number>();
    for (const l of [...monthVideoLogs, ...monthShootLogs]) if (!rateOn(l)) missing.set(l.userId, (missing.get(l.userId) ?? 0) + l.minutes / 60);

    // The videos of the month: in its cycles, or worked on in it.
    const videoIds = new Set(monthVideoLogs.map((l) => l.videoId));
    const videos = await this.tenant.db.video.findMany({
      where: { OR: [{ cycleId: { in: cycles.map((c) => c.id) } }, { id: { in: [...videoIds] } }] },
      select: { id: true, code: true, title: true, stage: true, cycleId: true, shootId: true, client: { select: { id: true, name: true, code: true } } },
    });
    const ids = videos.map((v) => v.id);
    const shootIds = [...new Set([...videos.map((v) => v.shootId).filter((x): x is string => !!x), ...monthShootLogs.map((l) => l.shootId)])];
    const [allVideoLogs, changes, shoots, shootVideos, allShootLogs, videoExpenses, kitUse] = await Promise.all([
      this.tenant.db.videoTimeLog.findMany({ where: { videoId: { in: ids } }, select: { videoId: true, userId: true, date: true, minutes: true } }),
      this.tenant.db.videoStageChange.findMany({ where: { videoId: { in: ids } }, orderBy: { at: "asc" }, select: { videoId: true, to: true, at: true } }),
      this.tenant.db.shoot.findMany({ where: { id: { in: shootIds } }, select: { id: true, kit: true, date: true, status: true, clientId: true } }),
      this.tenant.db.video.groupBy({ by: ["shootId"], where: { shootId: { in: shootIds } }, _count: { _all: true } }),
      this.tenant.db.shootTimeLog.findMany({ where: { shootId: { in: shootIds } }, select: { shootId: true, userId: true, date: true, minutes: true } }),
      this.tenant.db.expense.findMany({ where: { status: "approved", videoId: { in: ids } }, select: { amount: true, videoId: true } }),
      this.tenant.db.assetCustody.findMany({
        where: { shootId: { in: [...shootIds, ...monthShoots.map((s) => s.id)] }, returnedAt: { not: null }, minutes: { not: null } },
        select: {
          shootId: true,
          minutes: true,
          asset: { select: { purchaseDate: true, purchaseValue: true, residualValue: true, usefulLifeYears: true, hoursPerYear: true } },
        },
      }),
    ]);

    // Overheads for the month, shared by every hour logged in it.
    const hours = [...monthVideoLogs, ...monthShootLogs].reduce((n, l) => n + l.minutes / 60, 0);
    const overheads = (settingsRow?.monthlyOverhead ?? 0) + monthExpenses.filter((e) => !e.videoId && !e.clientId).reduce((n, e) => n + e.amount, 0);
    const perHour = hours ? overheads / hours : 0;

    // The kit items checked out for a shoot and back, at their cost per hour for the hours recorded.
    const registerKit = new Map<string, number>();
    for (const c of kitUse) {
      const hourly = perHourCost({ ...c.asset, purchaseDate: day(c.asset.purchaseDate) }) ?? 0;
      registerKit.set(c.shootId!, (registerKit.get(c.shootId!) ?? 0) + (hourly * c.minutes!) / 60);
    }
    /** A shoot's kit, once its day has come in India: what its items' use cost, or else its kit list's day rate. */
    const kitOf = (s: { id: string; kit: string; date: Date }) => (s.date.getTime() <= Date.now() + IST ? (registerKit.get(s.id) ?? kitRates[s.kit] ?? 0) : 0);
    // A shoot's whole cost (crew time and kit), and its share per video.
    const shootCost = new Map<string, { cost: number; hours: number }>();
    for (const s of shoots) {
      const logs = allShootLogs.filter((l) => l.shootId === s.id);
      const kit = kitOf(s);
      shootCost.set(s.id, { cost: logs.reduce((n, l) => n + cost(l), 0) + kit, hours: logs.reduce((n, l) => n + l.minutes / 60, 0) });
    }
    const perShootVideo = (shootId: string) => Math.max(1, shootVideos.find((g) => g.shootId === shootId)?._count._all ?? 1);

    // When each video was in revision, to tell rework apart.
    const revision = new Map<string, [Date, Date][]>();
    for (const v of ids) {
      const cs = changes.filter((c) => c.videoId === v);
      const spans: [Date, Date][] = [];
      cs.forEach((c, i) => {
        if (c.to === "revision") spans.push([utc(day(c.at)), utc(day(cs[i + 1]?.at ?? new Date(8.64e15)))]);
      });
      revision.set(v, spans);
    }
    const inRevision = (videoId: string, d: Date) => (revision.get(videoId) ?? []).some(([a, b]) => d >= a && d <= b);

    // A client's own expenses are shared across its videos of the month.
    const clientVideos = new Map<string, number>();
    for (const v of videos) clientVideos.set(v.client.id, (clientVideos.get(v.client.id) ?? 0) + 1);
    const clientShared = (clientId: string) =>
      monthExpenses.filter((e) => !e.videoId && e.clientId === clientId).reduce((n, e) => n + e.amount, 0) / Math.max(1, clientVideos.get(clientId) ?? 1);

    const videoRows: VideoCostRow[] = videos.map((v) => {
      const c = empty();
      for (const l of allVideoLogs.filter((x) => x.videoId === v.id)) {
        const rupees = cost(l);
        c.labour += rupees;
        c.hours += l.minutes / 60;
        if (inRevision(v.id, l.date)) c.rework += rupees;
      }
      if (v.shootId && shootCost.has(v.shootId)) {
        const s = shootCost.get(v.shootId)!;
        c.shoots += s.cost / perShootVideo(v.shootId);
        c.hours += s.hours / perShootVideo(v.shootId);
      }
      c.expenses = videoExpenses.filter((e) => e.videoId === v.id).reduce((n, e) => n + e.amount, 0) + clientShared(v.client.id);
      c.overhead = c.hours * perHour;
      const cycle = cycles.find((x) => x.id === v.cycleId);
      const promised = cycle ? cycle.promised + cycle.carriedIn : 0;
      const revenue = cycle && promised ? round(cycle.agreement.monthlyFee / promised) : null;
      const totals = finish(c);
      return {
        id: v.id,
        code: v.code,
        title: v.title,
        stage: v.stage,
        client: v.client,
        ...totals,
        revenue,
        margin: revenue === null ? null : revenue - totals.total,
      };
    });

    // Each client's month: what it pays, and what was spent on it in the month.
    const clientIds = new Set([...agreements.map((a) => a.clientId), ...videos.map((v) => v.client.id), ...shoots.map((s) => s.clientId)]);
    const clientInfo = await this.tenant.db.client.findMany({ where: { id: { in: [...clientIds] } }, select: { id: true, name: true, code: true } });
    const videoClient = new Map(videos.map((v) => [v.id, v.client.id]));
    const clientRows: ClientCostRow[] = clientInfo
      .map((cl) => {
        const c = empty();
        for (const l of monthVideoLogs.filter((x) => videoClient.get(x.videoId) === cl.id)) {
          const rupees = cost(l);
          c.labour += rupees;
          c.hours += l.minutes / 60;
          if (inRevision(l.videoId, l.date)) c.rework += rupees;
        }
        for (const s of shoots.filter((x) => x.clientId === cl.id)) {
          const logs = monthShootLogs.filter((l) => l.shootId === s.id);
          c.shoots += logs.reduce((n, l) => n + cost(l), 0) + (s.date >= start && s.date < end ? kitOf(s) : 0);
          c.hours += logs.reduce((n, l) => n + l.minutes / 60, 0);
        }
        c.expenses = monthExpenses.filter((e) => e.clientId === cl.id).reduce((n, e) => n + e.amount, 0);
        c.overhead = c.hours * perHour;
        const mine = agreements.filter((a) => a.clientId === cl.id);
        const revenue = mine.reduce((n, a) => n + a.monthlyFee, 0);
        const totals = finish(c);
        return {
          client: cl,
          package: mine.find((a) => a.package)?.package?.name ?? null,
          ...totals,
          revenue,
          margin: revenue - totals.total,
          marginPct: revenue ? Math.round(((revenue - totals.total) / revenue) * 100) : null,
          videos: videos.filter((v) => v.client.id === cl.id).length,
        };
      })
      .filter((r) => r.revenue || r.total)
      .sort((a, b) => a.client.name.localeCompare(b.client.name));

    const people = missing.size ? await this.tenant.db.user.findMany({ where: { id: { in: [...missing.keys()] } }, select: { id: true, name: true } }) : [];
    // Everything the month cost: all time logged in it, the kit of its shoots, its approved expenses and overheads.
    const totalCost =
      [...monthVideoLogs, ...monthShootLogs].reduce((n, l) => n + cost(l), 0) +
      monthShoots.reduce((n, s) => n + kitOf(s), 0) +
      monthExpenses.reduce((n, e) => n + e.amount, 0) +
      (settingsRow?.monthlyOverhead ?? 0);
    const summary: CostingSummary = {
      month,
      missingRates: people.map((p) => ({ id: p.id, name: p.name, hours: Math.round((missing.get(p.id) ?? 0) * 10) / 10 })),
      overheads: round(overheads),
      overheadPerHour: round(perHour),
      hours: Math.round(hours * 10) / 10,
      totalCost: round(totalCost),
    };
    return { videos: videoRows.sort((a, b) => a.code.localeCompare(b.code)), clients: clientRows, summary };
  }

  async videos(month: string) {
    return (await this.compute(month)).videos;
  }

  async clients(month: string) {
    return (await this.compute(month)).clients;
  }

  async summary(month: string) {
    return (await this.compute(month)).summary;
  }
}
