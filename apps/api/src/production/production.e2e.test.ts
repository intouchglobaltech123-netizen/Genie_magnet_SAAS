// The production pipeline (Phase 2), from an idea to a published video, on the sample agency.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PRODUCTION_SETTINGS, formatVideoCode, type NotificationList, type UploadStart } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let ashwin: Agent; // manager
let karthik: Agent; // team leader: approves scripts and quality checks
let divya: Agent; // editor: only her own videos
let meena: Agent; // social media manager: publishes
let clientId: string;
const dir = mkdtempSync(join(tmpdir(), "gm-prod-"));

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthsFromNow = (n: number) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  return iso(d).slice(0, 7);
};
const M = monthsFromNow(0);
const due = `${M}-25`;
const DIVYA = seedUserId("divya@geniemagnet.test");

type Content = { id: string; stage: string; scripts: { label: string; status: string }[]; video: { id: string; code: string } | null; pick: string | null };
type Video = {
  id: string;
  code: string;
  stage: string;
  revisionsUsed: number;
  qc: { key: string; result: "pass" | "fail" | null }[];
  versions: { id: string; label: string; status: string; comments: { author: string; text: string }[] }[];
  moves: { to: string; blocked: string | null }[];
};

beforeAll(async () => {
  t = await startSeededApp({ FILES_DIR: dir });
  [ashwin, karthik, divya, meena] = await Promise.all(["ashwin", "karthik", "divya", "meena"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  // A client of its own, with an agreement that started last month: 4 reels a month, 2 revisions each.
  clientId = (
    await ashwin
      .post("/clients")
      .send({ name: "Thendral Foods", code: "TND", contacts: [{ name: "Kumar", phone: "+91 98400 22002", approver: true }] })
      .expect(201)
  ).body.id;
  const a = (
    await ashwin
      .post(`/clients/${clientId}/agreements`)
      .send({
        title: "Thendral · Reels",
        startDate: `${monthsFromNow(-1)}-01`,
        months: 12,
        monthlyFee: 40000,
        billing: "Monthly advance",
        revisionsPerDeliverable: 2,
        shootDays: 1,
        deliverables: [{ name: "Reels", perMonth: 4, kind: "video" }],
        platforms: ["instagram"],
      })
      .expect(201)
  ).body;
  await ashwin.post(`/agreements/${a.id}/sign-off`).expect(200);
}, 180_000);

afterAll(async () => {
  await t?.stop();
  rmSync(dir, { recursive: true, force: true });
}, 60_000);

describe("content", () => {
  let ideas: Content[];

  it("starts from the client's pillars and the idea bank", async () => {
    await karthik
      .put(`/clients/${clientId}/pillars`)
      .send({ pillars: ["Farm to pack", "Recipes in 60 seconds"] })
      .expect(200);
    ideas = [];
    for (const title of ["Millet dosa in 60 seconds", "Where our turmeric comes from", "Five healthy swaps"])
      ideas.push((await karthik.post("/content").send({ clientId, title, pillar: "Farm to pack", format: "Reel", month: M }).expect(201)).body);
    expect(ideas.map((i) => i.stage)).toEqual(["idea", "idea", "idea"]);
  });

  it("goes on the month's topic list; the client's picks go to research and the rest back to the bank", async () => {
    const lists = (await karthik.put("/topic-lists").send({ clientId, month: M, needed: 2 }).expect(200)).body as { id: string }[];
    const listId = lists[0]!.id;
    await karthik.post(`/topic-lists/${listId}/confirm`).expect(409);
    await karthik.post(`/topic-lists/${listId}/send`).expect(200);
    await karthik.put(`/content/${ideas[0]!.id}/pick`).send({ pick: "picked" }).expect(200);
    await karthik.put(`/content/${ideas[1]!.id}/pick`).send({ pick: "picked" }).expect(200);
    await karthik.put(`/content/${ideas[2]!.id}/pick`).send({ pick: "skipped" }).expect(200);
    const [list] = (await karthik.post(`/topic-lists/${listId}/confirm`).expect(200)).body as { status: string }[];
    expect(list!.status).toBe("confirmed");
    const stages = await Promise.all(ideas.map(async (i) => ((await karthik.get(`/content/${i.id}`).expect(200)).body as Content).stage));
    expect(stages).toEqual(["research", "research", "idea"]);
  });

  it("is researched and scripted; the client asks for changes, then approves — and it becomes a video", async () => {
    const id = ideas[0]!.id;
    const bad = await karthik
      .patch(`/content/${id}`)
      .send({ links: [{ label: "Recipe", url: "http://example.com" }] })
      .expect(400);
    expect(bad.body.issues[0].message).toBe("Use an https:// link");
    await karthik
      .patch(`/content/${id}`)
      .send({ research: "Millets: 3x fibre of rice.", links: [{ label: "Recipe", url: "https://example.com/dosa" }] })
      .expect(200);
    await karthik.post(`/content/${id}/research-done`).expect(200);

    const script = { hook: "Dosa in 60 seconds?", body: "Batter, pan, flip.", cta: "Order now", onScreen: "" };
    await karthik.put(`/content/${id}/script`).send(script).expect(200);
    let c = (
      await karthik
        .put(`/content/${id}/script`)
        .send({ ...script, hook: "A millet dosa in 60 seconds?" })
        .expect(200)
    ).body as Content;
    expect(c.scripts.map((s) => s.label)).toEqual(["v1"]);
    await karthik.post(`/content/${id}/script/review`).expect(200);
    await divya.post(`/content/${id}/script/send`).expect(403);
    await karthik.post(`/content/${id}/script/send`).expect(200);

    await karthik.post(`/content/${id}/script/decision`).send({ approved: false }).expect(400);
    c = (await karthik.post(`/content/${id}/script/decision`).send({ approved: false, note: "Show the millet packet" }).expect(200)).body;
    expect(c).toMatchObject({ stage: "script", scripts: [{ label: "v1", status: "changes" }] });
    c = (
      await karthik
        .put(`/content/${id}/script`)
        .send({ ...script, body: "Packet, batter, pan, flip." })
        .expect(200)
    ).body;
    expect(c.scripts.map((s) => `${s.label}:${s.status}`)).toEqual(["v2:draft", "v1:changes"]);
    await karthik.post(`/content/${id}/script/send`).expect(200);
    const done = (await karthik.post(`/content/${id}/script/decision`).send({ approved: true }).expect(200)).body as Content & { videoId: string };
    expect(done.stage).toBe("ready");
    const video = (await ashwin.get(`/videos/${done.videoId}`).expect(200)).body as Video;
    expect(video).toMatchObject({ code: formatVideoCode(DEFAULT_PRODUCTION_SETTINGS.videoCodeFormat, "TND", M, 1), stage: "planned" });
  });
});

describe("a video through production", () => {
  let v: Video;

  it("is made with the next code and its editor is told", async () => {
    v = (await ashwin.post("/videos").send({ clientId, title: "Turmeric farm visit", format: "Reel", dueDate: due, editorId: DIVYA }).expect(201)).body;
    expect(v.code).toBe(formatVideoCode(DEFAULT_PRODUCTION_SETTINGS.videoCodeFormat, "TND", M, 2));
    const n = (await divya.get("/notifications").expect(200)).body as NotificationList;
    expect(n.items[0]).toMatchObject({ kind: "video_assigned", title: `New video for you: ${v.code}` });
  });

  it("is seen by its editor, who sees only her own videos", async () => {
    const mine = (await divya.get(`/videos?clientId=${clientId}`).expect(200)).body as Video[];
    expect(mine.map((x) => x.code)).toEqual([v.code]);
  });

  it("moves only when its checks pass: footage protected, edit steps done, time over plan explained", async () => {
    await divya.post(`/videos/${v.id}/move`).send({ to: "shot" }).expect(200);
    const blocked = await divya.post(`/videos/${v.id}/move`).send({ to: "editing" }).expect(409);
    expect(blocked.body.message).toBe("The footage is not backed up and verified (VP) yet.");
    await divya.put(`/videos/${v.id}/protect`).send({ done: true }).expect(200);
    await divya.post(`/videos/${v.id}/move`).send({ to: "editing" }).expect(200);
    expect((await divya.post(`/videos/${v.id}/move`).send({ to: "internal_qc" }).expect(409)).body.message).toBe("9 of 9 edit steps are still open.");
    // All at once, as ticking quickly does: none of the ticks may be lost.
    await Promise.all(DEFAULT_PRODUCTION_SETTINGS.editSteps.map((step) => divya.put(`/videos/${v.id}/edit-steps`).send({ step, done: true }).expect(200)));
    await divya
      .post(`/videos/${v.id}/time`)
      .send({ date: iso(new Date()), minutes: 360, note: "Colour took long" })
      .expect(201);
    expect((await divya.post(`/videos/${v.id}/move`).send({ to: "internal_qc" }).expect(409)).body.message).toMatch(/longer than planned/);
    await divya.patch(`/videos/${v.id}`).send({ delayReason: "Re-shot B-rolls" }).expect(200);
    v = (await divya.post(`/videos/${v.id}/move`).send({ to: "internal_qc" }).expect(200)).body;
    expect(v.stage).toBe("internal_qc");
  });

  it("is held by a failed quality check, which goes back to the editor", async () => {
    await divya.put(`/videos/${v.id}/qc`).send({ check: "audio", result: "pass" }).expect(403);
    await karthik.put(`/videos/${v.id}/qc`).send({ check: "audio", result: "fail" }).expect(400);
    await karthik.put(`/videos/${v.id}/qc`).send({ check: "audio", result: "fail", note: "BGM too loud" }).expect(200);
    expect(((await divya.get("/notifications").expect(200)).body as NotificationList).items[0]).toMatchObject({ kind: "qc_failed", body: "BGM too loud" });
    await divya.post(`/videos/${v.id}/versions`).send({ link: "https://drive.example/tnd-v1" }).expect(201);
    expect((await divya.post(`/videos/${v.id}/versions/send`).expect(409)).body.message).toBe("Failed quality check: Audio levels & clarity.");
    await Promise.all(DEFAULT_PRODUCTION_SETTINGS.qcChecks.map((c) => karthik.put(`/videos/${v.id}/qc`).send({ check: c.key, result: "pass" }).expect(200)));
    v = (await divya.post(`/videos/${v.id}/versions/send`).expect(200)).body;
    expect(v).toMatchObject({ stage: "client_review", versions: [{ label: "v1", status: "sent" }] });
  });

  it("goes to revision when the client asks for changes, counted against the allowance", async () => {
    v = (await divya.post(`/videos/${v.id}/decision`).send({ approved: false, note: "Logo too small at the end" }).expect(200)).body;
    expect(v.stage).toBe("revision");
    expect(v.versions[0]).toMatchObject({ status: "changes_requested", comments: [{ author: "Thendral Foods", text: "Logo too small at the end" }] });

    await divya.post("/change-requests").send({ videoId: v.id, kind: "included_revision", summary: "Bigger end logo" }).expect(201);
    await divya.post("/change-requests").send({ videoId: v.id, kind: "included_revision", summary: "New music" }).expect(201);
    const used = await divya.post("/change-requests").send({ videoId: v.id, kind: "included_revision", summary: "Third round" }).expect(409);
    expect(used.body.message).toBe("The 2 included revisions are used — make it a change request.");
    expect(
      (await divya.post("/change-requests").send({ videoId: v.id, kind: "change_request", summary: "Add a Tamil version" }).expect(400)).body.issues[0].path,
    ).toBe("estimate");
    const cr = (
      await divya
        .post("/change-requests")
        .send({ videoId: v.id, kind: "change_request", summary: "Add a Tamil version", estimate: 8000, dateImpactDays: 3 })
        .expect(201)
    ).body as {
      id: string;
      video: Video;
    };
    expect(cr.video.revisionsUsed).toBe(2);
    await divya.post(`/change-requests/${cr.id}/status`).send({ status: "done" }).expect(409);
    for (const status of ["awaiting_client", "approved", "done"]) await divya.post(`/change-requests/${cr.id}/status`).send({ status }).expect(200);
  });

  it("is checked again, sent as v2 and approved", async () => {
    expect((await divya.post(`/videos/${v.id}/move`).send({ to: "client_review" }).expect(409)).body.message).toMatch(/quality check again/);
    v = (await divya.post(`/videos/${v.id}/move`).send({ to: "internal_qc" }).expect(200)).body;
    expect(v.qc.every((c) => c.result === null)).toBe(true);
    await divya.post(`/videos/${v.id}/versions`).send({ link: "https://drive.example/tnd-v2", duration: "00:42" }).expect(201);
    expect((await divya.post(`/videos/${v.id}/versions/send`).expect(409)).body.message).toMatch(/quality check/i);
    await Promise.all(DEFAULT_PRODUCTION_SETTINGS.qcChecks.map((c) => karthik.put(`/videos/${v.id}/qc`).send({ check: c.key, result: "pass" }).expect(200)));
    await divya.post(`/videos/${v.id}/versions/send`).expect(200);
    v = (await divya.post(`/videos/${v.id}/decision`).send({ approved: true }).expect(200)).body;
    expect(v.stage).toBe("approved");
    expect(v.versions.map((x) => `${x.label}:${x.status}`)).toEqual(["v2:approved", "v1:changes_requested"]);
    expect(v.moves.find((m) => m.to === "published")!.blocked).toMatch(/from Publishing/);
  });

  it("is published with its link and proof", async () => {
    await meena.post(`/clients/${clientId}/platforms`).send({ platform: "instagram", handle: "@thendralfoods" }).expect(201);
    const [ig] = (await meena.get(`/clients/${clientId}/platforms`).expect(200)).body as { id: string }[];
    const queue = (
      await meena
        .post("/publishing/posts")
        .send({ videoId: v.id, connectionId: ig!.id, scheduledAt: new Date().toISOString(), caption: "Turmeric!" })
        .expect(201)
    ).body as {
      id: string;
      posts: { id: string }[];
    }[];
    const post = queue.find((q) => q.id === v.id)!.posts[0]!;

    const proof = (await meena.post("/files").send({ name: "proof.png", mime: "image/png", size: 12, entity: "publishing", entityId: v.id }).expect(201))
      .body as UploadStart;
    await request(t.app.getHttpServer()).put(new URL(proof.uploadUrl).pathname).set("Content-Type", "image/png").send(Buffer.from("proof-bytes!")).expect(200);
    const bad = await meena
      .post(`/publishing/posts/${post.id}/published`)
      .send({ url: "https://instagram.com/p/abc", publishedAt: new Date().toISOString(), proofFileId: proof.id })
      .expect(400);
    expect(bad.body.issues[0].path).toBe("confirmed");
    await divya
      .post(`/publishing/posts/${post.id}/published`)
      .send({ url: "https://instagram.com/p/abc", publishedAt: new Date().toISOString(), proofFileId: proof.id, confirmed: true })
      .expect(403);
    await meena
      .post(`/publishing/posts/${post.id}/published`)
      .send({ url: "https://instagram.com/p/abc", publishedAt: new Date().toISOString(), proofFileId: proof.id, confirmed: true })
      .expect(200);
    expect(((await ashwin.get(`/videos/${v.id}`).expect(200)).body as Video).stage).toBe("published");
  });
});

describe("a shoot", () => {
  it("signs the kit out and back, and moves its videos to Shot", async () => {
    const [planned] = (await ashwin.get(`/videos?clientId=${clientId}&stage=planned`).expect(200)).body as Video[];
    let s = (
      await ashwin
        .post("/shoots")
        .send({ clientId, title: "Thendral kitchen day", date: due, callTime: "07:00", kit: "single", videoIds: [planned!.id] })
        .expect(201)
    ).body as {
      id: string;
      status: string;
      signatures: Record<string, { byName: string | null }>;
      kit: { items: string[] };
      videos: { stage: string }[];
    };
    expect(s.videos[0]!.stage).toBe("shoot_scheduled");
    expect((await ashwin.post(`/shoots/${s.id}/sign`).send({ as: "giver" }).expect(409)).body.message).toMatch(/not packed/);
    await ashwin.post(`/shoots/${s.id}/kit/all`).send({ column: "packed" }).expect(200);
    s = (await ashwin.post(`/shoots/${s.id}/sign`).send({ as: "giver" }).expect(200)).body;
    expect(s).toMatchObject({ status: "packed", signatures: { giver: { byName: "Ashwin" } } });
    await ashwin.post(`/shoots/${s.id}/sign`).send({ as: "giver" }).expect(409);
    await ashwin.post(`/shoots/${s.id}/start`).expect(200);
    s = (await ashwin.post(`/shoots/${s.id}/videos-shot`).expect(200)).body;
    expect(s.videos[0]!.stage).toBe("shot");

    const missing = await ashwin.post(`/shoots/${s.id}/sign`).send({ as: "receiver" }).expect(409);
    expect(missing.body.message).toMatch(/Not back yet/);
    await ashwin
      .post(`/shoots/${s.id}/incidents`)
      .send({ items: ["Headset"], note: "Left at the location" })
      .expect(201);
    await ashwin.post(`/shoots/${s.id}/kit/all`).send({ column: "received" }).expect(200);
    expect(((await ashwin.post(`/shoots/${s.id}/sign`).send({ as: "receiver" }).expect(200)).body as { status: string }).status).toBe("returned");
    await ashwin.post(`/shoots/${s.id}/sign`).send({ as: "client" }).expect(400);
    expect(((await ashwin.post(`/shoots/${s.id}/sign`).send({ as: "client", name: "Kumar" }).expect(200)).body as { status: string }).status).toBe("closed");
  });
});

describe("monthly cycles", () => {
  it("count what was promised and delivered, and a closed month carries its shortfall", async () => {
    const cycles = (await ashwin.get(`/cycles?month=${M}`).expect(200)).body as {
      id: string;
      client: { code: string };
      promised: number;
      delivered: number;
      status: string;
    }[];
    expect(cycles.find((c) => c.client.code === "TND")).toMatchObject({ promised: 4, delivered: 1, status: "in_progress" });
    await ashwin
      .post(`/cycles/${cycles.find((c) => c.client.code === "TND")!.id}/close`)
      .send({})
      .expect(409);

    const last = monthsFromNow(-1);
    const made = (await ashwin.post("/cycles/generate").send({ month: last }).expect(200)).body as { cycles: { id: string; client: { code: string } }[] };
    const prev = made.cycles.find((c) => c.client.code === "TND")!;
    await ashwin.post(`/cycles/${prev.id}/close`).send({}).expect(400);
    await karthik.post(`/cycles/${prev.id}/close`).send({ decision: "carry" }).expect(403);
    expect((await ashwin.post(`/cycles/${prev.id}/close`).send({ decision: "carry" }).expect(200)).body).toMatchObject({
      status: "closed",
      decision: "carry",
      delivered: 0,
    });
    const now = ((await ashwin.get(`/cycles?month=${M}`).expect(200)).body as { client: { code: string }; promised: number; carriedIn: number }[]).find(
      (c) => c.client.code === "TND",
    );
    expect(now).toMatchObject({ promised: 8, carriedIn: 4 });
  });
});
