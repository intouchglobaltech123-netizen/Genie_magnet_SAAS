// Better Auth spike — exit criteria from docs/adr/0003-authentication-better-auth.md:
// 1. agencies and memberships are created in our tables; 2. the session's active agency flows into
// TenantDb → row-level security; 3. switching agency changes what the same person sees;
// 4. invitations work, and only for a confirmed email (emails are captured by the outbox until sending is built).
import "reflect-metadata";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@gm/db/testing";
import { AppModule } from "../app.module.js";
import { configureApp } from "../bootstrap.js";
import { Outbox } from "./outbox.js";

const ORIGIN = "http://localhost:3000";
const PASSWORD = "correct-horse-battery-9";
const kaveri = { name: "Kaveri Organics", code: "KVR", contacts: [{ name: "Ramesh Gounder", phone: "+91 94430 55101", approver: true }] };

let db: TestDatabase;
let app: NestExpressApplication;

type Agent = ReturnType<typeof request.agent>;
const post = (a: Agent, path: string, body: object) => a.post(path).set("Origin", ORIGIN).send(body);

async function signUp(name: string, email: string) {
  const agent = request.agent(app.getHttpServer());
  await post(agent, "/api/auth/sign-up/email", { name, email, password: PASSWORD }).expect(200);
  return agent;
}

beforeAll(async () => {
  db = await startTestDatabase();
  Object.assign(process.env, {
    NODE_ENV: "test",
    AUTH_MODE: "better-auth",
    DATABASE_URL: db.appUrl,
    AUTH_DATABASE_URL: db.authUrl,
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-hmac-0123456789",
    BETTER_AUTH_URL: "http://localhost:4000",
    WEB_ORIGIN: ORIGIN,
    // The real-use setting: email addresses are confirmed before an invitation can be accepted.
    REQUIRE_EMAIL_VERIFICATION: "true",
  });
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = configureApp(mod.createNestApplication<NestExpressApplication>({ bodyParser: false }));
  await app.init();
}, 180_000);

afterAll(async () => {
  await app?.close();
  await db?.stop();
}, 60_000);

describe("sign-in and agencies (Better Auth spike)", () => {
  let ashwin: Agent;
  let genieMagnet: { id: string };
  let zenStudio: { id: string };

  it("signs up, and without an agency there is no data access", async () => {
    ashwin = await signUp("Ashwin", "ashwin@gm.test");
    const me = await ashwin.get("/me").expect(200);
    expect(me.body).toMatchObject({ user: { name: "Ashwin", email: "ashwin@gm.test" }, activeAgencyId: null, agencies: [] });
    await ashwin.get("/clients").expect(401);
  });

  it("creates an agency in our tables, with the creator as owner, and works inside it", async () => {
    genieMagnet = (await post(ashwin, "/api/auth/organization/create", { name: "Genie Magnet", slug: "genie-magnet" }).expect(200)).body;
    await post(ashwin, "/api/auth/organization/set-active", { organizationId: genieMagnet.id }).expect(200);

    const owner = new pg.Client({ connectionString: db.ownerUrl });
    await owner.connect();
    const rows = await owner.query(`SELECT a.name, m.role FROM agencies a JOIN memberships m ON m.agency_id = a.id WHERE a.id = $1`, [genieMagnet.id]);
    const roles = await owner.query(`SELECT count(*)::int AS n FROM roles WHERE agency_id = $1`, [genieMagnet.id]);
    await owner.end();
    expect(rows.rows).toEqual([{ name: "Genie Magnet", role: "owner" }]);
    // A new agency starts with the default roles, which it can then change (P1-11).
    expect(roles.rows[0].n).toBe(12);

    const created = await post(ashwin, "/clients", kaveri).expect(201);
    expect(created.body.agencyId).toBe(genieMagnet.id);
    expect((await ashwin.get("/clients").expect(200)).body.map((c: { code: string }) => c.code)).toEqual(["KVR"]);
  });

  it("switching agency switches the data, for the same person", async () => {
    zenStudio = (await post(ashwin, "/api/auth/organization/create", { name: "Zen Studio", slug: "zen-studio" }).expect(200)).body;
    await post(ashwin, "/api/auth/organization/set-active", { organizationId: zenStudio.id }).expect(200);
    expect((await ashwin.get("/clients").expect(200)).body).toEqual([]);

    await post(ashwin, "/api/auth/organization/set-active", { organizationId: genieMagnet.id }).expect(200);
    expect((await ashwin.get("/clients").expect(200)).body.map((c: { code: string }) => c.code)).toEqual(["KVR"]);

    const me = await ashwin.get("/me").expect(200);
    expect(me.body.activeAgencyId).toBe(genieMagnet.id);
    expect(me.body.agencies.map((a: { name: string; role: string }) => `${a.name}:${a.role}`)).toEqual(["Genie Magnet:owner", "Zen Studio:owner"]);
  });

  it("invites a person by email; they join with the chosen role and see only that agency", async () => {
    const priya = await signUp("Priya", "priya@gm.test");
    await priya.get("/clients").expect(401);

    // Priya confirms her email from the link she was sent — required before accepting an invitation.
    const verification = app.get(Outbox).last("priya@gm.test");
    expect(verification?.subject).toBe("Confirm your email for Genie Magnet OS");
    const url = new URL(verification!.link!);
    await priya.get(url.pathname + url.search).expect((r) => expect([200, 302]).toContain(r.status));

    // People are invited through the API (permission matrix, audit); Better Auth's own invite route is closed.
    await post(ashwin, "/api/auth/organization/invite-member", { email: "priya@gm.test", role: "manager", organizationId: genieMagnet.id }).expect(404);
    await post(ashwin, "/team/invitations", { email: "priya@gm.test", role: "manager" }).expect(201);
    const email = app.get(Outbox).last("priya@gm.test");
    expect(email?.subject).toBe("Ashwin invited you to Genie Magnet on Genie Magnet OS");
    const invitationId = email!.link!.split("/").pop()!;

    await post(priya, "/api/auth/organization/accept-invitation", { invitationId }).expect(200);
    await post(priya, "/api/auth/organization/set-active", { organizationId: genieMagnet.id }).expect(200);
    expect((await priya.get("/clients").expect(200)).body.map((c: { code: string }) => c.code)).toEqual(["KVR"]);
    expect((await priya.get("/me").expect(200)).body.agencies).toEqual([expect.objectContaining({ name: "Genie Magnet", role: "manager" })]);

    // Priya cannot reach Zen Studio, even by asking for it.
    await post(priya, "/api/auth/organization/set-active", { organizationId: zenStudio.id }).expect((r) => expect(r.status).toBeGreaterThanOrEqual(400));
  });

  it("removing someone cuts their access at once, even with a live session", async () => {
    const priya = request.agent(app.getHttpServer());
    await post(priya, "/api/auth/sign-in/email", { email: "priya@gm.test", password: PASSWORD }).expect(200);
    await post(priya, "/api/auth/organization/set-active", { organizationId: genieMagnet.id }).expect(200);
    await priya.get("/clients").expect(200);

    const team = await ashwin.get("/team").expect(200);
    const membership = team.body.members.find((m: { user: { email: string } }) => m.user.email === "priya@gm.test");
    await ashwin.delete(`/team/members/${membership.id}`).set("Origin", ORIGIN).expect(204);
    await priya.get("/clients").expect(401);
  });

  it("rejects a wrong password", async () => {
    const intruder = request.agent(app.getHttpServer());
    await post(intruder, "/api/auth/sign-in/email", { email: "ashwin@gm.test", password: "not-the-password" }).expect(401);
  });

  it("slows down repeated sign-in attempts from one address", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await request(app.getHttpServer())
        .post("/api/auth/sign-in/email")
        .set("Origin", ORIGIN)
        .set("X-Forwarded-For", "203.0.113.7")
        .send({ email: "ashwin@gm.test", password: `guess-number-000${i}` });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([401, 401, 401, 429]);
  });
});
