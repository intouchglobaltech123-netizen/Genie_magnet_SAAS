import type { SocialPlatform } from "@gm/shared";

/**
 * How the app talks to Instagram, Facebook Pages and YouTube (P3-11): through our own Meta and Google apps, each
 * client signing in to grant access to their account; or an outbox of pretend platforms for development and tests.
 */
export interface SocialGrant {
  accessToken: string;
  refreshToken?: string | null;
  expiresAt?: Date | null;
}

/** An account the sign-in gave access to, with its own token when the platform has one (Facebook Pages). */
export interface SocialAccount {
  id: string;
  name: string;
  handle: string | null;
  accessToken?: string;
}

export interface PublishInput {
  title: string;
  caption: string;
  /** A link the platform can fetch the file from (valid for a few hours). */
  fileUrl: string;
  mime: string;
  size: number;
  /** The file itself, for platforms that take the bytes (YouTube). */
  open: () => Promise<NodeJS.ReadableStream>;
}

export type PublishResult = { done: true; id: string; url: string | null } | { done: false; uploadId: string };

export interface SocialMetrics {
  views?: number | null;
  reach?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
}

export interface SocialNetwork {
  readonly platform: SocialPlatform;
  /** The page the client signs in on. */
  authUrl(state: string, redirectUri: string): string;
  exchange(code: string, redirectUri: string): Promise<SocialGrant>;
  /** A fresh token, for platforms whose tokens expire (YouTube). */
  refresh?(grant: SocialGrant): Promise<SocialGrant>;
  /** The accounts the sign-in reaches; the handle helps the outbox pretend. */
  accounts(grant: SocialGrant, hint: { handle: string }): Promise<SocialAccount[]>;
  /** Posts a video, or starts it when the platform needs time to process it (then call again with the upload id). */
  publish(account: { id: string; accessToken: string }, input: PublishInput, uploadId?: string | null): Promise<PublishResult>;
  metrics(account: { id: string; accessToken: string }, postId: string): Promise<SocialMetrics>;
}

export const SOCIAL_NETWORKS = Symbol("SOCIAL_NETWORKS");

export interface SocialNetworks {
  readonly kind: "live" | "outbox";
  /** The network for a platform, or null when our app for it is not set up on this server. */
  get(platform: SocialPlatform): SocialNetwork | null;
}

/** A refusal that trying again will not change (a bad video, a missing permission). */
export class PermanentSocialError extends Error {}
/** The client's sign-in no longer works: they need to connect again. */
export class SocialAuthError extends Error {}

const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : null);

async function call<T>(url: string, init: RequestInit & { label: string }): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: init.signal ?? AbortSignal.timeout(30_000) });
  } catch (e) {
    throw new Error(`${init.label} could not be reached: ${e instanceof Error ? e.message : String(e)}`);
  }
  const data = (await res.json().catch(() => ({}))) as { error?: { message?: string; code?: number; type?: string } | string; error_description?: string } & T;
  if (res.ok) return data;
  const err = typeof data.error === "object" ? data.error : undefined;
  const message = err?.message ?? data.error_description ?? (typeof data.error === "string" ? data.error : `${init.label} answered ${res.status}`);
  // Meta: 190 is an expired or removed token; Google: 401 / invalid_grant.
  if (res.status === 401 || err?.code === 190 || data.error === "invalid_grant") throw new SocialAuthError(`${init.label}: ${message}`);
  if (res.status === 429 || res.status >= 500) throw new Error(`${init.label}: ${message}`);
  throw new PermanentSocialError(`${init.label}: ${message}`);
}

// ─── Meta: Instagram and Facebook Pages ──────────────────────────────

const META_SCOPES = [
  "pages_show_list",
  "pages_read_engagement",
  "pages_manage_posts",
  "read_insights",
  "instagram_basic",
  "instagram_content_publish",
  "instagram_manage_insights",
  "business_management",
].join(",");

type MetaPage = { id: string; name: string; access_token: string; instagram_business_account?: { id: string; username?: string } };

/** Our Meta app: the client signs in with Facebook and picks the Page (and its Instagram account) to post to. */
class MetaNetwork {
  constructor(
    private readonly appId: string,
    private readonly appSecret: string,
    private readonly graph: string,
  ) {}

  authUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({ client_id: this.appId, redirect_uri: redirectUri, state, scope: META_SCOPES, response_type: "code" });
    return `https://www.facebook.com/${this.graph.split("/").pop()}/dialog/oauth?${q}`;
  }

  async exchange(code: string, redirectUri: string): Promise<SocialGrant> {
    const short = await call<{ access_token: string }>(
      `${this.graph}/oauth/access_token?${new URLSearchParams({ client_id: this.appId, client_secret: this.appSecret, redirect_uri: redirectUri, code })}`,
      { label: "Facebook" },
    );
    // A long-lived user token; the Page tokens made from it do not expire.
    const long = await call<{ access_token: string; expires_in?: number }>(
      `${this.graph}/oauth/access_token?${new URLSearchParams({ grant_type: "fb_exchange_token", client_id: this.appId, client_secret: this.appSecret, fb_exchange_token: short.access_token })}`,
      { label: "Facebook" },
    );
    return { accessToken: long.access_token, expiresAt: long.expires_in ? new Date(Date.now() + long.expires_in * 1000) : null };
  }

  async pages(grant: SocialGrant) {
    const r = await call<{ data: MetaPage[] }>(
      `${this.graph}/me/accounts?${new URLSearchParams({ fields: "id,name,access_token,instagram_business_account{id,username}", limit: "100", access_token: grant.accessToken })}`,
      { label: "Facebook" },
    );
    return r.data;
  }
}

class InstagramNetwork implements SocialNetwork {
  readonly platform = "instagram" as const;
  constructor(
    private readonly meta: MetaNetwork,
    private readonly graph: string,
  ) {}

  authUrl(state: string, redirectUri: string) {
    return this.meta.authUrl(state, redirectUri);
  }
  exchange(code: string, redirectUri: string) {
    return this.meta.exchange(code, redirectUri);
  }

  async accounts(grant: SocialGrant) {
    return (await this.meta.pages(grant))
      .filter((p) => p.instagram_business_account)
      .map((p) => ({
        id: p.instagram_business_account!.id,
        name: p.instagram_business_account!.username ?? p.name,
        handle: p.instagram_business_account!.username ? `@${p.instagram_business_account!.username}` : null,
        accessToken: p.access_token,
      }));
  }

  /** A Reel: Instagram fetches the file, processes it, then it is published. */
  async publish(account: { id: string; accessToken: string }, input: PublishInput, uploadId?: string | null): Promise<PublishResult> {
    const token = account.accessToken;
    let container = uploadId;
    if (!container) {
      const made = await call<{ id: string }>(`${this.graph}/${account.id}/media`, {
        label: "Instagram",
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ media_type: "REELS", video_url: input.fileUrl, caption: input.caption.slice(0, 2200), access_token: token }),
      });
      container = made.id;
    }
    const s = await call<{ status_code?: string; status?: string }>(
      `${this.graph}/${container}?${new URLSearchParams({ fields: "status_code,status", access_token: token })}`,
      { label: "Instagram" },
    );
    if (s.status_code === "ERROR" || s.status_code === "EXPIRED")
      throw new PermanentSocialError(`Instagram could not process the video (${s.status ?? s.status_code}).`);
    if (s.status_code !== "FINISHED") return { done: false, uploadId: container };
    const published = await call<{ id: string }>(`${this.graph}/${account.id}/media_publish`, {
      label: "Instagram",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ creation_id: container, access_token: token }),
    });
    const media = await call<{ permalink?: string }>(`${this.graph}/${published.id}?${new URLSearchParams({ fields: "permalink", access_token: token })}`, {
      label: "Instagram",
    }).catch(() => ({ permalink: undefined }));
    return { done: true, id: published.id, url: media.permalink ?? null };
  }

  async metrics(account: { id: string; accessToken: string }, postId: string): Promise<SocialMetrics> {
    const r = await call<{ data: { name: string; values?: { value: unknown }[]; total_value?: { value: unknown } }[] }>(
      `${this.graph}/${postId}/insights?${new URLSearchParams({ metric: "views,reach,likes,comments,shares,saved", access_token: account.accessToken })}`,
      { label: "Instagram" },
    );
    const v = (name: string) => {
      const m = r.data.find((x) => x.name === name);
      return num(m?.total_value?.value ?? m?.values?.[0]?.value);
    };
    return { views: v("views"), reach: v("reach"), likes: v("likes"), comments: v("comments"), shares: v("shares"), saves: v("saved") };
  }
}

class FacebookNetwork implements SocialNetwork {
  readonly platform = "facebook" as const;
  constructor(
    private readonly meta: MetaNetwork,
    private readonly graph: string,
  ) {}

  authUrl(state: string, redirectUri: string) {
    return this.meta.authUrl(state, redirectUri);
  }
  exchange(code: string, redirectUri: string) {
    return this.meta.exchange(code, redirectUri);
  }

  async accounts(grant: SocialGrant) {
    return (await this.meta.pages(grant)).map((p) => ({ id: p.id, name: p.name, handle: null, accessToken: p.access_token }));
  }

  /** A video on the Page: Facebook fetches the file itself. */
  async publish(account: { id: string; accessToken: string }, input: PublishInput): Promise<PublishResult> {
    const video = this.graph.replace("graph.facebook.com", "graph-video.facebook.com");
    const r = await call<{ id: string }>(`${video}/${account.id}/videos`, {
      label: "Facebook",
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file_url: input.fileUrl, title: input.title.slice(0, 255), description: input.caption, access_token: account.accessToken }),
      signal: AbortSignal.timeout(300_000),
    });
    return { done: true, id: r.id, url: `https://www.facebook.com/${account.id}/videos/${r.id}` };
  }

  async metrics(account: { id: string; accessToken: string }, postId: string): Promise<SocialMetrics> {
    const token = account.accessToken;
    const [counts, insights] = await Promise.all([
      call<{ likes?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } } }>(
        `${this.graph}/${postId}?${new URLSearchParams({ fields: "likes.summary(true).limit(0),comments.summary(true).limit(0)", access_token: token })}`,
        { label: "Facebook" },
      ),
      call<{ data: { name: string; values: { value: unknown }[] }[] }>(
        `${this.graph}/${postId}/video_insights?${new URLSearchParams({ metric: "total_video_views,total_video_impressions_unique", access_token: token })}`,
        { label: "Facebook" },
      ).catch(() => ({ data: [] })),
    ]);
    const v = (name: string) => num(insights.data.find((x) => x.name === name)?.values[0]?.value);
    return {
      views: v("total_video_views"),
      reach: v("total_video_impressions_unique"),
      likes: counts.likes?.summary?.total_count ?? null,
      comments: counts.comments?.summary?.total_count ?? null,
    };
  }
}

// ─── Google: YouTube ─────────────────────────────────────────────────

const YOUTUBE_SCOPES = ["https://www.googleapis.com/auth/youtube.upload", "https://www.googleapis.com/auth/youtube.readonly"].join(" ");

class YouTubeNetwork implements SocialNetwork {
  readonly platform = "youtube" as const;
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  authUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: YOUTUBE_SCOPES,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      state,
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
  }

  private async token(body: Record<string, string>): Promise<SocialGrant> {
    const r = await call<{ access_token: string; expires_in?: number; refresh_token?: string }>("https://oauth2.googleapis.com/token", {
      label: "Google",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, ...body }).toString(),
    });
    return { accessToken: r.access_token, refreshToken: r.refresh_token ?? null, expiresAt: r.expires_in ? new Date(Date.now() + r.expires_in * 1000) : null };
  }

  exchange(code: string, redirectUri: string) {
    return this.token({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  }

  async refresh(grant: SocialGrant) {
    if (!grant.refreshToken) throw new SocialAuthError("Google: the sign-in has no refresh token — connect again.");
    const fresh = await this.token({ refresh_token: grant.refreshToken, grant_type: "refresh_token" });
    return { ...fresh, refreshToken: fresh.refreshToken ?? grant.refreshToken };
  }

  async accounts(grant: SocialGrant) {
    const r = await call<{ items?: { id: string; snippet: { title: string; customUrl?: string } }[] }>(
      "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
      { label: "YouTube", headers: { Authorization: `Bearer ${grant.accessToken}` } },
    );
    return (r.items ?? []).map((c) => ({ id: c.id, name: c.snippet.title, handle: c.snippet.customUrl ?? null }));
  }

  /** Uploads the file itself (YouTube does not fetch links). */
  async publish(account: { id: string; accessToken: string }, input: PublishInput): Promise<PublishResult> {
    const start = await fetch("https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${account.accessToken}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": input.mime,
        "X-Upload-Content-Length": String(input.size),
      },
      body: JSON.stringify({
        snippet: { title: input.title.slice(0, 100), description: input.caption.slice(0, 5000) },
        status: { privacyStatus: "public", selfDeclaredMadeForKids: false },
      }),
      signal: AbortSignal.timeout(30_000),
    }).catch((e: unknown) => {
      throw new Error(`YouTube could not be reached: ${e instanceof Error ? e.message : String(e)}`);
    });
    if (start.status === 401) throw new SocialAuthError("YouTube: the sign-in has expired.");
    const location = start.headers.get("location");
    if (!start.ok || !location) {
      const err = (await start.json().catch(() => ({}))) as { error?: { message?: string } };
      const message = `YouTube: ${err.error?.message ?? `answered ${start.status}`}`;
      if (start.status === 429 || start.status >= 500) throw new Error(message);
      throw new PermanentSocialError(message);
    }
    const body = (await input.open()) as unknown as ReadableStream;
    const r = await call<{ id: string }>(location, {
      label: "YouTube",
      method: "PUT",
      headers: { "Content-Type": input.mime, "Content-Length": String(input.size) },
      body,
      // Node's fetch needs this to send a stream.
      ...({ duplex: "half" } as object),
      signal: AbortSignal.timeout(30 * 60_000),
    });
    return { done: true, id: r.id, url: `https://www.youtube.com/watch?v=${r.id}` };
  }

  async metrics(account: { id: string; accessToken: string }, postId: string): Promise<SocialMetrics> {
    const r = await call<{ items?: { statistics: { viewCount?: string; likeCount?: string; commentCount?: string } }[] }>(
      `https://www.googleapis.com/youtube/v3/videos?part=statistics&id=${encodeURIComponent(postId)}`,
      { label: "YouTube", headers: { Authorization: `Bearer ${account.accessToken}` } },
    );
    const s = r.items?.[0]?.statistics;
    return { views: num(s?.viewCount), likes: num(s?.likeCount), comments: num(s?.commentCount) };
  }
}

/** Our Meta and Google apps; a platform whose app keys are missing cannot be connected (it is posted by hand). */
export class LiveSocialNetworks implements SocialNetworks {
  readonly kind = "live" as const;
  private readonly networks: Partial<Record<SocialPlatform, SocialNetwork>> = {};

  constructor(keys: { metaAppId?: string; metaAppSecret?: string; graphUrl: string; googleClientId?: string; googleClientSecret?: string }) {
    if (keys.metaAppId && keys.metaAppSecret) {
      const meta = new MetaNetwork(keys.metaAppId, keys.metaAppSecret, keys.graphUrl);
      this.networks.instagram = new InstagramNetwork(meta, keys.graphUrl);
      this.networks.facebook = new FacebookNetwork(meta, keys.graphUrl);
    }
    if (keys.googleClientId && keys.googleClientSecret) this.networks.youtube = new YouTubeNetwork(keys.googleClientId, keys.googleClientSecret);
  }

  get(platform: SocialPlatform) {
    return this.networks[platform] ?? null;
  }
}

// ─── Outbox: pretend platforms ───────────────────────────────────────

const clean = (h: string) => h.replace(/^@/, "").toLowerCase();

/**
 * Pretend platforms kept in memory (development and tests): signing in comes straight back with a code, the accounts
 * are made from the handle (one that matches, and another), posts and numbers are made up. A handle with "choose" in
 * it gives two accounts that do not match; a caption with "[refused]" is refused; a code "expired" fails as an
 * expired sign-in; a token starting "revoked" has stopped working; a caption with "[slow]" takes one extra round to
 * process.
 */
class OutboxNetwork implements SocialNetwork {
  private n = 0;
  constructor(
    readonly platform: SocialPlatform,
    private readonly owner: OutboxSocialNetworks,
  ) {}

  authUrl(state: string, redirectUri: string) {
    return `${redirectUri}?${new URLSearchParams({ code: `outbox-${this.platform}`, state })}`;
  }

  async exchange(code: string) {
    if (code === "expired") throw new SocialAuthError("The sign-in was refused.");
    return { accessToken: `outbox-token-${this.platform}-${++this.n}`, refreshToken: this.platform === "youtube" ? "outbox-refresh" : null, expiresAt: null };
  }

  async refresh(grant: SocialGrant) {
    return { ...grant, accessToken: `${grant.accessToken}-fresh`, expiresAt: new Date(Date.now() + 3_600_000) };
  }

  async accounts(_grant: SocialGrant, hint: { handle: string }) {
    const h = clean(hint.handle);
    if (h.includes("choose"))
      return [
        { id: `${this.platform}-acc-a`, name: "First account", handle: "@first", accessToken: "outbox-page-a" },
        { id: `${this.platform}-acc-b`, name: "Second account", handle: "@second", accessToken: "outbox-page-b" },
      ];
    return [
      { id: `${this.platform}-${h}`, name: h, handle: `@${h}`, accessToken: `outbox-page-${h}` },
      { id: `${this.platform}-other`, name: "Another page", handle: "@another", accessToken: "outbox-page-other" },
    ];
  }

  async publish(account: { id: string; accessToken: string }, input: PublishInput, uploadId?: string | null): Promise<PublishResult> {
    if (account.accessToken.startsWith("revoked")) throw new SocialAuthError(`${this.platform}: the sign-in has expired.`);
    if (input.caption.includes("[refused]")) throw new PermanentSocialError(`${this.platform}: the video was refused (too short).`);
    if (input.caption.includes("[slow]") && !uploadId) return { done: false, uploadId: `upload-${++this.n}` };
    const id = `${this.platform}-post-${++this.n}`;
    this.owner.posts.push({ platform: this.platform, account: account.id, id, ...input });
    return { done: true, id, url: `https://${this.platform}.example/p/${id}` };
  }

  async metrics(account: { id: string; accessToken: string }, postId: string): Promise<SocialMetrics> {
    if (account.accessToken.startsWith("revoked")) throw new SocialAuthError(`${this.platform}: the sign-in has expired.`);
    const n = Number(postId.split("-").pop()) || 1;
    return { views: 1000 * n + 234, reach: 800 * n, likes: 50 * n, comments: 7 * n, shares: 3 * n, saves: 5 * n };
  }
}

export class OutboxSocialNetworks implements SocialNetworks {
  readonly kind = "outbox" as const;
  readonly posts: ({ platform: string; account: string; id: string } & PublishInput)[] = [];
  private readonly networks: Record<SocialPlatform, OutboxNetwork> = {
    instagram: new OutboxNetwork("instagram", this),
    facebook: new OutboxNetwork("facebook", this),
    youtube: new OutboxNetwork("youtube", this),
  };

  get(platform: SocialPlatform) {
    return this.networks[platform];
  }
}
