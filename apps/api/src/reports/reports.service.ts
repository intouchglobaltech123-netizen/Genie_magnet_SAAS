import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma, TenantTx } from "@gm/db";
import { DONE_STAGES, METRIC_KEYS, type MonthlyReport, type MonthlyReportData, type PostMetricInput, type ReportRow } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { ClientMessages } from "../whatsapp/client-messages.service.js";

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const ym = (d: Date) => d.toISOString().slice(0, 7);
const nextMonth = (m: string) => {
  const d = utc(`${m}-01`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return ym(d);
};
export const monthName = (m: string) => utc(`${m}-01`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

/**
 * Monthly reports (P3-09): for each client with a running agreement, what the month promised and delivered, each
 * published post with its link and numbers, and next month's picked topics. Drafted by itself on the 25th (or made
 * by the team any time), refreshed while a draft, released to the client's portal with a WhatsApp notice — and kept
 * exactly as released.
 */
@Injectable()
export class ReportsService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly messages: ClientMessages,
  ) {}

  /** The month for one client, as it stands. */
  async compute(tx: TenantTx, clientId: string, month: string): Promise<MonthlyReportData> {
    const start = utc(`${month}-01`);
    const end = utc(`${nextMonth(month)}-01`);
    const agency = await tx.agency.findUniqueOrThrow({ where: { id: this.tenant.agencyId }, select: { name: true, logo: true, brandColor: true } });
    const client = await tx.client.findUniqueOrThrow({ where: { id: clientId }, select: { name: true, code: true } });
    const cycles = await tx.cycle.findMany({
      where: { month: start, agreement: { clientId } },
      select: { promised: true, carriedIn: true, closedAt: true, delivered: true, id: true },
    });
    const posts = await tx.scheduledPost.findMany({
      where: { video: { clientId }, status: "published", publishedAt: { gte: start, lt: end } },
      include: { connection: { select: { platform: true } }, metric: true },
      orderBy: { publishedAt: "asc" },
    });
    const videos = await tx.video.findMany({
      where: { clientId, OR: [{ cycleId: { in: cycles.map((c) => c.id) } }, { id: { in: posts.map((p) => p.videoId) } }] },
      select: { id: true, code: true, title: true, format: true, stage: true, cycleId: true },
      orderBy: { code: "asc" },
    });
    const done = (stage: string) => (DONE_STAGES as string[]).includes(stage);
    const inMonth = new Set(cycles.map((c) => c.id));
    const totals = { posts: posts.length, views: 0, reach: 0, likes: 0, comments: 0, shares: 0, saves: 0 };
    for (const p of posts) for (const k of METRIC_KEYS) totals[k] += p.metric?.[k] ?? 0;
    const picked = await tx.contentItem.findMany({ where: { clientId, month: utc(`${nextMonth(month)}-01`), pick: "picked" }, select: { title: true } });
    return {
      agency,
      client,
      month,
      promised: cycles.reduce((n, c) => n + c.promised, 0),
      carriedIn: cycles.reduce((n, c) => n + c.carriedIn, 0),
      delivered: videos.filter((v) => v.cycleId && inMonth.has(v.cycleId) && done(v.stage)).length,
      videos: videos.map((v) => ({
        id: v.id,
        code: v.code,
        title: v.title,
        format: v.format,
        stage: v.stage,
        delivered: done(v.stage),
        posts: posts
          .filter((p) => p.videoId === v.id)
          .map((p) => ({
            id: p.id,
            platform: p.connection.platform,
            url: p.publishedUrl,
            publishedAt: (p.publishedAt ?? p.scheduledAt).toISOString(),
            metrics: p.metric ? Object.fromEntries(METRIC_KEYS.map((k) => [k, p.metric![k]])) : null,
          })),
      })),
      totals,
      nextMonth: picked.map((p) => p.title),
    };
  }

  private async present(r: {
    id: string;
    clientId: string;
    month: Date;
    status: string;
    note: string | null;
    data: unknown;
    updatedAt: Date;
    releasedAt: Date | null;
    releasedBy: string | null;
  }): Promise<MonthlyReport> {
    const [client, by] = await Promise.all([
      this.tenant.db.client.findUniqueOrThrow({ where: { id: r.clientId }, select: { id: true, name: true, code: true } }),
      r.releasedBy ? this.tenant.db.user.findUnique({ where: { id: r.releasedBy }, select: { id: true, name: true } }) : null,
    ]);
    return {
      id: r.id,
      client,
      month: ym(r.month),
      status: r.status as "draft" | "released",
      note: r.note,
      data: r.data as MonthlyReportData,
      updatedAt: r.updatedAt.toISOString(),
      releasedAt: r.releasedAt?.toISOString() ?? null,
      releasedBy: by,
    };
  }

  private async find(id: string) {
    const r = await this.tenant.db.monthlyReport.findFirst({ where: { id } });
    if (!r) throw new NotFoundException("No report with that id.");
    return r;
  }

  /** Clients with a running agreement in the month, with their report when one is made. */
  async list(month: string): Promise<ReportRow[]> {
    const [cycles, reports] = await Promise.all([
      this.tenant.db.cycle.findMany({
        where: { month: utc(`${month}-01`) },
        select: { agreement: { select: { client: { select: { id: true, name: true, code: true } } } } },
      }),
      this.tenant.db.monthlyReport.findMany({ where: { month: utc(`${month}-01`) } }),
    ]);
    const clients = new Map(cycles.map((c) => [c.agreement.client.id, c.agreement.client]));
    for (const r of reports)
      if (!clients.has(r.clientId))
        clients.set(r.clientId, await this.tenant.db.client.findUniqueOrThrow({ where: { id: r.clientId }, select: { id: true, name: true, code: true } }));
    return [...clients.values()]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((client) => {
        const r = reports.find((x) => x.clientId === client.id);
        return {
          client,
          report: r
            ? { id: r.id, status: r.status as "draft" | "released", updatedAt: r.updatedAt.toISOString(), releasedAt: r.releasedAt?.toISOString() ?? null }
            : null,
        };
      });
  }

  async get(id: string) {
    return this.present(await this.find(id));
  }

  /** Makes the month's report for a client (or refreshes its draft). */
  async make(clientId: string, month: string) {
    const client = await this.tenant.db.client.findFirst({ where: { id: clientId }, select: { id: true, name: true } });
    if (!client) throw new NotFoundException("No client with that id.");
    const existing = await this.tenant.db.monthlyReport.findFirst({ where: { clientId, month: utc(`${month}-01`) } });
    if (existing) return this.refresh(existing.id);
    const id = await this.tenant.tx(async (tx) => {
      const r = await tx.monthlyReport.create({
        data: {
          agencyId: this.tenant.agencyId,
          clientId,
          month: utc(`${month}-01`),
          data: (await this.compute(tx, clientId, month)) as unknown as Prisma.InputJsonValue,
          createdBy: this.tenant.userId,
        },
      });
      await this.audit.record(tx, { action: "create", entity: "report", entityId: r.id, after: { client: client.name, month } });
      return r.id;
    });
    return this.get(id);
  }

  async refresh(id: string) {
    const r = await this.find(id);
    if (r.status === "released") throw new ConflictException("A released report stays as it was released.");
    await this.tenant.tx(async (tx) => {
      await tx.monthlyReport.update({ where: { id }, data: { data: (await this.compute(tx, r.clientId, ym(r.month))) as unknown as Prisma.InputJsonValue } });
    });
    return this.get(id);
  }

  async setNote(id: string, note: string | null) {
    const r = await this.find(id);
    if (r.status === "released") throw new ConflictException("A released report stays as it was released.");
    await this.tenant.db.monthlyReport.update({ where: { id }, data: { note: note || null } });
    return this.get(id);
  }

  /** Released to the client's portal, with the numbers as they are now; the client's approvers hear on WhatsApp. */
  async release(id: string) {
    const r = await this.find(id);
    if (r.status === "released") throw new ConflictException("This report is already released.");
    await this.tenant.tx(async (tx) => {
      const data = await this.compute(tx, r.clientId, ym(r.month));
      await tx.monthlyReport.update({
        where: { id },
        data: { status: "released", data: data as unknown as Prisma.InputJsonValue, releasedAt: new Date(), releasedBy: this.tenant.userId },
      });
      await this.audit.record(tx, { action: "release", entity: "report", entityId: id, after: { client: data.client.name, month: ym(r.month) } });
      await this.messages.reportReady(tx, r.clientId, monthName(ym(r.month)), id);
    });
    return this.get(id);
  }

  /** A published post's numbers (P3-09), entered by the team. */
  async setMetrics(postId: string, input: PostMetricInput) {
    const post = await this.tenant.db.scheduledPost.findFirst({ where: { id: postId }, select: { id: true, status: true } });
    if (!post) throw new NotFoundException("No post with that id.");
    if (post.status !== "published") throw new ConflictException("Numbers are kept for published posts.");
    const values = Object.fromEntries(METRIC_KEYS.map((k) => [k, input[k] ?? null]));
    const m = await this.tenant.db.postMetric.upsert({
      where: { postId },
      create: { agencyId: this.tenant.agencyId, postId, ...values, source: "manual", recordedBy: this.tenant.userId },
      update: { ...values, source: "manual", recordedAt: new Date(), recordedBy: this.tenant.userId },
    });
    return Object.fromEntries(METRIC_KEYS.map((k) => [k, m[k]]));
  }

  /** The daily job: on the 25th, a draft for each client with a running agreement; whoever looks after them is told. */
  async draftAll(tx: TenantTx, date: string) {
    if (!date.endsWith("-25")) return { drafted: 0 };
    const month = date.slice(0, 7);
    const cycles = await tx.cycle.findMany({ where: { month: utc(`${month}-01`) }, select: { agreement: { select: { clientId: true } } } });
    let drafted = 0;
    for (const clientId of new Set(cycles.map((c) => c.agreement.clientId))) {
      if (await tx.monthlyReport.findFirst({ where: { clientId, month: utc(`${month}-01`) }, select: { id: true } })) continue;
      const data = await this.compute(tx, clientId, month);
      const r = await tx.monthlyReport.create({
        data: { agencyId: this.tenant.agencyId, clientId, month: utc(`${month}-01`), data: data as unknown as Prisma.InputJsonValue },
      });
      drafted++;
      const client = await tx.client.findUniqueOrThrow({ where: { id: clientId }, select: { accountOwnerId: true } });
      await this.notifications.notify(tx, client.accountOwnerId ? { users: [client.accountOwnerId] } : { can: { area: "clients", level: "edit" } }, {
        kind: "report_draft",
        title: `${data.client.name}: the ${monthName(month)} report is ready to check`,
        body: `${data.delivered} of ${data.promised} videos delivered, ${data.totals.posts} posts. Add a note and release it to the client.`,
        link: `/app/reports/${r.id}`,
      });
    }
    return { drafted };
  }

  // ─── The client's portal ───────────────────────────────────────────

  async released(clientId: string) {
    const rows = await this.tenant.db.monthlyReport.findMany({ where: { clientId, status: "released" }, orderBy: { month: "desc" }, take: 24 });
    return rows.map((r) => ({ id: r.id, month: ym(r.month), releasedAt: r.releasedAt?.toISOString() ?? null }));
  }

  async releasedOne(clientId: string, id: string) {
    const r = await this.tenant.db.monthlyReport.findFirst({ where: { id, clientId, status: "released" } });
    if (!r) throw new NotFoundException("Not found.");
    return this.present(r);
  }
}
