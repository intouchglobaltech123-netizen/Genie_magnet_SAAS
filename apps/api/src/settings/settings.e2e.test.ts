// Agency profile (P1-12) and packages (P1-13), on the sample agencies.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { genieMagnet } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent;

beforeAll(async () => {
  t = await startSeededApp();
  jana = await t.signInAs("jana@geniemagnet.test");
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

const LOGO = `data:image/png;base64,${"iVBORw0KGgo".repeat(10)}`;

describe("agency profile", () => {
  it("is read by everyone on the team, and changed only with edit on Agency settings", async () => {
    const divya = await t.signInAs("divya@geniemagnet.test");
    const profile = (await divya.get("/agency").expect(200)).body;
    expect(profile).toMatchObject({ name: "Genie Magnet", city: "Appakudal", windowDays: 7, reminderDays: [2, 5], languages: ["en", "ta"] });
    await divya.patch("/agency").send({ city: "Erode" }).expect(403);
  });

  it("saves only what changed, audits it, and never puts the logo image in the audit log", async () => {
    const res = await jana
      .patch("/agency")
      .send({ logo: LOGO, brandColor: "#0F766E", businessStage: "Stability", windowDays: 10, reminderDays: [7, 3], website: "", city: "Appakudal" })
      .expect(200);
    expect(res.body).toMatchObject({ logo: LOGO, brandColor: "#0F766E", businessStage: "Stability", windowDays: 10, reminderDays: [3, 7], website: null });

    const [entry] = (await jana.get(`/audit?entity=agency&entityId=${genieMagnet.id}&limit=1`).expect(200)).body.items;
    expect(entry.action).toBe("update");
    expect(entry.after).toEqual({
      name: "Genie Magnet",
      logo: "(new logo)",
      brandColor: "#0F766E",
      businessStage: "Stability",
      windowDays: 10,
      reminderDays: [3, 7],
    });
  });

  it("explains what is wrong in plain words", async () => {
    const res = await jana
      .patch("/agency")
      .send({ windowDays: 5, reminderDays: [2, 6] })
      .expect(400);
    expect(res.body.issues).toEqual([{ path: "reminderDays", message: "Reminders must come before the end of the window" }]);
    await jana.patch("/agency").send({ logo: "data:image/svg+xml;base64,PHN2Zz4=" }).expect(400);
  });
});

describe("packages", () => {
  const pack = {
    name: "Festive Burst",
    monthlyFee: 55000,
    deliverables: [
      { name: "Reels", perMonth: 6, kind: "video" },
      { name: "Static posts", perMonth: 10, kind: "post" },
    ],
    shootDays: 1,
    revisionsPerDeliverable: 2,
    platforms: ["instagram"],
  };
  let created: { id: string };

  it("are seen by everyone on the team; only Agency settings edit may change them", async () => {
    const priya = await t.signInAs("priya@geniemagnet.test");
    const list = (await priya.get("/packages").expect(200)).body as { name: string; videosPerMonth: number; postsPerMonth: number }[];
    expect(list.map((p) => p.name)).toContain("Social Starter Pack");
    expect(list.find((p) => p.name === "Social Starter Pack")).toMatchObject({ videosPerMonth: 10, postsPerMonth: 32 });
    await priya.post("/packages").send(pack).expect(403);
  });

  it("are created with their deliverables and the totals worked out", async () => {
    created = (await jana.post("/packages").send(pack).expect(201)).body;
    expect(created).toMatchObject({ name: "Festive Burst", videosPerMonth: 6, postsPerMonth: 10, active: true, agreements: 0 });
    const dup = await jana.post("/packages").send(pack).expect(409);
    expect(dup.body.message).toBe('There is already a package called "Festive Burst".');
  });

  it("can change without touching agreements already made from them", async () => {
    const growth = ((await jana.get("/packages").expect(200)).body as { id: string; name: string; agreements: number }[]).find(
      (p) => p.name === "Growth Video Pack",
    )!;
    expect(growth.agreements).toBe(1);
    await jana.patch(`/packages/${growth.id}`).send({ monthlyFee: 95000 }).expect(200);
    const [agreement] = await t.sql<{ monthly_fee: number }>(`SELECT monthly_fee FROM agreements WHERE package_id = $1`, [growth.id]);
    expect(agreement!.monthly_fee).toBe(85000);

    // In use: archive, not delete.
    await jana.delete(`/packages/${growth.id}`).expect(409);
    await jana.post(`/packages/${growth.id}/archive`).expect(200);
    expect(((await jana.get("/packages").expect(200)).body as { id: string }[]).some((p) => p.id === growth.id)).toBe(false);
    expect(((await jana.get("/packages?archived=1").expect(200)).body as { id: string; active: boolean }[]).find((p) => p.id === growth.id)?.active).toBe(
      false,
    );
    await jana.post(`/packages/${growth.id}/restore`).expect(200);
  });

  it("deletes a package nothing uses, and audits every step", async () => {
    await jana.delete(`/packages/${created.id}`).expect(204);
    const history = (await jana.get(`/audit?entity=package&entityId=${created.id}`).expect(200)).body.items as { action: string }[];
    expect(history.map((e) => e.action)).toEqual(["delete", "create"]);
    const fee = (await jana.get("/audit?entity=package&limit=50").expect(200)).body.items.find((e: { action: string }) => e.action === "update");
    expect(fee).toMatchObject({ before: { name: "Growth Video Pack", monthlyFee: 85000 }, after: { name: "Growth Video Pack", monthlyFee: 95000 } });
  });
});

describe("the set-up guide", () => {
  type Setup = { hidden: boolean; steps: Record<string, boolean> };

  it("ticks each step from the agency's own data", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    const before = (await zara.get("/agency/setup").expect(200)).body as Setup;
    expect(before.hidden).toBe(false);
    expect(before.steps).toMatchObject({ packages: true, clients: true, production: false, videos: false, platforms: false });
    await zara
      .put("/production-settings")
      .send((await zara.get("/production-settings").expect(200)).body)
      .expect(200);
    expect(((await zara.get("/agency/setup").expect(200)).body as Setup).steps.production).toBe(true);
  });

  it("is hidden for the whole agency by someone who may change settings, and shown again", async () => {
    const divya = await t.signInAs("divya@geniemagnet.test");
    await divya.put("/agency/setup").send({ hidden: true }).expect(403);
    expect(((await jana.put("/agency/setup").send({ hidden: true }).expect(200)).body as Setup).hidden).toBe(true);
    expect(((await divya.get("/agency/setup").expect(200)).body as Setup).hidden).toBe(true);
    const zara = await t.signInAs("zara@zenstudio.test");
    expect(((await zara.get("/agency/setup").expect(200)).body as Setup).hidden).toBe(false);
    expect(((await jana.put("/agency/setup").send({ hidden: false }).expect(200)).body as Setup).hidden).toBe(false);
  });
});
