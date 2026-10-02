// The financial planner (P5-19): each person's own — saved and read back by them only.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PlannerData } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner: may use the planner
let ashwin: Agent; // manager: may not
const MINE: PlannerData = {
  month: "2026-10",
  setup: { name: "Janarthanan", age: 38, monthlyIncome: 150000, retireAge: 55, inflation: 7, expectedReturn: 12, postRetirementReturn: 6, monthlySip: 20000 },
  log: [
    { id: "e1", day: 2, date: "2026-10-02", item: "Coffee out", amount: 450, kind: "Want", leakType: "DRIPPER", emotion: "Boredom", mood: 3, rule48: "No" },
  ],
  answers: { "1": 3, "2": 4 },
  quizIndex: 2,
  detoxJoined: false,
};

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin] = await Promise.all(["jana", "ashwin"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("the financial planner", () => {
  it("is each person's own, saved and read back by them alone", async () => {
    expect((await jana.get("/planner").expect(200)).text).toBe("");
    await jana
      .put("/planner")
      .send({ ...MINE, setup: { ...MINE.setup, age: 5 } })
      .expect(400);
    await jana
      .put("/planner")
      .send({ ...MINE, month: "2026-13" })
      .expect(400);
    await jana.put("/planner").send(MINE).expect(200);
    expect((await jana.get("/planner").expect(200)).body).toEqual(MINE);
    await ashwin.get("/planner").expect(403); // the personal planner is its own permission, off for every role but the owner
    await ashwin.put("/planner").send(MINE).expect(403);
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/planner").expect(200)).text).toBe("");
    // Nothing about it shows in the audit log.
    expect(await t.sql(`SELECT 1 FROM audit_logs WHERE entity ILIKE '%planner%'`)).toEqual([]);
  });
});
