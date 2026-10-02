// Ask Genie (P4-08): questions answered with read-only tools as the person asking — an editor hears only about their
// own work — with links to the records, kept as conversations for the agency's retention period.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type AiUsageSummary, type AskConversationRow, DEFAULT_PRODUCTION_SETTINGS } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";
import { GENIE_MODEL, type StandInModel } from "./model.js";

let t: SeededApp;
let jana: Agent; // owner
let ashwin: Agent; // manager: sees every video
let karthik: Agent; // team leader: quality check, approves for the client
let divya: Agent; // editor: only her videos
let surya: Agent; // editor: only his videos
let model: StandInModel;
let mine: { id: string; code: string }; // Divya's
let his: { id: string; code: string }; // Surya's
let conversation: AskConversationRow;
const M = new Date().toISOString().slice(0, 7);
const QUESTION = "Which Kaveri videos are waiting on the client?";
const ask = async (who: Agent, question: string, conversationId?: string) =>
  (await who.post("/genie/ask").send({ question, conversationId }).expect(200)).body as AskConversationRow;
const answer = (c: AskConversationRow) => c.messages.at(-1)!;

/** A Kaveri video taken to the client for approval, by its editor. */
async function withClient(title: string, editor: Agent, email: string) {
  const kaveri = ((await ashwin.get("/clients").expect(200)).body as { id: string; code: string }[]).find((c) => c.code === "KVR")!;
  const v = (
    await ashwin
      .post("/videos")
      .send({ clientId: kaveri.id, title, format: "Reel", dueDate: `${M}-27`, editorId: seedUserId(email) })
      .expect(201)
  ).body as {
    id: string;
    code: string;
  };
  await editor.post(`/videos/${v.id}/move`).send({ to: "shot" }).expect(200);
  await editor.put(`/videos/${v.id}/protect`).send({ done: true }).expect(200);
  await editor.post(`/videos/${v.id}/move`).send({ to: "editing" }).expect(200);
  for (const step of DEFAULT_PRODUCTION_SETTINGS.editSteps) await editor.put(`/videos/${v.id}/edit-steps`).send({ step, done: true }).expect(200);
  await editor.post(`/videos/${v.id}/move`).send({ to: "internal_qc" }).expect(200);
  for (const q of DEFAULT_PRODUCTION_SETTINGS.qcChecks) await karthik.put(`/videos/${v.id}/qc`).send({ check: q.key, result: "pass" }).expect(200);
  await editor
    .post(`/videos/${v.id}/versions`)
    .send({ link: `https://drive.example/${v.code}` })
    .expect(201);
  await editor.post(`/videos/${v.id}/versions/send`).expect(200);
  return v;
}

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, karthik, divya, surya] = await Promise.all(["jana", "ashwin", "karthik", "divya", "surya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  model = t.app.get<StandInModel>(GENIE_MODEL);
  mine = await withClient("Millet laddoo, step by step", divya, "divya@geniemagnet.test");
  his = await withClient("Our farm in the rain", surya, "surya@geniemagnet.test");
}, 300_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("Ask Genie", () => {
  it("waits for the agency to switch it on", async () => {
    expect((await ashwin.post("/genie/ask").send({ question: QUESTION }).expect(409)).body.message).toBe(
      "Switch drafting and Ask Genie on in Settings → Genie Assistant first.",
    );
    await jana.put("/genie/ai").send({ aiEnabled: true }).expect(200);
  });

  it("answers from what the person may see, with links to the videos", async () => {
    conversation = await ask(ashwin, QUESTION);
    expect(conversation.title).toBe(QUESTION);
    const a = answer(conversation);
    expect(a.role).toBe("assistant");
    for (const v of [mine, his]) {
      expect(a.content).toContain(`(/app/production/${v.id})`);
      expect(a.sources).toContainEqual({ label: expect.stringContaining(v.code), href: `/app/production/${v.id}` });
    }
    // The model was given the question, and asked as Ashwin.
    expect(model.questions.at(-1)!.at(-1)).toEqual({ role: "user", content: QUESTION });
  });

  it("tells an editor only about their own videos", async () => {
    const a = answer(await ask(divya, QUESTION));
    expect(a.content).toContain(`(/app/production/${mine.id})`);
    expect(a.content).not.toContain(his.id);
    expect(a.sources.map((s) => s.href)).not.toContain(`/app/production/${his.id}`);
    const b = answer(await ask(surya, QUESTION));
    expect(b.content).toContain(his.code);
    expect(b.content).not.toContain(mine.code);
  });

  it("carries a conversation on, kept for the person who asked", async () => {
    const next = await ask(ashwin, "Any overdue invoices for Kaveri?", conversation.id);
    expect(next.id).toBe(conversation.id);
    expect(next.messages.map((m) => m.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(model.questions.at(-1)!.map((m) => m.role)).toEqual(["user", "assistant", "user"]); // the earlier turns went with it
    expect(((await ashwin.get("/genie/conversations").expect(200)).body as { id: string }[]).map((c) => c.id)).toContain(conversation.id);
    await divya.get(`/genie/conversations/${conversation.id}`).expect(404);
    await divya.post("/genie/ask").send({ question: "And now?", conversationId: conversation.id }).expect(404);
  });

  it("is metered with the drafts", async () => {
    const u = (await jana.get("/genie/usage").expect(200)).body as AiUsageSummary;
    expect(u.byFeature.find((f) => f.feature === "ask")?.calls).toBe(4);
  });

  it("forgets conversations after the agency's retention period, and belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    await zara.get(`/genie/conversations/${conversation.id}`).expect(404);
    await jana.put("/genie/ai").send({ retentionDays: 7 }).expect(200);
    await t.app.get(JobRunner).tick(new Date(`${new Date(Date.now() + 9 * 86_400_000).toISOString().slice(0, 10)}T03:00:00Z`));
    expect((await ashwin.get("/genie/conversations").expect(200)).body).toEqual([]);
    await ashwin.delete(`/genie/conversations/${conversation.id}`).expect(404);
  });
});
