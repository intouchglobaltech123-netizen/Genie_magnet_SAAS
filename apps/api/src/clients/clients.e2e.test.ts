import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@gm/db/testing";
import { AppModule } from "../app.module.js";

const A = "0190f5a0-0000-7000-8000-0000000000a1";
const B = "0190f5a0-0000-7000-8000-0000000000b2";

let db: TestDatabase;
let app: INestApplication;

const kaveri = {
  name: "Kaveri Organics",
  code: "KVR",
  city: "Erode",
  stage: "Success",
  fitment: "Bread-winning",
  contacts: [{ name: "Ramesh Gounder", phone: "+91 94430 55101", approver: true }],
};

beforeAll(async () => {
  db = await startTestDatabase();
  const owner = new pg.Client({ connectionString: db.ownerUrl });
  await owner.connect();
  await owner.query(`INSERT INTO agencies (id, name, slug) VALUES ($1, 'Genie Magnet', 'gm-e2e'), ($2, 'Other Agency', 'other-e2e')`, [A, B]);
  await owner.end();

  process.env.DATABASE_URL = db.appUrl;
  process.env.NODE_ENV = "test";
  process.env.AUTH_MODE = "dev-header";
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
}, 180_000);

afterAll(async () => {
  await app?.close();
  await db?.stop();
}, 60_000);

describe("health", () => {
  it("is live and the database is ready", async () => {
    await request(app.getHttpServer()).get("/health").expect(200, { status: "ok", service: "api" });
    await request(app.getHttpServer()).get("/health/ready").expect(200, { status: "ok", database: "ok" });
  });
});

describe("clients", () => {
  it("requires an agency", async () => {
    await request(app.getHttpServer()).get("/clients").expect(401);
  });

  it("creates a client with contacts and an audit entry", async () => {
    const res = await request(app.getHttpServer()).post("/clients").set("x-agency-id", A).set("x-user-id", "user-ashwin").send(kaveri).expect(201);
    expect(res.body).toMatchObject({ agencyId: A, code: "KVR", fitment: "bread_winning", stage: "success" });
    expect(res.body.contacts).toHaveLength(1);

    const owner = new pg.Client({ connectionString: db.ownerUrl });
    await owner.connect();
    const audit = await owner.query(`SELECT action, entity, actor_id FROM audit_logs WHERE agency_id = $1`, [A]);
    await owner.end();
    expect(audit.rows).toEqual([{ action: "create", entity: "client", actor_id: "user-ashwin" }]);
  });

  it("never shows one agency's clients to another", async () => {
    const mine = await request(app.getHttpServer()).get("/clients").set("x-agency-id", A).expect(200);
    const theirs = await request(app.getHttpServer()).get("/clients").set("x-agency-id", B).expect(200);
    expect(mine.body.map((c: { code: string }) => c.code)).toEqual(["KVR"]);
    expect(theirs.body).toEqual([]);
  });

  it("lets two agencies use the same client code", async () => {
    await request(app.getHttpServer()).post("/clients").set("x-agency-id", B).send(kaveri).expect(201);
  });

  it("rejects a duplicate code within one agency", async () => {
    await request(app.getHttpServer()).post("/clients").set("x-agency-id", A).send(kaveri).expect(409);
  });

  it("returns field-level validation errors from the shared schema", async () => {
    const res = await request(app.getHttpServer()).post("/clients").set("x-agency-id", A).send({ name: "K", code: "kvr", contacts: [] }).expect(400);
    expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(expect.arrayContaining(["name", "code", "contacts"]));
  });
});
