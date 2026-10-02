// Social connections (P3-11): Instagram, Facebook and YouTube connected through the platform's sign-in, posting by
// themselves at the scheduled time, numbers each day, and posting by hand whenever the app cannot.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PRODUCTION_SETTINGS, type PlatformConnectionRow, type PublishingItem, type SocialSettings, type UploadStart } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { Secrets } from "../common/secrets.js";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";
import { type OutboxSocialNetworks, SOCIAL_NETWORKS } from "./provider.js";

let t: SeededApp;
let ashwin: Agent; // manager
let karthik: Agent; // team leader: quality check, approves for the client
let divya: Agent; // editor: no publishing
let meena: Agent; // social media manager: publishes
let outbox: OutboxSocialNetworks;
let runner: JobRunner;
let clientId: string;
let withFile: string; // a video whose approved version has its file
let linkOnly: string; // a video approved from a link
const ids: Record<string, string> = {};
const dir = mkdtempSync(join(tmpdir(), "gm-social-"));
const M = new Date().toISOString().slice(0, 7);
const HOUR = 3_600_000;
const anon = () => request(t.app.getHttpServer());
const later = (hours: number) => new Date(Date.now() + hours * HOUR);
/** The morning after a time, once the daily jobs are due (they run at 02:30 UTC). */
const morningAfter = (d: Date) => new Date(`${new Date(d.getTime() + 24 * HOUR).toISOString().slice(0, 10)}T03:00:00Z`);
let lastMorning: Date;
const platforms = async () => (await meena.get(`/clients/${clientId}/platforms`).expect(200)).body as PlatformConnectionRow[];
const queue = async () => (await meena.get("/publishing").expect(200)).body as PublishingItem[];
const postsOf = async (videoId: string) => (await queue()).find((v) => v.id === videoId)?.posts ?? [];

/** Follows the platform's sign-in: the outbox sends the browser straight back to us. */
async function signIn(platformId: string, state?: (s: string) => string) {
  const { url } = (await meena.post(`/clients/${clientId}/platforms/${platformId}/connect`).expect(200)).body as { url: string };
  const u = new URL(url);
  if (state) u.searchParams.set("state", state(u.searchParams.get("state")!));
  const res = await anon().get(`${u.pathname}${u.search}`).expect(302);
  return res.headers.location as string;
}

/** A video taken through to approved by the client, its approved version a file or a link. */
async function approvedVideo(title: string, file: boolean) {
  const v = (
    await ashwin
      .post("/videos")
      .send({ clientId, title, format: "Reel", dueDate: `${M}-27`, editorId: seedUserId("divya@geniemagnet.test") })
      .expect(201)
  ).body as { id: string };
  await divya.post(`/videos/${v.id}/move`).send({ to: "shot" }).expect(200);
  await divya.put(`/videos/${v.id}/protect`).send({ done: true }).expect(200);
  await divya.post(`/videos/${v.id}/move`).send({ to: "editing" }).expect(200);
  for (const step of DEFAULT_PRODUCTION_SETTINGS.editSteps) await divya.put(`/videos/${v.id}/edit-steps`).send({ step, done: true }).expect(200);
  await divya.post(`/videos/${v.id}/move`).send({ to: "internal_qc" }).expect(200);
  for (const q of DEFAULT_PRODUCTION_SETTINGS.qcChecks) await karthik.put(`/videos/${v.id}/qc`).send({ check: q.key, result: "pass" }).expect(200);
  let version: Record<string, string> = { link: "https://drive.example/tk-final" };
  if (file) {
    const up = (await divya.post("/files").send({ name: "final.mp4", mime: "video/mp4", size: 16, entity: "video", entityId: v.id }).expect(201))
      .body as UploadStart;
    await anon().put(new URL(up.uploadUrl).pathname).set("Content-Type", "video/mp4").send(Buffer.from("pretend-mp4-data")).expect(200);
    version = { fileId: up.id };
  }
  await divya.post(`/videos/${v.id}/versions`).send(version).expect(201);
  await divya.post(`/videos/${v.id}/versions/send`).expect(200);
  await karthik.post(`/videos/${v.id}/decision`).send({ approved: true }).expect(200);
  return v.id;
}

beforeAll(async () => {
  t = await startSeededApp({ FILES_DIR: dir });
  [ashwin, karthik, divya, meena] = await Promise.all(["ashwin", "karthik", "divya", "meena"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  outbox = t.app.get<OutboxSocialNetworks>(SOCIAL_NETWORKS);
  runner = t.app.get(JobRunner);
  clientId = (
    (
      await ashwin
        .post("/clients")
        .send({ name: "Tiruppur Knits", code: "TPK", contacts: [{ name: "Selvi", phone: "+91 98400 66001", approver: true }] })
        .expect(201)
    ).body as { id: string }
  ).id;
  for (const [platform, handle] of [
    ["instagram", "@tiruppurknits"],
    ["youtube", "@choose-tk"],
    ["x", "@tpk"],
  ] as const) {
    const rows = (await meena.post(`/clients/${clientId}/platforms`).send({ platform, handle }).expect(201)).body as PlatformConnectionRow[];
    ids[platform] = rows.find((r) => r.platform === platform)!.id;
  }
  withFile = await approvedVideo("Cotton tees, packed", true);
  linkOnly = await approvedVideo("Factory tour", false);
}, 300_000);

afterAll(async () => {
  await t?.stop();
  rmSync(dir, { recursive: true, force: true });
}, 60_000);

describe("connecting a client's platforms", () => {
  it("is switched on for Instagram, Facebook and YouTube; other platforms are posted by hand", async () => {
    expect((await meena.get("/social").expect(200)).body as SocialSettings).toEqual({
      provider: "outbox",
      available: { instagram: true, facebook: true, youtube: true },
    });
    const rows = await platforms();
    expect(rows.find((r) => r.platform === "x")).toMatchObject({ status: "manual", canConnect: false, linked: null });
    await meena.post(`/clients/${clientId}/platforms/${ids.x}/connect`).expect(400);
    await divya.post(`/clients/${clientId}/platforms/${ids.instagram}/connect`).expect(403);
  });

  it("links the account matching the handle after signing in, and keeps its access encrypted", async () => {
    const back = await signIn(ids.instagram!);
    expect(back).toBe(`http://localhost:3000/app/clients/${clientId}?social=linked&platform=instagram`);
    expect((await platforms()).find((r) => r.platform === "instagram")).toMatchObject({
      status: "linked",
      linked: { id: "instagram-tiruppurknits", name: "tiruppurknits" },
      autoPublish: true,
      lastError: null,
    });
    const [row] = await t.sql<{ access_token: string }>(`SELECT access_token FROM platform_connections WHERE id = '${ids.instagram}'`);
    expect(row!.access_token).not.toContain("outbox-page");
    const audit = (await ashwin.get(`/audit?entity=platform&entityId=${ids.instagram}&limit=1`).expect(200)).body.items[0];
    expect(audit).toMatchObject({ action: "connect", actor: { name: "Meena Ravi" }, after: { account: "tiruppurknits" } });
  });

  it("asks which account when the sign-in reaches several that do not match", async () => {
    expect(await signIn(ids.youtube!)).toContain("social=choose&platform=youtube");
    const accounts = (await meena.get(`/clients/${clientId}/platforms/${ids.youtube}/accounts`).expect(200)).body as { id: string; name: string }[];
    expect(accounts.map((a) => a.name)).toEqual(["First account", "Second account"]);
    await meena.post(`/clients/${clientId}/platforms/${ids.youtube}/choose`).send({ accountId: "nope" }).expect(400);
    const rows = (await meena.post(`/clients/${clientId}/platforms/${ids.youtube}/choose`).send({ accountId: accounts[1]!.id }).expect(200))
      .body as PlatformConnectionRow[];
    expect(rows.find((r) => r.platform === "youtube")).toMatchObject({ status: "linked", linked: { name: "Second account" } });
  });

  it("refuses a sign-in link that was tampered with", async () => {
    const back = await signIn(ids.instagram!, (s) => `${s.slice(0, -4)}AAAA`);
    expect(back).toBe("http://localhost:3000/app?social=invalid");
  });
});

describe("posting", () => {
  it("goes out by itself at its time — and not at a time it was moved from", async () => {
    await meena
      .post("/publishing/posts")
      .send({ videoId: withFile, connectionId: ids.instagram, scheduledAt: later(1).toISOString(), caption: "Packed and ready #tiruppur" })
      .expect(201);
    let [post] = await postsOf(withFile);
    expect(post).toMatchObject({ status: "scheduled", auto: true, via: "manual" });
    await meena
      .patch(`/publishing/posts/${post!.id}`)
      .send({ scheduledAt: later(3).toISOString() })
      .expect(200);

    await runner.tick(later(2));
    expect((await postsOf(withFile))[0]!.status).toBe("scheduled"); // the job for the old time does nothing
    await runner.tick(later(4));
    [post] = await postsOf(withFile);
    expect(post).toMatchObject({ status: "published", via: "connector", publishedUrl: expect.stringMatching(/^https:\/\/instagram\.example\/p\//) });
    expect(outbox.posts.at(-1)).toMatchObject({
      platform: "instagram",
      account: "instagram-tiruppurknits",
      caption: "Packed and ready #tiruppur",
      mime: "video/mp4",
    });
    expect(outbox.posts.at(-1)!.fileUrl).toMatch(/^http:\/\/localhost:4000\/files\/download\//);
    expect((await queue()).find((v) => v.id === withFile)?.stage).toBe("published");
  });

  it("is marked for the team when the app cannot post it, who post it by hand", async () => {
    await meena
      .post("/publishing/posts")
      .send({ videoId: linkOnly, connectionId: ids.instagram, scheduledAt: later(1).toISOString() })
      .expect(201);
    await runner.tick(later(2));
    const [post] = await postsOf(linkOnly);
    expect(post).toMatchObject({ status: "failed", publishError: expect.stringMatching(/no video file uploaded/) });
    const n = (await ashwin.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "post_failed")?.title).toMatch(/^Could not post TPK-.* on Instagram$/);

    const proof = (await meena.post("/files").send({ name: "proof.png", mime: "image/png", size: 5, entity: "publishing", entityId: linkOnly }).expect(201))
      .body as UploadStart;
    await anon().put(new URL(proof.uploadUrl).pathname).set("Content-Type", "image/png").send(Buffer.from("proof")).expect(200);
    await meena
      .post(`/publishing/posts/${post!.id}/published`)
      .send({ url: "https://instagram.com/p/by-hand", publishedAt: new Date().toISOString(), proofFileId: proof.id, confirmed: true })
      .expect(200);
    expect((await postsOf(linkOnly))[0]).toMatchObject({ status: "published", via: "manual" });
  });

  it("waits while the platform processes the video, then publishes it", async () => {
    const video = await approvedVideo("Kids' range", true);
    await meena
      .post("/publishing/posts")
      .send({ videoId: video, connectionId: ids.instagram, scheduledAt: later(1).toISOString(), caption: "Kids' range [slow]" })
      .expect(201);
    await runner.tick(later(2));
    expect((await postsOf(video))[0]).toMatchObject({ status: "publishing" });
    await divya.post(`/publishing/posts/${(await postsOf(video))[0]!.id}/post-now`).expect(403);
    await runner.tick(new Date(later(2).getTime() + 2 * 60_000));
    expect((await postsOf(video))[0]).toMatchObject({ status: "published", via: "connector" });
  });

  it("can be tried again after the platform refused it", async () => {
    const video = await approvedVideo("Winter range", true);
    await meena
      .post("/publishing/posts")
      .send({ videoId: video, connectionId: ids.youtube, scheduledAt: later(1).toISOString(), caption: "Winter range [refused]" })
      .expect(201);
    await runner.tick(later(2));
    let [post] = await postsOf(video);
    expect(post).toMatchObject({ status: "failed", publishError: "youtube: the video was refused (too short)." });
    await meena.patch(`/publishing/posts/${post!.id}`).send({ caption: "Winter range, all colours" }).expect(200);
    await divya.post(`/publishing/posts/${post!.id}/post-now`).expect(403);
    await meena.post(`/publishing/posts/${post!.id}/post-now`).expect(200);
    await runner.tick(new Date(Date.now() + 60_000));
    [post] = await postsOf(video);
    expect(post).toMatchObject({ status: "published", via: "connector", publishedUrl: expect.stringMatching(/^https:\/\/youtube\.example\//) });
    expect(outbox.posts.at(-1)).toMatchObject({ platform: "youtube", account: "youtube-acc-b", title: "Winter range" });
  });
});

describe("numbers", () => {
  it("come in each day for the posts the app made", async () => {
    lastMorning = morningAfter(later(4));
    await runner.tick(lastMorning);
    const rows = await t.sql<{ views: number; likes: number; source: string }>(
      `SELECT m.views, m.likes, m.source FROM post_metrics m JOIN scheduled_posts p ON p.id = m.post_id WHERE p.published_via = 'connector'`,
    );
    expect(rows.length).toBe(3);
    expect(rows.every((r) => r.source === "connector" && r.views > 1000 && r.likes > 0)).toBe(true);
  });

  it("ask for connecting again when the sign-in stops working", async () => {
    const revoked = t.app.get(Secrets).encrypt("revoked-token");
    await t.sql(`UPDATE platform_connections SET access_token = '${revoked}' WHERE id = '${ids.instagram}'`);
    await runner.tick(morningAfter(lastMorning));
    expect((await platforms()).find((r) => r.platform === "instagram")).toMatchObject({ status: "expired", lastError: "instagram: the sign-in has expired." });
    const n = (await meena.get("/notifications").expect(200)).body.items as { title: string; link: string }[];
    expect(n.find((x) => x.title === "Connect Instagram again for Tiruppur Knits")).toMatchObject({ link: `/app/clients/${clientId}` });
  });
});

describe("disconnecting", () => {
  it("goes back to posting by hand and forgets the access", async () => {
    const rows = (await meena.post(`/clients/${clientId}/platforms/${ids.youtube}/disconnect`).expect(200)).body as PlatformConnectionRow[];
    expect(rows.find((r) => r.platform === "youtube")).toMatchObject({ status: "manual", linked: null });
    const [row] = await t.sql<{ access_token: string | null; refresh_token: string | null }>(
      `SELECT access_token, refresh_token FROM platform_connections WHERE id = '${ids.youtube}'`,
    );
    expect(row).toEqual({ access_token: null, refresh_token: null });
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get(`/clients/${clientId}/platforms`).expect(200)).body).toEqual([]);
    await zara.post(`/clients/${clientId}/platforms/${ids.instagram}/connect`).expect(404);
  });
});
