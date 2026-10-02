import { createHash, createHmac } from "node:crypto";
import type { SocialPlatform } from "@gm/shared";

/**
 * How the app talks to Instagram, Facebook Pages and YouTube (P3-11), LinkedIn company pages and X (P5-22): through our
 * own Meta, Google, LinkedIn and X apps, each client signing in to grant access to their account; or an outbox of
 * pretend platforms for development and tests.
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
  /** Swaps the code from the sign-in for access; `state` is the one the sign-in was started with. */
  exchange(code: string, redirectUri: string, state: string): Promise<SocialGrant>;
  /** A fresh token, for platforms whose tokens expire (YouTube, LinkedIn, X). */
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
  const data = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; code?: number; type?: string } | string;
    error_description?: string;
    // LinkedIn says what went wrong in `message`, X in `detail`.
    message?: string;
    detail?: string;
  } & T;
  if (res.ok) return data;
  const err = typeof data.error === "object" ? data.error : undefined;
  const message =
    err?.message ??
    data.error_description ??
    (typeof data.error === "string" ? data.error : (data.message ?? data.detail ?? `${init.label} answered ${res.status}`));
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

// ─── Pieces of a file ────────────────────────────────────────────────

/** Reads a file in pieces of the given sizes (the last may be shorter). */
async function* pieces(stream: NodeJS.ReadableStream, sizes: number[]): AsyncGenerator<Buffer> {
  let held: Buffer[] = [];
  let heldBytes = 0;
  let i = 0;
  const take = (n: number) => {
    const all = Buffer.concat(held, heldBytes);
    held = [all.subarray(n)];
    heldBytes = all.length - n;
    return all.subarray(0, n);
  };
  for await (const chunk of stream as AsyncIterable<Buffer | string>) {
    const b = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    held.push(b);
    heldBytes += b.length;
    while (i < sizes.length && heldBytes >= sizes[i]!) yield take(sizes[i++]!);
  }
  if (heldBytes > 0) yield take(heldBytes);
}

// ─── LinkedIn: company pages ─────────────────────────────────────────

const LINKEDIN_SCOPES = ["r_organization_social", "w_organization_social", "rw_organization_admin"].join(" ");
const LINKEDIN_API = "https://api.linkedin.com/rest";

/** LinkedIn's "little" text format: these characters are written with a backslash before them. */
const linkedInText = (t: string) => t.replace(/[\\|{}@[\]()<>#*_~]/g, (c) => `\\${c}`);

/** Our LinkedIn app: the client's page admin signs in and picks the company page to post to. */
class LinkedInNetwork implements SocialNetwork {
  readonly platform = "linkedin" as const;
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
    private readonly version: string,
  ) {}

  private headers(token: string) {
    return { Authorization: `Bearer ${token}`, "LinkedIn-Version": this.version, "X-Restli-Protocol-Version": "2.0.0", "Content-Type": "application/json" };
  }

  authUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({ response_type: "code", client_id: this.clientId, redirect_uri: redirectUri, state, scope: LINKEDIN_SCOPES });
    return `https://www.linkedin.com/oauth/v2/authorization?${q}`;
  }

  private async token(body: Record<string, string>): Promise<SocialGrant> {
    const r = await call<{ access_token: string; expires_in?: number; refresh_token?: string }>("https://www.linkedin.com/oauth/v2/accessToken", {
      label: "LinkedIn",
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: this.clientId, client_secret: this.clientSecret, ...body }).toString(),
    });
    return { accessToken: r.access_token, refreshToken: r.refresh_token ?? null, expiresAt: r.expires_in ? new Date(Date.now() + r.expires_in * 1000) : null };
  }

  exchange(code: string, redirectUri: string) {
    return this.token({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
  }

  /** LinkedIn gives refresh tokens only to some apps; without one, the page is connected again when access runs out. */
  async refresh(grant: SocialGrant) {
    if (!grant.refreshToken) throw new SocialAuthError("LinkedIn: the sign-in has expired — connect again.");
    const fresh = await this.token({ grant_type: "refresh_token", refresh_token: grant.refreshToken });
    return { ...fresh, refreshToken: fresh.refreshToken ?? grant.refreshToken };
  }

  /** The company pages the person administers. */
  async accounts(grant: SocialGrant) {
    const acl = await call<{ elements?: { organization: string }[] }>(
      `${LINKEDIN_API}/organizationAcls?${new URLSearchParams({ q: "roleAssignee", role: "ADMINISTRATOR", state: "APPROVED" })}`,
      { label: "LinkedIn", headers: this.headers(grant.accessToken) },
    );
    const orgs = [...new Set((acl.elements ?? []).map((e) => e.organization))];
    return Promise.all(
      orgs.map(async (urn) => {
        const org = await call<{ localizedName?: string; vanityName?: string }>(`${LINKEDIN_API}/organizations/${urn.split(":").pop()}`, {
          label: "LinkedIn",
          headers: this.headers(grant.accessToken),
        }).catch(() => ({ localizedName: undefined, vanityName: undefined }));
        return { id: urn, name: org.localizedName ?? urn, handle: org.vanityName ?? null };
      }),
    );
  }

  /** Uploads the video in the pieces LinkedIn asks for; once it is processed, posts it on the page. */
  async publish(account: { id: string; accessToken: string }, input: PublishInput, uploadId?: string | null): Promise<PublishResult> {
    const headers = this.headers(account.accessToken);
    let video = uploadId;
    if (!video) {
      const init = await call<{
        value: { video: string; uploadToken?: string; uploadInstructions: { uploadUrl: string; firstByte: number; lastByte: number }[] };
      }>(`${LINKEDIN_API}/videos?action=initializeUpload`, {
        label: "LinkedIn",
        method: "POST",
        headers,
        body: JSON.stringify({ initializeUploadRequest: { owner: account.id, fileSizeBytes: input.size, uploadCaptions: false, uploadThumbnail: false } }),
      });
      const steps = init.value.uploadInstructions.slice().sort((a, b) => a.firstByte - b.firstByte);
      const etags: string[] = [];
      let n = 0;
      for await (const piece of pieces(
        await input.open(),
        steps.map((x) => x.lastByte - x.firstByte + 1),
      )) {
        const step = steps[n++];
        if (!step) break;
        const res = await fetch(step.uploadUrl, {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body: new Uint8Array(piece),
          signal: AbortSignal.timeout(10 * 60_000),
        }).catch((e: unknown) => {
          throw new Error(`LinkedIn could not be reached: ${e instanceof Error ? e.message : String(e)}`);
        });
        if (!res.ok) throw new Error(`LinkedIn: uploading the video answered ${res.status}`);
        etags.push(res.headers.get("etag") ?? "");
      }
      await call(`${LINKEDIN_API}/videos?action=finalizeUpload`, {
        label: "LinkedIn",
        method: "POST",
        headers,
        body: JSON.stringify({ finalizeUploadRequest: { video: init.value.video, uploadToken: init.value.uploadToken ?? "", uploadedPartIds: etags } }),
      });
      video = init.value.video;
    }
    const v = await call<{ status?: string }>(`${LINKEDIN_API}/videos/${encodeURIComponent(video)}`, { label: "LinkedIn", headers });
    if (v.status === "PROCESSING_FAILED") throw new PermanentSocialError("LinkedIn could not process the video.");
    if (v.status !== "AVAILABLE") return { done: false, uploadId: video };
    let res: Response;
    try {
      res = await fetch(`${LINKEDIN_API}/posts`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          author: account.id,
          commentary: linkedInText(input.caption.slice(0, 3000)),
          visibility: "PUBLIC",
          distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
          content: { media: { title: input.title.slice(0, 200), id: video } },
          lifecycleState: "PUBLISHED",
          isReshareDisabledByAuthor: false,
        }),
        signal: AbortSignal.timeout(30_000),
      });
    } catch (e) {
      throw new Error(`LinkedIn could not be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { message?: string };
      const message = `LinkedIn: ${err.message ?? `answered ${res.status}`}`;
      if (res.status === 401) throw new SocialAuthError(message);
      if (res.status === 429 || res.status >= 500) throw new Error(message);
      throw new PermanentSocialError(message);
    }
    // The new post's id comes back in a header.
    const id = res.headers.get("x-restli-id") ?? res.headers.get("x-linkedin-id") ?? "";
    return { done: true, id, url: id ? `https://www.linkedin.com/feed/update/${id}/` : null };
  }

  async metrics(account: { id: string; accessToken: string }, postId: string): Promise<SocialMetrics> {
    const r = await call<{ reactionSummaries?: Record<string, { count?: number }>; commentSummary?: { count?: number } }>(
      `${LINKEDIN_API}/socialMetadata/${encodeURIComponent(postId)}`,
      { label: "LinkedIn", headers: this.headers(account.accessToken) },
    );
    const reactions = Object.values(r.reactionSummaries ?? {}).reduce((n, x) => n + (x.count ?? 0), 0);
    return { likes: reactions, comments: r.commentSummary?.count ?? null };
  }
}

// ─── X ───────────────────────────────────────────────────────────────

const X_SCOPES = ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"].join(" ");
const X_API = "https://api.x.com/2";
const base64url = (b: Buffer) => b.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
/** The pieces a video goes up in. */
const X_PIECE = 4 * 1024 * 1024;

/** Our X app: the client signs in to their X account. */
class XNetwork implements SocialNetwork {
  readonly platform = "x" as const;
  constructor(
    private readonly clientId: string,
    private readonly clientSecret: string,
  ) {}

  /** The sign-in's proof key, made from its state with our secret, so nothing has to be kept between the two steps. */
  private verifier(state: string) {
    return base64url(createHmac("sha256", this.clientSecret).update(state).digest());
  }

  authUrl(state: string, redirectUri: string) {
    const q = new URLSearchParams({
      response_type: "code",
      client_id: this.clientId,
      redirect_uri: redirectUri,
      scope: X_SCOPES,
      state,
      code_challenge: base64url(createHash("sha256").update(this.verifier(state)).digest()),
      code_challenge_method: "S256",
    });
    return `https://x.com/i/oauth2/authorize?${q}`;
  }

  private async token(body: Record<string, string>): Promise<SocialGrant> {
    const r = await call<{ access_token: string; expires_in?: number; refresh_token?: string }>(`${X_API}/oauth2/token`, {
      label: "X",
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64")}`,
      },
      body: new URLSearchParams({ client_id: this.clientId, ...body }).toString(),
    });
    return { accessToken: r.access_token, refreshToken: r.refresh_token ?? null, expiresAt: r.expires_in ? new Date(Date.now() + r.expires_in * 1000) : null };
  }

  exchange(code: string, redirectUri: string, state: string) {
    return this.token({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: this.verifier(state) });
  }

  /** X's access lasts two hours; each refresh gives a new refresh token too. */
  async refresh(grant: SocialGrant) {
    if (!grant.refreshToken) throw new SocialAuthError("X: the sign-in has expired — connect again.");
    const fresh = await this.token({ grant_type: "refresh_token", refresh_token: grant.refreshToken });
    return { ...fresh, refreshToken: fresh.refreshToken ?? grant.refreshToken };
  }

  async accounts(grant: SocialGrant) {
    const r = await call<{ data?: { id: string; name: string; username: string } }>(`${X_API}/users/me`, {
      label: "X",
      headers: { Authorization: `Bearer ${grant.accessToken}` },
    });
    return r.data ? [{ id: r.data.id, name: r.data.name, handle: `@${r.data.username}` }] : [];
  }

  /** Uploads the video in pieces; once X has processed it, posts it with the caption. */
  async publish(account: { id: string; accessToken: string }, input: PublishInput, uploadId?: string | null): Promise<PublishResult> {
    const auth = { Authorization: `Bearer ${account.accessToken}` };
    let media = uploadId;
    let state: string;
    if (!media) {
      const init = await call<{ data: { id: string } }>(`${X_API}/media/upload/initialize`, {
        label: "X",
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ media_type: input.mime, total_bytes: input.size, media_category: "tweet_video" }),
      });
      media = init.data.id;
      let segment = 0;
      const sizes = Array.from({ length: Math.ceil(input.size / X_PIECE) }, () => X_PIECE);
      for await (const piece of pieces(await input.open(), sizes)) {
        const form = new FormData();
        form.append("media", new Blob([new Uint8Array(piece)]), "video");
        form.append("segment_index", String(segment++));
        await call(`${X_API}/media/upload/${media}/append`, {
          label: "X",
          method: "POST",
          headers: auth,
          body: form,
          signal: AbortSignal.timeout(10 * 60_000),
        });
      }
      const fin = await call<{ data?: { processing_info?: { state?: string } } }>(`${X_API}/media/upload/${media}/finalize`, {
        label: "X",
        method: "POST",
        headers: auth,
      });
      state = fin.data?.processing_info?.state ?? "succeeded";
    } else {
      const s = await call<{ data?: { processing_info?: { state?: string; error?: { message?: string } } } }>(
        `${X_API}/media/upload?${new URLSearchParams({ command: "STATUS", media_id: media })}`,
        { label: "X", headers: auth },
      );
      state = s.data?.processing_info?.state ?? "succeeded";
      if (state === "failed")
        throw new PermanentSocialError(
          `X could not process the video${s.data?.processing_info?.error?.message ? `: ${s.data.processing_info.error.message}` : "."}`,
        );
    }
    if (state === "failed") throw new PermanentSocialError("X could not process the video.");
    if (state !== "succeeded") return { done: false, uploadId: media };
    const text = input.caption.length > 280 ? `${input.caption.slice(0, 279)}…` : input.caption;
    const r = await call<{ data: { id: string } }>(`${X_API}/tweets`, {
      label: "X",
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ text, media: { media_ids: [media] } }),
    });
    return { done: true, id: r.data.id, url: `https://x.com/i/web/status/${r.data.id}` };
  }

  async metrics(account: { id: string; accessToken: string }, postId: string): Promise<SocialMetrics> {
    const r = await call<{
      data?: {
        public_metrics?: {
          impression_count?: number;
          like_count?: number;
          reply_count?: number;
          retweet_count?: number;
          quote_count?: number;
          bookmark_count?: number;
        };
      };
    }>(`${X_API}/tweets/${encodeURIComponent(postId)}?tweet.fields=public_metrics`, {
      label: "X",
      headers: { Authorization: `Bearer ${account.accessToken}` },
    });
    const m = r.data?.public_metrics;
    return {
      views: m?.impression_count ?? null,
      likes: m?.like_count ?? null,
      comments: m?.reply_count ?? null,
      shares: m ? (m.retweet_count ?? 0) + (m.quote_count ?? 0) : null,
      saves: m?.bookmark_count ?? null,
    };
  }
}

/** Our Meta, Google, LinkedIn and X apps; a platform whose app keys are missing cannot be connected (it is posted by hand). */
export class LiveSocialNetworks implements SocialNetworks {
  readonly kind = "live" as const;
  private readonly networks: Partial<Record<SocialPlatform, SocialNetwork>> = {};

  constructor(keys: {
    metaAppId?: string;
    metaAppSecret?: string;
    graphUrl: string;
    googleClientId?: string;
    googleClientSecret?: string;
    linkedinClientId?: string;
    linkedinClientSecret?: string;
    linkedinVersion: string;
    xClientId?: string;
    xClientSecret?: string;
  }) {
    if (keys.metaAppId && keys.metaAppSecret) {
      const meta = new MetaNetwork(keys.metaAppId, keys.metaAppSecret, keys.graphUrl);
      this.networks.instagram = new InstagramNetwork(meta, keys.graphUrl);
      this.networks.facebook = new FacebookNetwork(meta, keys.graphUrl);
    }
    if (keys.googleClientId && keys.googleClientSecret) this.networks.youtube = new YouTubeNetwork(keys.googleClientId, keys.googleClientSecret);
    if (keys.linkedinClientId && keys.linkedinClientSecret)
      this.networks.linkedin = new LinkedInNetwork(keys.linkedinClientId, keys.linkedinClientSecret, keys.linkedinVersion);
    if (keys.xClientId && keys.xClientSecret) this.networks.x = new XNetwork(keys.xClientId, keys.xClientSecret);
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
    return {
      accessToken: `outbox-token-${this.platform}-${++this.n}`,
      refreshToken: this.platform === "youtube" || this.platform === "x" ? "outbox-refresh" : null,
      expiresAt: null,
    };
  }

  async refresh(grant: SocialGrant) {
    return { ...grant, accessToken: `${grant.accessToken}-fresh`, expiresAt: new Date(Date.now() + 3_600_000) };
  }

  async accounts(_grant: SocialGrant, hint: { handle: string }) {
    const h = clean(hint.handle);
    // LinkedIn and X post with the sign-in's own token (kept fresh with its refresh token), not one per account.
    const own = (token: string) => (this.platform === "linkedin" || this.platform === "x" ? {} : { accessToken: token });
    if (h.includes("choose"))
      return [
        { id: `${this.platform}-acc-a`, name: "First account", handle: "@first", ...own("outbox-page-a") },
        { id: `${this.platform}-acc-b`, name: "Second account", handle: "@second", ...own("outbox-page-b") },
      ];
    return [
      { id: `${this.platform}-${h}`, name: h, handle: `@${h}`, ...own(`outbox-page-${h}`) },
      { id: `${this.platform}-other`, name: "Another page", handle: "@another", ...own("outbox-page-other") },
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
    linkedin: new OutboxNetwork("linkedin", this),
    x: new OutboxNetwork("x", this),
  };

  get(platform: SocialPlatform) {
    return this.networks[platform];
  }
}
