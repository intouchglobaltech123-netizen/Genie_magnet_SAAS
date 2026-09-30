// Cross-tenant suite: proves one agency can never read or change another agency's rows.
// Runs in CI on every pull request; a failure here blocks the merge.
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrisma, forAgency, TenancyError, withAgency } from "./index.js";
import { startTestDatabase, type TestDatabase } from "./test/database.js";

const A = "0190f5a0-0000-7000-8000-00000000000a"; // Genie Magnet
const B = "0190f5a0-0000-7000-8000-00000000000b"; // another agency on the SaaS

let db: TestDatabase;
let prisma: ReturnType<typeof createPrisma>;
let clientA: string;
let clientB: string;

beforeAll(async () => {
  db = await startTestDatabase();
  // Seed as the schema owner (superuser locally / in CI), which bypasses RLS.
  const owner = new pg.Client({ connectionString: db.ownerUrl });
  await owner.connect();
  await owner.query(`INSERT INTO agencies (id, name, slug) VALUES ($1, 'Genie Magnet', 'genie-magnet'), ($2, 'Other Agency', 'other')`, [A, B]);
  const a = await owner.query(`INSERT INTO clients (id, agency_id, code, name) VALUES (gen_random_uuid(), $1, 'KVR', 'Kaveri Organics') RETURNING id`, [A]);
  const b = await owner.query(`INSERT INTO clients (id, agency_id, code, name) VALUES (gen_random_uuid(), $1, 'ZEN', 'Zen Studio') RETURNING id`, [B]);
  clientA = a.rows[0].id;
  clientB = b.rows[0].id;
  await owner.query(`INSERT INTO audit_logs (id, agency_id, action, entity) VALUES (gen_random_uuid(), $1, 'create', 'client')`, [A]);
  await owner.end();
  prisma = createPrisma(db.appUrl);
}, 180_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await db?.stop();
}, 60_000);

describe("row-level security", () => {
  it("returns nothing when no agency is set", async () => {
    expect(await prisma.client.findMany()).toEqual([]);
    expect(await prisma.agency.findMany()).toEqual([]);
  });

  it("returns only the current agency's rows", async () => {
    const rows = await forAgency(prisma, A).client.findMany();
    expect(rows.map((r) => r.id)).toEqual([clientA]);
    const agencies = await forAgency(prisma, A).agency.findMany();
    expect(agencies.map((r) => r.id)).toEqual([A]);
  });

  it("cannot read another agency's row by id", async () => {
    expect(await forAgency(prisma, A).client.findUnique({ where: { id: clientB } })).toBeNull();
  });

  it("cannot update or delete another agency's rows", async () => {
    const upd = await forAgency(prisma, A).client.updateMany({ where: { id: clientB }, data: { name: "Hacked" } });
    expect(upd.count).toBe(0);
    const del = await forAgency(prisma, A).client.deleteMany({ where: { id: clientB } });
    expect(del.count).toBe(0);
    const still = await forAgency(prisma, B).client.findUnique({ where: { id: clientB } });
    expect(still?.name).toBe("Zen Studio");
  });

  it("cannot write a row into another agency", async () => {
    await expect(forAgency(prisma, A).client.create({ data: { agencyId: B, code: "BAD", name: "Planted" } })).rejects.toThrow();
  });

  it("creates rows inside the current agency", async () => {
    const created = await forAgency(prisma, A).client.create({ data: { agencyId: A, code: "SLS", name: "Sri Lakshmi Silks" } });
    expect(created.agencyId).toBe(A);
    expect(await forAgency(prisma, B).client.findUnique({ where: { id: created.id } })).toBeNull();
  });

  it("keeps the agency for every step of a transaction", async () => {
    const count = await withAgency(prisma, B, async (tx) => {
      await tx.contact.create({ data: { agencyId: B, clientId: clientB, name: "Asha", phone: "+91 90000 00000", approver: true } });
      return tx.contact.count();
    });
    expect(count).toBe(1);
    expect(await forAgency(prisma, A).contact.count()).toBe(0);
  });

  it("keeps the audit log append-only", async () => {
    await expect(forAgency(prisma, A).auditLog.updateMany({ data: { action: "tampered" } })).rejects.toThrow();
    await expect(forAgency(prisma, A).auditLog.deleteMany()).rejects.toThrow();
  });

  it("rejects a missing or malformed agency id before touching the database", () => {
    expect(() => forAgency(prisma, "")).toThrow(TenancyError);
    expect(() => forAgency(prisma, "1 OR 1=1")).toThrow(TenancyError);
  });
});

describe("schema guard", () => {
  it("has row-level security forced on every table with agency_id", async () => {
    const owner = new pg.Client({ connectionString: db.ownerUrl });
    await owner.connect();
    const { rows } = await owner.query(`
      SELECT c.relname, c.relrowsecurity AS enabled, c.relforcerowsecurity AS forced,
             EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS has_policy
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
      WHERE c.relkind = 'r'
        AND EXISTS (SELECT 1 FROM information_schema.columns col WHERE col.table_name = c.relname AND col.column_name = 'agency_id')`);
    await owner.end();
    expect(rows.length).toBeGreaterThan(20);
    const unsafe = rows.filter((r) => !r.enabled || !r.forced || !r.has_policy).map((r) => r.relname);
    expect(unsafe).toEqual([]);
  });
});
