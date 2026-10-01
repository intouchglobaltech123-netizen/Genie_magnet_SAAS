// For e2e tests: the API on a fresh database with the sample agencies, real sign-in, and test sign-in switched on.
import "reflect-metadata";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { Test } from "@nestjs/testing";
import pg from "pg";
import request from "supertest";
import { createPrisma } from "@gm/db";
import { seedSampleData } from "@gm/db/seed";
import { startTestDatabase, type TestDatabase } from "@gm/db/testing";
import { AppModule } from "../app.module.js";
import { configureApp } from "../bootstrap.js";

export const ORIGIN = "http://localhost:3000";
export type Agent = ReturnType<typeof request.agent>;

export interface SeededApp {
  app: NestExpressApplication;
  db: TestDatabase;
  /** A signed-in browser for a sample person (their first agency unless one is given). */
  signInAs(email: string, agencyId?: string): Promise<Agent>;
  /** Runs SQL as the schema owner (for checks the API would not show). */
  sql<T = Record<string, unknown>>(text: string, values?: unknown[]): Promise<T[]>;
  stop(): Promise<void>;
}

export async function startSeededApp(env: Record<string, string> = {}): Promise<SeededApp> {
  const db = await startTestDatabase();
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
    RATE_LIMIT_PER_MINUTE: "1000",
    ...env,
  });
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = configureApp(mod.createNestApplication<NestExpressApplication>({ bodyParser: false, logger: false }));
  await app.init();

  return {
    app,
    db,
    async signInAs(email, agencyId) {
      const agent = request.agent(app.getHttpServer());
      await agent.post("/api/auth/test-sign-in").set("Origin", ORIGIN).send({ email, agencyId }).expect(200);
      return agent;
    },
    async sql(text, values) {
      const client = new pg.Client({ connectionString: db.ownerUrl });
      await client.connect();
      try {
        return (await client.query(text, values)).rows;
      } finally {
        await client.end();
      }
    },
    async stop() {
      await app.close();
      await db.stop();
    },
  };
}
