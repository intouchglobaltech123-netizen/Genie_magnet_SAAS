import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma, type TenantTx } from "@gm/db";
import { type ConnectionStatus, isSocialPlatform, PLATFORM_LABELS, type Platform, type PostInput, type PostStatus, type PublishedInput } from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { JobsService } from "../jobs/jobs.service.js";
import { SOCIAL_NETWORKS, type SocialNetworks } from "../social/provider.js";
import { TenantDb } from "../tenancy/tenant-context.js";
import { ClientMessages } from "../whatsapp/client-messages.service.js";
import { CyclesService, thisMonth } from "./cycles.service.js";

type PostRow = Prisma.ScheduledPostGetPayload<{ include: { connection: true } }>;
/** A connected platform posts by itself. */
const posts = (c: { status: string; autoPublish: boolean }) => c.status === "linked" && c.autoPublish;

/**
 * Publishing (P2-12): each client's platforms, approved videos scheduled per platform with a caption, and each post
 * published — by the app at its time on a connected platform (P3-11), or marked as published by the team with its
 * link and a screenshot as proof. A video is Published once all its scheduled posts are.
 */
@Injectable()
export class PublishingService {
  constructor(
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly cycles: CyclesService,
    private readonly messages: ClientMessages,
    private readonly jobs: JobsService,
    @Inject(SOCIAL_NETWORKS) private readonly networks: SocialNetworks,
  ) {}

  async connections(clientId: string) {
    const rows = await this.tenant.db.platformConnection.findMany({ where: { clientId }, orderBy: { platform: "asc" } });
    return rows.map((c) => ({
      id: c.id,
      platform: c.platform,
      handle: c.handle,
      status: c.status as ConnectionStatus,
      connectedAt: c.connectedAt,
      linked: c.status === "linked" && c.externalId ? { id: c.externalId, name: c.externalName ?? c.handle } : null,
      autoPublish: c.autoPublish,
      lastError: c.lastError,
      canConnect: isSocialPlatform(c.platform) && !!this.networks.get(c.platform),
    }));
  }

  // ─── Posting by the app (P3-11) ─────────────────────────────────────

  /** Queues the job that posts it (`social.publish`), at its time unless said otherwise. */
  async enqueue(tx: TenantTx, postId: string, payload: Record<string, unknown>, opts: { key: string; runAt: Date }) {
    await this.jobs.enqueue(tx, "social.publish", { ...payload, postId }, opts);
  }

  private async queueAt(tx: TenantTx, post: { id: string; scheduledAt: Date }) {
    const at = post.scheduledAt.toISOString();
    await this.enqueue(tx, post.id, { at }, { key: `social.publish:${post.id}:${at}`, runAt: post.scheduledAt });
  }

  /** A platform just connected (or posting switched on): its posts scheduled for later go out by themselves. */
  async queueLater(tx: TenantTx, connectionId: string) {
    const later = await tx.scheduledPost.findMany({ where: { connectionId, status: "scheduled", scheduledAt: { gt: new Date() } } });
    for (const p of later) await this.queueAt(tx, p);
  }

  /** Posts it now through its connected platform: a post that is due, or one the app could not post before. */
  async postNow(id: string) {
    const p = await this.post(id);
    if (p.status === "published") throw new ConflictException("It is already published.");
    if (p.status === "publishing") throw new ConflictException("The app is posting it right now.");
    if (p.connection.status !== "linked")
      throw new ConflictException(
        `${PLATFORM_LABELS[p.connection.platform as Platform] ?? p.connection.platform} is not connected for this client — connect it, or mark the post as published by hand.`,
      );
    await this.tenant.tx(async (tx) => {
      await tx.scheduledPost.update({ where: { id }, data: { status: "scheduled", publishError: null, externalId: null } });
      await this.enqueue(tx, id, { at: p.scheduledAt.toISOString(), now: true }, { key: `social.publish:${id}:now:${Date.now()}`, runAt: new Date() });
      await this.audit.record(tx, { action: "post_now", entity: "post", entityId: id, after: { code: p.video.code, platform: p.connection.platform } });
    });
    return this.queue();
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

  private presentPost(p: PostRow) {
    return {
      id: p.id,
      videoId: p.videoId,
      platform: p.connection.platform,
      handle: p.connection.handle,
      connectionId: p.connectionId,
      scheduledAt: p.scheduledAt,
      caption: p.caption,
      status: p.status as PostStatus,
      publishedUrl: p.publishedUrl,
      publishedAt: p.publishedAt,
      proofFileId: p.proofFileId,
      via: p.publishedVia as "manual" | "connector",
      auto: p.status === "scheduled" && posts(p.connection),
      publishError: p.publishError,
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
      if (posts(c)) await this.queueAt(tx, p);
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
    if (p.status === "publishing") throw new ConflictException("The app is posting it right now.");
    await this.tenant.tx(async (tx) => {
      const moved = await tx.scheduledPost.update({
        where: { id },
        data: { scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined, caption: input.caption },
      });
      // A job queued for the old time does nothing; one is queued for the new time.
      if (input.scheduledAt && moved.status === "scheduled" && posts(p.connection)) await this.queueAt(tx, moved);
    });
    return this.queue();
  }

  async unschedule(id: string) {
    const p = await this.post(id);
    if (p.status === "published") throw new ConflictException("It is already published.");
    if (p.status === "publishing") throw new ConflictException("The app is posting it right now.");
    await this.tenant.db.scheduledPost.delete({ where: { id } });
    return this.queue();
  }

  /** Marks a post published by hand: its link, when, and a screenshot as proof. The video is Published once all its posts are. */
  async published(id: string, input: PublishedInput) {
    const p = await this.post(id);
    if (p.status === "published") throw new ConflictException("It is already marked as published.");
    if (p.status === "publishing") throw new ConflictException("The app is posting it right now — wait a minute and look again.");
    const proof = await this.tenant.db.fileObject.findFirst({ where: { id: input.proofFileId, entity: "publishing", entityId: p.videoId, status: "ready" } });
    if (!proof)
      throw new BadRequestException({ message: "Upload the screenshot again.", issues: [{ path: "proofFileId", message: "Upload the screenshot again" }] });
    await this.tenant.tx((tx) => this.finish(tx, p, { url: input.url, at: new Date(input.publishedAt), via: "manual", proofFileId: input.proofFileId }));
    return this.queue();
  }

  /**
   * A post is out, by hand or by the app: recorded with its link, the client told on WhatsApp, and the video
   * Published once all its posts are.
   */
  async finish(
    tx: TenantTx,
    p: { id: string; videoId: string; connection: { platform: string; handle: string }; video: { code: string; stage: string } },
    r: { url: string | null; at: Date; via: "manual" | "connector"; proofFileId?: string; externalId?: string },
  ) {
    await tx.scheduledPost.update({
      where: { id: p.id },
      data: {
        status: "published",
        publishedUrl: r.url,
        publishedAt: r.at,
        publishedVia: r.via,
        proofFileId: r.proofFileId,
        externalId: r.externalId,
        publishError: null,
        publishedBy: r.via === "manual" ? this.tenant.userId : null,
      },
    });
    await this.audit.record(tx, {
      action: "publish",
      entity: "post",
      entityId: p.id,
      after: { code: p.video.code, platform: p.connection.platform, url: r.url, ...(r.via === "connector" && { by: "the app" }) },
    });
    const where = PLATFORM_LABELS[p.connection.platform as Platform] ?? p.connection.platform;
    const video = await tx.video.findUniqueOrThrow({ where: { id: p.videoId }, select: { id: true, code: true, title: true, clientId: true } });
    await this.messages.videoPublished(tx, video.clientId, video, where, r.url ?? `${where} ${p.connection.handle}`);
    const open = await tx.scheduledPost.count({ where: { videoId: p.videoId, status: { not: "published" } } });
    if (!open && p.video.stage === "approved") {
      await tx.video.update({ where: { id: p.videoId }, data: { stage: "published" } });
      await tx.videoStageChange.create({
        data: { agencyId: this.tenant.agencyId, videoId: p.videoId, from: "approved", to: "published", note: r.url, by: this.tenant.userId },
      });
    }
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
