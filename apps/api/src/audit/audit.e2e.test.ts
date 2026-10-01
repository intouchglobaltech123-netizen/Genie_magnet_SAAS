// Audit log (P1-03): every change recorded with who and what changed; owners and managers read it, per record
// or per agency, filtered by person and date; one agency never sees another's entries.
import "reflect-metadata";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma } from "@gm/db";
import { genieMagnet, seedSampleData, seedUserId, zenStudio } from "@gm/db/seed";
import { startTestDatabase, type TestDatabase } from "@gm/db/testing";
import { AppModule } from "../app.module.js";
import { configureApp } from "../bootstrap.js";
import { changes } from "./audit.service.js";

const ORIGIN = "http://localhost:3000";
const GM = genieMagnet.id;

let db: TestDatabase;
let app: NestExpressApplication;

type Agent = ReturnType<typeof request.agent>;
interface Entry {
  id: string;
  action: string;
  entity: string;
  entityId: string | null;
  actor: { id: string; name: string | null } | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
}

async function signInAs(email: string, agencyId?: string) {
  const agent = request.agent(app.getHttpServer());
  await agent.post("/api/auth/test-sign-in").set("Origin", ORIGIN).send({ email, agencyId }).expect(200);
  return agent;
}
const post = (a: Agent, path: string, body: object) => a.post(path).set("Origin", ORIGIN).send(body);
const entries = async (a: Agent, query = "") => (await a.get(`/audit${query}`).expect(200)).body.items as Entry[];

async function membershipId(email: string) {
  const owner = new pg.Client({ connectionString: db.ownerUrl });
  await owner.connect();
  const r = await owner.query(`SELECT id FROM memberships WHERE agency_id = $1 AND user_id = $2`, [GM, seedUserId(email)]);
  await owner.end();
  return r.rows[0].id as string;
}

beforeAll(async () => {
  db = await startTestDatabase();
  const owner = createPrisma(db.ownerUrl);
  await seedSampleData(owner);
  await owner.$disconnect();
  Object.assign(process.env, {
    NODE_ENV: "test",
    AUTH_MODE: "better-auth",
    DATABASE_URL: db.appUrl,
    AUTH_DATABASE_URL: db.authUrl,
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-hmac-0123456789",
    BETTER_AUTH_URL: "http://localhost:4000",
    WEB_ORIGIN: ORIGIN,
    TEST_SIGN_IN: "true",
    RATE_LIMIT_PER_MINUTE: "300",
  });
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(mod.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false }));
  await app.init();
}, 180_000);

afterAll(async () => {
  await app?.close();
  await db?.stop();
}, 60_000);

describe("audit log", () => {
  let jana: Agent;
  let ashwin: Agent;
  let clientId: string;

  beforeAll(async () => {
    jana = await signInAs("jana@geniemagnet.test");
    ashwin = await signInAs("ashwin@geniemagnet.test");
  });

  it("records a change in the same transaction, with who made it", async () => {
    const created = await post(ashwin, "/clients", {
      name: "Thendral Foods",
      code: "THF",
      contacts: [{ name: "Selvi", phone: "+91 90000 11111", approver: true }],
    }).expect(201);
    clientId = created.body.id;

    const history = await entries(jana, `?entity=client&entityId=${clientId}`);
    expect(history).toEqual([
      expect.objectContaining({
        action: "create",
        entity: "client",
        actor: { id: seedUserId("ashwin@geniemagnet.test"), name: "Ashwin" },
        after: { code: "THF", name: "Thendral Foods" },
      }),
    ]);
  });

  it("records invitations, role changes and removals made through sign-in, by the person who made them", async () => {
    await post(jana, "/api/auth/organization/invite-member", { email: "new.editor@geniemagnet.test", role: "editor", organizationId: GM }).expect(200);
    await post(jana, "/api/auth/organization/update-member-role", {
      memberId: await membershipId("surya@geniemagnet.test"),
      role: "team_leader",
      organizationId: GM,
    }).expect(200);
    await post(jana, "/api/auth/organization/remove-member", { memberIdOrEmail: "rahul@freelance.test", organizationId: GM }).expect(200);

    const byJana = await entries(jana, `?actorId=${seedUserId("jana@geniemagnet.test")}`);
    expect(byJana.map((e) => `${e.action} ${e.entity}`)).toEqual(["delete membership", "update membership", "create invitation"]);
    expect(byJana.every((e) => e.actor?.name === "Janarthanan")).toBe(true);
    expect(byJana[0]).toMatchObject({ before: { name: "Rahul Menon", role: "freelancer" }, after: null });
    expect(byJana[1]).toMatchObject({ before: { name: "Surya Prakash", role: "editor" }, after: { name: "Surya Prakash", role: "team_leader" } });
    expect(byJana[2]).toMatchObject({ after: { email: "new.editor@geniemagnet.test", role: "editor" } });
  });

  it("filters by date and pages through long histories", async () => {
    const all = await entries(jana);
    expect(all.length).toBeGreaterThanOrEqual(5); // seed, client, invitation, role, removal
    expect(await entries(jana, `?from=${new Date(Date.now() + 60_000).toISOString()}`)).toEqual([]);

    const first = (await jana.get("/audit?limit=2").expect(200)).body as { items: Entry[]; next: string };
    const second = (await jana.get(`/audit?limit=2&cursor=${first.next}`).expect(200)).body as { items: Entry[] };
    expect([...first.items, ...second.items].map((e) => e.id)).toEqual(all.slice(0, 4).map((e) => e.id));
  });

  it("is read by owners and managers only", async () => {
    await entries(ashwin);
    const divya = await signInAs("divya@geniemagnet.test");
    await divya.get("/audit").expect(403);
  });

  it("never shows one agency's entries to another", async () => {
    const zara = await signInAs("zara@zenstudio.test");
    const theirs = await entries(zara);
    expect(theirs.map((e) => `${e.action} ${e.entity}`)).toEqual(["seed agency"]);
    expect(theirs[0]?.entityId).toBe(zenStudio.id);
  });

  it("cannot be changed or deleted, even by the API's own database role", async () => {
    const appDb = new pg.Client({ connectionString: db.appUrl });
    await appDb.connect();
    await appDb.query(`SELECT set_config('app.agency_id', $1, false)`, [GM]);
    await expect(appDb.query(`UPDATE audit_logs SET action = 'tampered'`)).rejects.toThrow(/permission denied/);
    await expect(appDb.query(`DELETE FROM audit_logs`)).rejects.toThrow(/permission denied/);
    await appDb.end();
  });
});

describe("changes()", () => {
  it("keeps only the fields that changed", () => {
    expect(changes({ name: "Kaveri", city: "Erode", fee: 85000 }, { name: "Kaveri", city: "Salem", fee: 90000 })).toEqual({
      before: { city: "Erode", fee: 85000 },
      after: { city: "Salem", fee: 90000 },
    });
    expect(changes({ name: "Kaveri" }, { name: "Kaveri" })).toBeNull();
    expect(changes({ a: null }, { a: "x", b: 1 })).toEqual({ before: { a: null, b: null }, after: { a: "x", b: 1 } });
  });
});
