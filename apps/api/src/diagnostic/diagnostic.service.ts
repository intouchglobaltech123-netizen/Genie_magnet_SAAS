import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import {
  type BfaRow,
  bfaScores,
  BUSINESS_FUNCTIONS,
  type ClientDiagnosticRow,
  type DiagnosticInput,
  type DiagnosticView,
  diagnosticInput,
  FITMENT_QUADRANTS,
  type FitmentQuadrant,
  fitmentOf,
  healthOf,
  type RoadMapInput,
  type RoadMapRow,
  type RoadMapStatus,
  roadMapInput,
  type ScenarioInput,
  type ScenarioInputs,
  type ScenarioRow,
  scenarioInput,
  scenarioInputs,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { fitmentLabel } from "../clients/clients.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";

const DAY = 86_400_000;
const IST = 330 * 60_000;
const FITMENT: Record<FitmentQuadrant, "amazing" | "bread_winning" | "convenience" | "dangerous"> = {
  Amazing: "amazing",
  "Bread-winning": "bread_winning",
  Convenience: "convenience",
  Dangerous: "dangerous",
};
type TableRow = Record<string, string>;
const yesNo = (v: string | undefined) => (v === "Yes" ? true : v === "No" ? false : null);
const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
};

/**
 * The business diagnostic (P5-18): the BFA scorecard and founder dependency — first from the agency questionnaire,
 * then taken again in reviews; each client's place on the fitment map and its health; the Strategic Road Map; and
 * scenarios worked from where the agency stands.
 */
@Injectable()
export class DiagnosticService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
  ) {}

  // ─── BFA ────────────────────────────────────────────────────────────

  /** What the agency questionnaire says: the BFA table, the challenges and what is working. */
  private async fromQuestionnaire(): Promise<DiagnosticView["current"]> {
    const response = await this.tenant.db.questionnaireResponse.findFirst({
      where: { clientId: null, template: { kind: "agency" } },
      include: { answers: { where: { questionKey: { in: ["a7", "a10", "a23"] } } } },
      orderBy: { createdAt: "desc" },
    });
    if (!response) return null;
    const answer = (k: string) => response.answers.find((a) => a.questionKey === k)?.value;
    const bfa = (answer("a7") as TableRow[] | undefined) ?? [];
    const challenges = (answer("a23") as TableRow[] | undefined) ?? [];
    if (!bfa.length && !challenges.length) return null;
    const rows: BfaRow[] = BUSINESS_FUNCTIONS.map((f) => {
      const r = bfa.find((x) => x.row === f) ?? {};
      return {
        function: f,
        consistent: yesNo(r.consistent),
        ownerDependent: yesNo(r.owner),
        results: r.results === "High" || r.results === "Low" ? r.results : null,
        leader: yesNo(r.leader),
        action: r.action || null,
      };
    });
    return {
      id: null,
      takenAt: response.completedAt?.toISOString() ?? null,
      source: "questionnaire",
      rows,
      challenges: challenges.map((c) => ({
        function: c.row ?? "",
        challenge: c.challenge ?? "",
        rating: c.rating ? Math.max(0, Math.min(10, Math.round(Number(c.rating)))) || null : null,
      })),
      notes: typeof answer("a10") === "string" ? (answer("a10") as string) : "",
    };
  }

  async view(): Promise<DiagnosticView> {
    const snapshots = await this.tenant.db.diagnosticSnapshot.findMany({ orderBy: { takenAt: "desc" } });
    const latest = snapshots[0];
    const current: DiagnosticView["current"] = latest
      ? {
          id: latest.id,
          takenAt: latest.takenAt.toISOString(),
          source: latest.source as "questionnaire" | "review",
          rows: latest.rows as BfaRow[],
          challenges: latest.challenges as NonNullable<DiagnosticView["current"]>["challenges"],
          notes: latest.notes,
        }
      : await this.fromQuestionnaire();
    return {
      current,
      scores: current ? bfaScores(current.rows) : null,
      history: snapshots.map((s) => {
        const sc = bfaScores(s.rows as BfaRow[]);
        return { id: s.id, takenAt: s.takenAt.toISOString(), overall: sc.overall, founderDependency: sc.founderDependency };
      }),
      functions: BUSINESS_FUNCTIONS,
    };
  }

  /** The BFA taken again: kept with the date, the earlier ones staying to compare. */
  async take(input: DiagnosticInput) {
    const d = diagnosticInput.parse(input);
    await this.tenant.tx(async (tx) => {
      const s = await tx.diagnosticSnapshot.create({
        data: {
          agencyId: this.tenant.agencyId,
          source: "review",
          rows: d.rows,
          challenges: d.challenges,
          notes: d.notes,
          createdBy: this.tenant.userId ?? null,
        },
      });
      const sc = bfaScores(d.rows);
      await this.audit.record(tx, {
        action: "create",
        entity: "diagnostic",
        entityId: s.id,
        after: { overall: sc.overall, founderDependency: sc.founderDependency },
      });
    });
    return this.view();
  }

  // ─── Clients ────────────────────────────────────────────────────────

  async clients(): Promise<{ rows: ClientDiagnosticRow[]; medianFee: number; medianHours: number }> {
    const db = this.tenant.db;
    const now = new Date();
    const today = new Date(new Date(now.getTime() + IST).toISOString().slice(0, 10) + "T00:00:00Z");
    const since = new Date(now.getTime() - 90 * DAY);
    const clients = await db.client.findMany({
      where: {
        archivedAt: null,
        agreements: { some: { status: { in: ["active", "renewal_due", "paused"] }, startDate: { lte: today }, endDate: { gte: today } } },
      },
      include: {
        agreements: {
          where: { status: { in: ["active", "renewal_due", "paused"] }, startDate: { lte: today }, endDate: { gte: today } },
          select: { status: true, monthlyFee: true },
        },
      },
    });
    if (!clients.length) return { rows: [], medianFee: 0, medianHours: 0 };
    const ids = clients.map((c) => c.id);
    const [videoMinutes, shootMinutes, approvals, overdue, onboarding] = await Promise.all([
      db.videoTimeLog.findMany({
        where: { date: { gte: since }, video: { clientId: { in: ids } } },
        select: { minutes: true, video: { select: { clientId: true } } },
      }),
      db.shootTimeLog.findMany({
        where: { date: { gte: since }, shoot: { clientId: { in: ids } } },
        select: { minutes: true, shoot: { select: { clientId: true } } },
      }),
      db.videoStageChange.findMany({
        where: { to: "approved", at: { gte: since }, video: { clientId: { in: ids } } },
        select: { videoId: true, at: true, video: { select: { clientId: true, dueDate: true, revisionsUsed: true } } },
        orderBy: { at: "asc" },
      }),
      db.invoice.findMany({ where: { status: "sent", dueDate: { lt: today }, clientId: { in: ids } }, select: { clientId: true, dueDate: true } }),
      db.questionnaireResponse.findMany({ where: { clientId: { in: ids } }, select: { clientId: true, completedAt: true, requiredDoneAt: true } }),
    ]);
    const firsts = new Map<string, (typeof approvals)[number]>();
    for (const a of approvals) if (!firsts.has(a.videoId)) firsts.set(a.videoId, a);
    const figures = clients.map((c) => {
      const fee = c.agreements.reduce((s, a) => s + a.monthlyFee, 0);
      const minutes =
        videoMinutes.filter((v) => v.video.clientId === c.id).reduce((s, v) => s + v.minutes, 0) +
        shootMinutes.filter((v) => v.shoot.clientId === c.id).reduce((s, v) => s + v.minutes, 0);
      const hours = Math.round((minutes / 60 / 3) * 10) / 10;
      const mine = [...firsts.values()].filter((a) => a.video.clientId === c.id);
      const dated = mine.filter((a) => a.video.dueDate);
      const onTime = dated.filter((a) => new Date(a.at.getTime() + IST).toISOString().slice(0, 10) <= a.video.dueDate!.toISOString().slice(0, 10)).length;
      const late = overdue.filter((i) => i.clientId === c.id).map((i) => Math.floor((today.getTime() - i.dueDate!.getTime()) / DAY));
      const statuses = c.agreements.map((a) => a.status);
      const ob = onboarding.filter((o) => o.clientId === c.id);
      return {
        c,
        fee,
        hours,
        health: healthOf({
          onTimeShare: dated.length ? onTime / dated.length : null,
          revisionsPerVideo: mine.length ? mine.reduce((s, a) => s + a.video.revisionsUsed, 0) / mine.length : null,
          daysOverdue: late.length ? Math.max(...late) : 0,
          agreement: statuses.includes("active")
            ? "running"
            : statuses.includes("renewal_due")
              ? "renewal_due"
              : statuses.includes("paused")
                ? "paused"
                : "none",
          onboarded: !ob.length || ob.some((o) => o.completedAt || o.requiredDoneAt),
        }),
      };
    });
    const medianFee = median(figures.map((f) => f.fee));
    const medianHours = median(figures.map((f) => f.hours));
    return {
      rows: figures
        .map((f) => ({
          client: { id: f.c.id, name: f.c.name, code: f.c.code },
          fee: f.fee,
          hours: f.hours,
          suggested: fitmentOf(f.fee, f.hours, medianFee, medianHours),
          fitment: fitmentLabel(f.c.fitment),
          health: f.health,
        }))
        .sort((a, b) => b.fee - a.fee),
      medianFee,
      medianHours,
    };
  }

  /** The agency places a client on the map (taking the suggestion, or its own view). */
  async setFitment(clientId: string, fitment: FitmentQuadrant | null) {
    const c = await this.tenant.db.client.findFirst({ where: { id: clientId }, select: { id: true, name: true, fitment: true } });
    if (!c) throw new NotFoundException("No client with that id.");
    if (fitment && !FITMENT_QUADRANTS.includes(fitment)) throw new BadRequestException("Choose a quadrant.");
    await this.tenant.tx(async (tx) => {
      await tx.client.update({ where: { id: clientId }, data: { fitment: fitment ? FITMENT[fitment] : null } });
      await this.audit.record(tx, { action: "update", entity: "client", entityId: clientId, before: { fitment: fitmentLabel(c.fitment) }, after: { fitment } });
    });
    return { fitment };
  }

  // ─── Road map ───────────────────────────────────────────────────────

  async roadMap(): Promise<RoadMapRow[]> {
    const rows = await this.tenant.db.roadMapItem.findMany({ orderBy: [{ startMonth: "asc" }, { priority: "desc" }] });
    const [people, goals] = await Promise.all([
      this.tenant.db.user.findMany({ where: { id: { in: rows.map((r) => r.ownerId).filter((x): x is string => !!x) } }, select: { id: true, name: true } }),
      this.tenant.db.goal.findMany({ where: { id: { in: rows.map((r) => r.goalId).filter((x): x is string => !!x) } }, select: { id: true, title: true } }),
    ]);
    return rows.map((r) => ({
      id: r.id,
      function: r.function,
      title: r.title,
      detail: r.detail,
      startMonth: r.startMonth,
      endMonth: r.endMonth,
      status: r.status as RoadMapStatus,
      priority: r.priority,
      owner: r.ownerId ? (people.find((p) => p.id === r.ownerId) ?? null) : null,
      goal: r.goalId ? (goals.find((g) => g.id === r.goalId) ?? null) : null,
    }));
  }

  async saveItem(id: string | null, input: RoadMapInput) {
    const r = roadMapInput.parse(input);
    if (r.goalId && !(await this.tenant.db.goal.findFirst({ where: { id: r.goalId }, select: { id: true } })))
      throw new BadRequestException("Choose one of your goals.");
    const data = { ...r };
    await this.tenant.tx(async (tx) => {
      const saved = id
        ? await tx.roadMapItem.update({ where: { id }, data })
        : await tx.roadMapItem.create({ data: { agencyId: this.tenant.agencyId, ...data, createdBy: this.tenant.userId ?? null } });
      await this.audit.record(tx, { action: id ? "update" : "create", entity: "road_map", entityId: saved.id, after: { title: r.title, status: r.status } });
    });
    return this.roadMap();
  }

  async removeItem(id: string) {
    const r = await this.tenant.db.roadMapItem.findFirst({ where: { id } });
    if (!r) throw new NotFoundException("No road map item with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.roadMapItem.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "road_map", entityId: id, before: { title: r.title } });
    });
    return this.roadMap();
  }

  /** A first draft from the diagnostic's challenges, the biggest first, a quarter each. */
  async draftRoadMap() {
    if (await this.tenant.db.roadMapItem.findFirst({ select: { id: true } })) throw new ConflictException("The road map has items already.");
    const v = await this.view();
    const challenges = (v.current?.challenges ?? []).filter((c) => c.challenge.trim()).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    if (!challenges.length)
      throw new ConflictException("The diagnostic has no challenges to plan from — fill in the agency questionnaire's challenges, or take the diagnostic.");
    const start = new Date(Date.now() + IST);
    const monthOf = (offset: number) => {
      const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + offset, 1));
      return d.toISOString().slice(0, 7);
    };
    await this.tenant.tx(async (tx) => {
      await tx.roadMapItem.createMany({
        data: challenges.slice(0, 8).map((c, i) => {
          const q = Math.floor(i / 2);
          return {
            agencyId: this.tenant.agencyId,
            function: c.function,
            title: c.challenge.length > 200 ? `${c.challenge.slice(0, 197)}…` : c.challenge,
            startMonth: monthOf(q * 3),
            endMonth: monthOf(q * 3 + 2),
            priority: c.rating ? Math.max(1, Math.min(10, c.rating)) : 5,
            createdBy: this.tenant.userId ?? null,
          };
        }),
      });
      await this.audit.record(tx, { action: "create", entity: "road_map", after: { drafted: Math.min(8, challenges.length) } });
    });
    return this.roadMap();
  }

  // ─── Scenarios ──────────────────────────────────────────────────────

  /** Where the agency stands now, to start a scenario from. */
  async baseline(): Promise<ScenarioInputs> {
    const today = new Date(new Date(Date.now() + IST).toISOString().slice(0, 10) + "T00:00:00Z");
    const [running, rates, costs] = await Promise.all([
      this.tenant.db.agreement.findMany({
        where: { status: { in: ["active", "renewal_due"] }, startDate: { lte: today }, endDate: { gte: today } },
        select: { clientId: true, monthlyFee: true },
      }),
      this.tenant.db.personCostRate.findMany({ where: { effectiveFrom: { lte: today } }, orderBy: { effectiveFrom: "desc" } }),
      this.tenant.db.costSettings.findUnique({ where: { agencyId: this.tenant.agencyId } }),
    ]);
    const clients = new Set(running.map((r) => r.clientId)).size;
    const latest = new Map<string, number>();
    for (const r of rates) if (!latest.has(r.userId)) latest.set(r.userId, r.monthlyCost);
    return scenarioInputs.parse({
      startClients: clients,
      avgFee: clients ? Math.round(running.reduce((s, r) => s + r.monthlyFee, 0) / clients) : 0,
      newClientsPerMonth: 1,
      churnPerMonth: 0.03,
      teamCostPerMonth: [...latest.values()].reduce((s, n) => s + n, 0),
      overheadPerMonth: costs?.monthlyOverhead ?? 0,
    });
  }

  async scenarios(): Promise<ScenarioRow[]> {
    const rows = await this.tenant.db.scenario.findMany({ orderBy: { updatedAt: "desc" } });
    return rows.map((r) => ({ id: r.id, name: r.name, inputs: scenarioInputs.parse(r.inputs), updatedAt: r.updatedAt.toISOString() }));
  }

  async saveScenario(id: string | null, input: ScenarioInput) {
    const s = scenarioInput.parse(input);
    const data = { name: s.name, inputs: s.inputs as unknown as Prisma.InputJsonValue };
    await this.tenant.tx(async (tx) => {
      const saved = id
        ? await tx.scenario.update({ where: { id }, data })
        : await tx.scenario.create({ data: { agencyId: this.tenant.agencyId, ...data, createdBy: this.tenant.userId ?? null } });
      await this.audit.record(tx, { action: id ? "update" : "create", entity: "scenario", entityId: saved.id, after: { name: s.name } });
    });
    return this.scenarios();
  }

  async removeScenario(id: string) {
    const s = await this.tenant.db.scenario.findFirst({ where: { id } });
    if (!s) throw new NotFoundException("No scenario with that id.");
    await this.tenant.tx(async (tx) => {
      await tx.scenario.delete({ where: { id } });
      await this.audit.record(tx, { action: "delete", entity: "scenario", entityId: id, before: { name: s.name } });
    });
    return this.scenarios();
  }
}
