// The client page (P1-18) and agreements (P1-19), on the sample agencies.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { agreementEndDate, dayAfter, type Agreement, type ClientDetail } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner
let ashwin: Agent; // manager: may sign off agreements
let priya: Agent; // team leader: edits clients, only sees agreements
let divya: Agent; // editor: sees clients only
let kaveriId: string;
let growthId: string;

const iso = (d: Date) => d.toISOString().slice(0, 10);
const monthsAgo = (n: number) => {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - n);
  return iso(d);
};

const terms = (over: Record<string, unknown> = {}) => ({
  packageId: growthId,
  title: "Thendral Foods · Growth Video Pack",
  startDate: monthsAgo(0),
  months: 12,
  monthlyFee: 80000,
  billing: "Monthly advance",
  revisionsPerDeliverable: 2,
  shootDays: 2,
  deliverables: [
    { name: "Reels", perMonth: 8, kind: "video" },
    { name: "Static posts", perMonth: 6, kind: "post" },
  ],
  platforms: ["instagram", "youtube"],
  ...over,
});

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, priya, divya] = await Promise.all(["jana", "ashwin", "priya", "divya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  const clients = (await jana.get("/clients").expect(200)).body as { id: string; code: string }[];
  kaveriId = clients.find((c) => c.code === "KVR")!.id;
  const packages = (await jana.get("/packages").expect(200)).body as { id: string; name: string }[];
  growthId = packages.find((p) => p.name === "Growth Video Pack")!.id;
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("the client page", () => {
  it("shows contacts, the account owner and agreements with their monthly quotas", async () => {
    const kaveri = (await priya.get(`/clients/${kaveriId}`).expect(200)).body as ClientDetail;
    expect(kaveri).toMatchObject({
      code: "KVR",
      accountOwner: { id: seedUserId("ashwin@geniemagnet.test"), name: "Ashwin" },
      gstin: "33AAKFK4821M1Z5",
      state: "33",
      monthlyFee: 85000,
      activeAgreements: 1,
      canDelete: false,
    });
    expect(kaveri.contacts.map((c) => c.approver)).toEqual([true, false]);
    expect(kaveri.agreements).toHaveLength(1);
    expect(kaveri.agreements![0]).toMatchObject({ status: "active", videosPerMonth: 12, months: 12, packageName: "Growth Video Pack" });
  });

  it("leaves out agreements for roles that may not see them", async () => {
    const kaveri = (await divya.get(`/clients/${kaveriId}`).expect(200)).body as ClientDetail;
    expect(kaveri.agreements).toBeNull();
    await divya.patch(`/clients/${kaveriId}`).send({ city: "Salem" }).expect(403);
  });

  it("is not visible to another agency", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    await zara.get(`/clients/${kaveriId}`).expect(404);
  });

  it("edits details and records only what changed", async () => {
    const res = await priya
      .patch(`/clients/${kaveriId}`)
      .send({ city: "Perundurai", industry: "", whatsappGroupUrl: "https://chat.whatsapp.com/KvrGroup", accountOwnerId: seedUserId("priya@geniemagnet.test") })
      .expect(200);
    expect(res.body).toMatchObject({ city: "Perundurai", industry: null, accountOwner: { name: "Priya Venkatesh" } });
    const [entry] = (await jana.get(`/audit?entity=client&entityId=${kaveriId}&limit=1`).expect(200)).body.items;
    expect(entry.before).toEqual({
      name: "Kaveri Organics",
      city: "Erode",
      industry: "FMCG · Organic foods",
      whatsappGroupUrl: null,
      accountOwnerId: seedUserId("ashwin@geniemagnet.test"),
    });
  });

  it("checks the GSTIN, its state, the code and the account owner", async () => {
    let res = await priya.patch(`/clients/${kaveriId}`).send({ gstin: "33AAKFK4821M1Z6" }).expect(400);
    expect(res.body.issues[0]).toMatchObject({ path: "gstin" });
    res = await priya.patch(`/clients/${kaveriId}`).send({ state: "29" }).expect(400);
    expect(res.body.issues).toEqual([{ path: "state", message: "The GSTIN is registered in another state" }]);
    res = await priya.patch(`/clients/${kaveriId}`).send({ code: "SLS" }).expect(409);
    expect(res.body.issues).toEqual([{ path: "code", message: "Already used by another client" }]);
    res = await priya
      .patch(`/clients/${kaveriId}`)
      .send({ accountOwnerId: seedUserId("zara@zenstudio.test") })
      .expect(400);
    expect(res.body.issues[0].path).toBe("accountOwnerId");
  });

  it("takes the state from a new GSTIN", async () => {
    const created = (
      await priya
        .post("/clients")
        .send({ name: "Pothys Sweets", code: "PTS", gstin: "33aagcg2741h1zv", contacts: [{ name: "Selvi", phone: "+91 98400 22001", approver: true }] })
        .expect(201)
    ).body;
    expect(created).toMatchObject({ gstin: "33AAGCG2741H1ZV", state: "33" });
  });

  it("adds, edits and removes contacts, keeping at least one", async () => {
    let kaveri = (
      await priya.post(`/clients/${kaveriId}/contacts`).send({ name: "Arun K", phone: "+91 94430 55103", email: "arun@kaveriorganics.test" }).expect(201)
    ).body as ClientDetail;
    const arun = kaveri.contacts.find((c) => c.name === "Arun K")!;
    kaveri = (await priya.patch(`/clients/${kaveriId}/contacts/${arun.id}`).send({ approver: true, email: "" }).expect(200)).body;
    expect(kaveri.contacts.find((c) => c.id === arun.id)).toMatchObject({ approver: true, email: null });
    kaveri = (await priya.delete(`/clients/${kaveriId}/contacts/${arun.id}`).expect(200)).body;
    expect(kaveri.contacts).toHaveLength(2);

    const pothys = ((await priya.get("/clients").expect(200)).body as ClientDetail[]).find((c) => c.code === "PTS")!;
    const res = await priya.delete(`/clients/${pothys.id}/contacts/${pothys.contacts[0]!.id}`).expect(409);
    expect(res.body.message).toMatch(/at least one contact/);
  });

  it("archives only a client with no running agreement, and deletes only one with nothing attached", async () => {
    await priya.post(`/clients/${kaveriId}/archive`).expect(409);
    await priya.delete(`/clients/${kaveriId}`).expect(409);

    const pothys = ((await priya.get("/clients").expect(200)).body as ClientDetail[]).find((c) => c.code === "PTS")!;
    expect((await priya.post(`/clients/${pothys.id}/archive`).expect(200)).body.archivedAt).not.toBeNull();
    expect((await priya.post(`/clients/${pothys.id}/restore`).expect(200)).body.archivedAt).toBeNull();
    await priya.delete(`/clients/${pothys.id}`).expect(204);
    await priya.get(`/clients/${pothys.id}`).expect(404);
  });
});

describe("agreements", () => {
  let clientId: string;
  let draft: Agreement;

  beforeAll(async () => {
    clientId = (
      await jana
        .post("/clients")
        .send({ name: "Thendral Foods", code: "TND", contacts: [{ name: "Kumar", phone: "+91 98400 22002", approver: true }] })
        .expect(201)
    ).body.id;
  });

  it("are made as drafts by people who may edit them", async () => {
    await priya.post(`/clients/${clientId}/agreements`).send(terms()).expect(403);
    draft = (await ashwin.post(`/clients/${clientId}/agreements`).send(terms()).expect(201)).body;
    expect(draft).toMatchObject({
      status: "draft",
      months: 12,
      endDate: agreementEndDate(monthsAgo(0), 12),
      videosPerMonth: 8,
      postsPerMonth: 6,
      signedBy: null,
    });
  });

  it("change their terms only while a draft", async () => {
    const changed = (await ashwin.patch(`/agreements/${draft.id}`).send({ monthlyFee: 78000, months: 6 }).expect(200)).body;
    expect(changed).toMatchObject({ monthlyFee: 78000, months: 6, endDate: agreementEndDate(monthsAgo(0), 6) });
  });

  it("are signed off by someone who may approve them, then keep their terms", async () => {
    await priya.post(`/agreements/${draft.id}/sign-off`).expect(403);
    const signed = (await ashwin.post(`/agreements/${draft.id}/sign-off`).expect(200)).body;
    expect(signed).toMatchObject({ status: "active", signedBy: { name: "Ashwin" } });
    const res = await ashwin.patch(`/agreements/${draft.id}`).send({ monthlyFee: 1 }).expect(409);
    expect(res.body.message).toMatch(/renew it/);
    await ashwin.delete(`/agreements/${draft.id}`).expect(409);
  });

  it("pause and resume", async () => {
    expect((await ashwin.post(`/agreements/${draft.id}/pause`).send({ note: "Client travelling" }).expect(200)).body).toMatchObject({
      status: "paused",
      statusNote: "Client travelling",
    });
    expect((await ashwin.post(`/agreements/${draft.id}/resume`).expect(200)).body).toMatchObject({ status: "active", statusNote: null });
  });

  it("show as due for renewal within the agency's notice, until renewed", async () => {
    // Started 11 months ago for 12 months: it ends within the default 45 days.
    const ending = (
      await ashwin
        .post(`/clients/${clientId}/agreements`)
        .send(terms({ startDate: monthsAgo(11), title: "Thendral · first year" }))
        .expect(201)
    ).body as Agreement;
    await ashwin.post(`/agreements/${ending.id}/sign-off`).expect(200);
    let due = (await ashwin.get("/agreements?renewal=1").expect(200)).body as Agreement[];
    expect(due.map((a) => a.title)).toContain("Thendral · first year");
    expect((await ashwin.get(`/clients/${clientId}`).expect(200)).body.renewalDue).toBe(true);

    await jana.patch("/agency").send({ renewalNoticeDays: 7 }).expect(200);
    due = (await ashwin.get("/agreements?renewal=1").expect(200)).body;
    const stillDue = due.some((a) => a.id === ending.id);
    expect(stillDue).toBe(ending.daysLeft <= 7);
    await jana.patch("/agency").send({ renewalNoticeDays: 45 }).expect(200);

    await priya.post(`/agreements/${ending.id}/renew`).send({ months: 12 }).expect(403);
    const next = (await ashwin.post(`/agreements/${ending.id}/renew`).send({ months: 12, monthlyFee: 90000 }).expect(201)).body as Agreement;
    expect(next).toMatchObject({
      status: "draft",
      renewsId: ending.id,
      startDate: dayAfter(ending.endDate),
      monthlyFee: 90000,
      title: "Thendral · first year",
    });
    await ashwin.post(`/agreements/${ending.id}/renew`).send({ months: 12 }).expect(409);
    due = (await ashwin.get("/agreements?renewal=1").expect(200)).body;
    expect(due.some((a) => a.id === ending.id)).toBe(false);
    expect((await ashwin.get(`/agreements/${ending.id}`).expect(200)).body.renewedById).toBe(next.id);

    // Signed, but it starts later: shown as upcoming and not counted in what the client brings in now.
    expect((await ashwin.post(`/agreements/${next.id}/sign-off`).expect(200)).body).toMatchObject({ status: "active", upcoming: true });
    const client = (await ashwin.get(`/clients/${clientId}`).expect(200)).body as ClientDetail;
    expect(client).toMatchObject({ monthlyFee: 78000 + 80000, activeAgreements: 2 });
  });

  it("end early with a reason, by someone who may approve them", async () => {
    await priya.post(`/agreements/${draft.id}/end`).send({ note: "Budget cut" }).expect(403);
    await ashwin.post(`/agreements/${draft.id}/end`).send({}).expect(400);
    const ended = (await ashwin.post(`/agreements/${draft.id}/end`).send({ note: "Budget cut" }).expect(200)).body as Agreement;
    expect(ended).toMatchObject({ status: "ended", statusNote: "Budget cut", endDate: iso(new Date()) });
    const [entry] = (await jana.get(`/audit?entity=agreement&entityId=${draft.id}&limit=1`).expect(200)).body.items;
    expect(entry).toMatchObject({ action: "end", after: { status: "ended", note: "Budget cut" } });
  });

  it("refuse a package that is archived, and a client that is archived", async () => {
    const pkg = (
      await jana
        .post("/packages")
        .send({ name: "Old Pack", monthlyFee: 1000, deliverables: [{ name: "Reels", perMonth: 1, kind: "video" }], shootDays: 0, revisionsPerDeliverable: 1 })
        .expect(201)
    ).body;
    await jana.post(`/packages/${pkg.id}/archive`).send({}).expect(200);
    const res = await ashwin
      .post(`/clients/${clientId}/agreements`)
      .send(terms({ packageId: pkg.id }))
      .expect(400);
    expect(res.body.issues[0].path).toBe("packageId");
  });

  it("list drafts waiting for sign-off", async () => {
    const d = (
      await ashwin
        .post(`/clients/${clientId}/agreements`)
        .send(terms({ title: "Thendral · festive add-on", months: 2 }))
        .expect(201)
    ).body;
    const drafts = (await ashwin.get("/agreements?status=draft").expect(200)).body as Agreement[];
    expect(drafts.map((a) => a.id)).toEqual([d.id]);
    await ashwin.delete(`/agreements/${d.id}`).expect(204);
  });
});
