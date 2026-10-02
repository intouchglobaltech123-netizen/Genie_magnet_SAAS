// Sales pipeline (P1-14), activities (P1-15) and importing leads, on the sample agencies.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent;
let priya: Agent;

type Stage = { key: string; name: string; kind: string; probability: number };
type Lead = { id: string; name: string; stage: string; owner: { id: string; name: string } | null; nextFollowUp: string | null; activities: number };

beforeAll(async () => {
  t = await startSeededApp();
  jana = await t.signInAs("jana@geniemagnet.test");
  priya = await t.signInAs("priya@geniemagnet.test"); // team leader: leads and proposals
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("pipeline stages", () => {
  it("start from the Growth OS stages, with Won and Lost last", async () => {
    const stages = (await priya.get("/pipeline/stages").expect(200)).body as Stage[];
    expect(stages.map((s) => s.key)).toEqual(["new", "contacted", "qualified", "discovery", "proposal", "negotiation", "won", "lost"]);
    expect(stages.slice(-2).map((s) => s.kind)).toEqual(["won", "lost"]);
  });

  it("are the agency's to rename, add, reorder and remove — but never a stage with leads in it", async () => {
    const open = ((await jana.get("/pipeline/stages").expect(200)).body as Stage[]).filter((s) => s.kind === "open");
    const keep = (key: string) => open.find((s) => s.key === key)!;

    const withoutQualified = open.filter((s) => s.key !== "qualified").map(({ key, name, probability }) => ({ key, name, probability }));
    const refused = await jana.put("/pipeline/stages").send({ stages: withoutQualified }).expect(409);
    expect(refused.body.message).toBe("Move the leads out of Qualified (2 leads) before removing it.");

    const next = [
      keep("new"),
      keep("contacted"),
      keep("qualified"),
      { ...keep("discovery"), name: "Discovery call" },
      keep("proposal"),
      { name: "Demo shoot", probability: 65 },
      keep("negotiation"),
    ].map(({ key, name, probability }) => ({ key, name, probability }));
    const saved = (await jana.put("/pipeline/stages").send({ stages: next }).expect(200)).body as Stage[];
    expect(saved.map((s) => s.name)).toEqual(["New", "Contacted", "Qualified", "Discovery call", "Proposal", "Demo shoot", "Negotiation", "Won", "Lost"]);
    expect(saved.find((s) => s.name === "Demo shoot")?.key).toBe("demo_shoot");

    await priya.put("/pipeline/stages").send({ stages: next }).expect(403); // needs edit on Agency settings
  });
});

describe("leads and activities", () => {
  let lead: Lead;

  it("lists the agency's leads and adds new ones, followed up by whoever added them", async () => {
    expect(((await priya.get("/leads").expect(200)).body as Lead[]).length).toBe(12);
    lead = (
      await priya
        .post("/leads")
        .send({ name: "Anitha Florist", company: "Anitha Flowers", phone: "+91 90000 22222", source: "Instagram", value: 30000 })
        .expect(201)
    ).body;
    expect(lead).toMatchObject({ stage: "new", owner: { id: seedUserId("priya@geniemagnet.test"), name: "Priya Venkatesh" }, activities: 0 });
    const bad = await priya.post("/leads").send({ name: "X Y", source: "Referral", stage: "imaginary" }).expect(400);
    expect(bad.body.issues).toEqual([{ path: "stage", message: "Pick a stage" }]);
  });

  it("moves through the stages, and the audit log shows each move", async () => {
    await priya.patch(`/leads/${lead.id}`).send({ stage: "demo_shoot" }).expect(200);
    const [entry] = (await jana.get(`/audit?entity=lead&entityId=${lead.id}&limit=1`).expect(200)).body.items;
    expect(entry).toMatchObject({ action: "update", before: { stage: "new" }, after: { stage: "demo_shoot" } });
  });

  it("logs calls and notes, and can set the next follow-up at the same time", async () => {
    const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
    const after = (
      await priya
        .post(`/leads/${lead.id}/activities`)
        .send({ kind: "call", summary: "Wants Diwali reels; call back after the quote", nextFollowUp: yesterday })
        .expect(201)
    ).body as Lead & { history: { kind: string; summary: string; by: { name: string } }[] };
    expect(after.nextFollowUp).toBe(yesterday);
    expect(after.history).toEqual([expect.objectContaining({ kind: "call", by: expect.objectContaining({ name: "Priya Venkatesh" }) })]);
    const due = (await priya.get("/leads?due=1").expect(200)).body as Lead[];
    expect(due.some((l) => l.id === lead.id)).toBe(true);
    expect(((await priya.get("/leads?q=florist").expect(200)).body as Lead[]).map((l) => l.name)).toEqual(["Anitha Florist"]);
  });

  it("is read-only for roles that only view sales", async () => {
    const anitha = await t.signInAs("anitha@geniemagnet.test"); // finance: view
    await anitha.get("/leads").expect(200);
    await anitha.post("/leads").send({ name: "No Access", source: "Referral" }).expect(403);
  });

  it("limits a role to its own leads when the matrix says so", async () => {
    await jana
      .post("/roles")
      .send({ name: "Sales rep", permissions: { crm: { level: "edit", scope: "own" } } })
      .expect(201);
    const team = (await jana.get("/team").expect(200)).body as { members: { id: string; user: { email: string } }[] };
    const meena = team.members.find((m) => m.user.email === "meena@geniemagnet.test")!;
    await jana.patch(`/team/members/${meena.id}`).send({ role: "sales_rep" }).expect(200);

    const rep = await t.signInAs("meena@geniemagnet.test");
    expect((await rep.get("/leads").expect(200)).body).toEqual([]);
    const mine = (await rep.post("/leads").send({ name: "Meena's Lead", source: "WhatsApp" }).expect(201)).body as Lead;
    expect(mine.owner?.name).toBe("Meena Ravi");
    expect(((await rep.get("/leads").expect(200)).body as Lead[]).map((l) => l.name)).toEqual(["Meena's Lead"]);
    await rep.patch(`/leads/${lead.id}`).send({ stage: "won" }).expect(404); // Priya's lead
    await rep
      .post("/leads")
      .send({ name: "Someone Else's", source: "Referral", ownerId: seedUserId("priya@geniemagnet.test") })
      .expect(403);
  });

  it("puts follow-ups on open leads on the calendar — a role limited to its own leads sees only its own", async () => {
    const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);
    type Event = { kind: string; date: string; title: string; state: string; link: string };
    const calendar = async (who: Agent) =>
      ((await who.get(`/calendar?from=${day(-3)}&to=${day(10)}`).expect(200)).body as Event[]).filter((e) => e.kind === "followup");

    const all = await calendar(priya);
    expect(all.find((e) => e.link === `/app/sales?lead=${lead.id}`)).toMatchObject({ date: day(-1), title: "Follow up Anitha Flowers", state: "late" });
    const rep = await t.signInAs("meena@geniemagnet.test");
    const [mine] = (await rep.get("/leads").expect(200)).body as Lead[];
    await rep
      .patch(`/leads/${mine!.id}`)
      .send({ nextFollowUp: day(2) })
      .expect(200);
    expect((await calendar(rep)).map((e) => `${e.title}:${e.state}`)).toEqual(["Follow up Meena's Lead:open"]);
    expect((await calendar(priya)).length).toBe(all.length + 1);

    await priya.patch(`/leads/${lead.id}`).send({ stage: "lost", lostReason: "Went with another agency" }).expect(200);
    expect((await calendar(priya)).some((e) => e.link.endsWith(lead.id))).toBe(false); // closed leads drop off
    const divya = await t.signInAs("divya@geniemagnet.test"); // editor: no sales
    expect(await calendar(divya)).toEqual([]);
  });
});

describe("importing leads", () => {
  it("checks stages and owners, imports all good rows, and can be undone", async () => {
    const bad = await priya
      .post("/imports/leads")
      .send({
        fileName: "leads.xlsx",
        rows: [
          { name: "Lead One", source: "Referral", stage: "contacted" },
          { name: "Lead Two", source: "Referral", stage: "warm" },
          { name: "Lead Three", source: "Event", ownerEmail: "ghost@geniemagnet.test" },
        ],
      })
      .expect(400);
    expect((bad.body.issues as { path: string }[]).map((i) => i.path)).toEqual(["rows.1.stage", "rows.2.ownerEmail"]);

    const ok = (
      await priya
        .post("/imports/leads")
        .send({
          fileName: "leads.xlsx",
          rows: [
            { name: "Lead One", source: "Referral", stage: "contacted", value: 45000, nextFollowUp: "2026-10-09" },
            { name: "Lead Two", source: "Event", ownerEmail: "ashwin@geniemagnet.test" },
          ],
        })
        .expect(201)
    ).body;
    const leads = (await priya.get("/leads").expect(200)).body as Lead[];
    expect(leads.find((l) => l.name === "Lead Two")).toMatchObject({ stage: "new", owner: { name: "Ashwin" } });
    expect((await priya.delete(`/imports/${ok.id}`).expect(200)).body).toMatchObject({ removed: 2 });
  });
});
