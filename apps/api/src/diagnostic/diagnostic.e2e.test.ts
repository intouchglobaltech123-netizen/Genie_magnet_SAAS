// The business diagnostic (P5-18): the BFA and founder dependency from the agency questionnaire, taken again later;
// each client on the fitment map with its health; the Strategic Road Map drafted from the challenges; scenarios.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ClientDiagnosticRow, DiagnosticView, RoadMapRow, ScenarioInputs, ScenarioRow } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner
let karthik: Agent; // team leader: may edit reviews
let divya: Agent; // editor
let view: DiagnosticView;

beforeAll(async () => {
  t = await startSeededApp();
  [jana, karthik, divya] = await Promise.all(["jana", "karthik", "divya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("the business diagnostic", () => {
  it("is empty until the agency questionnaire's BFA is answered, then reads it", async () => {
    await divya.get("/diagnostic").expect(403);
    expect(((await jana.get("/diagnostic").expect(200)).body as DiagnosticView).current).toBeNull();
    const o = (await jana.post("/onboarding/agency").expect(201)).body as { id: string };
    await jana
      .put(`/onboarding/${o.id}/answers/a7`)
      .send({
        value: [
          { row: "Sales", consistent: "Yes", owner: "Yes", results: "High", leader: "No", action: "Hire" },
          { row: "Operations / delivery", consistent: "Yes", owner: "No", results: "High", leader: "Yes", action: "Develop" },
          { row: "HR", consistent: "No", owner: "Yes", results: "Low", leader: "Yes", action: "Delegate" },
        ],
      })
      .expect(200);
    await jana
      .put(`/onboarding/${o.id}/answers/a23`)
      .send({
        value: [
          { row: "Sales", challenge: "Leads come only through referrals", rating: "9" },
          { row: "HR", challenge: "No hiring process", rating: "6" },
          { row: "Management", challenge: "", rating: "" },
        ],
      })
      .expect(200);
    await jana.put(`/onboarding/${o.id}/answers/a10`).send({ value: "Delivery works; sales depends on me." }).expect(200);
    view = (await karthik.get("/diagnostic").expect(200)).body as DiagnosticView;
    expect(view.current).toMatchObject({ id: null, source: "questionnaire", notes: "Delivery works; sales depends on me." });
    expect(view.current!.rows.find((r) => r.function === "Sales")).toMatchObject({
      consistent: true,
      ownerDependent: true,
      results: "High",
      leader: false,
      action: "Hire",
    });
    expect(view.scores).toMatchObject({ overall: 58, founderDependency: 50 });
    expect(view.history).toEqual([]);
  });

  it("is taken again and kept with the date, the earlier ones to compare", async () => {
    const rows = view.current!.rows.map((r) => (r.function === "Sales" ? { ...r, leader: true, ownerDependent: false } : r));
    await divya.post("/diagnostic").send({ rows }).expect(403);
    view = (await karthik.post("/diagnostic").send({ rows, challenges: view.current!.challenges, notes: "A sales lead now runs it" }).expect(201))
      .body as DiagnosticView;
    expect(view.current).toMatchObject({ source: "review", notes: "A sales lead now runs it" });
    expect(view.scores!.founderDependency).toBe(17); // HR half of three answered
    expect(view.history).toHaveLength(1);
  });

  it("places each client on the fitment map with its health", async () => {
    const r = (await jana.get("/diagnostic/clients").expect(200)).body as { rows: ClientDiagnosticRow[]; medianFee: number };
    expect(r.rows.length).toBeGreaterThan(0);
    const first = r.rows[0]!;
    expect(first.fee).toBeGreaterThanOrEqual(r.medianFee);
    expect(["Amazing", "Bread-winning"]).toContain(first.suggested);
    expect(first.health.score).toBeGreaterThanOrEqual(0);
    expect(first.health.score).toBeLessThanOrEqual(100);
    await divya.put(`/diagnostic/clients/${first.client.id}`).send({ fitment: "Dangerous" }).expect(403);
    await jana.put(`/diagnostic/clients/${first.client.id}`).send({ fitment: first.suggested }).expect(200);
    const again = (await jana.get("/diagnostic/clients").expect(200)).body as { rows: ClientDiagnosticRow[] };
    expect(again.rows.find((x) => x.client.id === first.client.id)!.fitment).toBe(first.suggested);
  });
});

describe("the Strategic Road Map", () => {
  it("is drafted from the diagnostic's challenges, the biggest first, then kept by hand", async () => {
    let items = (await karthik.post("/road-map/draft").expect(200)).body as RoadMapRow[];
    expect(items.map((i) => [i.function, i.title, i.priority])).toEqual([
      ["Sales", "Leads come only through referrals", 9],
      ["HR", "No hiring process", 6],
    ]);
    await karthik.post("/road-map/draft").expect(409);
    const first = items[0]!;
    items = (
      await karthik
        .put(`/road-map/${first.id}`)
        .send({ function: first.function, title: first.title, startMonth: first.startMonth, endMonth: first.endMonth, status: "in_progress", priority: 9 })
        .expect(200)
    ).body as RoadMapRow[];
    expect(items.find((i) => i.id === first.id)!.status).toBe("in_progress");
    items = (await karthik.delete(`/road-map/${items[1]!.id}`).expect(200)).body as RoadMapRow[];
    expect(items).toHaveLength(1);
  });
});

describe("scenarios", () => {
  it("start from where the agency stands and are saved to compare", async () => {
    const base = (await jana.get("/scenarios/baseline").expect(200)).body as ScenarioInputs;
    expect(base.startClients).toBeGreaterThan(0);
    expect(base.avgFee).toBeGreaterThan(0);
    let list = (
      await jana
        .post("/scenarios")
        .send({
          name: "Two more editors",
          inputs: {
            ...base,
            hires: [
              { month: 3, cost: 30000 },
              { month: 6, cost: 30000 },
            ],
          },
        })
        .expect(201)
    ).body as ScenarioRow[];
    expect(list.map((s) => s.name)).toEqual(["Two more editors"]);
    list = (
      await jana
        .put(`/scenarios/${list[0]!.id}`)
        .send({ name: "Two editors, 10% fee rise", inputs: { ...list[0]!.inputs, feeRise: 0.1 } })
        .expect(200)
    ).body as ScenarioRow[];
    expect(list[0]).toMatchObject({ name: "Two editors, 10% fee rise", inputs: { feeRise: 0.1 } });
    expect((await jana.delete(`/scenarios/${list[0]!.id}`).expect(200)).body).toEqual([]);
  });

  it("belong to their agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/road-map").expect(200)).body).toEqual([]);
    expect(((await zara.get("/diagnostic").expect(200)).body as DiagnosticView).history).toEqual([]);
  });
});
