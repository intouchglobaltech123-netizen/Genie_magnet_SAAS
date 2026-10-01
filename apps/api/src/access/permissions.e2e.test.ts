// Custom roles and the permission matrix (P1-11), on the sample agencies with test sign-in.
import "reflect-metadata";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma } from "@gm/db";
import { seedSampleData } from "@gm/db/seed";
import { startTestDatabase, type TestDatabase } from "@gm/db/testing";
import { allows, type AreaKey, DEFAULT_PERMISSIONS, type DefaultRole, FULL_ACCESS } from "@gm/shared";
import { AppModule } from "../app.module.js";
import { configureApp } from "../bootstrap.js";

const ORIGIN = "http://localhost:3000";

let db: TestDatabase;
let app: NestExpressApplication;
type Agent = ReturnType<typeof request.agent>;

async function signInAs(email: string) {
  const agent = request.agent(app.getHttpServer());
  await agent.post("/api/auth/test-sign-in").set("Origin", ORIGIN).send({ email }).expect(200);
  return agent;
}

async function membershipOf(owner: Agent, email: string): Promise<string> {
  const team = (await owner.get("/team").expect(200)).body as { members: { id: string; user: { email: string } }[] };
  return team.members.find((m) => m.user.email === email)!.id;
}

const codes = (res: request.Response) => (res.body as { code: string }[]).map((c) => c.code).sort();

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

describe("the default matrix, enforced for every role", () => {
  const people: [DefaultRole, string][] = [
    ["owner", "jana@geniemagnet.test"],
    ["manager", "ashwin@geniemagnet.test"],
    ["team_leader", "priya@geniemagnet.test"],
    ["editor", "divya@geniemagnet.test"],
    ["shooter", "vignesh@geniemagnet.test"],
    ["script_writer", "keerthana@freelance.test"],
    ["social_media_manager", "meena@geniemagnet.test"],
    ["finance", "anitha@geniemagnet.test"],
    ["hr", "harini@geniemagnet.test"],
    ["freelancer", "rahul@freelance.test"],
  ];
  const endpoints: { name: string; area: AreaKey; level: "view" | "edit"; call: (a: Agent, i: number) => request.Test }[] = [
    { name: "GET /clients", area: "clients", level: "view", call: (a) => a.get("/clients") },
    {
      name: "POST /clients",
      area: "clients",
      level: "edit",
      call: (a, i) =>
        a.post("/clients").send({ name: `Matrix Client ${i}`, code: `MX${String.fromCharCode(65 + i)}`, contacts: [{ name: "A", phone: "+91 90000 00000" }] }),
    },
    { name: "GET /audit", area: "audit", level: "view", call: (a) => a.get("/audit") },
    { name: "GET /team", area: "team", level: "view", call: (a) => a.get("/team") },
    { name: "GET /roles", area: "team", level: "view", call: (a) => a.get("/roles") },
    {
      name: "POST /team/invitations",
      area: "team",
      level: "edit",
      call: (a, i) => a.post("/team/invitations").send({ email: `matrix${i}@geniemagnet.test`, role: "editor" }),
    },
    { name: "POST /roles", area: "roles", level: "edit", call: (a, i) => a.post("/roles").send({ name: `Matrix role ${i}` }) },
  ];

  it.each(people.map(([role, email], i) => ({ role, email, i })))("$role gets exactly what the matrix allows", async ({ role, email, i }) => {
    const agent = await signInAs(email);
    const matrix = role === "owner" ? FULL_ACCESS : DEFAULT_PERMISSIONS[role];
    const outcome = [];
    for (const e of endpoints) {
      const res = await e.call(agent, i);
      outcome.push(`${e.name} ${res.status < 300 ? "allowed" : res.status}`);
    }
    expect(outcome).toEqual(endpoints.map((e) => `${e.name} ${allows(matrix, e.area, e.level) ? "allowed" : 403}`));
  });

  it("keeps the important lines where Growth OS puts them", async () => {
    await (await signInAs("harini@geniemagnet.test")).get("/clients").expect(403); // HR: no client data
    await (await signInAs("divya@geniemagnet.test")).get("/audit").expect(403); // editors: no audit log
    await (await signInAs("anitha@geniemagnet.test")).post("/team/invitations").send({ email: "x@geniemagnet.test", role: "editor" }).expect(403);
  });

  it("tells the web app the person's role and permissions", async () => {
    const me = await (await signInAs("divya@geniemagnet.test")).get("/me").expect(200);
    expect(me.body).toMatchObject({ role: { key: "editor", name: "Editor" }, permissions: DEFAULT_PERMISSIONS.editor });
  });
});

describe("custom roles and changes", () => {
  let jana: Agent;
  let ashwin: Agent;

  beforeAll(async () => {
    jana = await signInAs("jana@geniemagnet.test");
    ashwin = await signInAs("ashwin@geniemagnet.test");
  });

  it("a copied role, changed by the owner, applies from the person's next request", async () => {
    const created = await jana.post("/roles").send({ name: "Technical support", copyFrom: "editor" }).expect(201);
    expect(created.body).toMatchObject({ key: "technical_support", permissions: DEFAULT_PERMISSIONS.editor });
    await jana
      .patch(`/team/members/${await membershipOf(jana, "surya@geniemagnet.test")}`)
      .send({ role: "technical_support" })
      .expect(200);

    const surya = await signInAs("surya@geniemagnet.test");
    const newClient = { name: "Support Client", code: "SPC", contacts: [{ name: "B", phone: "+91 90000 00001" }] };
    await surya.post("/clients").send(newClient).expect(403);

    await jana
      .patch("/roles/technical_support")
      .send({ permissions: { ...DEFAULT_PERMISSIONS.editor, clients: { level: "edit" } } })
      .expect(200);
    await surya.post("/clients").send(newClient).expect(201);

    const history = (await jana.get("/audit?entity=role").expect(200)).body.items as { action: string; before: unknown; after: unknown }[];
    expect(history.find((e) => e.action === "update")).toMatchObject({
      before: { permissions: expect.objectContaining({ clients: { level: "view" } }) },
      after: { permissions: expect.objectContaining({ clients: { level: "edit" } }) },
    });
  });

  it("never lets anyone give more access than they have", async () => {
    // The owner lets managers edit roles…
    await jana
      .patch("/roles/manager")
      .send({ permissions: { ...DEFAULT_PERMISSIONS.manager, roles: { level: "edit" } } })
      .expect(200);
    // …but a manager still cannot create or widen a role beyond their own access.
    const res = await ashwin
      .post("/roles")
      .send({ name: "Payroll helper", permissions: { salaries: { level: "view" } } })
      .expect(403);
    expect(res.body.message).toMatch(/Salaries and payroll/);
    await ashwin
      .patch("/roles/manager")
      .send({ permissions: { ...DEFAULT_PERMISSIONS.manager, roles: { level: "edit" }, salaries: { level: "view" } } })
      .expect(403);
    await ashwin
      .post("/roles")
      .send({ name: "Helper", permissions: { clients: { level: "view" } } })
      .expect(201);
    // Nor make or unmake owners.
    await ashwin.post("/team/invitations").send({ email: "co.owner@geniemagnet.test", role: "owner" }).expect(403);
    await ashwin
      .patch(`/team/members/${await membershipOf(jana, "jana@geniemagnet.test")}`)
      .send({ role: "editor" })
      .expect(403);
  });

  it("limits a role to its own records when the matrix says so", async () => {
    await jana
      .post("/roles")
      .send({ name: "Account handler", permissions: { clients: { level: "edit", scope: "own" } } })
      .expect(201);
    await jana
      .patch(`/team/members/${await membershipOf(jana, "priya@geniemagnet.test")}`)
      .send({ role: "account_handler" })
      .expect(200);
    const priya = await signInAs("priya@geniemagnet.test");
    expect(codes(await priya.get("/clients").expect(200))).toEqual(["BPA", "SLS"]); // the clients she is account owner of
    await priya
      .post("/clients")
      .send({ name: "Priya's New Client", code: "PNC", contacts: [{ name: "C", phone: "+91 90000 00002" }] })
      .expect(201);
    expect(codes(await priya.get("/clients").expect(200))).toEqual(["BPA", "PNC", "SLS"]);
  });

  it("always keeps an owner and never deletes a role that is in use", async () => {
    const janaMembership = await membershipOf(jana, "jana@geniemagnet.test");
    await jana.delete(`/team/members/${janaMembership}`).expect(409);
    await jana.patch(`/team/members/${janaMembership}`).send({ role: "manager" }).expect(409);
    await jana.patch("/roles/owner").send({ name: "Boss" }).expect(403);
    await jana.delete("/roles/owner").expect(403);
    await jana.delete("/roles/editor").expect(409);
    await jana.delete("/roles/helper").expect(204);
  });

  it("saves only a valid matrix", async () => {
    const res = await jana
      .patch("/roles/technical_support")
      .send({ permissions: { audit: { level: "edit" } } })
      .expect(400);
    expect(res.body.issues).toEqual([expect.objectContaining({ path: "permissions.audit.level" })]);
  });

  it("while email confirmation is off (building and testing), an invited person signs up and joins straight away", async () => {
    const invitation = await jana.post("/team/invitations").send({ email: "naveen@geniemagnet.test", role: "editor" }).expect(201);
    const naveen = request.agent(app.getHttpServer());
    await naveen
      .post("/api/auth/sign-up/email")
      .set("Origin", ORIGIN)
      .send({ name: "Naveen Raj", email: "naveen@geniemagnet.test", password: "a-long-test-password-1" })
      .expect(200);
    await naveen.post("/api/auth/organization/accept-invitation").set("Origin", ORIGIN).send({ invitationId: invitation.body.id }).expect(200);
    const team = (await jana.get("/team").expect(200)).body as { members: { user: { email: string }; role: { key: string } }[] };
    expect(team.members.find((m) => m.user.email === "naveen@geniemagnet.test")?.role.key).toBe("editor");
  });

  it("closes Better Auth's own people routes, so its fixed roles can never bypass the matrix", async () => {
    const post = (path: string, body: object) => jana.post(`/api/auth/organization/${path}`).set("Origin", ORIGIN).send(body);
    await post("invite-member", { email: "x@geniemagnet.test", role: "owner" }).expect(404);
    await post("update-member-role", { memberId: "x", role: "owner" }).expect(404);
    await post("remove-member", { memberIdOrEmail: "ashwin@geniemagnet.test" }).expect(404);
    await jana.get("/api/auth/organization/list-members").expect(404);
  });
});
