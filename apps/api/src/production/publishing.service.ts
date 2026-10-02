import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@gm/db";
import { PLATFORM_LABELS, type Platform, type PostInput, type PublishedInput } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { ClientMessages } from "../whatsapp/client-messages.service.js";
import { CyclesService, thisMonth } from "./cycles.service.js";

/**
 * Publishing, by hand for now (P2-12): each client's platforms, approved videos scheduled per platform with a caption,
 * and each post marked as published with its link and a screenshot as proof. A video is Published once all its
 * scheduled posts are. Posting through the platforms themselves comes with their connections later.
 */
@Injectable()
export class PublishingService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly cycles: CyclesService,
    private readonly messages: ClientMessages,
  ) {}

  async connections(clientId: string) {
    const rows = await this.tenant.db.platformConnection.findMany({ where: { clientId }, orderBy: { platform: "asc" } });
    return rows.map((c) => ({ id: c.id, platform: c.platform, handle: c.handle, status: c.status, connectedAt: c.connectedAt }));
  }

  async addConnection(clientId: string, input: { platform: string; handle: string }) {
    const client = await this.tenant.db.client.findFirst({ where: { id: clientId }, select: { id: true, name: true } });
    if (!client) throw new NotFoundException("No client with that id.");
    try {
      await this.tenant.tx(async (tx) => {
        const c = await tx.platformConnection.create({
          data: { agencyId: this.tenant.agencyId, clientId, platform: input.platform, handle: input.handle, status: "manual" },
        });
        await this.audit.record(tx, {
          action: "create",
          entity: "platform",
          entityId: c.id,
          after: { client: client.name, platform: input.platform, handle: input.handle },
        });
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
        throw new ConflictException({ message: "This platform is already there for the client.", issues: [{ path: "platform", message: "Already added" }] });
      throw e;
    }
    return this.connections(clientId);
  }

  async removeConnection(clientId: string, id: string) {
    const c = await this.tenant.db.platformConnection.findFirst({ where: { id, clientId }, include: { _count: { select: { posts: true } } } });
    if (!c) throw new NotFoundException("No platform with that id.");
    if (c._count.posts) throw new ConflictException("Posts use this platform, so it stays.");
    await this.tenant.db.platformConnection.delete({ where: { id } });
    return this.connections(clientId);
  }

  private presentPost(p: Prisma.ScheduledPostGetPayload<{ include: { connection: true } }>) {
    return {
      id: p.id,
      videoId: p.videoId,
      platform: p.connection.platform,
      handle: p.connection.handle,
      connectionId: p.connectionId,
      scheduledAt: p.scheduledAt,
      caption: p.caption,
      status: p.status as "scheduled" | "published",
      publishedUrl: p.publishedUrl,
      publishedAt: p.publishedAt,
      proofFileId: p.proofFileId,
    };
  }

  /** Approved videos waiting to be published, and what is scheduled or published in the month. */
  async queue(month = thisMonth()) {
    const start = new Date(`${month}-01T00:00:00Z`);
    const end = new Date(start);
    end.setUTCMonth(end.getUTCMonth() + 1);
    const videos = await this.tenant.db.video.findMany({
      where: { OR: [{ stage: "approved" }, { stage: "published", posts: { some: { publishedAt: { gte: start, lt: end } } } }] },
      include: {
        client: { select: { id: true, name: true, code: true } },
        posts: { include: { connection: true }, orderBy: { scheduledAt: "asc" } },
        versions: { where: { status: "approved" }, orderBy: { number: "desc" }, take: 1, select: { label: true } },
      },
      orderBy: [{ publishDate: { sort: "asc", nulls: "last" } }, { code: "asc" }],
      take: 500,
    });
    return videos.map((v) => ({
      id: v.id,
      code: v.code,
      title: v.title,
      client: v.client,
      stage: v.stage,
      publishDate: v.publishDate?.toISOString().slice(0, 10) ?? null,
      platforms: v.platforms,
      approvedVersion: v.versions[0]?.label ?? null,
      posts: v.posts.map((p) => this.presentPost(p)),
    }));
  }

  async schedule(input: PostInput) {
    const v = await this.tenant.db.video.findFirst({ where: { id: input.videoId }, select: { id: true, code: true, clientId: true, stage: true } });
    if (!v) throw new NotFoundException("No video with that id.");
    if (v.stage !== "approved") throw new ConflictException("Only a video the client approved is scheduled.");
    const c = await this.tenant.db.platformConnection.findFirst({ where: { id: input.connectionId, clientId: v.clientId } });
    if (!c)
      throw new BadRequestException({ message: "Choose one of the client's platforms.", issues: [{ path: "connectionId", message: "Choose the platform" }] });
    await this.tenant.tx(async (tx) => {
      const p = await tx.scheduledPost.create({
        data: {
          agencyId: this.tenant.agencyId,
          videoId: v.id,
          connectionId: c.id,
          scheduledAt: new Date(input.scheduledAt),
          caption: input.caption,
          createdBy: this.tenant.userId,
        },
      });
      await this.audit.record(tx, { action: "schedule", entity: "post", entityId: p.id, after: { code: v.code, platform: c.platform, at: input.scheduledAt } });
    });
    return this.queue();
  }

  private async post(id: string) {
    const p = await this.tenant.db.scheduledPost.findFirst({
      where: { id },
      include: { connection: true, video: { select: { id: true, code: true, stage: true } } },
    });
    if (!p) throw new NotFoundException("No post with that id.");
    return p;
  }

  async reschedule(id: string, input: { scheduledAt?: string; caption?: string }) {
    const p = await this.post(id);
    if (p.status === "published") throw new ConflictException("It is already published.");
    await this.tenant.db.scheduledPost.update({
      where: { id },
      data: { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined, caption: input.caption },
    });
    return this.queue();
  }

  async unschedule(id: string) {
    const p = await this.post(id);
    if (p.status === "published") throw new ConflictException("It is already published.");
    await this.tenant.db.scheduledPost.delete({ where: { id } });
    return this.queue();
  }

  /** Marks a post published: its link, when, and a screenshot as proof. The video is Published once all its posts are. */
  async published(id: string, input: PublishedInput) {
    const p = await this.post(id);
    if (p.status === "published") throw new ConflictException("It is already marked as published.");
    const proof = await this.tenant.db.fileObject.findFirst({ where: { id: input.proofFileId, entity: "publishing", entityId: p.videoId, status: "ready" } });
    if (!proof)
      throw new BadRequestException({ message: "Upload the screenshot again.", issues: [{ path: "proofFileId", message: "Upload the screenshot again" }] });
    await this.tenant.tx(async (tx) => {
      await tx.scheduledPost.update({
        where: { id },
        data: {
          status: "published",
          publishedUrl: input.url,
          publishedAt: new Date(input.publishedAt),
          proofFileId: input.proofFileId,
          publishedBy: this.tenant.userId,
        },
      });
      await this.audit.record(tx, {
        action: "publish",
        entity: "post",
        entityId: id,
        after: { code: p.video.code, platform: p.connection.platform, url: input.url },
      });
      const video = await tx.video.findUniqueOrThrow({ where: { id: p.videoId }, select: { id: true, code: true, title: true, clientId: true } });
      await this.messages.videoPublished(tx, video.clientId, video, PLATFORM_LABELS[p.connection.platform as Platform] ?? p.connection.platform, input.url);
      const open = await tx.scheduledPost.count({ where: { videoId: p.videoId, status: { not: "published" } } });
      if (!open && p.video.stage === "approved") {
        await tx.video.update({ where: { id: p.videoId }, data: { stage: "published" } });
        await tx.videoStageChange.create({
          data: { agencyId: this.tenant.agencyId, videoId: p.videoId, from: "approved", to: "published", note: input.url, by: this.tenant.userId },
        });
      }
    });
    return this.queue();
  }

  /** Each client's month: promised, delivered, scheduled, in the making, not started — at risk when more than half is short. */
  async quotas(month = thisMonth()) {
    const cycles = await this.cycles.list(month);
    const scheduled = await this.tenant.db.video.groupBy({
      by: ["cycleId"],
      where: { cycleId: { in: cycles.map((c) => c.id) }, stage: "approved", posts: { some: {} } },
      _count: { _all: true },
    });
    const sched = new Map(scheduled.map((s) => [s.cycleId, s._count._all]));
    return cycles.map((c) => ({
      ...c,
      scheduled: sched.get(c.id) ?? 0,
      atRisk: c.promised > 0 && c.status !== "closed" && (c.promised - c.delivered) / c.promised > 0.5,
    }));
  }
}
