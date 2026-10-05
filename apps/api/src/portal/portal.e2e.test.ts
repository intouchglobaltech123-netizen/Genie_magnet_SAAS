// The client portal (P3-01 to P3-05): a contact's private link, and what the client does there.
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PRODUCTION_SETTINGS, type PortalHome, type PortalScript, type PortalTopicList, type PortalVideos } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner
let ashwin: Agent; // manager
let karthik: Agent; // team leader: content and the quality check
let divya: Agent; // editor
let clientId: string;
let otherClientId: string;
let contactId: string;
let link: string;
let videoId: string;
let otherVideoId: string;
const portal = (path = "") => `/portal/${link.split("/app/c/")[1]}${path}`;
const anon = () => request(t.app.getHttpServer());
const M = new Date().toISOString().slice(0, 7);
const DIVYA = seedUserId("divya@geniemagnet.test");

/** A video for the client, taken through production to the client's review with v1 sent. */
async function videoWithClient(client: string, title: string) {
  const v = (
    await ashwin
      .post("/videos")
      .send({ clientId: client, title, format: "Reel", dueDate: `${M}-27`, editorId: DIVYA })
      .expect(201)
  ).body as { id: string };
  await divya.post(`/videos/${v.id}/move`).send({ to: "shot" }).expect(200);
  await divya.put(`/videos/${v.id}/protect`).send({ done: true }).expect(200);
  await divya.post(`/videos/${v.id}/move`).send({ to: "editing" }).expect(200);
  for (const step of DEFAULT_PRODUCTION_SETTINGS.editSteps) await divya.put(`/videos/${v.id}/edit-steps`).send({ step, done: true }).expect(200);
  await divya.post(`/videos/${v.id}/move`).send({ to: "internal_qc" }).expect(200);
  for (const c of DEFAULT_PRODUCTION_SETTINGS.qcChecks) await karthik.put(`/videos/${v.id}/qc`).send({ check: c.key, result: "pass" }).expect(200);
  await divya
    .post(`/videos/${v.id}/versions`)
    .send({ link: `https://drive.example/${title.replace(/\W+/g, "-")}` })
    .expect(201);
  await divya.post(`/videos/${v.id}/versions/send`).expect(200);
  return v.id;
}

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, karthik, divya] = await Promise.all(["jana", "ashwin", "karthik", "divya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  const make = async (name: string, code: string) => {
    const c = (
      await ashwin
        .post("/clients")
        .send({
          name,
          code,
          contacts: [
            { name: `${name} Owner`, phone: "+91 98400 55001", approver: true },
            { name: `${name} Marketing`, phone: "+91 98400 55002" },
          ],
        })
        .expect(201)
    ).body as { id: string };
    const a = (
      await ashwin
        .post(`/clients/${c.id}/agreements`)
        .send({
          title: `${name} · Reels`,
          startDate: `${M}-01`,
          months: 6,
          monthlyFee: 30000,
          billing: "Monthly advance",
          revisionsPerDeliverable: 2,
          shootDays: 1,
          deliverables: [{ name: "Reels", perMonth: 4, kind: "video" }],
          platforms: ["instagram"],
        })
        .expect(201)
    ).body as { id: string };
    await jana.post(`/agreements/${a.id}/sign-off`).expect(200);
    return { id: c.id, agreementId: a.id };
  };
  const mine = await make("Kovai Crunch", "KVC");
  clientId = mine.id;
  otherClientId = (await make("Nila Weaves", "NLW")).id;

  // Three topics on a sent list, a script with the client, a video with the client, and an issued invoice.
  for (const title of ["Banana chips, fresh", "Inside our kitchen", "Festive box"])
    await karthik.post("/content").send({ clientId, title, pillar: "Products", format: "Reel", month: M }).expect(201);
  const [list] = (await karthik.put("/topic-lists").send({ clientId, month: M, needed: 2 }).expect(200)).body as { id: string; client: { id: string } }[];
  await karthik.post(`/topic-lists/${list!.id}/send`).expect(200);
  const script = (await karthik.post("/content").send({ clientId, title: "Our story in 30 seconds", pillar: "Story", format: "Reel", month: M }).expect(201))
    .body as { id: string };
  await karthik.post(`/content/${script.id}/start`).expect(200);
  await karthik.post(`/content/${script.id}/research-done`).expect(200);
  await karthik.put(`/content/${script.id}/script`).send({ hook: "Since 1998.", body: "Three generations.", cta: "Taste it", onScreen: "" }).expect(200);
  await karthik.post(`/content/${script.id}/script/send`).expect(200);
  videoId = await videoWithClient(clientId, "Chips close-up");
  otherVideoId = await videoWithClient(otherClientId, "Loom at work");
  const inv = (await ashwin.post(`/agreements/${mine.agreementId}/invoices`).send({ period: M }).expect(201)).body as { id: string };
  await jana.post(`/invoices/${inv.id}/issue`).send({}).expect(200);
  const next = new Date(`${M}-01T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  await ashwin
    .post(`/agreements/${mine.agreementId}/invoices`)
    .send({ period: next.toISOString().slice(0, 7) })
    .expect(201); // a draft: never shown to the client
}, 300_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("portal links", () => {
  it("are made per contact by people who may change clients, shown once, and replaced", async () => {
    const links = (await ashwin.get(`/clients/${clientId}/portal-links`).expect(200)).body as { contactId: string; contactName: string; active: boolean }[];
    contactId = links.find((l) => l.contactName === "Kovai Crunch Owner")!.contactId;
    await divya.post(`/clients/${clientId}/contacts/${contactId}/portal-link`).expect(403);
    const first = (await ashwin.post(`/clients/${clientId}/contacts/${contactId}/portal-link`).expect(201)).body as { link: string };
    expect(first.link).toMatch(/\/app\/c\/[A-Za-z0-9_-]{32}$/);
    const second = (await ashwin.post(`/clients/${clientId}/contacts/${contactId}/portal-link`).expect(201)).body as {
      link: string;
      links: { active: boolean }[];
    };
    link = first.link;
    await anon().get(portal()).expect(404); // replaced
    link = second.link;
    expect(second.links.filter((l) => l.active)).toHaveLength(1);
    await anon().get("/portal/not-a-real-token-but-long-enough").expect(404);
  });

  it("open the client's portal in the agency's name, with what waits for them", async () => {
    const home = (await anon().get(portal()).expect(200)).body as PortalHome;
    expect(home).toMatchObject({
      agency: { name: "Genie Magnet" },
      client: { name: "Kovai Crunch" },
      contact: { name: "Kovai Crunch Owner" },
      // Three topics offered, two asked for: two picks still owed.
      todo: { topics: 2, scripts: 1, videos: 1, invoices: 1 },
    });
  });
});

describe("in the portal, the client", () => {
  it("picks topics and says when they are done; the team is told", async () => {
    let lists = (await anon().get(portal("/topics")).expect(200)).body as PortalTopicList[];
    const [list] = lists;
    expect(list!.items).toHaveLength(3);
    await anon()
      .put(portal(`/topics/${list!.items[0]!.id}`))
      .send({ pick: "picked" })
      .expect(200);
    lists = (
      await anon()
        .put(portal(`/topics/${list!.items[1]!.id}`))
        .send({ pick: "picked" })
        .expect(200)
    ).body;
    expect(lists[0]!.items.map((i) => i.pick)).toEqual(["picked", "picked", null]);
    // Two of two picked: nothing left to pick, though one topic is neither picked nor skipped.
    expect(((await anon().get(portal()).expect(200)).body as PortalHome).todo.topics).toBe(0);
    expect(
      (
        await anon()
          .post(portal(`/topic-lists/${list!.id}/done`))
          .expect(200)
      ).body.picked,
    ).toBe(2);
    const n = (await karthik.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    const month = new Date(`${M}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
    expect(n.find((x) => x.kind === "client_portal")!.title).toBe(`Kovai Crunch picked 2 topics for ${month}`);
  });

  it("asks for changes to a script, and approves the next version — which becomes a video", async () => {
    const [s] = (await anon().get(portal("/scripts")).expect(200)).body as PortalScript[];
    expect(s!.script).toMatchObject({ label: "v1", hook: "Since 1998." });
    await anon()
      .post(portal(`/scripts/${s!.contentId}/decision`))
      .send({ approved: false })
      .expect(400);
    await anon()
      .post(portal(`/scripts/${s!.contentId}/decision`))
      .send({ approved: false, note: "Mention the 1998 shop" })
      .expect(200);
    expect((await anon().get(portal("/scripts")).expect(200)).body).toEqual([]);
    await karthik
      .put(`/content/${s!.contentId}/script`)
      .send({ hook: "Since 1998, from one shop.", body: "Three generations.", cta: "Taste it", onScreen: "" })
      .expect(200);
    await karthik.post(`/content/${s!.contentId}/script/send`).expect(200);
    const [again] = (await anon().get(portal("/scripts")).expect(200)).body as PortalScript[];
    expect(again!.earlier).toEqual([{ label: "v1", status: "changes", clientNote: "Mention the 1998 shop" }]);
    await anon()
      .post(portal(`/scripts/${s!.contentId}/decision`))
      .send({ approved: true })
      .expect(200);
    const item = (await karthik.get(`/content/${s!.contentId}`).expect(200)).body as { stage: string; video: { id: string } | null };
    expect(item.stage).toBe("ready");
  });

  it("comments on a video at a moment in it, and asks for changes; the editor hears of both", async () => {
    const { waiting } = (await anon().get(portal("/videos")).expect(200)).body as PortalVideos;
    expect(waiting.map((v) => v.id)).toEqual([videoId]);
    expect(waiting[0]!.version).toMatchObject({ label: "v1", link: "https://drive.example/Chips-close-up" });
    const after = (
      await anon()
        .post(portal(`/videos/${videoId}/comments`))
        .send({ text: "Logo too small here", at: 12 })
        .expect(201)
    ).body;
    expect(after.version.comments).toEqual([expect.objectContaining({ author: "Kovai Crunch Owner", at: 12, text: "Logo too small here" })]);
    const n = (await divya.get("/notifications").expect(200)).body.items as { title: string }[];
    expect(n.some((x) => x.title === `Kovai Crunch Owner commented on ${after.code}`)).toBe(true);

    await anon()
      .post(portal(`/videos/${videoId}/decision`))
      .send({ approved: false, note: "Bigger logo please" })
      .expect(200);
    expect(((await ashwin.get(`/videos/${videoId}`).expect(200)).body as { stage: string }).stage).toBe("revision");
    await anon()
      .post(portal(`/videos/${videoId}/comments`))
      .send({ text: "One more" })
      .expect(409);
  });

  it("sees issued invoices only, and can open one to print", async () => {
    const rows = (await anon().get(portal("/invoices")).expect(200)).body as { id: string; status: string; number: string }[];
    expect(rows.map((r) => r.status)).toEqual(["sent"]);
    const inv = (
      await anon()
        .get(portal(`/invoices/${rows[0]!.id}`))
        .expect(200)
    ).body;
    expect(inv).toMatchObject({ number: rows[0]!.number, client: { name: "Kovai Crunch" } });
  });

  it("asks the team something, and sees the answer", async () => {
    const mine = (await anon().post(portal("/requests")).send({ kind: "idea", text: "A reel for Pongal?" }).expect(201)).body as { id: string }[];
    const open = (await ashwin.get("/client-requests?status=open").expect(200)).body as { id: string; contactName: string; client: { code: string } }[];
    expect(open[0]).toMatchObject({ contactName: "Kovai Crunch Owner", client: { code: "KVC" } });
    await divya.post(`/client-requests/${mine[0]!.id}/answer`).send({ answer: "Yes" }).expect(403);
    await ashwin.post(`/client-requests/${mine[0]!.id}/answer`).send({ answer: "Yes — in the January list" }).expect(200);
    const [r] = (await anon().get(portal("/requests")).expect(200)).body as { status: string; answer: string }[];
    expect(r).toMatchObject({ status: "answered", answer: "Yes — in the January list" });
  });
});

describe("the portal stays inside its client", () => {
  it("reaches nothing of another client, even by id", async () => {
    await anon()
      .post(portal(`/videos/${otherVideoId}/comments`))
      .send({ text: "Hello" })
      .expect(404);
    await anon()
      .post(portal(`/videos/${otherVideoId}/decision`))
      .send({ approved: true })
      .expect(404);
    const { waiting, done } = (await anon().get(portal("/videos")).expect(200)).body as PortalVideos;
    expect([...waiting, ...done].some((v) => v.id === otherVideoId)).toBe(false);
  });

  it("records changes as made by the contact", async () => {
    const items = (await jana.get("/audit?entity=client_request&limit=5").expect(200)).body.items as { action: string; after: Record<string, unknown> }[];
    expect(items.find((e) => e.action === "create")!.after).toMatchObject({ byClient: "Kovai Crunch Owner" });
    expect(items.find((e) => e.action === "answer")!.after.byClient).toBeUndefined();
  });

  it("is hidden from another agency, and stops at once when switched off or the client is archived", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/client-requests").expect(200)).body).toEqual([]);
    await zara.get(`/clients/${clientId}/portal-links`).expect(200).expect([]);

    await ashwin.delete(`/clients/${clientId}/contacts/${contactId}/portal-link`).expect(200);
    await anon().get(portal()).expect(404);
    link = ((await ashwin.post(`/clients/${clientId}/contacts/${contactId}/portal-link`).expect(201)).body as { link: string }).link;
    await anon().get(portal()).expect(200);
    await t.sql(`UPDATE clients SET archived_at = now() WHERE id = $1`, [clientId]);
    await anon().get(portal()).expect(404);
  });
});
