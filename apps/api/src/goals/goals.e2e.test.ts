// Goals (P5-13): the company's goal, a department's serving it, a person's serving that; figures the app knows
// filled in; check-ins, breakthroughs and breakdowns; who sees what; the revenue cascade from the agency's own year.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CascadeView, GoalRow } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner
let ashwin: Agent; // manager: keeps goals
let karthik: Agent; // team leader: keeps goals
let priya: Agent; // team leader: sales
let divya: Agent; // editor
let company: GoalRow;
let sales: GoalRow;
let production: GoalRow;
let mine: GoalRow;
const DIVYA = seedUserId("divya@geniemagnet.test");
const PRIYA = seedUserId("priya@geniemagnet.test");
const day = (offset: number) => new Date(Date.now() + 330 * 60_000 + offset * 86_400_000).toISOString().slice(0, 10);

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, karthik, priya, divya] = await Promise.all(["jana", "ashwin", "karthik", "priya", "divya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("goals", () => {
  it("cascade from the company to departments to people, kept by those who may edit goals", async () => {
    company = (
      await jana
        .post("/goals")
        .send({
          level: "company",
          title: "₹60 lakh revenue this year",
          type: "financial",
          unit: "inr",
          target: 6_000_000,
          metric: "invoiced",
          startDate: day(-30),
          dueDate: day(335),
          cadence: "strategic",
        })
        .expect(201)
    ).body as GoalRow;
    await divya
      .post("/goals")
      .send({ level: "company", title: "Mine", target: 1, startDate: day(0), dueDate: day(10) })
      .expect(403);
    await ashwin
      .post("/goals")
      .send({ level: "department", title: "Win clients", target: 6, startDate: day(-30), dueDate: day(335) })
      .expect(400); // serves nothing
    sales = (
      await ashwin
        .post("/goals")
        .send({
          parentId: company.id,
          level: "department",
          title: "New leads",
          measure: "Leads this year",
          target: 100,
          metric: "leads",
          ownerIds: [PRIYA],
          startDate: day(-30),
          dueDate: day(335),
        })
        .expect(201)
    ).body as GoalRow;
    production = (
      await ashwin
        .post("/goals")
        .send({
          parentId: company.id,
          level: "department",
          title: "Quality first time",
          unit: "pct",
          baseline: 70,
          target: 90,
          startDate: day(-30),
          dueDate: day(30),
        })
        .expect(201)
    ).body as GoalRow;
    await karthik
      .post("/goals")
      .send({ parentId: sales.id, level: "company", title: "Wrong way up", target: 1, startDate: day(0), dueDate: day(10) })
      .expect(400);
    mine = (
      await karthik
        .post("/goals")
        .send({
          parentId: production.id,
          level: "person",
          title: "Divya: 40 reels approved",
          target: 40,
          ownerIds: [DIVYA],
          startDate: day(-30),
          dueDate: day(30),
          cadence: "operational",
        })
        .expect(201)
    ).body as GoalRow;
    // Divya sees her goal and what it serves, not the rest.
    expect(((await divya.get("/goals").expect(200)).body as GoalRow[]).map((g) => g.title).sort()).toEqual([
      "Divya: 40 reels approved",
      "Quality first time",
      "₹60 lakh revenue this year",
    ]);
    expect(((await ashwin.get("/goals").expect(200)).body as GoalRow[]).length).toBe(4);
    await ashwin.delete(`/goals/${company.id}`).expect(409);
  });

  it("follow figures the app knows, and show whether they are on track", async () => {
    for (const name of ["Lakshmi Textiles", "Erode Sweets"]) await priya.post("/leads").send({ name, source: "Referral" }).expect(201);
    sales = (await ashwin.get(`/goals/${sales.id}`).expect(200)).body as GoalRow;
    expect(sales.actual).toBeGreaterThanOrEqual(2);
    // A month into the year: on track when the leads so far are where they should be by now.
    expect(sales.status).toBe(sales.progress / sales.expected >= 0.95 ? "on_track" : sales.progress / sales.expected >= 0.8 ? "at_risk" : "off_track");
    await divya.post(`/goals/${mine.id}/check-ins`).send({ kind: "update", note: "Halfway", value: 20 }).expect(201);
    mine = (await divya.get(`/goals/${mine.id}`).expect(200)).body as GoalRow;
    expect(mine).toMatchObject({ actual: 20, progress: 0.5, expected: 0.5, status: "on_track" });
    await divya.post(`/goals/${sales.id}/check-ins`).send({ note: "Not mine" }).expect(403);
    await priya.post(`/goals/${sales.id}/check-ins`).send({ note: "Counted", value: 5 }).expect(400); // follows the app's figure
  });

  it("report breakthroughs and breakdowns; a breakdown tells the owners of the goal it serves", async () => {
    await priya.post(`/goals/${sales.id}/check-ins`).send({ kind: "breakthrough", note: "Two referrals from one client" }).expect(201);
    await divya.post(`/goals/${mine.id}/check-ins`).send({ kind: "breakdown", note: "Footage came late for three reels" }).expect(201);
    mine = (await divya.get(`/goals/${mine.id}`).expect(200)).body as GoalRow;
    expect(mine.checkIns.map((c) => c.kind)).toEqual(["breakdown", "update"]);
    // The production goal has no owners, so nobody beyond Divya herself would be told — give it one and try again.
    await ashwin
      .put(`/goals/${production.id}`)
      .send({
        parentId: company.id,
        level: "department",
        title: "Quality first time",
        unit: "pct",
        baseline: 70,
        target: 90,
        ownerIds: [seedUserId("karthik@geniemagnet.test")],
        startDate: day(-30),
        dueDate: day(30),
      })
      .expect(200);
    await divya.post(`/goals/${mine.id}/check-ins`).send({ kind: "breakdown", note: "Two more late" }).expect(201);
    const n = (await karthik.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "goal_breakdown")!.title).toBe("Breakdown on “Divya: 40 reels approved”");
  });

  it("take the revenue cascade from the agency's own year, and set targets from it", async () => {
    await divya.get("/goals/cascade").expect(403);
    const view = (await jana.get("/goals/cascade").expect(200)).body as CascadeView;
    expect(view.history.revenueTarget).toBe(6_000_000); // the company's revenue goal
    expect(view.basis.revenueTarget).toBe("The company's revenue goal");
    expect(view.basis.baseBook).toMatch(/running agreements?, for a year$/);
    expect(view.saved).toBeNull();
    await jana
      .post("/goals/cascade/apply")
      .send({ links: [{ goalId: sales.id, figure: "leads" }] })
      .expect(409);
    const saved = {
      ...view.history,
      baseBook: 3_600_000,
      retention: 0.89,
      churn: 0.05,
      avgDeal: 500_000,
      winRate: 0.28,
      proposalRate: 0.135,
      costPerLead: 450,
    };
    expect(((await jana.put("/goals/cascade").send(saved).expect(200)).body as CascadeView).saved).toMatchObject({ avgDeal: 500_000 });
    const goals = (
      await jana
        .post("/goals/cascade/apply")
        .send({ links: [{ goalId: sales.id, figure: "leads" }] })
        .expect(200)
    ).body as GoalRow[];
    const s = goals.find((g) => g.id === sales.id)!;
    expect(s.target).toBe(163);
    expect(s.checkIns[0]!.note).toBe("Target set to 163 from the revenue cascade.");
  });

  it("belong to their agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/goals").expect(200)).body).toEqual([]);
    await zara.get(`/goals/${company.id}`).expect(404);
  });
});
