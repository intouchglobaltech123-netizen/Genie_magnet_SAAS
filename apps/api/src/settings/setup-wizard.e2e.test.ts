// Setting up a new workspace (P6-06): the agency questionnaire's essentials set up the packages, this year's goals
// and the suites worth having; sample data can be added to try things with, and removed in one go with whatever the
// team made for it since — except a sample client an invoice was issued to, kept for the GST records.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Me, SampleData, SampleRemoved, SetupStatus, SetupWizard } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let zara: Agent; // owner of Zen Studio
let leo: Agent; // editor at Zen Studio
let zen: string;
const wizard = async () => (await zara.get("/agency/setup/wizard").expect(200)).body as SetupWizard;
const count = async (sql: string) => ((await t.sql(sql)) as { n: number }[])[0]!.n;

beforeAll(async () => {
  t = await startSeededApp();
  [zara, leo] = await Promise.all(["zara@zenstudio.test", "leo@zenstudio.test"].map((e) => t.signInAs(e)));
  zen = ((await zara.get("/me").expect(200)).body as Me).activeAgencyId!;
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("the set-up wizard", () => {
  it("starts from the agency questionnaire, and shows what is there already", async () => {
    expect(await wizard()).toEqual({
      questionnaire: null,
      packages: { inAnswers: 0, made: 1 },
      goals: { target: null, made: 0 },
      suites: [],
      team: { inAnswers: 0, onTeam: 3, invited: 0 },
      sample: null,
    });
    await leo.get("/agency/setup/wizard").expect(200); // anyone on the team can see how far it has got
  });

  it("the essentials set up the packages and this year's goals, and say which suites are worth having", async () => {
    const o = (await zara.post("/onboarding/agency").expect(201)).body as { id: string };
    const answer = (key: string, value: unknown) => zara.put(`/onboarding/${o.id}/answers/${key}`).send({ value }).expect(200);
    await answer("a1", "Zen Studio, Zara Ahmed (founder), zara@zenstudio.test");
    await answer("a1b", "Four years, video agency, Chennai");
    await answer("a2", "Survival");
    await answer("a3", ["Video production", "Social media management"]);
    await answer("a4", [{ name: "Reels Plus", price: "40,000", videos: "10", posts: "8", shootDays: "2", revisions: "2" }]);
    await answer("a13", "Twice the clients in two years, so Zara can step back from editing");
    await answer("a14", "12,00,000");
    await answer("a14b", "24,00,000");
    await answer("a20", [
      { name: "Zara", role: "Founder", approves: "Everything" },
      { name: "Leo", role: "Editor", approves: "Nothing" },
      { name: "Priya", role: "Shooter", approves: "Nothing" },
    ]);
    const w = await wizard();
    expect(w.questionnaire).toEqual({ id: o.id, requiredDone: true });
    expect(w.packages).toEqual({ inAnswers: 1, made: 1 });
    expect(w.goals).toEqual({ target: 2_400_000, made: 0 });
    expect(w.suites.map((s) => s.key)).toEqual(["management", "people", "finance", "operations", "genie"]);
    expect(w.suites.find((s) => s.key === "people")?.why).toBe("3 people on the team: attendance, leave, payroll and reviews in one place.");
    expect(w.team.inAnswers).toBe(3);

    await zara.post(`/onboarding/${o.id}/packages`).send({}).expect(200);
    await zara.post("/goals/from-questionnaire").expect(200);
    const after = await wizard();
    expect(after.packages.made).toBe(2);
    expect(after.goals.made).toBeGreaterThan(0);
    expect(((await zara.get("/agency/setup").expect(200)).body as SetupStatus).steps.agency_questionnaire).toBe(true);
  });
});

describe("sample data", () => {
  let sampleClients: { id: string; code: string; name: string; contacts: { id: string; phone: string }[] }[];

  it("is added by someone who keeps the settings: three clients, four leads along the pipeline and four videos", async () => {
    await leo.post("/agency/setup/sample").expect(403);
    const added = (await zara.post("/agency/setup/sample").expect(201)).body as SampleData;
    expect(added).toMatchObject({ clients: 3, leads: 4, videos: 4, addedBy: { name: "Zara Ahmed" } });
    expect((await zara.post("/agency/setup/sample").expect(409)).body.message).toBe("The sample data is already here.");
    expect((await wizard()).sample).toEqual(added);

    const clients = (await zara.get("/clients").expect(200)).body as typeof sampleClients;
    sampleClients = clients.filter((c) => c.name.endsWith("(sample)"));
    expect(sampleClients.map((c) => c.code).sort()).toEqual(["LTI", "PFS", "SRB"]);
    // Numbers no Indian mobile has, so no message can ever reach anyone.
    expect(sampleClients.flatMap((c) => c.contacts.map((x) => x.phone)).every((p) => p.startsWith("+91 00000"))).toBe(true);
    const leads = (await zara.get("/leads").expect(200)).body as { company: string; stage: string }[];
    const sampleLeads = leads.filter((l) => l.company?.endsWith("(sample)"));
    expect(sampleLeads).toHaveLength(4);
    expect(new Set(sampleLeads.map((l) => l.stage)).size).toBeGreaterThan(1);
    expect(
      await count(`SELECT count(*)::int AS n FROM videos WHERE agency_id = '${zen}' AND client_id = '${sampleClients.find((c) => c.code === "SRB")!.id}'`),
    ).toBe(4);
  });

  it("goes in one go with whatever was made for it since; a sample client an invoice was issued to stays", async () => {
    const bakery = sampleClients.find((c) => c.code === "SRB")!;
    const fitness = sampleClients.find((c) => c.code === "PFS")!;
    const interiors = sampleClients.find((c) => c.code === "LTI")!;
    // The team tries things on the sample clients: a video of their own, a portal link, a draft invoice, and an invoice issued.
    await zara.post("/videos").send({ clientId: bakery.id, title: "Our own try-out reel", format: "Reel", dueDate: "2026-10-20" }).expect(201);
    const steps = async () => ((await zara.get("/agency/setup").expect(200)).body as SetupStatus).steps;
    expect(await steps()).toMatchObject({ portal: false, whatsapp: false });
    await zara.post(`/clients/${fitness.id}/contacts/${fitness.contacts[0]!.id}/portal-link`).expect(201);
    expect((await steps()).portal).toBe(true);
    const line = { description: "Trial month", sac: "998361", quantity: 1, rate: 10000, taxRate: 18 };
    await zara
      .post("/invoices")
      .send({ clientId: fitness.id, lines: [line] })
      .expect(201);
    const issued = (
      await zara
        .post("/invoices")
        .send({ clientId: interiors.id, lines: [line] })
        .expect(201)
    ).body as { id: string };
    await t.sql(`UPDATE invoices SET number = 'ZEN-TEST-001', status = 'issued' WHERE id = '${issued.id}'`);
    const realClients = await count(`SELECT count(*)::int AS n FROM clients WHERE agency_id = '${zen}' AND name NOT LIKE '%(sample)'`);
    const realLeads = await count(`SELECT count(*)::int AS n FROM leads WHERE agency_id = '${zen}' AND company NOT LIKE '%(sample)'`);

    await leo.delete("/agency/setup/sample").expect(403);
    const removed = (await zara.delete("/agency/setup/sample").expect(200)).body as SampleRemoved;
    expect(removed).toEqual({ clients: 2, leads: 4, videos: 4, kept: ["LTI"] });

    const ids = `'${bakery.id}', '${fitness.id}'`;
    for (const table of ["clients", "contacts", "videos", "portal_links", "invoices"])
      expect(await count(`SELECT count(*)::int AS n FROM ${table} WHERE ${table === "clients" ? "id" : "client_id"} IN (${ids})`)).toBe(0);
    expect(await count(`SELECT count(*)::int AS n FROM leads WHERE agency_id = '${zen}' AND company LIKE '%(sample)'`)).toBe(0);
    // The kept client and its invoice, and everything real, stay.
    expect(await count(`SELECT count(*)::int AS n FROM invoices WHERE id = '${issued.id}'`)).toBe(1);
    expect(await count(`SELECT count(*)::int AS n FROM clients WHERE id = '${interiors.id}'`)).toBe(1);
    expect(await count(`SELECT count(*)::int AS n FROM clients WHERE agency_id = '${zen}' AND name NOT LIKE '%(sample)'`)).toBe(realClients);
    expect(await count(`SELECT count(*)::int AS n FROM leads WHERE agency_id = '${zen}' AND company NOT LIKE '%(sample)'`)).toBe(realLeads);
    expect((await wizard()).sample).toBeNull();
    await zara.delete("/agency/setup/sample").expect(409);
    // And it can be added again.
    expect(((await zara.post("/agency/setup/sample").expect(201)).body as SampleData).clients).toBe(3);
  });
});
