// Security and load (P6-14): headers on every answer, and a limit for each agency as a whole on top of each person's,
// so one agency cannot slow the platform for the others.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent;
let divya: Agent; // also Genie Magnet
let zara: Agent; // Zen Studio

beforeAll(async () => {
  t = await startSeededApp({ RATE_LIMIT_AGENCY_PER_MINUTE: "8" });
  [jana, divya, zara] = await Promise.all(["jana@geniemagnet.test", "divya@geniemagnet.test", "zara@zenstudio.test"].map((e) => t.signInAs(e)));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("every answer", () => {
  it("is not sniffed, framed, cached or sent on with a referrer", async () => {
    for (const res of [await request(t.app.getHttpServer()).get("/health"), await request(t.app.getHttpServer()).get("/nowhere"), await zara.get("/me")]) {
      expect(res.headers).toMatchObject({
        "x-content-type-options": "nosniff",
        "x-frame-options": "DENY",
        "referrer-policy": "no-referrer",
        "cache-control": "no-store",
      });
      expect(res.headers["x-powered-by"]).toBeUndefined();
      expect(res.headers["strict-transport-security"]).toBeUndefined(); // the test server is not on HTTPS
    }
  });
});

describe("the limit for an agency as a whole", () => {
  it("counts everyone in the agency over every route, and no other agency", async () => {
    const routes = ["/me", "/clients", "/videos", "/notifications"];
    let ok = 0;
    for (let i = 0; i < 8; i++) {
      const res = await (i % 2 ? divya : jana).get(routes[i % routes.length]!);
      if (res.status === 200) ok++;
    }
    expect(ok).toBe(8); // eight a minute for the whole agency in this test
    const refused = await divya.get("/agency").expect(429);
    expect(refused.body.message).toMatch(/^Your agency is sending too many requests at once\. Try again in \d+ seconds\.$/);
    expect(Number(refused.headers["retry-after"])).toBeGreaterThan(0);
    await jana.get("/clients").expect(429);
    // Another agency carries on, and so do routes that are never limited.
    await zara.get("/clients").expect(200);
    await request(t.app.getHttpServer()).get("/health").expect(200);
  });
});
