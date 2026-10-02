// Finance and costing (P5-01 to P5-03): cost rates restricted like salaries, expenses submitted by anyone and approved
// by finance, and the true cost of a video and a client's month against what the client pays.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type ClientCostRow,
  type CostingSummary,
  type CostRateRow,
  type CostSettings,
  DEFAULT_PRODUCTION_SETTINGS,
  type ExpenseRow,
  type UploadStart,
  type VideoCostRow,
} from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner: salaries
let ashwin: Agent; // manager: finance view
let karthik: Agent; // team leader
let divya: Agent; // editor
let surya: Agent; // editor
let vignesh: Agent; // shooter
let anitha: Agent; // finance: approves expenses
let clientId: string;
let videoId: string;
let props: ExpenseRow;
const dir = mkdtempSync(join(tmpdir(), "gm-finance-"));
const M = new Date().toISOString().slice(0, 7);
const TODAY = new Date().toISOString().slice(0, 10);
const FIRST = `${M}-01`;
const DIVYA = seedUserId("divya@geniemagnet.test");
const anon = () => request(t.app.getHttpServer());
const expense = async (who: Agent, body: object) => (await who.post("/expenses").send(body).expect(201)).body as ExpenseRow;

beforeAll(async () => {
  t = await startSeededApp({ FILES_DIR: dir });
  [jana, ashwin, karthik, divya, surya, vignesh, anitha] = await Promise.all(
    ["jana", "ashwin", "karthik", "divya", "surya", "vignesh", "anitha"].map((p) => t.signInAs(`${p}@geniemagnet.test`)),
  );
  clientId = (
    await ashwin
      .post("/clients")
      .send({ name: "Hosur Hardware", code: "HSR", contacts: [{ name: "Ganesh", phone: "+91 98400 11001", approver: true }] })
      .expect(201)
  ).body.id;
  const a = (
    await ashwin
      .post(`/clients/${clientId}/agreements`)
      .send({
        title: "Hosur · Reels",
        startDate: FIRST,
        months: 6,
        monthlyFee: 60000,
        billing: "Monthly advance",
        revisionsPerDeliverable: 2,
        shootDays: 1,
        deliverables: [{ name: "Reels", perMonth: 4, kind: "video" }],
        platforms: ["instagram"],
      })
      .expect(201)
  ).body as { id: string };
  await jana.post(`/agreements/${a.id}/sign-off`).expect(200);
  // One video, shot on a shoot, edited, sent, and sent back for a revision.
  videoId = (
    (
      await ashwin
        .post("/videos")
        .send({ clientId, title: "Tools that last", format: "Reel", dueDate: `${M}-27`, editorId: DIVYA })
        .expect(201)
    ).body as { id: string }
  ).id;
  const shoot = (
    await ashwin
      .post("/shoots")
      .send({
        clientId,
        title: "Hosur shop day",
        date: FIRST,
        callTime: "09:00",
        kit: "single",
        cameraId: seedUserId("vignesh@geniemagnet.test"),
        videoIds: [videoId],
      })
      .expect(201)
  ).body as { id: string };
  await vignesh.post(`/shoots/${shoot.id}/time`).send({ date: FIRST, minutes: 120 }).expect(201);
  await divya.post(`/videos/${videoId}/move`).send({ to: "shot" }).expect(200);
  await divya.put(`/videos/${videoId}/protect`).send({ done: true }).expect(200);
  await divya.post(`/videos/${videoId}/move`).send({ to: "editing" }).expect(200);
  await divya.post(`/videos/${videoId}/time`).send({ date: FIRST, minutes: 240, note: "Edit" }).expect(201);
  for (const step of DEFAULT_PRODUCTION_SETTINGS.editSteps) await divya.put(`/videos/${videoId}/edit-steps`).send({ step, done: true }).expect(200);
  await divya.post(`/videos/${videoId}/move`).send({ to: "internal_qc" }).expect(200);
  for (const q of DEFAULT_PRODUCTION_SETTINGS.qcChecks) await karthik.put(`/videos/${videoId}/qc`).send({ check: q.key, result: "pass" }).expect(200);
  await divya.post(`/videos/${videoId}/versions`).send({ link: "https://drive.example/hsr-v1" }).expect(201);
  await divya.post(`/videos/${videoId}/versions/send`).expect(200);
  await karthik.post(`/videos/${videoId}/decision`).send({ approved: false, note: "Show the price tags" }).expect(200);
  await divya.post(`/videos/${videoId}/time`).send({ date: TODAY, minutes: 60, note: "Revision" }).expect(201);
}, 300_000);

afterAll(async () => {
  await t?.stop();
  rmSync(dir, { recursive: true, force: true });
}, 60_000);

describe("cost rates and settings", () => {
  it("are restricted: people's rates like salaries, the rest to finance", async () => {
    await anitha.get("/costing/rates").expect(403); // finance does not see salaries
    await anitha.put(`/costing/rates/${DIVYA}`).send({ monthlyCost: 52800, hoursPerMonth: 176, effectiveFrom: FIRST }).expect(403);
    const rows = (await jana.put(`/costing/rates/${DIVYA}`).send({ monthlyCost: 52800, hoursPerMonth: 176, effectiveFrom: FIRST }).expect(200))
      .body as CostRateRow[];
    expect(rows.find((r) => r.user.id === DIVYA)).toMatchObject({ hourly: 300, current: { monthlyCost: 52800, hoursPerMonth: 176, effectiveFrom: FIRST } });
    const [audit] = (await jana.get("/audit?entity=cost_rate&limit=1").expect(200)).body.items as { after: Record<string, unknown> }[];
    expect(JSON.stringify(audit)).not.toContain("52800"); // that it changed, not the amount

    await divya
      .put("/costing/settings")
      .send({ kitRates: { single: 3000 }, monthlyOverhead: 20000 })
      .expect(403);
    const s = (
      await anitha
        .put("/costing/settings")
        .send({ kitRates: { single: 3000 }, monthlyOverhead: 20000 })
        .expect(200)
    ).body as CostSettings;
    expect(s.kits.find((k) => k.key === "single")).toMatchObject({ dailyRate: 3000 });
    expect(s.monthlyOverhead).toBe(20000);
  });
});

describe("expenses", () => {
  it("are submitted by anyone, with receipts, and seen only by them and finance", async () => {
    props = await expense(divya, {
      date: TODAY,
      vendor: "Hosur Props House",
      category: "Props and set",
      description: "Price tags and shelf props",
      amount: 1200,
      gst: 216,
      videoId,
    });
    expect(props).toMatchObject({ status: "submitted", client: { name: "Hosur Hardware" }, video: { id: videoId }, vendor: { name: "Hosur Props House" } });
    const up = (await divya.post("/files").send({ name: "bill.jpg", mime: "image/jpeg", size: 4, entity: "expense", entityId: props.id }).expect(201))
      .body as UploadStart;
    await anon().put(new URL(up.uploadUrl).pathname).set("Content-Type", "image/jpeg").send(Buffer.from("bill")).expect(200);
    expect(((await divya.get(`/expenses/${props.id}`).expect(200)).body as ExpenseRow).receipts).toBe(1);

    await surya.get(`/expenses/${props.id}`).expect(404);
    await surya.get(`/files?entity=expense&entityId=${props.id}`).expect(403);
    expect(((await surya.get("/expenses").expect(200)).body as ExpenseRow[]).some((e) => e.id === props.id)).toBe(false);
    const n = (await anitha.get("/notifications").expect(200)).body.items as { kind: string }[];
    expect(n.some((x) => x.kind === "expense_to_approve")).toBe(true);
  });

  it("are approved or rejected (with a reason) by finance, and then stay as they are", async () => {
    await divya.post(`/expenses/${props.id}/decision`).send({ approved: true }).expect(403);
    await anitha.post(`/expenses/${props.id}/decision`).send({ approved: true }).expect(200);
    await divya.put(`/expenses/${props.id}`).send({ date: TODAY, category: "Props and set", description: "Changed", amount: 5000 }).expect(409);

    const travel = await expense(divya, { date: TODAY, category: "Travel", description: "Cab to Hosur and back", amount: 800, clientId });
    const software = await expense(anitha, { date: TODAY, category: "Software", description: "Editing suite, monthly", amount: 5000 });
    const lunch = await expense(divya, { date: TODAY, category: "Food", description: "Team lunch", amount: 2500 });
    await anitha.post(`/expenses/${travel.id}/decision`).send({ approved: true }).expect(200);
    await anitha.post(`/expenses/${software.id}/decision`).send({ approved: true }).expect(200);
    await anitha.post(`/expenses/${lunch.id}/decision`).send({ approved: false }).expect(400);
    await anitha.post(`/expenses/${lunch.id}/decision`).send({ approved: false, note: "Not a client cost" }).expect(200);
    const n = (await divya.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.filter((x) => x.kind === "expense_decided").map((x) => x.title)).toEqual(expect.arrayContaining(["Rejected: ₹2,500 · Team lunch"]));
    const all = (await anitha.get(`/expenses?month=${M}&status=approved`).expect(200)).body as ExpenseRow[];
    expect(all.map((e) => e.amount).sort((a, b) => a - b)).toEqual([800, 1200, 5000]);
  });
});

describe("true costing", () => {
  it("costs a video: labour at the editor's rate, its shoot and kit, expenses, overheads — and rework apart", async () => {
    await divya.get(`/costing/videos?month=${M}`).expect(403);
    const rows = (await anitha.get(`/costing/videos?month=${M}`).expect(200)).body as VideoCostRow[];
    const v = rows.find((r) => r.id === videoId)!;
    const summary = (await anitha.get(`/costing/summary?month=${M}`).expect(200)).body as CostingSummary;
    expect(v).toMatchObject({ labour: 1500, shoots: 3000, expenses: 2000, hours: 7, revenue: 15000, client: { code: "HSR" } });
    // The 60 minutes in revision are rework (all of it when the month began today).
    expect(v.rework).toBe(FIRST === TODAY ? 1500 : 300);
    expect(v.overhead).toBeGreaterThan(0);
    expect(v.total).toBe(v.labour + v.shoots + v.expenses + v.overhead);
    expect(v.margin).toBe(15000 - v.total);
    // Overheads: the monthly figure and the unallocated software expense, shared by the hours logged.
    expect(summary.overheads).toBe(25000);
    expect(summary.missingRates).toEqual([expect.objectContaining({ name: "Vignesh Kumar", hours: 2 })]);
  });

  it("costs a client's month against what it pays", async () => {
    const rows = (await ashwin.get(`/costing/clients?month=${M}`).expect(200)).body as ClientCostRow[];
    const c = rows.find((r) => r.client.code === "HSR")!;
    expect(c).toMatchObject({ revenue: 60000, labour: 1500, shoots: 3000, expenses: 2000, videos: 1 });
    expect(c.margin).toBe(60000 - c.total);
    expect(c.marginPct).toBe(Math.round(((60000 - c.total) / 60000) * 100));
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect(((await zara.get(`/costing/clients?month=${M}`).expect(200)).body as ClientCostRow[]).some((r) => r.client.code === "HSR")).toBe(false);
    expect(((await zara.get("/expenses").expect(200)).body as ExpenseRow[]).some((e) => e.id === props.id)).toBe(false);
    await zara.get(`/expenses/${props.id}`).expect(404);
  });
});
