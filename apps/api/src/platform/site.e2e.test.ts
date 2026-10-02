// The marketing site and pricing page (P6-12): the brand name, trial and offered plans with prices, from the platform
// settings — open to anyone, and nothing else of the settings.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PlatformSettings, PublicSite } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // on the platform's team
const site = async () => (await request(t.app.getHttpServer()).get("/public/site").expect(200)).body as PublicSite;

beforeAll(async () => {
  t = await startSeededApp({ PLATFORM_ADMIN_EMAILS: "jana@geniemagnet.test" });
  jana = await t.signInAs("jana@geniemagnet.test");
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("the public site", () => {
  it("shows the brand, the trial and the offered plans to anyone, and nothing else of the settings", async () => {
    const s = await site();
    expect(Object.keys(s).sort()).toEqual(["brandName", "domain", "plans", "trialDays", "trialPlan"]);
    expect(s).toMatchObject({ brandName: "Genie Magnet OS", trialDays: 14, trialPlan: "Scale" });
    expect(s.plans.map((p) => p.name)).toEqual(["Starter", "Growth", "Scale", "Enterprise"]);
    expect(Object.keys(s.plans[0]!).sort()).toEqual(["description", "key", "limits", "name", "priceInr", "priceUsd", "suites"]);
  });

  it("follows the platform settings: names, prices, and plans no longer offered", async () => {
    const settings = (await jana.get("/platform/settings").expect(200)).body as PlatformSettings;
    await jana
      .put("/platform/settings")
      .send({
        ...settings,
        brandName: "Reelworks",
        plans: settings.plans.map((p) => (p.key === "growth" ? { ...p, priceInr: 4999, priceUsd: 59 } : p.key === "enterprise" ? { ...p, offered: false } : p)),
      })
      .expect(200);
    const s = await site();
    expect(s.brandName).toBe("Reelworks");
    expect(s.plans.map((p) => p.key)).toEqual(["starter", "growth", "scale"]);
    expect(s.plans.find((p) => p.key === "growth")).toMatchObject({ priceInr: 4999, priceUsd: 59 });
  });
});
