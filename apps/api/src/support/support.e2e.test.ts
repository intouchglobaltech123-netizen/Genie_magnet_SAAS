// Support access (P6-08, ADR 0011): the agency lets the platform's support team in for some hours, seeing only or also
// fixing; the platform comes in only while that lasts, never to salaries or people's planners; every visit and change
// is in the agency's audit log; and it ends when the agency takes it back, the platform leaves, or the time is up.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Me, PlatformAgencyRow, SupportGrantRow } from "@gm/shared";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let zara: Agent; // owner of Zen Studio
let anitha: Agent; // the platform's own team on this server (and in Genie Magnet)
let divya: Agent; // editor at Genie Magnet
let zen: string;
let gm: string;
const me = async (a: Agent) => (await a.get("/me").expect(200)).body as Me;
const contact = [{ name: "Owner", phone: "+91 98400 77003", approver: true }];

beforeAll(async () => {
  t = await startSeededApp({ PLATFORM_ADMIN_EMAILS: "anitha@geniemagnet.test" });
  [zara, anitha, divya] = await Promise.all(["zara@zenstudio.test", "anitha@geniemagnet.test", "divya@geniemagnet.test"].map((e) => t.signInAs(e)));
  zen = (await me(zara)).activeAgencyId!;
  gm = (await me(anitha)).activeAgencyId!;
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("support access", () => {
  it("is the agency's to give; the platform comes in only while it lasts, and never to salaries or planners", async () => {
    expect((await anitha.post(`/platform/agencies/${zen}/support`).expect(409)).body.message).toBe(
      "This agency has not let support in, or its access has ended.",
    );
    await divya.post("/support-access").send({ hours: 2, level: "view", reason: "Look" }).expect(403);
    const granted = (await zara.post("/support-access").send({ hours: 2, level: "view", reason: "Invoices will not send" }).expect(201))
      .body as SupportGrantRow[];
    expect(granted[0]).toMatchObject({ level: "view", reason: "Invoices will not send", active: true, grantedBy: { name: "Zara Ahmed" } });
    const row = ((await anitha.get("/platform/agencies").expect(200)).body as PlatformAgencyRow[]).find((a) => a.id === zen)!;
    expect(row.support).toMatchObject({ level: "view" });

    await divya.post(`/platform/agencies/${zen}/support`).expect(403); // not the platform
    await anitha.post(`/platform/agencies/${zen}/support`).expect(200);
    expect(await me(anitha)).toMatchObject({
      activeAgencyId: zen,
      role: { key: "support", name: "Platform support" },
      support: { agencyId: zen, agencyName: "Zen Studio (test agency)", level: "view" },
    });
    expect(((await anitha.get("/clients").expect(200)).body as { code: string }[]).map((c) => c.code).sort()).toEqual(["KVR", "MBC"]);
    await anitha.post("/clients").send({ name: "Support Client", code: "SUP", contacts: contact }).expect(403); // seeing only
    await anitha.get("/payroll/salaries").expect(403);
    await anitha.get("/planner").expect(403);
    expect(await t.sql(`SELECT action FROM audit_logs WHERE agency_id = '${zen}' AND action = 'support_enter'`)).toHaveLength(1);
  });

  it("ends at once when the agency takes it back", async () => {
    const [grant] = (await zara.get("/support-access").expect(200)).body as SupportGrantRow[];
    await zara.post(`/support-access/${grant!.id}/revoke`).expect(200);
    expect(await me(anitha)).toMatchObject({ activeAgencyId: gm, support: null });
  });

  it("can let support fix things, each change marked in the audit log — but never its own access or the team", async () => {
    await zara.post("/support-access").send({ hours: 1, level: "edit", reason: "Fix the client's contacts" }).expect(201);
    await anitha.post(`/platform/agencies/${zen}/support`).expect(200);
    const made = (await anitha.post("/clients").send({ name: "Support Client", code: "SUP", contacts: contact }).expect(201)).body as { id: string };
    const [entry] = (await t.sql(`SELECT after FROM audit_logs WHERE agency_id = '${zen}' AND entity = 'client' AND entity_id = '${made.id}'`)) as {
      after: Record<string, unknown>;
    }[];
    expect(entry!.after).toMatchObject({ byPlatformSupport: true });
    expect((await anitha.post("/support-access").send({ hours: 72, level: "edit", reason: "More time" }).expect(403)).body.message).toBe(
      "Support cannot change its own access.",
    );
    await anitha.post("/team/invitations").send({ email: "someone@zenstudio.test", role: "editor" }).expect(403);
  });

  it("ends when the platform leaves, or when the time is up", async () => {
    await anitha.delete("/platform/support").expect(200);
    expect(await me(anitha)).toMatchObject({ activeAgencyId: gm, support: null });
    expect(await t.sql(`SELECT action FROM audit_logs WHERE agency_id = '${zen}' AND action = 'support_leave'`)).toHaveLength(1);

    await anitha.post(`/platform/agencies/${zen}/support`).expect(200);
    expect((await me(anitha)).activeAgencyId).toBe(zen);
    await t.sql(`UPDATE support_grants SET expires_at = now() - interval '1 minute' WHERE agency_id = '${zen}'`);
    expect(await me(anitha)).toMatchObject({ activeAgencyId: gm, support: null });
    await anitha.post(`/platform/agencies/${zen}/support`).expect(409);
  });

  it("is listed for the agency, with when support last came in", async () => {
    const rows = (await zara.get("/support-access").expect(200)).body as SupportGrantRow[];
    expect(rows.map((r) => [r.level, r.active, !!r.lastUsedAt, !!r.revokedAt])).toEqual([
      ["edit", false, true, false],
      ["view", false, true, true],
    ]);
  });
});
