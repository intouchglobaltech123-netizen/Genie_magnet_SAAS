// Equipment and assets (P5-20): the register, check-out and return against shoots, reservations with clashes,
// problems and repairs, items assigned for good, retiring, and the kit's use flowing into what a shoot cost.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { AssetDetail, AssetRow, CostingSummary } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner
let ashwin: Agent; // manager: keeps the register
let karthik: Agent; // team leader: uses the equipment
let vignesh: Agent; // shooter: uses the equipment
let divya: Agent; // editor: sees the equipment
let meena: Agent; // social media manager: no access
let ids: Record<string, string>;
let cam1: AssetDetail;
let cam2: AssetDetail;
let shootId: string;

const IST = 330 * 60_000;
const dayFrom = (n: number) => new Date(Date.now() + IST + n * 86_400_000).toISOString().slice(0, 10);
const TODAY = dayFrom(0);
const TOMORROW = dayFrom(1);
const MONTH = TODAY.slice(0, 7);
const camera = (tag: string) => ({
  tag,
  name: "Sony A7 IV",
  category: "Camera",
  purchaseDate: "2025-04-01",
  purchaseValue: 120000,
  usefulLifeYears: 4,
  hoursPerYear: 1200,
});

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, karthik, vignesh, divya, meena] = await Promise.all(
    ["jana", "ashwin", "karthik", "vignesh", "divya", "meena"].map((p) => t.signInAs(`${p}@geniemagnet.test`)),
  );
  const people = (await t.sql(`SELECT id, email FROM users WHERE email LIKE '%@geniemagnet.test'`)) as { id: string; email: string }[];
  ids = Object.fromEntries(people.map((p) => [p.email.split("@")[0]!, p.id]));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("the register", () => {
  it("is kept by those who may approve, seen by those who use it", async () => {
    await meena.get("/assets").expect(403);
    expect((await divya.get("/assets").expect(200)).body).toEqual([]);
    await vignesh.post("/assets").send(camera("GM-CAM-01")).expect(403);
    await ashwin
      .post("/assets")
      .send({ ...camera("GM-CAM-01"), residualValue: 200000 })
      .expect(400);
    cam1 = (await ashwin.post("/assets").send(camera("GM-CAM-01")).expect(201)).body as AssetDetail;
    expect(cam1).toMatchObject({ status: "available", condition: "Good", perHour: 25, hoursUsed: 0, out: null });
    expect(cam1.bookValue).toBeLessThan(120000);
    expect((await ashwin.post("/assets").send(camera("gm-cam-01")).expect(409)).body.message).toMatch(/already the tag/);
    cam2 = (await ashwin.post("/assets").send(camera("GM-CAM-02")).expect(201)).body as AssetDetail;
    const updated = (
      await ashwin
        .put(`/assets/${cam2.id}`)
        .send({ ...camera("GM-CAM-02"), name: "Sony A7 III", serialNo: "SN-2" })
        .expect(200)
    ).body as AssetDetail;
    expect(updated).toMatchObject({ name: "Sony A7 III", serialNo: "SN-2" });
  });
});

describe("reservations", () => {
  it("clash on the same day, pointing to an item of the same kind that is free", async () => {
    await vignesh
      .post(`/assets/${cam1.id}/reservations`)
      .send({ date: dayFrom(-1), userId: ids.vignesh, purpose: "Pickups" })
      .expect(400);
    cam1 = (await vignesh.post(`/assets/${cam1.id}/reservations`).send({ date: TOMORROW, userId: ids.vignesh, purpose: "Pickups" }).expect(201))
      .body as AssetDetail;
    expect(cam1.nextReservation).toMatchObject({ date: TOMORROW, purpose: "Pickups", for: { id: ids.vignesh } });
    const clash = await karthik.post(`/assets/${cam1.id}/reservations`).send({ date: TOMORROW, userId: ids.karthik, purpose: "Interview" }).expect(409);
    expect(clash.body.message).toMatch(/already reserved on that day for Vignesh Kumar: Pickups\. GM-CAM-02 Sony A7 III is free that day\./);
  });

  it("are cancelled by the person they are for, whoever made them, or someone who keeps the register", async () => {
    const r = cam1.nextReservation!;
    await karthik.delete(`/assets/reservations/${r.id}`).expect(403);
    cam1 = (await vignesh.delete(`/assets/reservations/${r.id}`).expect(200)).body as AssetDetail;
    expect(cam1.nextReservation).toBeNull();
  });
});

describe("check-out and return", () => {
  it("goes out against a shoot, due back on its day, and is with one person at a time", async () => {
    const clientId = (
      await ashwin
        .post("/clients")
        .send({ name: "Kovai Crafts", code: "KVC", contacts: [{ name: "Selvi", phone: "+91 98400 33003", approver: true }] })
        .expect(201)
    ).body.id as string;
    shootId = ((await ashwin.post("/shoots").send({ clientId, title: "Kovai workshop day", date: TODAY, kit: "single" }).expect(201)).body as { id: string })
      .id;
    expect(((await vignesh.get("/assets/shoots").expect(200)).body as { id: string }[]).map((s) => s.id)).toContain(shootId);
    const team = (await vignesh.get("/assets/people").expect(200)).body as { id: string; name: string }[];
    expect(team.map((p) => p.name)).toContain("Divya Lakshmi");
    expect(team.some((p) => p.name === "Kumar")).toBe(false);
    await divya.post(`/assets/${cam1.id}/check-out`).send({ userId: ids.divya, purpose: "Practice" }).expect(403);
    await vignesh.post(`/assets/${cam1.id}/check-out`).send({ userId: ids.vignesh }).expect(400);
    cam1 = (await vignesh.post(`/assets/${cam1.id}/check-out`).send({ userId: ids.vignesh, shootId }).expect(200)).body as AssetDetail;
    expect(cam1.status).toBe("checked_out");
    expect(cam1.out).toMatchObject({ kind: "out", holder: { name: "Vignesh Kumar" }, dueOn: TODAY, overdue: false, purpose: "Kovai workshop day" });
    expect(cam1.out!.shoot).toMatchObject({ id: shootId, client: "Kovai Crafts" });
    expect((await karthik.post(`/assets/${cam1.id}/check-out`).send({ userId: ids.karthik, purpose: "Interview" }).expect(409)).body.message).toMatch(
      /already with Vignesh Kumar/,
    );
    expect((await ashwin.post(`/assets/${cam1.id}/retire`).send({ note: "Sold" }).expect(409)).body.message).toMatch(/Take it back first/);
  });

  it("is kept for the person it is reserved for today", async () => {
    await karthik.post(`/assets/${cam2.id}/reservations`).send({ date: TODAY, userId: ids.karthik, purpose: "Interview" }).expect(201);
    expect(((await divya.get("/assets").expect(200)).body as AssetRow[]).find((a) => a.id === cam2.id)!.status).toBe("reserved");
    expect((await vignesh.post(`/assets/${cam2.id}/check-out`).send({ userId: ids.vignesh, purpose: "B-roll" }).expect(409)).body.message).toMatch(
      /reserved today for Karthik Subramanian: Interview/,
    );
    cam2 = (await karthik.post(`/assets/${cam2.id}/check-out`).send({ userId: ids.karthik, purpose: "Interview" }).expect(200)).body as AssetDetail;
    expect(cam2.nextReservation).toBeNull(); // the reservation is used
  });

  it("comes back with the hours of use, which is what the shoot's kit cost instead of the kit list's day rate", async () => {
    await jana
      .put("/costing/settings")
      .send({ kitRates: { single: 5000 }, monthlyOverhead: 0 })
      .expect(200);
    const before = ((await ashwin.get(`/costing/summary?month=${MONTH}`).expect(200)).body as CostingSummary).totalCost;
    cam1 = (await karthik.post(`/assets/${cam1.id}/return`).send({ condition: "Good", hours: 6 }).expect(200)).body as AssetDetail;
    expect(cam1).toMatchObject({ status: "available", hoursUsed: 6, recovered: 150, out: null });
    expect(cam1.custody[0]).toMatchObject({
      holder: { name: "Vignesh Kumar" },
      returnedTo: { name: "Karthik Subramanian" },
      hours: 6,
      returnCondition: "Good",
    });
    const after = ((await ashwin.get(`/costing/summary?month=${MONTH}`).expect(200)).body as CostingSummary).totalCost;
    expect(Math.abs(after - (before - 5000 + 150))).toBeLessThanOrEqual(1); // 6 hours at ₹25 an hour, not ₹5,000 for the day
  });
});

describe("problems and repairs", () => {
  it("take an item out of service until someone who keeps the register puts it back", async () => {
    await karthik.post(`/assets/${cam2.id}/return`).send({ condition: "Needs repair" }).expect(400);
    cam2 = (await karthik.post(`/assets/${cam2.id}/return`).send({ condition: "Needs repair", note: "Crackling on the XLR input" }).expect(200))
      .body as AssetDetail;
    expect(cam2).toMatchObject({ status: "maintenance", condition: "Needs repair" });
    expect(cam2.openRepair!.title).toBe("Reported on return: Crackling on the XLR input");
    expect((await vignesh.post(`/assets/${cam2.id}/check-out`).send({ userId: ids.vignesh, purpose: "B-roll" }).expect(409)).body.message).toMatch(
      /out for repair/,
    );
    expect((await vignesh.post(`/assets/${cam2.id}/problem`).send({ note: "Still crackling" }).expect(409)).body.message).toMatch(/already out for repair/);
    const repair = cam2.openRepair!.id;
    await karthik.post(`/assets/maintenance/${repair}/back-in-service`).send({ condition: "Good" }).expect(403);
    cam2 = (await ashwin.post(`/assets/maintenance/${repair}/back-in-service`).send({ condition: "Good", cost: 3500, note: "XLR board replaced" }).expect(200))
      .body as AssetDetail;
    expect(cam2).toMatchObject({ status: "available", condition: "Good", openRepair: null });
    expect(cam2.maintenance[0]).toMatchObject({
      cost: 3500,
      closeCondition: "Good",
      closedBy: { name: "Ashwin" },
      note: "Crackling on the XLR input\nXLR board replaced",
    });
  });

  it("are reported by anyone using the item, and serviced without taking it out", async () => {
    cam1 = (await vignesh.post(`/assets/${cam1.id}/problem`).send({ note: "Dust on the sensor" }).expect(200)).body as AssetDetail;
    expect(cam1).toMatchObject({ status: "maintenance", condition: "Needs repair" });
    cam1 = (await ashwin.post(`/assets/maintenance/${cam1.openRepair!.id}/back-in-service`).send({ condition: "Excellent" }).expect(200)).body as AssetDetail;
    await vignesh.post(`/assets/${cam1.id}/maintenance`).send({ date: TODAY, title: "Firmware update" }).expect(403);
    cam1 = (await ashwin.post(`/assets/${cam1.id}/maintenance`).send({ date: TODAY, title: "Firmware update", by: "Naveen", cost: 0 }).expect(201))
      .body as AssetDetail;
    expect(cam1).toMatchObject({ status: "available", condition: "Excellent" });
    expect(cam1.maintenance.map((m) => m.title)).toContain("Firmware update");
  });
});

describe("assigned for good, and retired", () => {
  it("an item assigned to someone stays with them and cannot be reserved", async () => {
    const laptop = (
      await ashwin
        .post("/assets")
        .send({
          tag: "GM-PC-01",
          name: "Edit workstation",
          category: "Computer",
          purchaseDate: "2026-01-10",
          purchaseValue: 180000,
          usefulLifeYears: 3,
          hoursPerYear: 2000,
        })
        .expect(201)
    ).body as AssetDetail;
    const assigned = (await ashwin.post(`/assets/${laptop.id}/check-out`).send({ userId: ids.divya, kind: "assigned" }).expect(200)).body as AssetDetail;
    expect(assigned).toMatchObject({ status: "assigned", out: { kind: "assigned", holder: { name: "Divya Lakshmi" }, dueOn: null } });
    expect(
      (await vignesh.post(`/assets/${laptop.id}/reservations`).send({ date: TOMORROW, userId: ids.vignesh, purpose: "Edit" }).expect(409)).body.message,
    ).toMatch(/assigned to Divya Lakshmi/);
  });

  it("a retired item is out of use, its reservations dropped", async () => {
    await vignesh.post(`/assets/${cam2.id}/reservations`).send({ date: TOMORROW, userId: ids.vignesh, purpose: "Pickups" }).expect(201);
    await karthik.post(`/assets/${cam2.id}/retire`).send({ note: "Sold" }).expect(403);
    cam2 = (await ashwin.post(`/assets/${cam2.id}/retire`).send({ note: "Sold to a student" }).expect(200)).body as AssetDetail;
    expect(cam2).toMatchObject({ status: "retired", retiredNote: "Sold to a student", reservations: [], nextReservation: null });
    expect((await vignesh.post(`/assets/${cam2.id}/check-out`).send({ userId: ids.vignesh, purpose: "B-roll" }).expect(409)).body.message).toMatch(/retired/);
    expect(await t.sql(`SELECT 1 FROM audit_logs WHERE entity = 'asset' LIMIT 1`)).toHaveLength(1);
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/assets").expect(200)).body).toEqual([]);
    await zara.get(`/assets/${cam1.id}`).expect(404);
  });
});
