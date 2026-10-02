// Phase 2 exit gate (P2-17): videos go from idea to published, with every step recorded — three of them, as one story:
// ideas and the client's picks, scripts the client approves, one shoot for all three, editing and the quality check,
// a revision, and publishing with proof; then the month's delivery, the calendar and the time add up.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PRODUCTION_SETTINGS, type UploadStart } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let ashwin: Agent; // manager
let karthik: Agent; // team leader: scripts and the quality check
let divya: Agent; // editor
let surya: Agent; // editor
let vignesh: Agent; // shooter
let meena: Agent; // social media manager: publishes
let clientId: string;
let videos: { id: string; code: string; editor: Agent }[] = [];
let shootId: string;
const dir = mkdtempSync(join(tmpdir(), "gm-gate2-"));

const iso = (d: Date) => d.toISOString().slice(0, 10);
const M = iso(new Date()).slice(0, 7);
const lastDay = (() => {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + 1, 0);
  return iso(d);
})();
const due = `${M}-26`;
const TITLES = ["Mango pickle, start to jar", "Why we sun-dry our chillies", "Grandma's podi, three ways"];

type Video = { id: string; code: string; stage: string; qc: { key: string; result: string | null }[]; history: { to: string }[] };

beforeAll(async () => {
  t = await startSeededApp({ FILES_DIR: dir });
  [ashwin, karthik, divya, surya, vignesh, meena] = await Promise.all(
    ["ashwin", "karthik", "divya", "surya", "vignesh", "meena"].map((p) => t.signInAs(`${p}@geniemagnet.test`)),
  );
  clientId = (
    await ashwin
      .post("/clients")
      .send({ name: "Amma's Kitchen", code: "AMK", contacts: [{ name: "Lalitha", phone: "+91 98400 44004", approver: true }] })
      .expect(201)
  ).body.id;
  const a = (
    await ashwin
      .post(`/clients/${clientId}/agreements`)
      .send({
        title: "Amma's Kitchen · Reels",
        startDate: `${M}-01`,
        months: 6,
        monthlyFee: 45000,
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

describe("Phase 2: three videos from idea to published", () => {
  it("1. ideas go on the month's topic list; the client picks three", async () => {
    await karthik
      .put(`/clients/${clientId}/pillars`)
      .send({ pillars: ["Family recipes", "From our farm"] })
      .expect(200);
    const ids: string[] = [];
    for (const title of [...TITLES, "A spare idea for later"])
      ids.push((await karthik.post("/content").send({ clientId, title, pillar: "Family recipes", format: "Reel", month: M }).expect(201)).body.id);
    const [list] = (await karthik.put("/topic-lists").send({ clientId, month: M, needed: 3 }).expect(200)).body as { id: string }[];
    await karthik.post(`/topic-lists/${list!.id}/send`).expect(200);
    for (const [i, id] of ids.entries())
      await karthik
        .put(`/content/${id}/pick`)
        .send({ pick: i < 3 ? "picked" : "skipped" })
        .expect(200);
    await karthik.post(`/topic-lists/${list!.id}/confirm`).expect(200);

    // 2. Researched and scripted; the client approves each script, and each becomes a video.
    for (const id of ids.slice(0, 3)) {
      await karthik
        .patch(`/content/${id}`)
        .send({ research: "Family recipe, told by Lalitha.", links: [{ label: "Notes", url: "https://example.com/notes" }] })
        .expect(200);
      await karthik.post(`/content/${id}/research-done`).expect(200);
      await karthik.put(`/content/${id}/script`).send({ hook: "Grandma knew best.", body: "Show, then tell.", cta: "Order today", onScreen: "" }).expect(200);
      await karthik.post(`/content/${id}/script/send`).expect(200);
      const done = (await karthik.post(`/content/${id}/script/decision`).send({ approved: true }).expect(200)).body as { videoId: string };
      const v = (await ashwin.get(`/videos/${done.videoId}`).expect(200)).body as Video;
      videos.push({ id: v.id, code: v.code, editor: videos.length === 1 ? surya : divya });
    }
    expect(videos.map((v) => v.code)).toEqual([1, 2, 3].map((n) => `AMK-${M.slice(5)}${M.slice(2, 4)}-${String(n).padStart(2, "0")}`));
  });

  it("3. editors are given their videos, and one shoot covers all three; the kit goes out and comes back signed", async () => {
    for (const v of videos)
      await ashwin
        .patch(`/videos/${v.id}`)
        .send({ dueDate: due, editorId: seedUserId(v.editor === surya ? "surya@geniemagnet.test" : "divya@geniemagnet.test") })
        .expect(200);
    shootId = (
      await ashwin
        .post("/shoots")
        .send({
          clientId,
          title: "Kitchen day",
          date: `${M}-10`,
          callTime: "07:30",
          kit: "single",
          cameraId: seedUserId("vignesh@geniemagnet.test"),
          videoIds: videos.map((v) => v.id),
        })
        .expect(201)
    ).body.id;
    await vignesh.post(`/shoots/${shootId}/kit/all`).send({ column: "packed" }).expect(200);
    await vignesh.post(`/shoots/${shootId}/sign`).send({ as: "giver" }).expect(200);
    await vignesh.post(`/shoots/${shootId}/start`).expect(200);
    await vignesh.post(`/shoots/${shootId}/videos-shot`).expect(200);
    await vignesh.post(`/shoots/${shootId}/kit/all`).send({ column: "received" }).expect(200);
    await vignesh.post(`/shoots/${shootId}/sign`).send({ as: "receiver" }).expect(200);
    const s = (await vignesh.post(`/shoots/${shootId}/sign`).send({ as: "client", name: "Lalitha" }).expect(200)).body;
    expect(s.status).toBe("closed");
    await vignesh
      .post(`/shoots/${shootId}/time`)
      .send({ date: `${M}-10`, minutes: 420, note: "Travel, set-up and three reels" })
      .expect(201);
    for (const v of videos) expect(((await ashwin.get(`/videos/${v.id}`).expect(200)).body as Video).stage).toBe("shot");
  });

  it("4. each is backed up, edited step by step and checked; one fails a check first", async () => {
    for (const v of videos) {
      await v.editor.put(`/videos/${v.id}/protect`).send({ done: true }).expect(200);
      await v.editor.post(`/videos/${v.id}/move`).send({ to: "editing" }).expect(200);
      await Promise.all(DEFAULT_PRODUCTION_SETTINGS.editSteps.map((step) => v.editor.put(`/videos/${v.id}/edit-steps`).send({ step, done: true }).expect(200)));
      await v.editor
        .post(`/videos/${v.id}/time`)
        .send({ date: iso(new Date()), minutes: 240, note: "Edit" })
        .expect(201);
      await v.editor.post(`/videos/${v.id}/move`).send({ to: "internal_qc" }).expect(200);
    }
    const first = videos[0]!;
    await karthik.put(`/videos/${first.id}/qc`).send({ check: "captions", result: "fail", note: "Captions run off the screen" }).expect(200);
    await first.editor.post(`/videos/${first.id}/versions`).send({ link: "https://drive.example/amk-1-v1" }).expect(201);
    expect((await first.editor.post(`/videos/${first.id}/versions/send`).expect(409)).body.message).toMatch(/Failed quality check/);
    for (const v of videos)
      await Promise.all(DEFAULT_PRODUCTION_SETTINGS.qcChecks.map((c) => karthik.put(`/videos/${v.id}/qc`).send({ check: c.key, result: "pass" }).expect(200)));
  });

  it("5. versions go to the client: two are approved, one comes back for a revision and is approved as v2", async () => {
    for (const v of videos.slice(1))
      await v.editor
        .post(`/videos/${v.id}/versions`)
        .send({ link: `https://drive.example/${v.code}-v1` })
        .expect(201);
    for (const v of videos) await v.editor.post(`/videos/${v.id}/versions/send`).expect(200);
    for (const v of videos.slice(0, 2)) await karthik.post(`/videos/${v.id}/decision`).send({ approved: true }).expect(200);

    const third = videos[2]!;
    await karthik.post(`/videos/${third.id}/decision`).send({ approved: false, note: "Show the podi on rice" }).expect(200);
    const cr = (await karthik.post("/change-requests").send({ videoId: third.id, kind: "included_revision", summary: "Podi on rice" }).expect(201)).body;
    expect(cr.video.revisionsUsed).toBe(1);
    await third.editor.post(`/videos/${third.id}/move`).send({ to: "internal_qc" }).expect(200);
    // A new cut is checked again.
    await third.editor
      .post(`/videos/${third.id}/versions`)
      .send({ link: `https://drive.example/${third.code}-v2` })
      .expect(201);
    await third.editor.post(`/videos/${third.id}/versions/send`).expect(409);
    await Promise.all(
      DEFAULT_PRODUCTION_SETTINGS.qcChecks.map((c) => karthik.put(`/videos/${third.id}/qc`).send({ check: c.key, result: "pass" }).expect(200)),
    );
    await third.editor.post(`/videos/${third.id}/versions/send`).expect(200);
    await karthik.post(`/videos/${third.id}/decision`).send({ approved: true }).expect(200);
    for (const v of videos) expect(((await ashwin.get(`/videos/${v.id}`).expect(200)).body as Video).stage).toBe("approved");
  });

  it("6. each is scheduled on the client's Instagram and marked published with its link and a screenshot", async () => {
    await meena.post(`/clients/${clientId}/platforms`).send({ platform: "instagram", handle: "@ammaskitchen" }).expect(201);
    const [ig] = (await meena.get(`/clients/${clientId}/platforms`).expect(200)).body as { id: string }[];
    for (const v of videos) {
      const queue = (
        await meena
          .post("/publishing/posts")
          .send({ videoId: v.id, connectionId: ig!.id, scheduledAt: new Date().toISOString(), caption: "From Amma's kitchen" })
          .expect(201)
      ).body as { id: string; posts: { id: string }[] }[];
      const post = queue.find((q) => q.id === v.id)!.posts[0]!;
      const proof = (await meena.post("/files").send({ name: "proof.png", mime: "image/png", size: 12, entity: "publishing", entityId: v.id }).expect(201))
        .body as UploadStart;
      await request(t.app.getHttpServer())
        .put(new URL(proof.uploadUrl).pathname)
        .set("Content-Type", "image/png")
        .send(Buffer.from("proof-bytes!"))
        .expect(200);
      await meena
        .post(`/publishing/posts/${post.id}/published`)
        .send({ url: `https://instagram.com/p/${v.code}`, publishedAt: new Date().toISOString(), proofFileId: proof.id, confirmed: true })
        .expect(200);
      expect(((await ashwin.get(`/videos/${v.id}`).expect(200)).body as Video).stage).toBe("published");
    }
  });

  it("7. the month's delivery, the calendar, the time and the history all add up", async () => {
    const cycles = (await ashwin.get(`/cycles?month=${M}`).expect(200)).body as { client: { code: string }; promised: number; delivered: number }[];
    expect(cycles.find((c) => c.client.code === "AMK")).toMatchObject({ promised: 4, delivered: 3 });

    const events = (await ashwin.get(`/calendar?from=${M}-01&to=${lastDay}`).expect(200)).body as { kind: string; title: string; state: string }[];
    expect(events.filter((e) => e.kind === "shoot" && e.title === "Kitchen day")).toHaveLength(1);
    expect(events.filter((e) => e.kind === "post" && e.state === "done" && e.title.startsWith("AMK-"))).toHaveLength(3);

    const time = (await ashwin.get(`/time?from=${M}-01&to=${lastDay}`).expect(200)).body as { minutes: number; on: { kind: string; label: string } }[];
    const amk = time.filter((e) => e.on.kind === "shoot" || e.on.label.startsWith("AMK-"));
    expect(amk.reduce((n, e) => n + e.minutes, 0)).toBe(420 + 3 * 240);

    const third = (await ashwin.get(`/videos/${videos[2]!.id}`).expect(200)).body as { history: { to: string }[] };
    expect(third.history.map((h) => h.to).reverse()).toEqual([
      "planned",
      "shoot_scheduled",
      "shot",
      "editing",
      "internal_qc",
      "client_review",
      "revision",
      "internal_qc",
      "client_review",
      "approved",
      "published",
    ]);
  });

  it("8. a person in the other agency sees none of it", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    const all = (await zara.get("/videos").expect(200)).body as { code: string }[];
    expect(all.some((v) => v.code.startsWith("AMK-"))).toBe(false);
    await zara.get(`/videos/${videos[0]!.id}`).expect(404);
    await zara.get(`/shoots/${shootId}`).expect(404);
    // Only Zen Studio's own sales follow-ups are on its calendar.
    const events = (await zara.get(`/calendar?from=${M}-01&to=${lastDay}`).expect(200)).body as { link: string }[];
    const zenLeads = new Set(((await zara.get("/leads").expect(200)).body as { id: string }[]).map((l) => `/app/sales?lead=${l.id}`));
    expect(events.every((e) => zenLeads.has(e.link))).toBe(true);
  });
});
