// Background jobs (ADR 0010): the daily checks, retries, failures and the exceptions list, on the sample agencies.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { JobOverview, JobRow, NotificationList } from "@gm/shared";
import { genieMagnet, seedUserId, zenStudio } from "@gm/db/seed";
import { asSystem, TenantDb } from "../tenancy/tenant-context.js";
import { draftInvoice } from "../test/draft-invoice.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";
import { JobRunner } from "./job-runner.js";
import { JobsService } from "./jobs.service.js";

let t: SeededApp;
let runner: JobRunner;
let jana: Agent; // owner: settings, agreements and invoices
let ashwin: Agent; // manager
let karthik: Agent; // team leader: approves production
let divya: Agent; // editor
let anitha: Agent; // finance
let zara: Agent; // owner of the other agency
let clientId: string;
let agreementId: string;
const GM = genieMagnet.id;
const DIVYA = seedUserId("divya@geniemagnet.test");
const ASHWIN = seedUserId("ashwin@geniemagnet.test");
const dir = mkdtempSync(join(tmpdir(), "gm-jobs-"));

const at = (iso: string) => new Date(iso);
const titles = async (who: Agent) => ((await who.get("/notifications").expect(200)).body as NotificationList).items.map((n) => n.title);
const jobs = (sql: string, values: unknown[] = []) =>
  t.sql<{ name: string; status: string; attempts: number; last_error: string | null; key: string | null }>(sql, values);

beforeAll(async () => {
  t = await startSeededApp({ FILES_DIR: dir });
  runner = t.app.get(JobRunner);
  [jana, ashwin, karthik, divya, anitha] = await Promise.all(["jana", "ashwin", "karthik", "divya", "anitha"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  zara = await t.signInAs(zenStudio.people[0]!.email);
  // A client whose agreement runs through 2030 (well away from the sample data's dates), looked after by Ashwin.
  clientId = (
    await ashwin
      .post("/clients")
      .send({ name: "Vaigai Spices", code: "VGS", contacts: [{ name: "Selvi", phone: "+91 98400 33003", approver: true }] })
      .expect(201)
  ).body.id;
  await t.sql(`UPDATE clients SET account_owner_id = $1 WHERE id = $2`, [ASHWIN, clientId]);
  agreementId = (
    await ashwin
      .post(`/clients/${clientId}/agreements`)
      .send({
        title: "Vaigai · Reels",
        startDate: "2030-01-01",
        months: 12,
        monthlyFee: 30000,
        billing: "Monthly advance",
        revisionsPerDeliverable: 2,
        shootDays: 1,
        deliverables: [{ name: "Reels", perMonth: 4, kind: "video" }],
        platforms: ["instagram"],
      })
      .expect(201)
  ).body.id;
  await jana.post(`/agreements/${agreementId}/sign-off`).expect(200);
}, 180_000);

afterAll(async () => {
  await t?.stop();
  rmSync(dir, { recursive: true, force: true });
}, 60_000);

describe("daily jobs", () => {
  it("are queued once a day for every agency and run in the morning", async () => {
    expect(await runner.tick(at("2030-06-10T01:00:00Z"))).toBe(0); // queued for 02:30, not due yet
    expect(await runner.tick(at("2030-06-10T01:30:00Z"))).toBe(0);
    const queued = await jobs(`SELECT name, status FROM jobs WHERE key LIKE '%:2030-06-10'`);
    expect(queued).toHaveLength(22); // eleven daily jobs × two agencies, never twice
    expect(queued.every((j) => j.status === "queued")).toBe(true);

    expect(await runner.tick(at("2030-06-10T03:00:00Z"))).toBe(22);
    expect((await jobs(`SELECT name, status FROM jobs WHERE key LIKE '%:2030-06-10'`)).every((j) => j.status === "done")).toBe(true);
    const overview = (await jana.get("/jobs/overview").expect(200)).body as JobOverview;
    expect(overview.daily).toHaveLength(11);
    expect(overview.daily.every((d) => d.status === "done" && d.date === "2030-06-10")).toBe(true);
  });

  it("tell the editor a video is due tomorrow, and whoever approves production when it is late", async () => {
    const v = (await ashwin.post("/videos").send({ clientId, title: "Pepper harvest", format: "Reel", dueDate: "2030-06-12", editorId: DIVYA }).expect(201))
      .body as { code: string };
    await runner.tick(at("2030-06-11T03:00:00Z"));
    expect(await titles(divya)).toContain(`${v.code} is due tomorrow`);
    expect(await titles(karthik)).not.toContain(`${v.code} is due tomorrow`);

    await runner.tick(at("2030-06-13T03:00:00Z"));
    expect(await titles(divya)).toContain(`${v.code} is late`);
    expect(await titles(karthik)).toContain(`${v.code} is late`);
    // Once each: the next morning says nothing new.
    await runner.tick(at("2030-06-14T03:00:00Z"));
    expect((await titles(divya)).filter((x) => x.startsWith(v.code))).toHaveLength(2);
  });

  it("tell whoever looks after the client to send the onboarding reminder on its day", async () => {
    const o = (await ashwin.post(`/clients/${clientId}/onboarding`).send({}).expect(201)).body as { id: string };
    await ashwin.post(`/onboarding/${o.id}/link`).expect(200);
    await t.sql(`UPDATE questionnaire_responses SET sent_at = '2030-06-20T09:00:00Z' WHERE id = $1`, [o.id]);
    await runner.tick(at("2030-06-21T03:00:00Z")); // day 2
    expect(await titles(ashwin)).toContain("Send Vaigai Spices's day-2 onboarding reminder");
    await runner.tick(at("2030-06-27T03:00:00Z")); // day 8: past the 7-day window
    expect(await titles(jana)).toContain("Vaigai Spices's onboarding is past its 7 days");
  });

  it("tell whoever approves invoices when one becomes overdue", async () => {
    const inv = await draftInvoice(ashwin, agreementId, "2030-06");
    const issued = (await jana.post(`/invoices/${inv.id}/issue`).send({ issueDate: "2030-06-01" }).expect(200)).body as { number: string };
    await t.sql(`UPDATE invoices SET due_date = '2030-06-28' WHERE id = $1`, [inv.id]);
    await runner.tick(at("2030-06-29T03:00:00Z"));
    expect(await titles(anitha)).toContain(`${issued.number} for Vaigai Spices is overdue`);
  });

  it("set up each month, and on the 1st ask for last month to be closed", async () => {
    await runner.tick(at("2030-11-15T03:00:00Z"));
    expect(await t.sql(`SELECT 1 FROM cycles WHERE agreement_id = $1 AND month = '2030-11-01'`, [agreementId])).toHaveLength(1);
    await runner.tick(at("2030-12-01T03:00:00Z"));
    expect(await titles(jana)).toContain("November 2030 is over — 1 month waits to be closed");
  });

  it("tell whoever looks after the client when an agreement comes up for renewal, and when it ends without one", async () => {
    await runner.tick(at("2030-11-16T03:00:00Z")); // 45 days before 31 Dec 2030
    expect(await titles(ashwin)).toContain("Vaigai Spices: time to renew Vaigai · Reels");
    await runner.tick(at("2031-01-01T03:00:00Z"));
    expect(await titles(jana)).toContain("Vaigai Spices: Vaigai · Reels ended without a renewal");
  });

  it("clear uploads that never finished", async () => {
    await t.sql(
      `INSERT INTO files (id, agency_id, storage_key, name, mime, size, status, created_at)
       VALUES (gen_random_uuid(), $1, 'pending-stale', 'half.mp4', 'video/mp4', 10, 'pending', now() - interval '2 days')`,
      [GM],
    );
    await runner.tick(at("2031-01-02T03:00:00Z"));
    expect(await t.sql(`SELECT 1 FROM files WHERE storage_key = 'pending-stale'`)).toHaveLength(0);
  });
});

describe("a job that fails", () => {
  it("is tried again after 1 and 5 minutes, then kept as failed and the owner is told", async () => {
    await t.sql(`INSERT INTO jobs (id, agency_id, name, payload, max_attempts, run_at) VALUES (gen_random_uuid(), $1, 'videos.due', '{}', 3, '2031-02-01')`, [
      GM,
    ]);
    const T = at("2031-02-01T05:00:00Z");
    await runner.tick(T);
    let [j] = await jobs(`SELECT status, attempts, last_error FROM jobs WHERE run_at::date >= '2031-02-01' AND name = 'videos.due' AND key IS NULL`);
    expect(j).toMatchObject({ status: "queued", attempts: 1, last_error: "The job has no valid date." });
    await runner.tick(new Date(T.getTime() + 30_000)); // not yet: the next try is a minute later
    [j] = await jobs(`SELECT status, attempts FROM jobs WHERE name = 'videos.due' AND key IS NULL`);
    expect(j!.attempts).toBe(1);
    await runner.tick(new Date(T.getTime() + 61_000));
    await runner.tick(new Date(T.getTime() + 61_000 + 301_000));
    [j] = await jobs(`SELECT status, attempts FROM jobs WHERE name = 'videos.due' AND key IS NULL`);
    expect(j).toMatchObject({ status: "failed", attempts: 3 });
    expect(await titles(jana)).toContain("Background work failed: Videos due tomorrow, and videos now late");
  });

  it("fails at once when nothing knows how to run it", async () => {
    await t.sql(`INSERT INTO jobs (id, agency_id, name, payload, run_at) VALUES (gen_random_uuid(), $1, 'nothing.known', '{}', '2031-02-01')`, [GM]);
    await runner.tick(at("2031-02-02T05:00:00Z"));
    const [j] = await jobs(`SELECT status, attempts, last_error FROM jobs WHERE name = 'nothing.known'`);
    expect(j).toMatchObject({ status: "failed", attempts: 1, last_error: 'There is no job called "nothing.known".' });
  });

  it("is listed for the agency only, and can be tried again by someone who may change settings", async () => {
    const failed = (await jana.get("/jobs?status=failed").expect(200)).body as JobRow[];
    expect(failed.map((f) => f.name).sort()).toEqual(["nothing.known", "videos.due"]);
    expect(((await zara.get("/jobs?status=failed").expect(200)).body as JobRow[]).length).toBe(0);
    const id = failed.find((f) => f.name === "videos.due")!.id;
    await divya.get("/jobs").expect(403);
    await divya.post(`/jobs/${id}/retry`).expect(403);
    await zara.post(`/jobs/${id}/retry`).expect(404);
    expect(((await ashwin.post(`/jobs/${id}/retry`).expect(200)).body as JobRow).status).toBe("queued");
    await ashwin.post(`/jobs/${id}/retry`).expect(409);
  });

  it("left running by a runner that stopped goes back to the queue", async () => {
    await t.sql(
      `INSERT INTO jobs (id, agency_id, name, payload, status, attempts, locked_at, run_at, key)
       VALUES (gen_random_uuid(), $1, 'files.cleanup', '{}', 'running', 1, '2031-03-01T04:00:00Z', '2031-03-01T04:00:00Z', 'stuck')`,
      [GM],
    );
    await runner.tick(at("2031-03-01T04:30:00Z"));
    expect((await jobs(`SELECT status, attempts FROM jobs WHERE key = 'stuck'`))[0]).toMatchObject({ status: "done", attempts: 2 });
  });
});

describe("queuing a job", () => {
  it("with a key already queued for the agency adds nothing", async () => {
    const service = t.app.get(JobsService);
    const tenant = t.app.get(TenantDb);
    for (let i = 0; i < 2; i++) await asSystem(GM, () => tenant.tx((tx) => service.enqueue(tx, "files.cleanup", {}, { key: "once", runAt: at("2040-01-01") })));
    expect(await jobs(`SELECT key FROM jobs WHERE key = 'once'`)).toHaveLength(1);
  });
});
