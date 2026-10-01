// Test sign-in on the sample data (P1-02): pick a person, no password, and work inside their agency.
import "reflect-metadata";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma } from "@gm/db";
import { genieMagnet, seedSampleData, zenStudio } from "@gm/db/seed";
import { startTestDatabase, type TestDatabase } from "@gm/db/testing";
import { DEFAULT_ROLES } from "@gm/shared";
import { AppModule } from "../app.module.js";
import { configureApp } from "../bootstrap.js";

const ORIGIN = "http://localhost:3000";

let db: TestDatabase;

async function startApi(testSignIn: boolean) {
  Object.assign(process.env, {
    NODE_ENV: "test",
    AUTH_MODE: "better-auth",
    DATABASE_URL: db.appUrl,
    AUTH_DATABASE_URL: db.authUrl,
    BETTER_AUTH_SECRET: "test-secret-that-is-long-enough-for-hmac-0123456789",
    BETTER_AUTH_URL: "http://localhost:4000",
    WEB_ORIGIN: ORIGIN,
    TEST_SIGN_IN: String(testSignIn),
  });
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(mod.createNestApplication<NestExpressApplication>({ bodyParser: false }));
  await app.init();
  return app;
}

async function signInAs(app: NestExpressApplication, email: string, agencyId?: string) {
  const agent = request.agent(app.getHttpServer());
  const res = await agent.post("/api/auth/test-sign-in").set("Origin", ORIGIN).send({ email, agencyId }).expect(200);
  return { agent, body: res.body as { activeAgencyId: string | null } };
}

const codes = (res: request.Response) => (res.body as { code: string }[]).map((c) => c.code).sort();

beforeAll(async () => {
  db = await startTestDatabase();
  const owner = createPrisma(db.ownerUrl);
  await seedSampleData(owner);
  await owner.$disconnect();
}, 180_000);

afterAll(async () => {
  await db?.stop();
}, 60_000);

describe("test sign-in, when switched on", () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await startApi(true);
  });
  afterAll(async () => {
    await app?.close();
  });

  it("lists the sample people with their agencies and default roles", async () => {
    const res = await request(app.getHttpServer()).get("/api/auth/test-sign-in/people").expect(200);
    const people = res.body as { name: string; email: string; agencies: { name: string; role: string }[] }[];
    expect(people.find((p) => p.name === "Ashwin")?.agencies).toEqual([expect.objectContaining({ name: "Genie Magnet", role: "manager" })]);
    const roles = new Set(people.flatMap((p) => p.agencies.map((a) => a.role)));
    expect([...roles].every((r) => (DEFAULT_ROLES as readonly string[]).includes(r))).toBe(true);
  });

  it("signs in without a password and opens the person's agency", async () => {
    const { agent, body } = await signInAs(app, "ashwin@geniemagnet.test");
    expect(body.activeAgencyId).toBe(genieMagnet.id);
    const me = await agent.get("/me").expect(200);
    expect(me.body).toMatchObject({ user: { name: "Ashwin" }, activeAgencyId: genieMagnet.id });
    expect(codes(await agent.get("/clients").expect(200))).toEqual(["BPA", "KVR", "NVD", "SLS", "UNR"]);
  });

  it("lets a person in two agencies pick one, and only theirs", async () => {
    const { agent } = await signInAs(app, "rahul@freelance.test", zenStudio.id);
    expect(codes(await agent.get("/clients").expect(200))).toEqual(["KVR", "MBC"]);

    // Zara (Zen Studio) cannot open Genie Magnet.
    await request(app.getHttpServer())
      .post("/api/auth/test-sign-in")
      .set("Origin", ORIGIN)
      .send({ email: "zara@zenstudio.test", agencyId: genieMagnet.id })
      .expect(403);
  });

  it("refuses an unknown person", async () => {
    await request(app.getHttpServer()).post("/api/auth/test-sign-in").set("Origin", ORIGIN).send({ email: "nobody@geniemagnet.test" }).expect(404);
  });
});

describe("test sign-in, when switched off (the default)", () => {
  let app: NestExpressApplication;
  beforeAll(async () => {
    app = await startApi(false);
  });
  afterAll(async () => {
    await app?.close();
  });

  it("does not exist", async () => {
    await request(app.getHttpServer()).post("/api/auth/test-sign-in").set("Origin", ORIGIN).send({ email: "ashwin@geniemagnet.test" }).expect(404);
    await request(app.getHttpServer()).get("/api/auth/test-sign-in/people").expect(404);
  });
});
