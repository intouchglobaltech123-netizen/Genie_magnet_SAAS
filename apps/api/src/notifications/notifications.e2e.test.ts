// Notifications in the app (P1-04), on the sample agencies.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { NotificationList } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner
let ashwin: Agent; // manager: approves discounts
let priya: Agent; // team leader: proposes
let leadId: string;
let packageId: string;

const inbox = async (a: Agent) => (await a.get("/notifications").expect(200)).body as NotificationList;
const propose = (discountPercent: number) => priya.post(`/leads/${leadId}/proposals`).send({ packageId, discountPercent, months: 12 }).expect(201);

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, priya] = await Promise.all(["jana", "ashwin", "priya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  leadId = ((await priya.get("/leads").expect(200)).body as { id: string; company: string }[]).find((l) => l.company === "Balaji Textiles")!.id;
  packageId = ((await priya.get("/packages").expect(200)).body as { id: string; name: string }[]).find((p) => p.name === "Growth Video Pack")!.id;
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("notifications", () => {
  it("tell everyone who may approve a discount, but not the person who asked", async () => {
    await propose(12);
    for (const a of [jana, ashwin]) {
      const n = await inbox(a);
      expect(n.unread).toBe(1);
      expect(n.items[0]).toMatchObject({ kind: "discount_approval", title: "Discount to approve: Balaji Textiles", link: "/app/sales", read: false });
    }
    expect((await inbox(priya)).unread).toBe(0);
  });

  it("tell the salesperson the decision", async () => {
    const pending = (await ashwin.get("/proposals?status=pending_approval").expect(200)).body as { id: string }[];
    await ashwin.post(`/proposals/${pending[0]!.id}/approve`).send({ note: "Fine for a year" }).expect(200);
    const n = await inbox(priya);
    expect(n.items[0]).toMatchObject({ kind: "discount_decided", title: "12% discount approved: Growth Video Pack", body: "Fine for a year" });
  });

  it("are marked read one by one or all at once", async () => {
    const n = await inbox(jana);
    const read = (
      await jana
        .post("/notifications/read")
        .send({ ids: [n.items[0]!.id] })
        .expect(200)
    ).body as NotificationList;
    expect(read.unread).toBe(n.unread - 1);
    expect((await jana.post("/notifications/read").send({}).expect(200)).body.unread).toBe(0);
  });

  it("respect each person's switched-off kinds", async () => {
    await ashwin
      .put("/notifications/preferences")
      .send({ muted: ["discount_approval"], quietFrom: "21:00", quietTo: "08:00" })
      .expect(200);
    expect((await ashwin.get("/notifications/preferences").expect(200)).body).toEqual({ muted: ["discount_approval"], quietFrom: "21:00", quietTo: "08:00" });
    const before = (await inbox(ashwin)).items.length;
    await propose(15);
    expect((await inbox(ashwin)).items.length).toBe(before);
    expect((await inbox(jana)).unread).toBe(1);

    const bad = await ashwin.put("/notifications/preferences").send({ muted: [], quietFrom: "21:00", quietTo: null }).expect(400);
    expect(bad.body.issues[0].path).toBe("quietTo");
  });

  it("stay inside the agency", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await inbox(zara)).items).toEqual([]);
  });
});
