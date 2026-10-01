// API hardening (P1-01): request ids and logs, one error shape, no internals in 500s, rate limits.
import "reflect-metadata";
import { Controller, Get, Logger } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { startTestDatabase, type TestDatabase } from "@gm/db/testing";
import { AppModule } from "../app.module.js";
import { configureApp } from "../bootstrap.js";

const A = "0190f5a0-0000-7000-8000-0000000000a1";

@Controller("boom")
class BoomController {
  @Get()
  boom() {
    throw new Error("connection string postgresql://secret@db/internal");
  }
}

let db: TestDatabase;
let app: NestExpressApplication;
const http = () => request(app.getHttpServer());

beforeAll(async () => {
  db = await startTestDatabase();
  const owner = new pg.Client({ connectionString: db.ownerUrl });
  await owner.connect();
  await owner.query(`INSERT INTO agencies (id, name, slug) VALUES ($1, 'Genie Magnet', 'gm-hardening')`, [A]);
  await owner.end();

  Object.assign(process.env, { NODE_ENV: "test", AUTH_MODE: "dev-header", DATABASE_URL: db.appUrl, RATE_LIMIT_PER_MINUTE: "5" });
  delete process.env.AUTH_DATABASE_URL;
  delete process.env.BETTER_AUTH_SECRET;
  const mod = await Test.createTestingModule({ imports: [AppModule], controllers: [BoomController] }).compile();
  app = configureApp(mod.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false }));
  await app.init();
}, 180_000);

afterAll(async () => {
  await app?.close();
  await db?.stop();
}, 60_000);

describe("request id, headers and the request log", () => {
  it("gives every response a request id, keeps a caller's own, and sets security headers", async () => {
    const res = await http().get("/health").expect(200);
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["x-frame-options"]).toBe("DENY");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    await http().get("/health").set("x-request-id", "trace-from-web-123").expect("x-request-id", "trace-from-web-123");
  });

  it("logs one line per request with ids only — no query string, IP address or tokens", async () => {
    const spy = vi.spyOn(Logger.prototype, "log");
    await http().get("/clients?search=Ramesh").set("x-agency-id", A).set("x-user-id", "user-ashwin").expect(200);
    await vi.waitFor(() => expect(spy.mock.calls.some(([m]) => String(m).startsWith("GET /clients 200"))).toBe(true));
    const [, entry] = spy.mock.calls.find(([m]) => String(m).startsWith("GET /clients 200"))!;
    expect(entry).toMatchObject({ method: "GET", path: "/clients", status: 200, agencyId: A, userId: "user-ashwin" });
    expect(JSON.stringify(entry)).not.toMatch(/Ramesh|127\.0\.0\.1|::1/);
    spy.mockRestore();
  });
});

describe("one error shape", () => {
  it("returns { message, requestId } for refused requests", async () => {
    const res = await http().get("/clients").expect(401);
    expect(res.body).toEqual({ message: "Sign in and choose an agency first.", requestId: res.headers["x-request-id"] });
    expect((await http().get("/nowhere").expect(404)).body).toEqual({ message: expect.any(String), requestId: expect.any(String) });
  });

  it("adds field issues for invalid input", async () => {
    const res = await http().post("/clients").set("x-agency-id", A).send({ name: "K", code: "kvr", contacts: [] }).expect(400);
    expect(res.body).toMatchObject({ message: "Validation failed", issues: expect.arrayContaining([expect.objectContaining({ path: "code" })]) });
  });

  it("answers a body that is not JSON with a clear 400", async () => {
    const res = await http().post("/clients").set("x-agency-id", A).set("Content-Type", "application/json").send('{"name": ').expect(400);
    expect(res.body).toEqual({ message: "The request body is not valid JSON.", requestId: expect.any(String) });
  });

  it("refuses a malformed agency id instead of failing", async () => {
    expect((await http().get("/clients").set("x-agency-id", "not-a-uuid").expect(400)).body.message).toBe("A valid agency is required.");
  });

  it("never shows internals when something breaks", async () => {
    const res = await http().get("/boom").expect(500);
    expect(res.body).toEqual({ message: "Something went wrong on our side. If you report it, quote the request id.", requestId: expect.any(String) });
    expect(JSON.stringify(res.body)).not.toContain("postgresql");
  });
});

describe("rate limits", () => {
  it("limits each person per route and says when to try again", async () => {
    const as = (user: string) => http().get("/clients").set("x-agency-id", A).set("x-user-id", user);
    for (let i = 0; i < 5; i++) await as("user-limited").expect(200);
    const res = await as("user-limited").expect(429);
    expect(res.body.message).toMatch(/Too many requests/);
    expect(Number(res.headers["retry-after"])).toBeGreaterThan(0);
    // Someone else is not affected.
    await as("user-other").expect(200);
  });

  it("never limits health checks", async () => {
    for (let i = 0; i < 8; i++) await http().get("/health").expect(200);
  });
});
