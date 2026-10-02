// Genie Assistant's drafts (P4-05 to P4-07, P4-09): switched on by the agency, written in the client's voice from their
// own approved work, approved as written or edited, metered against the agency's monthly budget.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type AiUsageSummary,
  type CaptionDraft,
  DEFAULT_PRODUCTION_SETTINGS,
  type DraftRow,
  type GenieSettings,
  type IdeasDraft,
  type InsightRow,
} from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";
import { GENIE_MODEL, type StandInModel } from "./model.js";

let t: SeededApp;
let jana: Agent; // owner: settings, usage
let ashwin: Agent; // manager: clients
let karthik: Agent; // team leader
let divya: Agent; // editor
let meena: Agent; // social media manager: publishing
let model: StandInModel;
let clientId: string;
let videoId: string;
let postId: string;
const M = new Date().toISOString().slice(0, 7);
const morning = (days: number) => new Date(`${new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)}T03:00:00Z`);
const draft = async (who: Agent, body: object, status = 201) => (await who.post("/genie/drafts").send(body).expect(status)).body as DraftRow;

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, karthik, divya, meena] = await Promise.all(["jana", "ashwin", "karthik", "divya", "meena"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  model = t.app.get<StandInModel>(GENIE_MODEL);
  clientId = (
    await ashwin
      .post("/clients")
      .send({ name: "Madurai Malli", code: "MDU", contacts: [{ name: "Revathi Sundar", phone: "98400 22002", approver: true }] })
      .expect(201)
  ).body.id;
  await karthik
    .put(`/clients/${clientId}/pillars`)
    .send({ pillars: ["Flowers", "Festivals"] })
    .expect(200);
  // The client's brand voice, from their onboarding.
  const o = (await ashwin.post(`/clients/${clientId}/onboarding`).send({}).expect(201)).body as { id: string };
  await ashwin
    .put(`/onboarding/${o.id}/answers/c29b`)
    .send({ value: ["Warm and friendly", "Traditional"] })
    .expect(200);
  await ashwin.put(`/onboarding/${o.id}/answers/c29c`).send({ value: "Never mention other flower shops" }).expect(200);
  await ashwin
    .put(`/onboarding/${o.id}/answers/c30`)
    .send({ value: ["Tamil", "English"] })
    .expect(200);
  // An approved video, scheduled on Instagram without a caption yet.
  const v = (
    await ashwin
      .post("/videos")
      .send({ clientId, title: "Jasmine at dawn, Madurai market", format: "Reel", dueDate: `${M}-27`, editorId: seedUserId("divya@geniemagnet.test") })
      .expect(201)
  ).body as { id: string };
  videoId = v.id;
  await divya.post(`/videos/${videoId}/move`).send({ to: "shot" }).expect(200);
  await divya.put(`/videos/${videoId}/protect`).send({ done: true }).expect(200);
  await divya.post(`/videos/${videoId}/move`).send({ to: "editing" }).expect(200);
  for (const step of DEFAULT_PRODUCTION_SETTINGS.editSteps) await divya.put(`/videos/${videoId}/edit-steps`).send({ step, done: true }).expect(200);
  await divya.post(`/videos/${videoId}/move`).send({ to: "internal_qc" }).expect(200);
  for (const q of DEFAULT_PRODUCTION_SETTINGS.qcChecks) await karthik.put(`/videos/${videoId}/qc`).send({ check: q.key, result: "pass" }).expect(200);
  await divya.post(`/videos/${videoId}/versions`).send({ link: "https://drive.example/mdu-v1" }).expect(201);
  await divya.post(`/videos/${videoId}/versions/send`).expect(200);
  await karthik.post(`/videos/${videoId}/decision`).send({ approved: true }).expect(200);
  await meena.post(`/clients/${clientId}/platforms`).send({ platform: "instagram", handle: "@maduraimalli" }).expect(201);
  const [ig] = (await meena.get(`/clients/${clientId}/platforms`).expect(200)).body as { id: string }[];
  const queue = (
    await meena
      .post("/publishing/posts")
      .send({ videoId, connectionId: ig!.id, scheduledAt: morning(3).toISOString() })
      .expect(201)
  ).body as {
    id: string;
    posts: { id: string }[];
  }[];
  postId = queue.find((q) => q.id === videoId)!.posts[0]!.id;
}, 300_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("drafting", () => {
  it("waits for the agency to switch it on, within a budget it sets", async () => {
    const s = (await meena.get("/genie/settings").expect(200)).body as GenieSettings;
    expect(s.ai).toEqual({ enabled: false, monthlyBudget: 2000, retentionDays: 90, source: "stand-in", spentThisMonth: 0 });
    const off = await meena.post("/genie/drafts").send({ kind: "caption", videoId }).expect(409);
    expect(off.body.message).toBe("Switch drafting on in Settings → Genie Assistant first.");
    await karthik.put("/genie/ai").send({ aiEnabled: true }).expect(403);
    await jana.put("/genie/ai").send({ retentionDays: 3 }).expect(400);
    const on = (await jana.put("/genie/ai").send({ aiEnabled: true, monthlyBudget: 500 }).expect(200)).body as GenieSettings;
    expect(on.ai).toMatchObject({ enabled: true, monthlyBudget: 500 });
  });

  it("writes a caption for an approved video in the client's voice, from their pillars", async () => {
    await draft(divya, { kind: "caption", videoId }, 403); // editors do not publish
    const d = await draft(meena, { kind: "caption", videoId, platform: "instagram", notes: "Mention the early morning market" });
    expect(d).toMatchObject({ kind: "caption", status: "draft", entity: "video", entityId: videoId, source: "stand-in", client: { name: "Madurai Malli" } });
    expect((d.output as CaptionDraft).caption).toContain("Jasmine at dawn");
    const call = model.calls.at(-1)!;
    expect(call.context).toContain("Tone of voice: Warm and friendly, Traditional");
    expect(call.context).toContain("Do's and don'ts: Never mention other flower shops");
    expect(call.context).toContain("Content languages: Tamil, English");
    expect(call.context).toContain("Content pillars: Flowers, Festivals");
    expect(call.task).toContain("It is for Instagram.");
    expect(call.task).toContain("The team asks: Mention the early morning market");
  });

  it("is approved with small edits, which go on the post still to go out — and is decided once", async () => {
    const [d] = (await meena.get(`/genie/drafts?entity=video&entityId=${videoId}`).expect(200)).body as DraftRow[];
    const out = d!.output as CaptionDraft;
    await meena
      .post(`/genie/drafts/${d!.id}/decision`)
      .send({ status: "approved", final: { ...out, hashtags: ["not a hashtag"] } })
      .expect(400);
    const r = (
      await meena
        .post(`/genie/drafts/${d!.id}/decision`)
        .send({ status: "approved", final: { ...out, caption: `${out.caption}\nFresh every morning.` } })
        .expect(200)
    ).body as { draft: DraftRow; postsUpdated: number };
    expect(r.postsUpdated).toBe(1);
    expect(r.draft).toMatchObject({ status: "approved" });
    expect(r.draft.editedPct).toBeGreaterThan(0);
    expect(r.draft.editedPct).toBeLessThan(50);
    const [row] = await t.sql<{ caption: string }>(`SELECT caption FROM scheduled_posts WHERE id = $1`, [postId]);
    expect(row!.caption).toContain("Fresh every morning.");
    expect(row!.caption).toContain("#MaduraiMalli");
    await meena.post(`/genie/drafts/${d!.id}/decision`).send({ status: "rejected" }).expect(409);
  });

  it("writes a nudge to the editor of a stuck video, and to the client when they are the ones waiting", async () => {
    // A second video, stuck in editing for days.
    const v = (
      await ashwin
        .post("/videos")
        .send({ clientId, title: "Garland making", format: "Reel", dueDate: `${M}-28`, editorId: seedUserId("divya@geniemagnet.test") })
        .expect(201)
    ).body as { id: string; code: string };
    await divya.post(`/videos/${v.id}/move`).send({ to: "shot" }).expect(200);
    await divya.put(`/videos/${v.id}/protect`).send({ done: true }).expect(200);
    await divya.post(`/videos/${v.id}/move`).send({ to: "editing" }).expect(200);
    await t.app.get(JobRunner).tick(morning(5));
    const stuck = ((await karthik.get("/genie/insights?rule=video_stuck").expect(200)).body as InsightRow[]).find((i) => i.title.startsWith(v.code))!;
    // Nudges chase clients' and colleagues' work: people who may change clients.
    await draft(karthik, { kind: "nudge", insightId: stuck.id });
    const toEditor = await draft(ashwin, { kind: "nudge", insightId: stuck.id });
    expect(toEditor).toMatchObject({ entity: "insight", entityId: stuck.id });
    expect(model.calls.at(-1)!.task).toContain("to Divya Lakshmi (address them as Divya)");
    const sent = (
      await ashwin
        .post(`/genie/drafts/${toEditor.id}/decision`)
        .send({ status: "approved", final: { message: "Hi Divya, the garland reel has been in editing a while — can you finish it today?" } })
        .expect(200)
    ).body as { whatsappLink: string };
    expect(sent.whatsappLink).toBe(
      `https://wa.me/?text=${encodeURIComponent("Hi Divya, the garland reel has been in editing a while — can you finish it today?")}`,
    );

    const toClient = await draft(ashwin, { kind: "nudge", clientId, notes: "The Diwali topics are waiting for her picks" });
    expect(model.calls.at(-1)!.task).toContain("to Revathi Sundar (address them as Revathi)");
    const r = (await ashwin.post(`/genie/drafts/${toClient.id}/decision`).send({ status: "approved" }).expect(200)).body as {
      whatsappLink: string;
      draft: DraftRow;
    };
    expect(r.whatsappLink).toMatch(/^https:\/\/wa\.me\/919840022002\?text=Hello%20Revathi/);
    expect(r.draft.editedPct).toBe(0);
  });

  it("suggests content ideas; the ones kept join the client's idea bank", async () => {
    const d = await draft(karthik, { kind: "ideas", clientId, month: M, count: 3 });
    const ideas = (d.output as IdeasDraft).ideas;
    expect(ideas).toHaveLength(3);
    await karthik
      .post(`/genie/drafts/${d.id}/decision`)
      .send({ status: "approved", final: { ideas: ideas.slice(0, 2) } })
      .expect(200);
    const bank = (await karthik.get(`/content?clientId=${clientId}&month=${M}`).expect(200)).body as { title: string; source: string }[];
    expect(bank.filter((c) => c.source === "Genie Assistant").map((c) => c.title)).toEqual(expect.arrayContaining(ideas.slice(0, 2).map((i) => i.title)));
  });

  it("writes a report's summary from its real numbers, which becomes the report's note", async () => {
    const report = (await ashwin.post("/reports").send({ clientId, month: M }).expect(201)).body as { id: string };
    const d = await draft(ashwin, { kind: "report_summary", reportId: report.id });
    expect(model.calls.at(-1)!.task).toMatch(/Videos promised: \d+; delivered: \d+\nPosts: \d+; views: \d+/);
    await ashwin.post(`/genie/drafts/${d.id}/decision`).send({ status: "approved" }).expect(200);
    const r = (await ashwin.get(`/reports/${report.id}`).expect(200)).body as { note: string };
    expect(r.note).toBe((d.output as { note: string }).note);
  });
});

describe("usage", () => {
  it("is metered per feature and person, for the owner, and stops at the budget", async () => {
    await meena.get("/genie/usage").expect(403);
    const u = (await jana.get("/genie/usage").expect(200)).body as AiUsageSummary;
    expect(u).toMatchObject({ month: M, budget: 500, calls: 6, drafts: { approved: 2, edited: 3, rejected: 0 } });
    expect(u.spent).toBeGreaterThan(0);
    expect(u.byFeature.map((f) => f.feature).sort()).toEqual(["caption", "ideas", "nudge", "report_summary"]);
    expect(u.byPerson.find((p) => p.name === "Ashwin")?.calls).toBe(3);

    await jana.put("/genie/ai").send({ monthlyBudget: 0 }).expect(200);
    const spent = await meena.post("/genie/drafts").send({ kind: "caption", videoId }).expect(409);
    expect(spent.body.message).toMatch(/^This month's AI budget \(₹0\) is used up/);
  });

  it("keeps what was sent to the model only for the agency's retention period", async () => {
    await jana.put("/genie/ai").send({ retentionDays: 7 }).expect(200);
    const [before] = await t.sql<{ n: number }>(`SELECT count(*)::int AS n FROM drafts WHERE context IS NOT NULL`);
    expect(before!.n).toBe(6);
    await t.app.get(JobRunner).tick(morning(9));
    const [after] = await t.sql<{ n: number }>(`SELECT count(*)::int AS n FROM drafts WHERE context IS NOT NULL`);
    expect(after!.n).toBe(0);
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    const [d] = (await meena.get(`/genie/drafts?entity=video&entityId=${videoId}`).expect(200)).body as DraftRow[];
    await zara.get(`/genie/drafts/${d!.id}`).expect(404);
    expect(((await zara.get("/genie/settings").expect(200)).body as GenieSettings).ai.spentThisMonth).toBe(0);
  });
});
