// The onboarding engine (P1-21 to P1-25), on the sample agencies.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_QUESTIONNAIRES, type QuestionnaireDefinition } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner
let ashwin: Agent; // manager: may approve onboarding exceptions
let priya: Agent; // team leader: runs onboarding, cannot change the questions

const publicApi = () => request(t.app.getHttpServer());
const tokenOf = (link: string) => link.split("/app/q/")[1]!;

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, priya] = await Promise.all(["jana", "ashwin", "priya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("the question builder", () => {
  it("starts every agency on the Growth OS questions", async () => {
    const q = (await priya.get("/questionnaires/client").expect(200)).body;
    expect(q).toMatchObject({ published: { version: 1 }, draft: null, versions: [{ version: 1, responses: 0 }] });
    expect(q.published.definition.sections.map((s: { key: string }) => s.key)).toEqual(DEFAULT_QUESTIONNAIRES.client.sections.map((s) => s.key));
  });

  it("keeps changes in a draft until they are published as the next version", async () => {
    const d: QuestionnaireDefinition = structuredClone(DEFAULT_QUESTIONNAIRES.client);
    d.sections[0]!.questions[0]!.label = "Registered business name, and brand name if different";
    d.sections[0]!.questions[0]!.translations = { ta: { label: "பதிவு செய்யப்பட்ட வணிகப் பெயர்" } };
    await priya.put("/questionnaires/client/draft").send(d).expect(403);
    const saved = (await jana.put("/questionnaires/client/draft").send(d).expect(200)).body;
    expect(saved).toMatchObject({ published: { version: 1 }, draft: { version: 2 } });

    const bad = structuredClone(d);
    bad.sections[0]!.questions[1]!.key = "c1";
    const res = await jana.put("/questionnaires/client/draft").send(bad).expect(400);
    expect(res.body.issues).toEqual([
      { path: "sections.0.questions.1.key", message: "Two questions have this key" },
      // The checklist item ticked by the renamed question is caught too.
      { path: "checklist.1.tick", message: "That question is not in the questionnaire" },
    ]);

    const published = (await jana.post("/questionnaires/client/publish").expect(200)).body;
    expect(published).toMatchObject({ published: { version: 2 }, draft: null });
    expect(published.versions.map((v: { version: number }) => v.version)).toEqual([2, 1]);
    await jana.post("/questionnaires/client/publish").expect(409);
  });
});

describe("client onboarding", () => {
  let id: string;
  let clientId: string;
  let token: string;

  it("starts when a deal is won, on the latest version, without a link yet", async () => {
    const lead = (await priya.post("/leads").send({ name: "Selvam", company: "Selvam Steels", phone: "+91 98400 33001", source: "Referral" }).expect(201)).body;
    const won = (
      await priya
        .post(`/leads/${lead.id}/win`)
        .send({
          client: { name: "Selvam Steels", code: "SST", contacts: [{ name: "Selvam", phone: "+91 98400 33001", approver: true }] },
          startDate: "2026-11-01",
        })
        .expect(201)
    ).body;
    expect(won.onboardingId).toBeTruthy();
    id = won.onboardingId;
    clientId = won.clientId;
    const o = (await priya.get(`/onboarding/${id}`).expect(200)).body;
    expect(o).toMatchObject({ kind: "client", version: 2, mode: "link", sentAt: null, window: { state: "not_sent" }, gate: { open: false } });
    expect(o.progress.required).toMatchObject({ answered: 0, total: 19 });
    await priya.post(`/clients/${clientId}/onboarding`).send({}).expect(409);
  });

  it("is shared by a private link that shows only the questions — and a new link replaces the old one", async () => {
    const first = (await priya.post(`/onboarding/${id}/link`).expect(200)).body;
    expect(first.link).toMatch(/^http:\/\/localhost:3000\/app\/q\/[A-Za-z0-9_-]{32}$/);
    const second = (await priya.post(`/onboarding/${id}/link`).expect(200)).body;
    await publicApi()
      .get(`/public/onboarding/${tokenOf(first.link)}`)
      .expect(404);
    token = tokenOf(second.link);

    const view = (await publicApi().get(`/public/onboarding/${token}`).expect(200)).body;
    expect(view).toMatchObject({ agency: { name: "Genie Magnet" }, client: { name: "Selvam Steels" }, language: "en", window: { state: "on_track", days: 7 } });
    expect(view.languages.map((l: { code: string }) => l.code)).toEqual(["en", "ta"]);
    const c6 = view.sections[0].questions.find((q: { key: string }) => q.key === "c6");
    expect(c6).not.toHaveProperty("mapsTo");
    expect(c6).not.toHaveProperty("feeds");
    expect((await priya.get(`/onboarding/${id}`).expect(200)).body.sentAt).not.toBeNull();
  });

  it("shows the client's language", async () => {
    const ta = (await publicApi().put(`/public/onboarding/${token}/language`).send({ language: "ta" }).expect(200)).body;
    expect(ta.sections[0].questions[0].label).toBe("பதிவு செய்யப்பட்ட வணிகப் பெயர்");
    await publicApi().put(`/public/onboarding/${token}/language`).send({ language: "en" }).expect(200);
  });

  it("saves answers as the client goes, checks them, and fills in mapped fields", async () => {
    const bad = await publicApi().put(`/public/onboarding/${token}/answers/c6`).send({ value: "Huge" }).expect(400);
    expect(bad.body.message).toBe("Choose one of the options");
    await publicApi().put(`/public/onboarding/${token}/answers/c6`).send({ value: "Success" }).expect(200);
    const [row] = await t.sql<{ stage: string }>(`SELECT stage FROM clients WHERE id = $1`, [clientId]);
    expect(row!.stage).toBe("success");
    await publicApi().put(`/public/onboarding/${token}/answers/nope`).send({ value: "x" }).expect(404);
  });

  it("records who answered when the account manager fills it in with the client", async () => {
    const o = (await priya.put(`/onboarding/${id}/answers/c1`).send({ value: "Selvam Steels Pvt Ltd" }).expect(200)).body;
    expect(o.answers.c1).toMatchObject({ value: "Selvam Steels Pvt Ltd", by: { id: seedUserId("priya@geniemagnet.test"), name: "Priya Venkatesh" } });
    expect(o.answers.c6.by).toBeNull(); // the client, by link
  });

  it("opens the gate once required answers and mandatory checklist items are done", async () => {
    const d = (await priya.get(`/onboarding/${id}`).expect(200)).body.definition as QuestionnaireDefinition;
    for (const q of d.sections.filter((s) => s.when === "required").flatMap((s) => s.questions)) {
      if (q.key === "c1" || q.key === "c6") continue;
      const value =
        q.type === "multi"
          ? [q.options![0]]
          : q.type === "table"
            ? [{ [q.columns![0]!.key]: "Selvam" }]
            : q.type === "choice"
              ? q.options![0]
              : q.type === "number" || q.type === "currency"
                ? "10"
                : q.type === "file"
                  ? ["https://drive.example/selvam-brand"]
                  : "Answer";
      await publicApi().put(`/public/onboarding/${token}/answers/${q.key}`).send({ value }).expect(200);
    }
    let o = (await priya.get(`/onboarding/${id}`).expect(200)).body;
    expect(o.progress.required.complete).toBe(true);
    expect(o.requiredDoneAt).not.toBeNull();
    // Won without a proposal, so no agreement yet; the approver came with the client.
    expect(o.gate).toEqual({ open: false, byException: false, missing: ["Agreement signed", "Deliverables confirmed"] });
    expect(o.checklist.find((c: { key: string }) => c.key === "approver")).toMatchObject({ done: true, auto: true });

    await priya.put(`/onboarding/${id}/checklist/approver`).send({ done: true }).expect(409);
    o = (await priya.put(`/onboarding/${id}/checklist/deliverables`).send({ done: true }).expect(200)).body;
    expect(o.gate.missing).toEqual(["Agreement signed"]);

    await priya.post(`/onboarding/${id}/exception`).send({ reason: "Agreement is with their lawyer" }).expect(403);
    o = (await ashwin.post(`/onboarding/${id}/exception`).send({ reason: "Agreement is with their lawyer" }).expect(200)).body;
    expect(o.gate).toMatchObject({ open: true, byException: true });
    expect(o.exception).toMatchObject({ reason: "Agreement is with their lawyer", by: { name: "Ashwin" } });
  });

  it("asks for reminders on the agency's days, once each, and flags it after the window", async () => {
    await t.sql(`UPDATE questionnaire_responses SET sent_at = now() - interval '4 days' WHERE id = $1`, [id]);
    let o = (await priya.get(`/onboarding/${id}`).expect(200)).body;
    expect(o.window).toMatchObject({ state: "on_track", day: 5 });
    expect(o.remindersDue).toEqual([2, 5]);
    o = (await priya.post(`/onboarding/${id}/reminders`).send({ day: 2 }).expect(200)).body;
    expect(o.remindersDue).toEqual([5]);
    expect(o.reminders).toMatchObject([{ day: 2, channel: "whatsapp", by: { name: "Priya Venkatesh" } }]);
    await priya.post(`/onboarding/${id}/reminders`).send({ day: 3 }).expect(400);

    await t.sql(`UPDATE questionnaire_responses SET sent_at = now() - interval '9 days' WHERE id = $1`, [id]);
    o = (await priya.get(`/onboarding/${id}`).expect(200)).body;
    expect(o.window.state).toBe("overdue");
    const list = (await jana.get("/onboarding").expect(200)).body as { id: string; window: { state: string } }[];
    expect(list.find((x) => x.id === id)?.window.state).toBe("overdue");
  });

  it("keeps the version it started on when the questions change again", async () => {
    const d: QuestionnaireDefinition = structuredClone(DEFAULT_QUESTIONNAIRES.client);
    d.sections.pop();
    await jana.put("/questionnaires/client/draft").send(d).expect(200);
    await jana.post("/questionnaires/client/publish").expect(200);
    expect((await priya.get(`/onboarding/${id}`).expect(200)).body.version).toBe(2);
  });

  it("is invisible to another agency", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    await zara.get(`/onboarding/${id}`).expect(404);
    expect((await zara.get("/onboarding").expect(200)).body).toEqual([]);
  });
});

describe("the agency's own questionnaire", () => {
  it("fills in the agency profile and turns the packages table into packages", async () => {
    expect((await jana.get("/onboarding/agency").expect(200)).text).toBe("");
    await priya.post("/onboarding/agency").expect(403);
    const o = (await jana.post("/onboarding/agency").expect(201)).body;
    expect(o).toMatchObject({ kind: "agency", client: null, version: 1, mode: "assisted" });
    expect((await priya.get("/onboarding/agency").expect(200)).body.id).toBe(o.id);
    await priya.put(`/onboarding/${o.id}/answers/a2`).send({ value: "Scale" }).expect(403);
    await jana.put(`/onboarding/${o.id}/answers/a2`).send({ value: "Stability" }).expect(200);
    expect((await jana.get("/agency").expect(200)).body.businessStage).toBe("Stability");

    await jana
      .put(`/onboarding/${o.id}/answers/a4`)
      .send({
        value: [
          { name: "Growth Video Pack", price: "85000", videos: "12", posts: "0", shootDays: "2", revisions: "2" },
          { name: "Founder Brand", price: "₹60,000", videos: "6", posts: "8", shootDays: "1", revisions: "2" },
        ],
      })
      .expect(200);
    expect((await jana.post(`/onboarding/${o.id}/packages`).expect(200)).body).toEqual({ added: ["Founder Brand"] });
    expect((await jana.post(`/onboarding/${o.id}/packages`).expect(200)).body).toEqual({ added: [] });
    const pkg = ((await jana.get("/packages").expect(200)).body as { name: string; monthlyFee: number; videosPerMonth: number; postsPerMonth: number }[]).find(
      (p) => p.name === "Founder Brand",
    );
    expect(pkg).toMatchObject({ monthlyFee: 60000, videosPerMonth: 6, postsPerMonth: 8 });
  });
});
