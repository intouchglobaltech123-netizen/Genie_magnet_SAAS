// Self-service imports (P1-31): clients and team from a spreadsheet, checked, all-or-nothing, with undo.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { genieMagnet, seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent;
let ashwin: Agent;

beforeAll(async () => {
  t = await startSeededApp();
  jana = await t.signInAs("jana@geniemagnet.test");
  ashwin = await t.signInAs("ashwin@geniemagnet.test");
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

const row = (name: string, code: string, extra: Record<string, unknown> = {}) => ({
  name,
  code,
  city: "Madurai",
  contacts: [{ name: `${name} Owner`, phone: "9443055101", approver: true }],
  ...extra,
});
type Client = { code: string; accountOwnerId: string | null };
const codes = async (a: Agent) => ((await a.get("/clients").expect(200)).body as Client[]).map((c) => c.code).sort();

describe("importing clients", () => {
  it("refuses the whole file when any row has a problem, and says which row and column", async () => {
    const res = await ashwin
      .post("/imports/clients")
      .send({
        fileName: "clients.xlsx",
        rows: [
          row("Thendral Foods", "THF"),
          row("Kovai Cotton", "KVR"), // KVR is Kaveri Organics'
          row("Thendral Foods Two", "THF"), // same code as row 1
          row("Kaveri Organics", "KOR"), // already a client
          row("Malar Studio", "MLS", { accountOwnerEmail: "nobody@geniemagnet.test" }),
        ],
      })
      .expect(400);
    expect(res.body.message).toBe("4 problems in the rows — nothing was imported.");
    expect(res.body.issues).toEqual([
      { path: "rows.1.code", message: "Code KVR is already used by Kaveri Organics" },
      { path: "rows.2.code", message: "Same code as row 1" },
      { path: "rows.3.name", message: "Already in your clients" },
      { path: "rows.4.accountOwnerEmail", message: "No one in your team has this email" },
    ]);
    expect(await codes(ashwin)).toEqual(["BPA", "KVR", "NVD", "SLS", "UNR"]);
  });

  let importId: string;

  it("imports every row in one go, with account owners, and keeps it in the history", async () => {
    const res = await ashwin
      .post("/imports/clients")
      .send({
        fileName: "clients.xlsx",
        rows: [row("Thendral Foods", "THF", { accountOwnerEmail: "Priya@GenieMagnet.test" }), row("Malar Studio", "MLS")],
      })
      .expect(201);
    importId = res.body.id;
    expect(res.body.created).toBe(2);

    const clients = (await ashwin.get("/clients").expect(200)).body as (Client & { name: string })[];
    expect(clients.find((c) => c.code === "THF")?.accountOwnerId).toBe(seedUserId("priya@geniemagnet.test"));
    const [entry] = (await ashwin.get("/imports").expect(200)).body;
    expect(entry).toMatchObject({ id: importId, kind: "clients", fileName: "clients.xlsx", rowCount: 2, createdBy: "Ashwin", canUndo: true, undoneAt: null });
    const audit = (await jana.get("/audit?entity=client&limit=5").expect(200)).body.items as { after: { via?: string } }[];
    expect(audit.filter((e) => e.after?.via === "clients.xlsx")).toHaveLength(2);
  });

  it("can be undone once, within 24 hours", async () => {
    expect((await ashwin.delete(`/imports/${importId}`).expect(200)).body).toMatchObject({ removed: 2, kept: 0 });
    expect(await codes(ashwin)).toEqual(["BPA", "KVR", "NVD", "SLS", "UNR"]);
    await ashwin.delete(`/imports/${importId}`).expect(409);

    const again = (
      await ashwin
        .post("/imports/clients")
        .send({ fileName: "late.csv", rows: [row("Late Client", "LTC")] })
        .expect(201)
    ).body;
    await t.sql(`UPDATE imports SET created_at = now() - interval '25 hours' WHERE id = $1`, [again.id]);
    expect((await ashwin.delete(`/imports/${again.id}`).expect(409)).body.message).toBe("Imports can be undone for 24 hours only.");
  });

  it("is not undone once its clients have been worked on", async () => {
    const res = (
      await ashwin
        .post("/imports/clients")
        .send({ fileName: "busy.xlsx", rows: [row("Busy Client", "BSY")] })
        .expect(201)
    ).body;
    const [client] = await t.sql<{ id: string }>(`SELECT id FROM clients WHERE code = 'BSY' AND agency_id = $1`, [genieMagnet.id]);
    await t.sql(`INSERT INTO audit_logs (id, agency_id, action, entity, entity_id) VALUES (gen_random_uuid(), $1, 'update', 'client', $2)`, [
      genieMagnet.id,
      client!.id,
    ]);
    await ashwin.delete(`/imports/${res.id}`).expect(409);
  });

  it("needs edit on clients", async () => {
    const divya = await t.signInAs("divya@geniemagnet.test"); // editors only view clients
    await divya
      .post("/imports/clients")
      .send({ fileName: "x.csv", rows: [row("Nope", "NOP")] })
      .expect(403);
    expect((await divya.get("/imports").expect(200)).body).toEqual([]);
  });
});

describe("importing the team", () => {
  it("turns rows into invitations, and checks roles and people first", async () => {
    const bad = await ashwin
      .post("/imports/team")
      .send({
        fileName: "team.xlsx",
        rows: [
          { email: "new.one@geniemagnet.test", role: "editor" },
          { email: "divya@geniemagnet.test", role: "editor" }, // already a member
          { email: "boss@geniemagnet.test", role: "owner" }, // managers cannot make owners
          { email: "x@geniemagnet.test", role: "astronaut" },
          { email: "NEW.ONE@geniemagnet.test", role: "shooter" },
        ],
      })
      .expect(400);
    expect((bad.body.issues as { path: string }[]).map((i) => i.path)).toEqual(["rows.1.email", "rows.2.role", "rows.3.role", "rows.4.email"]);

    const ok = await ashwin
      .post("/imports/team")
      .send({
        fileName: "team.xlsx",
        rows: [
          { email: "new.one@geniemagnet.test", role: "editor" },
          { email: "new.two@geniemagnet.test", role: "team_leader" },
        ],
      })
      .expect(201);
    const team = (await ashwin.get("/team").expect(200)).body as { invitations: { email: string; role: { key: string }; link: string }[] };
    expect(team.invitations.map((i) => `${i.email}:${i.role.key}`).sort()).toEqual(["new.one@geniemagnet.test:editor", "new.two@geniemagnet.test:team_leader"]);

    // Undo cancels the invitations still waiting.
    expect((await ashwin.delete(`/imports/${ok.body.id}`).expect(200)).body).toMatchObject({ removed: 2, kept: 0 });
    expect(((await ashwin.get("/team").expect(200)).body as { invitations: unknown[] }).invitations).toEqual([]);
  });

  it("needs edit on the team", async () => {
    const harini = await t.signInAs("harini@geniemagnet.test"); // HR sees the team but cannot invite
    await harini
      .post("/imports/team")
      .send({ fileName: "t.csv", rows: [{ email: "z@geniemagnet.test", role: "editor" }] })
      .expect(403);
  });
});
