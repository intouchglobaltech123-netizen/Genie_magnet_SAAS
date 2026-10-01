import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma, forAgency } from "../index.js";
import { startTestDatabase, type TestDatabase } from "../test/database.js";
import { genieMagnet, seedSampleData, seedUserId, zenStudio } from "./index.js";

let db: TestDatabase;

beforeAll(async () => {
  db = await startTestDatabase();
});

afterAll(async () => {
  await db?.stop();
});

describe("sample data (P1-02)", () => {
  it("creates both agencies, even where row-level security applies to the seeding role, and a re-run changes nothing", async () => {
    // Hosted databases often give the schema owner no superuser rights, so row-level security applies to it.
    // A role with full table rights but no superuser behaves the same way.
    const admin = new pg.Client({ connectionString: db.ownerUrl });
    await admin.connect();
    await admin.query(`DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'genie_seed_test') THEN
      CREATE ROLE genie_seed_test LOGIN PASSWORD 'seed-test' NOSUPERUSER NOBYPASSRLS; END IF; END $$`);
    await admin.query(`GRANT USAGE ON SCHEMA public TO genie_seed_test;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO genie_seed_test;
      GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO genie_seed_test`);
    await admin.end();
    const url = new URL(db.ownerUrl);
    url.username = "genie_seed_test";
    url.password = "seed-test";

    const limited = createPrisma(url.toString());
    const owner = createPrisma(db.ownerUrl);
    try {
      expect(await seedSampleData(limited)).toEqual([
        { agency: "Genie Magnet", created: true },
        { agency: "Zen Studio (test agency)", created: true },
      ]);
      expect(await seedSampleData(owner)).toEqual([
        { agency: "Genie Magnet", created: false },
        { agency: "Zen Studio (test agency)", created: false },
      ]);
    } finally {
      await limited.$disconnect();
      await owner.$disconnect();
    }
  });

  it("keeps each agency's data inside it", async () => {
    const app = createPrisma(db.appUrl);
    try {
      const gm = forAgency(app, genieMagnet.id);
      const zen = forAgency(app, zenStudio.id);
      expect((await gm.client.findMany({ orderBy: { code: "asc" } })).map((c) => c.code)).toEqual(["BPA", "KVR", "NVD", "SLS", "UNR"]);
      expect((await zen.client.findMany({ orderBy: { code: "asc" } })).map((c) => c.code)).toEqual(["KVR", "MBC"]);
      expect(await gm.agreement.count()).toBe(5);
      expect(await gm.lead.count()).toBe(12);
      expect(await gm.package.count()).toBe(5);
      expect(await gm.membership.count()).toBe(genieMagnet.people.length);
      expect(await zen.lead.count()).toBe(1);
      expect(await gm.role.count()).toBe(12);
      expect((await gm.role.findUnique({ where: { agencyId_key: { agencyId: genieMagnet.id, key: "editor" } } }))?.permissions).toEqual({
        clients: { level: "view" },
        content: { level: "view" },
        production: { level: "edit", scope: "own" },
      });
    } finally {
      await app.$disconnect();
    }
  });

  it("stores times in UTC, whatever the server's own time zone", async () => {
    const app = createPrisma(db.appUrl);
    try {
      const agency = await forAgency(app, genieMagnet.id).agency.findUnique({ where: { id: genieMagnet.id }, select: { createdAt: true } });
      expect(Math.abs(Date.now() - agency!.createdAt.getTime())).toBeLessThan(10 * 60_000);
    } finally {
      await app.$disconnect();
    }
  });

  it("makes a person who works for both agencies one user with two memberships", async () => {
    const owner = new pg.Client({ connectionString: db.ownerUrl });
    await owner.connect();
    const rows = await owner.query(`SELECT a.slug, m.role FROM memberships m JOIN agencies a ON a.id = m.agency_id WHERE m.user_id = $1 ORDER BY a.slug`, [
      seedUserId("rahul@freelance.test"),
    ]);
    const emails = await owner.query(`SELECT email FROM users`);
    await owner.end();
    expect(rows.rows).toEqual([
      { slug: "genie-magnet", role: "freelancer" },
      { slug: "zen-studio", role: "freelancer" },
    ]);
    // Nothing seeded can receive a real email.
    expect(emails.rows.every((r: { email: string }) => r.email.endsWith(".test"))).toBe(true);
  });
});
