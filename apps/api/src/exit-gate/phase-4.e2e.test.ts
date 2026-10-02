// Phase 4 exit gate (P4-12): Genie Assistant on the sample agency, as one story. A video idle in editing for three days
// raises an insight for the team leader, who drafts a WhatsApp nudge, edits it and sends it; the social media manager
// drafts a caption for an approved video and approves it with small edits; Ask Genie answers "Which Kaveri videos are
// waiting on the client?" with the right videos and links, and an editor asking the same hears only about their own;
// the owner's usage view shows the agency's AI usage; and another agency sees none of it.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AiUsageSummary, type AskConversationRow, type CaptionDraft, DEFAULT_PRODUCTION_SETTINGS, type DraftRow, type InsightRow } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner
let ashwin: Agent; // manager
let karthik: Agent; // team leader
let divya: Agent; // editor
let surya: Agent; // editor
let meena: Agent; // social media manager
let kaveri: string;
let stuck: { id: string; code: string };
let approved: { id: string; code: string };
let waiting: { id: string; code: string }[];
let insight: InsightRow;
const M = new Date().toISOString().slice(0, 7);
const QUESTION = "Which Kaveri videos are waiting on the client?";
const morning = (days: number) => new Date(`${new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)}T03:00:00Z`);

/** A Kaveri video taken by its editor as far as the step given. */
async function video(title: string, editor: Agent, email: string, to: "editing" | "client_review" | "approved") {
  const v = (
    await ashwin
      .post("/videos")
      .send({ clientId: kaveri, title, format: "Reel", dueDate: `${M}-27`, editorId: seedUserId(email) })
      .expect(201)
  ).body as {
    id: string;
    code: string;
  };
  await editor.post(`/videos/${v.id}/move`).send({ to: "shot" }).expect(200);
  await editor.put(`/videos/${v.id}/protect`).send({ done: true }).expect(200);
  await editor.post(`/videos/${v.id}/move`).send({ to: "editing" }).expect(200);
  if (to === "editing") return v;
  for (const step of DEFAULT_PRODUCTION_SETTINGS.editSteps) await editor.put(`/videos/${v.id}/edit-steps`).send({ step, done: true }).expect(200);
  await editor.post(`/videos/${v.id}/move`).send({ to: "internal_qc" }).expect(200);
  for (const q of DEFAULT_PRODUCTION_SETTINGS.qcChecks) await karthik.put(`/videos/${v.id}/qc`).send({ check: q.key, result: "pass" }).expect(200);
  await editor
    .post(`/videos/${v.id}/versions`)
    .send({ link: `https://drive.example/${v.code}` })
    .expect(201);
  await editor.post(`/videos/${v.id}/versions/send`).expect(200);
  if (to === "approved") await karthik.post(`/videos/${v.id}/decision`).send({ approved: true }).expect(200);
  return v;
}

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, karthik, divya, surya, meena] = await Promise.all(
    ["jana", "ashwin", "karthik", "divya", "surya", "meena"].map((p) => t.signInAs(`${p}@geniemagnet.test`)),
  );
  kaveri = ((await ashwin.get("/clients").expect(200)).body as { id: string; code: string }[]).find((c) => c.code === "KVR")!.id;
  stuck = await video("Turmeric, field to jar", divya, "divya@geniemagnet.test", "editing");
  approved = await video("Cold-pressed groundnut oil", divya, "divya@geniemagnet.test", "approved");
  waiting = [
    await video("Millet dosa at home", divya, "divya@geniemagnet.test", "client_review"),
    await video("A day at the farm", surya, "surya@geniemagnet.test", "client_review"),
  ];
  await meena.post(`/clients/${kaveri}/platforms`).send({ platform: "instagram", handle: "@kaveriorganics" }).expect(201);
  const [ig] = (await meena.get(`/clients/${kaveri}/platforms`).expect(200)).body as { id: string }[];
  await meena
    .post("/publishing/posts")
    .send({ videoId: approved.id, connectionId: ig!.id, scheduledAt: morning(10).toISOString() })
    .expect(201);
}, 300_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("Phase 4: Genie Assistant finds, drafts, answers — and a person decides", () => {
  it("0. the owner switches drafting and Ask Genie on, with a monthly budget", async () => {
    await jana.put("/genie/ai").send({ aiEnabled: true, monthlyBudget: 1500 }).expect(200);
  });

  it("1. a video idle in editing for three days raises an insight for the team leader", async () => {
    await t.app.get(JobRunner).tick(morning(4));
    insight = ((await karthik.get("/genie/insights?rule=video_stuck").expect(200)).body as InsightRow[]).find((i) => i.title.startsWith(stuck.code))!;
    expect(insight).toMatchObject({
      status: "open",
      title: expect.stringMatching(new RegExp(`^${stuck.code} has been in Editing for \\d+ days$`)),
      owner: { name: "Divya Lakshmi" },
    });
    const n = (await karthik.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.some((x) => x.kind === "genie_insight" && x.title === insight.title)).toBe(true);
  });

  it("2. the team leader drafts a WhatsApp nudge to the editor, edits it and sends it", async () => {
    const d = (await karthik.post("/genie/drafts").send({ kind: "nudge", insightId: insight.id }).expect(201)).body as DraftRow;
    expect(d).toMatchObject({ kind: "nudge", status: "draft", entity: "insight", entityId: insight.id });
    const message = "Hi Divya, the turmeric reel has been in editing for a few days — can you finish it by tomorrow? Shout if you are stuck.";
    const r = (await karthik.post(`/genie/drafts/${d.id}/decision`).send({ status: "approved", final: { message } }).expect(200)).body as {
      draft: DraftRow;
      whatsappLink: string;
    };
    expect(r.whatsappLink).toBe(`https://wa.me/?text=${encodeURIComponent(message)}`);
    expect(r.draft.editedPct).toBeGreaterThan(0);
    await karthik.put(`/genie/insights/${insight.id}`).send({ status: "done" }).expect(200);
  });

  it("3. the social media manager drafts a caption for an approved video and approves it with small edits", async () => {
    const d = (await meena.post("/genie/drafts").send({ kind: "caption", videoId: approved.id, platform: "instagram" }).expect(201)).body as DraftRow;
    const out = d.output as CaptionDraft;
    const r = (
      await meena
        .post(`/genie/drafts/${d.id}/decision`)
        .send({ status: "approved", final: { ...out, caption: `${out.caption} Order today.` } })
        .expect(200)
    ).body as { draft: DraftRow; postsUpdated: number };
    expect(r.postsUpdated).toBe(1);
    expect(r.draft.editedPct).toBeGreaterThan(0);
    expect(r.draft.editedPct).toBeLessThan(30);
  });

  it("4. Ask Genie answers with the right videos and links; an editor hears only about their own", async () => {
    const all = (await ashwin.post("/genie/ask").send({ question: QUESTION }).expect(200)).body as AskConversationRow;
    const answer = all.messages.at(-1)!;
    for (const v of waiting) expect(answer.sources).toContainEqual({ label: expect.stringContaining(v.code), href: `/app/production/${v.id}` });
    expect(answer.content).not.toContain(stuck.code); // not waiting on the client

    const hers = ((await divya.post("/genie/ask").send({ question: QUESTION }).expect(200)).body as AskConversationRow).messages.at(-1)!;
    expect(hers.sources.map((s) => s.href)).toContain(`/app/production/${waiting[0]!.id}`);
    expect(hers.sources.map((s) => s.href)).not.toContain(`/app/production/${waiting[1]!.id}`);
  });

  it("5. the owner's usage view shows the agency's AI usage", async () => {
    await karthik.get("/genie/usage").expect(403); // the owner and whoever may change settings
    const u = (await jana.get("/genie/usage").expect(200)).body as AiUsageSummary;
    expect(u).toMatchObject({ month: M, budget: 1500, calls: 4 });
    expect(u.spent).toBeGreaterThan(0);
    expect(Object.fromEntries(u.byFeature.map((f) => [f.feature, f.calls]))).toEqual({ nudge: 1, caption: 1, ask: 2 });
    expect(u.byPerson.map((p) => p.name).sort()).toEqual(["Ashwin", "Divya Lakshmi", "Karthik Subramanian", "Meena Ravi"]);
  });

  it("6. a person in another agency sees none of it", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect(((await zara.get("/genie/insights").expect(200)).body as InsightRow[]).some((i) => i.title.startsWith("KVR"))).toBe(false);
    await zara.put(`/genie/insights/${insight.id}`).send({ status: "open" }).expect(404);
    expect((await zara.get("/genie/conversations").expect(200)).body).toEqual([]);
    expect((await zara.get(`/genie/drafts?entity=video&entityId=${approved.id}`).expect(200)).body).toEqual([]);
  });
});
