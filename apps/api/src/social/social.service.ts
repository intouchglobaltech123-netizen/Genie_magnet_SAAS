import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import type { Prisma } from "@gm/db";
import {
  isSocialPlatform,
  PLATFORM_LABELS,
  SOCIAL_NETWORK,
  SOCIAL_PLATFORMS,
  type SocialAccountChoice,
  type SocialPlatform,
  type SocialSettings,
} from "@gm/shared";
import { AuditService } from "../audit/audit.service.js";
import { Secrets } from "../common/secrets.js";
import { ENV, type Env } from "../env.js";
import { FileStore } from "../files/file-store.js";
import { NotificationsService } from "../notifications/notifications.service.js";
import { PublishingService } from "../production/publishing.service.js";
import { asSystem, TenantDb } from "../tenancy/tenant-context.js";
import {
  PermanentSocialError,
  SOCIAL_NETWORKS,
  type SocialAccount,
  SocialAuthError,
  type SocialGrant,
  type SocialNetwork,
  type SocialNetworks,
} from "./provider.js";

type Connection = Prisma.PlatformConnectionGetPayload<object>;
type Pending = { grant: SocialGrant; accounts: SocialAccount[] };

/** How long a sign-in may take before its link stops working. */
const STATE_MINUTES = 30;
/** How long the platform may take to fetch the video file. */
const FILE_LINK_SECONDS = 6 * 3600;
/** Times to look again, a minute apart, while a platform processes a video. */
const PROCESSING_CHECKS = 30;
/** Posts whose numbers are brought in each day. */
const METRICS_DAYS = 90;

const label = (p: string) => PLATFORM_LABELS[p as SocialPlatform] ?? p;
const plain = (h: string | null | undefined) =>
  (h ?? "")
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?[^/]+\//, "")
    .replace(/^@/, "")
    .replace(/[\s/]+$/, "");

/**
 * Social connections (P3-11). A client's Instagram, Facebook Page or YouTube channel is connected through the
 * platform's own sign-in (our Meta and Google apps): the client, or the team member with the client's login, signs in
 * and the account matching the handle is linked, or the team chooses it. Linked platforms post scheduled videos by
 * themselves at their time — the approved version's file — and bring in each post's numbers every day. Anything the
 * app cannot post is marked so, with the reason, and the team posts it by hand as before.
 */
@Injectable()
export class SocialService {
  constructor(
    @Inject(ENV) private readonly env: Env,
    @Inject(SOCIAL_NETWORKS) private readonly networks: SocialNetworks,
    private readonly tenant: TenantDb,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly secrets: Secrets,
    private readonly store: FileStore,
    private readonly publishing: PublishingService,
  ) {}

  settings(): SocialSettings {
    return {
      provider: this.networks.kind,
      available: Object.fromEntries(SOCIAL_PLATFORMS.map((p) => [p, !!this.networks.get(p)])) as SocialSettings["available"],
    };
  }

  private redirectUri(platform: SocialPlatform) {
    return `${this.env.PUBLIC_API_URL}/webhooks/social/${SOCIAL_NETWORK[platform]}`;
  }

  private network(c: { platform: string }): SocialNetwork {
    if (!isSocialPlatform(c.platform)) throw new BadRequestException(`${label(c.platform)} is posted by hand; Instagram, Facebook and YouTube connect.`);
    const net = this.networks.get(c.platform);
    if (!net) throw new ConflictException(`Connecting ${label(c.platform)} is not switched on yet — post by hand meanwhile.`);
    return net;
  }

  private async find(clientId: string, id: string) {
    const c = await this.tenant.db.platformConnection.findFirst({ where: { id, clientId } });
    if (!c) throw new NotFoundException("No platform with that id.");
    return c;
  }

  // ─── Connecting ─────────────────────────────────────────────────────

  /** The platform's sign-in page; it sends the person back to /webhooks/social/:network. */
  async connectUrl(clientId: string, id: string) {
    const c = await this.find(clientId, id);
    const net = this.network(c);
    const state = this.secrets.encrypt(JSON.stringify({ a: this.tenant.agencyId, c: c.id, u: this.tenant.userId, e: Date.now() + STATE_MINUTES * 60_000 }));
    return { url: net.authUrl(state, this.redirectUri(net.platform)) };
  }

  /** Where the platform sends the person after signing in: links the account, and returns the page to show next. */
  async callback(network: string, q: { code?: string; state?: string; error?: string; error_description?: string }): Promise<string> {
    const web = this.env.WEB_ORIGIN;
    let s: { a: string; c: string; u: string | null; e: number };
    try {
      s = JSON.parse(this.secrets.decrypt(q.state ?? ""));
    } catch {
      return `${web}/app?social=invalid`;
    }
    return asSystem(
      s.a,
      async () => {
        const c = await this.tenant.db.platformConnection.findFirst({ where: { id: s.c } });
        if (!c) return `${web}/app/clients`;
        const back = (result: string) => `${web}/app/clients/${c.clientId}?social=${result}&platform=${c.platform}`;
        if (s.e < Date.now()) return back("expired");
        if (!isSocialPlatform(c.platform) || SOCIAL_NETWORK[c.platform] !== network) return back("error");
        if (q.error || !q.code) {
          await this.problem(c, `Signing in to ${label(c.platform)} was cancelled${q.error_description ? `: ${q.error_description}` : ""}.`);
          return back("cancelled");
        }
        try {
          const net = this.network(c);
          const grant = await net.exchange(q.code, this.redirectUri(net.platform));
          const accounts = await net.accounts(grant, { handle: c.handle });
          if (!accounts.length) {
            await this.problem(c, `No ${label(c.platform)} account came with this sign-in — sign in with the login that manages ${c.handle}.`);
            return back("none");
          }
          const match = accounts.length === 1 ? accounts[0] : accounts.find((x) => plain(x.handle) === plain(c.handle) || plain(x.name) === plain(c.handle));
          if (match) {
            await this.link(c, grant, match);
            return back("linked");
          }
          const pending: Pending = { grant, accounts };
          await this.tenant.tx((tx) =>
            tx.platformConnection.update({
              where: { id: c.id },
              data: { status: "choose", pending: this.secrets.encrypt(JSON.stringify(pending)), lastError: null },
            }),
          );
          return back("choose");
        } catch (e) {
          await this.problem(c, e instanceof Error ? e.message : String(e));
          return back("error");
        }
      },
      s.u ?? undefined,
    );
  }

  /** A sign-in that did not work: a linked platform stays linked; otherwise it is marked so, with the reason. */
  private async problem(c: Connection, message: string) {
    await this.tenant.db.platformConnection.update({
      where: { id: c.id },
      data: { lastError: message.slice(0, 500), ...(c.status !== "linked" && { status: "error", pending: null }) },
    });
  }

  private async link(c: Connection, grant: SocialGrant, account: SocialAccount) {
    const own = !!account.accessToken;
    await this.tenant.tx(async (tx) => {
      await tx.platformConnection.update({
        where: { id: c.id },
        data: {
          status: "linked",
          externalId: account.id,
          externalName: account.name,
          accessToken: this.secrets.encrypt(account.accessToken ?? grant.accessToken),
          refreshToken: !own && grant.refreshToken ? this.secrets.encrypt(grant.refreshToken) : null,
          // Facebook Page tokens do not expire; a YouTube token is refreshed when it does.
          tokenExpiresAt: own ? null : (grant.expiresAt ?? null),
          pending: null,
          lastError: null,
          linkedAt: new Date(),
          linkedBy: this.tenant.userId,
        },
      });
      await this.audit.record(tx, {
        action: "connect",
        entity: "platform",
        entityId: c.id,
        after: { platform: c.platform, handle: c.handle, account: account.name },
      });
      // Posts already scheduled for later now go out by themselves.
      if (c.autoPublish) await this.publishing.queueLater(tx, c.id);
    });
  }

  private pending(c: Connection): Pending {
    if (c.status !== "choose" || !c.pending) throw new ConflictException("Sign in first — then choose the account.");
    return JSON.parse(this.secrets.decrypt(c.pending)) as Pending;
  }

  async accounts(clientId: string, id: string): Promise<SocialAccountChoice[]> {
    const c = await this.find(clientId, id);
    return this.pending(c).accounts.map((a) => ({ id: a.id, name: a.name, handle: a.handle }));
  }

  async choose(clientId: string, id: string, accountId: string) {
    const c = await this.find(clientId, id);
    const p = this.pending(c);
    const account = p.accounts.find((a) => a.id === accountId);
    if (!account)
      throw new BadRequestException({ message: "Choose one of the accounts listed.", issues: [{ path: "accountId", message: "Choose the account" }] });
    await this.link(c, { ...p.grant, expiresAt: p.grant.expiresAt ? new Date(p.grant.expiresAt) : null }, account);
    return this.publishing.connections(clientId);
  }

  /** Back to posting by hand; the platform's access is forgotten. */
  async disconnect(clientId: string, id: string) {
    const c = await this.find(clientId, id);
    await this.tenant.tx(async (tx) => {
      await tx.platformConnection.update({
        where: { id },
        data: {
          status: "manual",
          externalId: null,
          externalName: null,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          pending: null,
          lastError: null,
        },
      });
      await this.audit.record(tx, {
        action: "disconnect",
        entity: "platform",
        entityId: id,
        before: { platform: c.platform, handle: c.handle, account: c.externalName },
      });
    });
    return this.publishing.connections(clientId);
  }

  async setAutoPublish(clientId: string, id: string, autoPublish: boolean) {
    const c = await this.find(clientId, id);
    await this.tenant.tx(async (tx) => {
      await tx.platformConnection.update({ where: { id }, data: { autoPublish } });
      await this.audit.record(tx, { action: "update", entity: "platform", entityId: id, before: { autoPublish: c.autoPublish }, after: { autoPublish } });
      if (autoPublish && c.status === "linked") await this.publishing.queueLater(tx, id);
    });
    return this.publishing.connections(clientId);
  }

  // ─── Posting (background job) ───────────────────────────────────────

  /** A usable token, refreshed first when it is about to expire (YouTube). */
  private async token(c: Connection, net: SocialNetwork) {
    let token = this.secrets.decrypt(c.accessToken!);
    if (net.refresh && c.tokenExpiresAt && c.tokenExpiresAt.getTime() < Date.now() + 120_000) {
      const fresh = await net.refresh({ accessToken: token, refreshToken: c.refreshToken ? this.secrets.decrypt(c.refreshToken) : null });
      token = fresh.accessToken;
      await this.tenant.db.platformConnection.update({
        where: { id: c.id },
        data: {
          accessToken: this.secrets.encrypt(token),
          refreshToken: fresh.refreshToken ? this.secrets.encrypt(fresh.refreshToken) : c.refreshToken,
          tokenExpiresAt: fresh.expiresAt ?? null,
        },
      });
    }
    return token;
  }

  /** The sign-in stopped working: the team is asked to connect again; meanwhile it is posted by hand. */
  private async expire(c: Connection, message: string) {
    await this.tenant.tx(async (tx) => {
      await tx.platformConnection.update({ where: { id: c.id }, data: { status: "expired", lastError: message.slice(0, 500) } });
      const client = await tx.client.findUnique({ where: { id: c.clientId }, select: { name: true } });
      await this.notifications.notify(
        tx,
        { can: { area: "publishing", level: "edit" } },
        {
          kind: "post_failed",
          title: `Connect ${label(c.platform)} again for ${client?.name ?? "a client"}`,
          body: message.slice(0, 300),
          link: `/app/clients/${c.clientId}`,
        },
      );
    });
  }

  private async failPost(p: { id: string; video: { code: string }; connection: Connection }, message: string) {
    await this.tenant.tx(async (tx) => {
      await tx.scheduledPost.update({ where: { id: p.id }, data: { status: "failed", publishError: message.slice(0, 500) } });
      await this.audit.record(tx, {
        action: "publish_failed",
        entity: "post",
        entityId: p.id,
        after: { code: p.video.code, platform: p.connection.platform, reason: message },
      });
      await this.notifications.notify(
        tx,
        { can: { area: "publishing", level: "approve" } },
        {
          kind: "post_failed",
          title: `Could not post ${p.video.code} on ${label(p.connection.platform)}`,
          body: message.slice(0, 300),
          link: "/app/publishing",
        },
      );
    });
    return { failed: message };
  }

  /**
   * Posts one scheduled post through its connected platform (job `social.publish`). A job for an old time, a removed
   * post, or a platform posted by hand does nothing. While the platform processes the video it looks again each
   * minute. What the platform refuses — and what still fails after the last try — is marked failed for the team.
   */
  async publishJob(payload: Record<string, unknown>, attempt: { last: boolean }) {
    const p = await this.tenant.db.scheduledPost.findFirst({
      where: { id: String(payload.postId) },
      include: {
        connection: true,
        video: {
          select: {
            id: true,
            code: true,
            title: true,
            clientId: true,
            stage: true,
            versions: { where: { status: "approved", fileId: { not: null } }, orderBy: { number: "desc" }, take: 1, select: { fileId: true } },
          },
        },
      },
    });
    if (!p) return { skipped: "removed" };
    if (p.status === "published" || p.status === "failed") return { skipped: p.status };
    if (!payload.now && payload.at !== p.scheduledAt.toISOString()) return { skipped: "moved" };
    const c = p.connection;
    if (c.status !== "linked" || (!c.autoPublish && !payload.now)) return { skipped: "posted by hand" };
    if (!isSocialPlatform(c.platform) || !this.networks.get(c.platform)) return { skipped: "not switched on" };
    const net = this.networks.get(c.platform)!;

    const fileId = p.video.versions[0]?.fileId;
    const file = fileId ? await this.tenant.db.fileObject.findFirst({ where: { id: fileId, status: "ready" } }) : null;
    if (!file)
      return this.failPost(
        p,
        "The approved version has no video file uploaded, so the app cannot post it — upload the file to the version and try again, or post it by hand.",
      );
    if (!file.mime.startsWith("video/")) return this.failPost(p, `The approved version's file (${file.name}) is not a video.`);

    try {
      const token = await this.token(c, net);
      if (p.status === "scheduled") await this.tenant.db.scheduledPost.update({ where: { id: p.id }, data: { status: "publishing", publishError: null } });
      const r = await net.publish(
        { id: c.externalId!, accessToken: token },
        {
          title: p.video.title,
          caption: p.caption ?? p.video.title,
          fileUrl: `${this.env.PUBLIC_API_URL}/files/download/${this.store.token(file.id, this.tenant.agencyId, "down", FILE_LINK_SECONDS)}`,
          mime: file.mime,
          size: Number(file.size),
          open: async () => (await this.store.open(file.storageKey)).stream,
        },
        p.externalId,
      );
      if (!r.done) {
        const checks = Number(payload.checks ?? 0) + 1;
        if (checks > PROCESSING_CHECKS)
          return this.failPost(p, `${label(c.platform)} took too long to process the video — check the account, then try again or post it by hand.`);
        await this.tenant.tx(async (tx) => {
          await tx.scheduledPost.update({ where: { id: p.id }, data: { externalId: r.uploadId } });
          await this.publishing.enqueue(
            tx,
            p.id,
            { ...payload, checks, now: true },
            { key: `social.publish:${p.id}:check:${checks}`, runAt: new Date(Date.now() + 60_000) },
          );
        });
        return { processing: r.uploadId, checks };
      }
      await this.tenant.tx((tx) => this.publishing.finish(tx, p, { url: r.url, at: new Date(), via: "connector", externalId: r.id }));
      return { published: r.id, url: r.url };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (e instanceof SocialAuthError) {
        await this.expire(c, message);
        return this.failPost(p, `The ${label(c.platform)} sign-in for ${c.handle} has stopped working — connect it again and try again, or post it by hand.`);
      }
      if (e instanceof PermanentSocialError) return this.failPost(p, message);
      if (attempt.last) return this.failPost(p, `${message} (tried several times)`);
      await this.tenant.db.scheduledPost.update({ where: { id: p.id }, data: { publishError: `Trying again: ${message}`.slice(0, 500) } });
      throw e;
    }
  }

  // ─── Numbers (daily job) ────────────────────────────────────────────

  /** Brings in the numbers of the posts the app made in the last 90 days (job `social.metrics`, daily). */
  async metricsJob() {
    const since = new Date(Date.now() - METRICS_DAYS * 86_400_000);
    const connections = await this.tenant.db.platformConnection.findMany({ where: { status: "linked" } });
    let updated = 0;
    const problems: string[] = [];
    for (const c of connections) {
      const net = isSocialPlatform(c.platform) ? this.networks.get(c.platform) : null;
      if (!net) continue;
      const posts = await this.tenant.db.scheduledPost.findMany({
        where: { connectionId: c.id, status: "published", publishedVia: "connector", externalId: { not: null }, publishedAt: { gte: since } },
        select: { id: true, externalId: true },
      });
      if (!posts.length) continue;
      try {
        const token = await this.token(c, net);
        for (const p of posts) {
          try {
            const m = await net.metrics({ id: c.externalId!, accessToken: token }, p.externalId!);
            const data = { views: m.views, reach: m.reach, likes: m.likes, comments: m.comments, shares: m.shares, saves: m.saves, source: "connector" };
            await this.tenant.db.postMetric.upsert({
              where: { postId: p.id },
              create: { agencyId: this.tenant.agencyId, postId: p.id, ...data },
              update: { ...data, recordedAt: new Date(), recordedBy: null },
            });
            updated++;
          } catch (e) {
            if (e instanceof SocialAuthError) throw e;
            problems.push(`${label(c.platform)} ${c.handle}: ${e instanceof Error ? e.message : String(e)}`);
          }
        }
      } catch (e) {
        if (!(e instanceof SocialAuthError)) throw e;
        await this.expire(c, e.message);
        problems.push(`${label(c.platform)} ${c.handle}: the sign-in has stopped working`);
      }
    }
    return { updated, problems: problems.slice(0, 10) };
  }
}
