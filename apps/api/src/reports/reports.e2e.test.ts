// Monthly reports (P3-09): the month for a client, numbers per post, release to the portal, and the 25th's drafts.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PRODUCTION_SETTINGS, type MonthlyReport, type ReportRow, type UploadStart } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent;
let ashwin: Agent; // manager: changes clients
let karthik: Agent; // team leader: sees reports, quality check
let divya: Agent; // editor: no reports
let meena: Agent; // social media manager: publishes
let clientId: string;
let postId: string;
let reportId: string;
let link: string;
const dir = mkdtempSync(join(tmpdir(), "gm-reports-"));
const M = new Date().toISOString().slice(0, 7);
const next = (() => {
  const d = new Date(`${M}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 7);
})();
const anon = () => request(t.app.getHttpServer());

beforeAll(async () => {
  t = await startSeededApp({ FILES_DIR: dir });
  [jana, ashwin, karthik, divya, meena] = await Promise.all(["jana", "ashwin", "karthik", "divya", "meena"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  const c = (
    await ashwin
      .post("/clients")
      .send({ name: "Pollachi Coconuts", code: "PCN", contacts: [{ name: "Kannan", phone: "+91 98400 77001", approver: true }] })
      .expect(201)
  ).body as { id: string; contacts: { id: string }[] };
  clientId = c.id;
  const a = (
    await ashwin
      .post(`/clients/${clientId}/agreements`)
      .send({
        title: "Pollachi · Reels",
        startDate: `${M}-01`,
        months: 6,
        monthlyFee: 20000,
        billing: "Monthly advance",
        revisionsPerDeliverable: 2,
        shootDays: 1,
        deliverables: [{ name: "Reels", perMonth: 4, kind: "video" }],
        platforms: ["instagram"],
      })
      .expect(201)
  ).body as { id: string };
  await jana.post(`/agreements/${a.id}/sign-off`).expect(200);

  // One video through to published on Instagram, with its proof.
  const v = (
    await ashwin
      .post("/videos")
      .send({ clientId, title: "Tender coconut, opened", format: "Reel", dueDate: `${M}-27`, editorId: seedUserId("divya@geniemagnet.test") })
      .expect(201)
  ).body as { id: string };
  await divya.post(`/videos/${v.id}/move`).send({ to: "shot" }).expect(200);
  await divya.put(`/videos/${v.id}/protect`).send({ done: true }).expect(200);
  await divya.post(`/videos/${v.id}/move`).send({ to: "editing" }).expect(200);
  for (const step of DEFAULT_PRODUCTION_SETTINGS.editSteps) await divya.put(`/videos/${v.id}/edit-steps`).send({ step, done: true }).expect(200);
  await divya.post(`/videos/${v.id}/move`).send({ to: "internal_qc" }).expect(200);
  for (const q of DEFAULT_PRODUCTION_SETTINGS.qcChecks) await karthik.put(`/videos/${v.id}/qc`).send({ check: q.key, result: "pass" }).expect(200);
  await divya.post(`/videos/${v.id}/versions`).send({ link: "https://drive.example/pcn-v1" }).expect(201);
  await divya.post(`/videos/${v.id}/versions/send`).expect(200);
  await karthik.post(`/videos/${v.id}/decision`).send({ approved: true }).expect(200);
  await meena.post(`/clients/${clientId}/platforms`).send({ platform: "instagram", handle: "@pollachicoconuts" }).expect(201);
  const [ig] = (await meena.get(`/clients/${clientId}/platforms`).expect(200)).body as { id: string }[];
  const queue = (await meena.post("/publishing/posts").send({ videoId: v.id, connectionId: ig!.id, scheduledAt: new Date().toISOString() }).expect(201))
    .body as {
    id: string;
    posts: { id: string }[];
  }[];
  postId = queue.find((q) => q.id === v.id)!.posts[0]!.id;
  const proof = (await meena.post("/files").send({ name: "proof.png", mime: "image/png", size: 12, entity: "publishing", entityId: v.id }).expect(201))
    .body as UploadStart;
  await anon().put(new URL(proof.uploadUrl).pathname).set("Content-Type", "image/png").send(Buffer.from("proof-bytes!")).expect(200);
  await meena
    .post(`/publishing/posts/${postId}/published`)
    .send({ url: "https://instagram.com/p/pcn1", publishedAt: new Date().toISOString(), proofFileId: proof.id, confirmed: true })
    .expect(200);
  // Next month's picks.
  const idea = (await karthik.post("/content").send({ clientId, title: "Coconut oil, three ways", pillar: "Recipes", format: "Reel", month: next }).expect(201))
    .body as { id: string };
  const [list] = (await karthik.put("/topic-lists").send({ clientId, month: next, needed: 1 }).expect(200)).body as { id: string; client: { id: string } }[];
  await karthik.post(`/topic-lists/${list!.id}/send`).expect(200);
  await karthik.put(`/content/${idea.id}/pick`).send({ pick: "picked" }).expect(200);

  link = ((await ashwin.post(`/clients/${clientId}/contacts/${c.contacts[0]!.id}/portal-link`).expect(201)).body as { link: string }).link;
}, 300_000);

afterAll(async () => {
  await t?.stop();
  rmSync(dir, { recursive: true, force: true });
}, 60_000);

describe("a monthly report", () => {
  it("is made for a client with the month's promise, delivery, posts and next month's picks", async () => {
    await divya.post("/reports").send({ clientId, month: M }).expect(403);
    const r = (await ashwin.post("/reports").send({ clientId, month: M }).expect(201)).body as MonthlyReport;
    reportId = r.id;
    expect(r).toMatchObject({ status: "draft", month: M, client: { code: "PCN" } });
    expect(r.data).toMatchObject({ promised: 4, delivered: 1, totals: { posts: 1, views: 0 }, nextMonth: ["Coconut oil, three ways"] });
    expect(r.data.videos[0]!.posts[0]).toMatchObject({ platform: "instagram", url: "https://instagram.com/p/pcn1", metrics: null });
    const rows = (await karthik.get(`/reports?month=${M}`).expect(200)).body as ReportRow[];
    expect(rows.find((x) => x.client.code === "PCN")!.report).toMatchObject({ id: reportId, status: "draft" });
    await divya.get(`/reports?month=${M}`).expect(403);
  });

  it("adds up the numbers the team enters for each post", async () => {
    await divya.put(`/publishing/posts/${postId}/metrics`).send({ views: 10 }).expect(403);
    await meena.put(`/publishing/posts/${postId}/metrics`).send({ views: 12500, likes: 640, comments: 38, shares: 51, saves: 90 }).expect(200);
    const r = (await ashwin.post(`/reports/${reportId}/refresh`).expect(200)).body as MonthlyReport;
    expect(r.data.totals).toMatchObject({ posts: 1, views: 12500, likes: 640, comments: 38, shares: 51, saves: 90, reach: 0 });
  });

  it("gets a note and is released to the client's portal, then stays as released", async () => {
    await ashwin.put(`/reports/${reportId}/note`).send({ note: "A strong first month — the coconut reel did very well." }).expect(200);
    const portal = `/portal/${link.split("/app/c/")[1]}`;
    expect((await anon().get(`${portal}/reports`).expect(200)).body).toEqual([]); // a draft is not shown
    const r = (await ashwin.post(`/reports/${reportId}/release`).expect(200)).body as MonthlyReport;
    expect(r).toMatchObject({ status: "released", note: "A strong first month — the coconut reel did very well.", releasedBy: { name: "Ashwin" } });
    await ashwin.post(`/reports/${reportId}/refresh`).expect(409);
    await ashwin.put(`/reports/${reportId}/note`).send({ note: "changed" }).expect(409);
    await meena.put(`/publishing/posts/${postId}/metrics`).send({ views: 99999 }).expect(200);
    expect(((await ashwin.get(`/reports/${reportId}`).expect(200)).body as MonthlyReport).data.totals.views).toBe(12500); // kept as released

    const list = (await anon().get(`${portal}/reports`).expect(200)).body as { id: string; month: string }[];
    expect(list).toEqual([expect.objectContaining({ id: reportId, month: M })]);
    const seen = (await anon().get(`${portal}/reports/${reportId}`).expect(200)).body as MonthlyReport;
    expect(seen.data.totals.views).toBe(12500);
  });
});

describe("on the 25th", () => {
  it("a draft is made for every client with a running agreement, once, and whoever looks after them is told", async () => {
    const runner = t.app.get(JobRunner);
    await runner.tick(new Date(`${M}-24T03:00:00Z`));
    const before = (await ashwin.get(`/reports?month=${M}`).expect(200)).body as ReportRow[];
    const without = before.filter((r) => !r.report).length;
    expect(without).toBeGreaterThan(0); // the sample clients
    await runner.tick(new Date(`${M}-25T03:00:00Z`));
    await runner.tick(new Date(`${M}-25T04:00:00Z`));
    const after = (await ashwin.get(`/reports?month=${M}`).expect(200)).body as ReportRow[];
    expect(after.every((r) => r.report)).toBe(true);
    expect(after.find((r) => r.client.code === "PCN")!.report!.status).toBe("released"); // left as it was
    const [n] = await t.sql<{ n: number }>(`SELECT count(*)::int AS n FROM notifications WHERE kind = 'report_draft'`);
    expect(n!.n).toBeGreaterThanOrEqual(without);
  });

  it("is never seen by another agency", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    const rows = (await zara.get(`/reports?month=${M}`).expect(200)).body as ReportRow[];
    expect(rows.some((r) => r.client.code === "PCN")).toBe(false);
    await zara.get(`/reports/${reportId}`).expect(404);
  });
});
