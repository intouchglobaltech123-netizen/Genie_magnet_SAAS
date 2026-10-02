// The agency's own data (P6-10): the owner's full export — CSV per table and a JSON archive, its own records only,
// without secrets, bank numbers or anyone's personal planner — and deleting the workspace after a grace period the
// owner can stop, which removes everything the agency owns and nothing of anyone else.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataExportRow, Me, PlatformInvoiceRow, PlatformSettings, WorkspaceDeletion } from "@gm/shared";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";
import { unzip } from "../test/unzip.js";

let t: SeededApp;
let jana: Agent; // owner of Genie Magnet, and of the platform
let ashwin: Agent; // manager
let zara: Agent; // owner of Zen Studio
let gm: string;
let zen: string;
let ready: DataExportRow;
const dir = mkdtempSync(join(tmpdir(), "gm-data-"));
const me = async (a: Agent) => (await a.get("/me").expect(200)).body as Me;
const count = async (sql: string) => ((await t.sql(sql)) as { n: number }[])[0]!.n;

beforeAll(async () => {
  t = await startSeededApp({ FILES_DIR: dir, PLATFORM_ADMIN_EMAILS: "jana@geniemagnet.test" });
  [jana, ashwin, zara] = await Promise.all(["jana@geniemagnet.test", "ashwin@geniemagnet.test", "zara@zenstudio.test"].map((e) => t.signInAs(e)));
  gm = (await me(jana)).activeAgencyId!;
  zen = (await me(zara)).activeAgencyId!;
  await jana
    .put("/planner")
    .send({
      setup: {
        name: "Janarthanan",
        age: 38,
        monthlyIncome: 150000,
        retireAge: 55,
        inflation: 7,
        expectedReturn: 12,
        postRetirementReturn: 6,
        monthlySip: 20000,
      },
      log: [],
      answers: {},
    })
    .expect(200);
}, 180_000);

afterAll(async () => {
  await t?.stop();
  rmSync(dir, { recursive: true, force: true });
}, 60_000);

describe("the export", () => {
  it("is the owner's to ask for, and is made in the background", async () => {
    expect((await ashwin.post("/data/exports").expect(403)).body.message).toBe("Only the agency's owner can do this.");
    const asked = (await jana.post("/data/exports").expect(201)).body as DataExportRow[];
    expect(asked[0]).toMatchObject({ status: "queued", requestedBy: { name: "Janarthanan" } });
    await jana.post("/data/exports").expect(409);
    await t.app.get(JobRunner).tick(new Date(Date.now() + 60_000));
    [ready] = (await jana.get("/data/exports").expect(200)).body as DataExportRow[];
    expect(ready).toMatchObject({ status: "ready", error: null });
    expect(ready.tables).toBeGreaterThan(30);
    expect(ready.rows).toBeGreaterThan(50);
    const n = (await jana.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "data_export")?.title).toBe("Your agency's export is ready");
  });

  it("has every table as CSV and all of it as JSON — its own records, without secrets or anyone's planner", async () => {
    const res = await jana
      .get(`/data/exports/${ready.id}/download`)
      .buffer(true)
      .parse((r, done) => {
        const chunks: Buffer[] = [];
        r.on("data", (c: Buffer) => chunks.push(c));
        r.on("end", () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers["content-type"]).toBe("application/zip");
    const istToday = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
    expect(res.headers["content-disposition"]).toBe(`attachment; filename="genie-magnet-export-${istToday}.zip"`);
    const files = unzip(res.body as Buffer);
    const names = files.map((f) => f.name);
    expect(names).toEqual(expect.arrayContaining(["README.txt", "data.json", "csv/clients.csv", "csv/audit_logs.csv"]));
    expect(names).not.toContain("csv/personal_planners.csv");
    expect(names).not.toContain("csv/jobs.csv");
    const clients = files.find((f) => f.name === "csv/clients.csv")!.data.toString("utf8");
    expect(clients).toContain("Kaveri Organics");
    expect(clients.startsWith("\uFEFFid,")).toBe(true); // so Excel reads it as UTF-8
    const data = JSON.parse(files.find((f) => f.name === "data.json")!.data.toString("utf8")) as Record<string, Record<string, unknown>[]>;
    expect(data.clients!.length).toBe(5); // Genie Magnet's own five, none of Zen Studio's
    expect(data.clients!.every((c) => c.agency_id === gm)).toBe(true);
    const text = JSON.stringify(data);
    for (const secret of ['"access_token"', '"key_secret"', '"webhook_secret"', '"bank_account"', '"pan"', '"storage_key"']) expect(text).not.toContain(secret);
    expect(text).not.toContain("monthlySip");

    await zara.get(`/data/exports/${ready.id}/download`).expect(404); // another agency's
    await ashwin.get(`/data/exports/${ready.id}/download`).expect(403);
  });
});

describe("deleting the workspace", () => {
  it("is the owner's to ask for, typing the agency's name, and can be stopped during the grace period", async () => {
    await jana.post("/data/deletion").send({ confirm: "Zen Studio (test agency)" }).expect(400); // not her agency's name
    await ashwin.post("/data/deletion").send({ confirm: "Genie Magnet" }).expect(403);
    const asked = (await zara.post("/data/deletion").send({ confirm: "zen studio (test agency)" }).expect(201)).body as WorkspaceDeletion;
    const days = (new Date(asked.deleteAfter).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(29.9);
    expect((await me(zara)).deletion).toMatchObject({ requestedBy: { name: "Zara Ahmed" } });
    await zara.delete("/data/deletion").expect(200);
    expect((await me(zara)).deletion).toBeNull();
  });

  it("tells the people who look after the settings, both when it is asked for and when it is stopped", async () => {
    const asked = (await jana.post("/data/deletion").send({ confirm: "Genie Magnet" }).expect(201)).body as WorkspaceDeletion;
    const day = new Date(asked.deleteAfter).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
    const notices = async () =>
      ((await ashwin.get("/notifications").expect(200)).body.items as { kind: string; title: string }[]).filter((n) => n.kind === "workspace_deletion");
    expect((await notices()).map((n) => n.title)).toEqual([`Genie Magnet will be deleted on ${day}`]);
    await jana.delete("/data/deletion").expect(200);
    expect((await notices()).map((n) => n.title)).toEqual(["Genie Magnet will not be deleted", `Genie Magnet will be deleted on ${day}`]);
  });

  it("removes everything the agency owns when it is due, and nothing of anyone else", async () => {
    // Nothing is deleted before its time.
    await expect(t.sql(`SELECT app_purge_agency('${gm}')`)).rejects.toThrow(/not due to be deleted/);
    const gmClients = await count(`SELECT count(*)::int AS n FROM clients WHERE agency_id = '${gm}'`);
    expect(await count(`SELECT count(*)::int AS n FROM clients WHERE agency_id = '${zen}'`)).toBeGreaterThan(0);
    // Zen Studio pays us for a plan (pretend billing issues our invoice at once).
    const settings = (await jana.get("/platform/settings").expect(200)).body as PlatformSettings;
    await jana
      .put("/platform/settings")
      .send({ ...settings, plans: settings.plans.map((p) => (p.key === "growth" ? { ...p, priceInr: 4999 } : p)) })
      .expect(200);
    await zara.post("/plan/choose").send({ plan: "growth", currency: "INR" }).expect(200);
    const invoices = async () => ((await jana.get("/platform/invoices").expect(200)).body as PlatformInvoiceRow[]).filter((i) => i.agency.id === zen);
    const [billed] = await invoices();
    expect(billed).toBeDefined();

    await zara.post("/data/deletion").send({ confirm: "Zen Studio (test agency)" }).expect(201);
    await t.sql(`UPDATE workspace_deletions SET delete_after = now() - interval '1 minute' WHERE agency_id = '${zen}'`);
    await t.app.get(JobRunner).tick(new Date(Date.now() + 2 * 3_600_000)); // the hourly sweep

    for (const table of ["agencies", "clients", "memberships", "audit_logs", "roles", "workspace_deletions"])
      expect(await count(`SELECT count(*)::int AS n FROM ${table} WHERE ${table === "agencies" ? "id" : "agency_id"} = '${zen}'`)).toBe(0);
    expect((await me(zara)).agencies).toEqual([]);
    // Our invoice to it stays, for our accounts, under the name it was billed as.
    expect(await invoices()).toEqual([{ ...billed, agency: { id: zen, name: billed!.buyer.name } }]);
    // Genie Magnet is untouched.
    expect(await count(`SELECT count(*)::int AS n FROM clients WHERE agency_id = '${gm}'`)).toBe(gmClients);
    expect((await me(jana)).activeAgencyId).toBe(gm);
  });
});
