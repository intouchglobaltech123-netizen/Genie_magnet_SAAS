// Self-service imports (P1-31): clients, team, videos and agreements from a spreadsheet, checked, all-or-nothing, with undo
// and a check report for each import (P3-12).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ImportDetail, ImportReport } from "@gm/shared";
import { genieMagnet, seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";
import { dateText } from "./check-report.js";

let t: SeededApp;
let jana: Agent;
let ashwin: Agent;

beforeAll(async () => {
  t = await startSeededApp();
  jana = await t.signInAs("jana@geniemagnet.test");
  ashwin = await t.signInAs("ashwin@geniemagnet.test");
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

const row = (name: string, code: string, extra: Record<string, unknown> = {}) => ({
  name,
  code,
  city: "Madurai",
  contacts: [{ name: `${name} Owner`, phone: "9443055101", approver: true }],
  ...extra,
});
type Client = { code: string; accountOwnerId: string | null };
const codes = async (a: Agent) => ((await a.get("/clients").expect(200)).body as Client[]).map((c) => c.code).sort();

describe("importing clients", () => {
  it("refuses the whole file when any row has a problem, and says which row and column", async () => {
    const res = await ashwin
      .post("/imports/clients")
      .send({
        fileName: "clients.xlsx",
        rows: [
          row("Thendral Foods", "THF"),
          row("Kovai Cotton", "KVR"), // KVR is Kaveri Organics'
          row("Thendral Foods Two", "THF"), // same code as row 1
          row("Kaveri Organics", "KOR"), // already a client
          row("Malar Studio", "MLS", { accountOwnerEmail: "nobody@geniemagnet.test" }),
        ],
      })
      .expect(400);
    expect(res.body.message).toBe("4 problems in the rows — nothing was imported.");
    expect(res.body.issues).toEqual([
      { path: "rows.1.code", message: "Code KVR is already used by Kaveri Organics" },
      { path: "rows.2.code", message: "Same code as row 1" },
      { path: "rows.3.name", message: "Already in your clients" },
      { path: "rows.4.accountOwnerEmail", message: "No one in your team has this email" },
    ]);
    expect(await codes(ashwin)).toEqual(["BPA", "KVR", "NVD", "SLS", "UNR"]);
  });

  let importId: string;

  it("imports every row in one go, with account owners, and keeps it in the history", async () => {
    const res = await ashwin
      .post("/imports/clients")
      .send({
        fileName: "clients.xlsx",
        rows: [row("Thendral Foods", "THF", { accountOwnerEmail: "Priya@GenieMagnet.test" }), row("Malar Studio", "MLS")],
      })
      .expect(201);
    importId = res.body.id;
    expect(res.body.created).toBe(2);

    const clients = (await ashwin.get("/clients").expect(200)).body as (Client & { name: string })[];
    expect(clients.find((c) => c.code === "THF")?.accountOwnerId).toBe(seedUserId("priya@geniemagnet.test"));
    const [entry] = (await ashwin.get("/imports").expect(200)).body;
    expect(entry).toMatchObject({ id: importId, kind: "clients", fileName: "clients.xlsx", rowCount: 2, createdBy: "Ashwin", canUndo: true, undoneAt: null });
    const audit = (await jana.get("/audit?entity=client&limit=5").expect(200)).body.items as { after: { via?: string } }[];
    expect(audit.filter((e) => e.after?.via === "clients.xlsx")).toHaveLength(2);
  });

  it("can be undone once, within 24 hours", async () => {
    expect((await ashwin.delete(`/imports/${importId}`).expect(200)).body).toMatchObject({ removed: 2, kept: 0 });
    expect(await codes(ashwin)).toEqual(["BPA", "KVR", "NVD", "SLS", "UNR"]);
    await ashwin.delete(`/imports/${importId}`).expect(409);

    const again = (
      await ashwin
        .post("/imports/clients")
        .send({ fileName: "late.csv", rows: [row("Late Client", "LTC")] })
        .expect(201)
    ).body;
    await t.sql(`UPDATE imports SET created_at = now() - interval '25 hours' WHERE id = $1`, [again.id]);
    expect((await ashwin.delete(`/imports/${again.id}`).expect(409)).body.message).toBe("Imports can be undone for 24 hours only.");
  });

  it("is not undone once its clients have been worked on", async () => {
    const res = (
      await ashwin
        .post("/imports/clients")
        .send({ fileName: "busy.xlsx", rows: [row("Busy Client", "BSY")] })
        .expect(201)
    ).body;
    const [client] = await t.sql<{ id: string }>(`SELECT id FROM clients WHERE code = 'BSY' AND agency_id = $1`, [genieMagnet.id]);
    await t.sql(`INSERT INTO audit_logs (id, agency_id, action, entity, entity_id) VALUES (gen_random_uuid(), $1, 'update', 'client', $2)`, [
      genieMagnet.id,
      client!.id,
    ]);
    await ashwin.delete(`/imports/${res.id}`).expect(409);
  });

  it("needs edit on clients", async () => {
    const divya = await t.signInAs("divya@geniemagnet.test"); // editors only view clients
    await divya
      .post("/imports/clients")
      .send({ fileName: "x.csv", rows: [row("Nope", "NOP")] })
      .expect(403);
    expect((await divya.get("/imports").expect(200)).body).toEqual([]);
  });
});

describe("importing the team", () => {
  it("turns rows into invitations, and checks roles and people first", async () => {
    const bad = await ashwin
      .post("/imports/team")
      .send({
        fileName: "team.xlsx",
        rows: [
          { email: "new.one@geniemagnet.test", role: "editor" },
          { email: "divya@geniemagnet.test", role: "editor" }, // already a member
          { email: "boss@geniemagnet.test", role: "owner" }, // managers cannot make owners
          { email: "x@geniemagnet.test", role: "astronaut" },
          { email: "NEW.ONE@geniemagnet.test", role: "shooter" },
        ],
      })
      .expect(400);
    expect((bad.body.issues as { path: string }[]).map((i) => i.path)).toEqual(["rows.1.email", "rows.2.role", "rows.3.role", "rows.4.email"]);

    const ok = await ashwin
      .post("/imports/team")
      .send({
        fileName: "team.xlsx",
        rows: [
          { email: "new.one@geniemagnet.test", role: "editor" },
          { email: "new.two@geniemagnet.test", role: "team_leader" },
        ],
      })
      .expect(201);
    const team = (await ashwin.get("/team").expect(200)).body as { invitations: { email: string; role: { key: string }; link: string }[] };
    expect(team.invitations.map((i) => `${i.email}:${i.role.key}`).sort()).toEqual(["new.one@geniemagnet.test:editor", "new.two@geniemagnet.test:team_leader"]);

    // Undo cancels the invitations still waiting.
    expect((await ashwin.delete(`/imports/${ok.body.id}`).expect(200)).body).toMatchObject({ removed: 2, kept: 0 });
    expect(((await ashwin.get("/team").expect(200)).body as { invitations: unknown[] }).invitations).toEqual([]);
  });

  it("needs edit on the team", async () => {
    const harini = await t.signInAs("harini@geniemagnet.test"); // HR sees the team but cannot invite
    await harini
      .post("/imports/team")
      .send({ fileName: "t.csv", rows: [{ email: "z@geniemagnet.test", role: "editor" }] })
      .expect(403);
  });
});

describe("importing videos in progress", () => {
  type Video = { id: string; code: string; stage: string; editor: { name: string | null } | null; protected: boolean; clipNo: string | null };
  const v = (title: string, extra: Record<string, unknown> = {}) => ({ clientCode: "KVR", title, format: "Reel", dueDate: "2026-12-20", ...extra });
  let importId: string;

  it("refuses the file when a client, format, editor or code is wrong", async () => {
    const res = await ashwin
      .post("/imports/videos")
      .send({
        fileName: "tracking.xlsx",
        rows: [
          v("Unknown client", { clientCode: "ZZZ" }),
          v("Odd format", { format: "Hologram" }),
          v("Stranger edits", { editorEmail: "stranger@example.com" }),
          v("Twice A", { code: "KVR-1226-90" }),
          v("Twice B", { code: "KVR-1226-90" }),
        ],
      })
      .expect(400);
    expect((res.body.issues as { path: string }[]).map((i) => i.path)).toEqual(["rows.0.clientCode", "rows.1.format", "rows.2.editorEmail", "rows.4.code"]);
    expect(((await ashwin.get("/videos?clientId=").expect(200)).body as Video[]).some((x) => x.code === "KVR-1226-90")).toBe(false);
  });

  it("brings each video in at its stage, keeps its own code, and counts earlier work as done", async () => {
    const res = await ashwin
      .post("/imports/videos")
      .send({
        fileName: "tracking.xlsx",
        rows: [
          v("Turmeric story", { code: "KVR-1226-90", stage: "editing", editorEmail: "divya@geniemagnet.test", clipNo: "C0012–C0019", footageProtected: true }),
          v("Millet laddu", { stage: "client_review", urgency: "rush" }),
          v("Festive hamper", {}),
        ],
      })
      .expect(201);
    expect(res.body.created).toBe(3);
    importId = res.body.id;
    const all = (await ashwin.get("/videos").expect(200)).body as Video[];
    const turmeric = all.find((x) => x.code === "KVR-1226-90")!;
    expect(turmeric).toMatchObject({ stage: "editing", editor: { name: "Divya Lakshmi" }, protected: true, clipNo: "C0012–C0019" });
    const laddu = all.find((x) => x.code !== "KVR-1226-90" && x.stage === "client_review")!;
    const detail = (await ashwin.get(`/videos/${laddu.id}`).expect(200)).body as { qc: { result: string | null }[]; editSteps: { done: boolean }[] };
    expect(detail.qc.every((c) => c.result === "pass")).toBe(true);
    expect(detail.editSteps.every((s) => s.done)).toBe(true);
    // Nobody is told about imported videos.
    const divya = await t.signInAs("divya@geniemagnet.test");
    expect(((await divya.get("/notifications").expect(200)).body as { items: { title: string }[] }).items.some((n) => n.title.includes("KVR-1226-90"))).toBe(
      false,
    );
  });

  it("is undone while nobody has worked on its videos", async () => {
    await ashwin.delete(`/imports/${importId}`).expect(200);
    expect(((await ashwin.get("/videos").expect(200)).body as Video[]).some((x) => x.code === "KVR-1226-90")).toBe(false);

    const again = (
      await ashwin
        .post("/imports/videos")
        .send({ fileName: "tracking-2.xlsx", rows: [v("Pepper drying", { stage: "shot" })] })
        .expect(201)
    ).body;
    const [video] = ((await ashwin.get("/videos").expect(200)).body as (Video & { title?: string })[]).filter((x) => x.stage === "shot");
    await ashwin.put(`/videos/${video!.id}/protect`).send({ done: true }).expect(200);
    expect((await ashwin.delete(`/imports/${again.id}`).expect(409)).body.message).toMatch(/worked on/);
  });

  it("needs a role that changes every video", async () => {
    const divya = await t.signInAs("divya@geniemagnet.test");
    await divya
      .post("/imports/videos")
      .send({ fileName: "x.xlsx", rows: [v("Mine")] })
      .expect(403);
  });
});

describe("importing agreements", () => {
  const d = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
  type Agreement = { id: string; title: string; status: string; endDate: string; signedBy: { name: string | null } | null; client: { code: string } };
  let starter: { id: string; name: string };
  let importId: string;
  const terms = { billing: "Monthly advance", revisionsPerDeliverable: 2, shootDays: 1, deliverables: [{ name: "Reels", perMonth: 8, kind: "video" }] };
  const a = (clientCode: string, title: string, extra: Record<string, unknown> = {}) => ({
    clientCode,
    title,
    startDate: d(-30),
    endDate: d(300),
    monthlyFee: 50000,
    ...terms,
    ...extra,
  });

  beforeAll(async () => {
    starter = ((await ashwin.get("/packages").expect(200)).body as { id: string; name: string }[]).find((p) => p.name === "Social Starter Pack")!;
  });

  it("refuses the file when a client is unknown, a start date is taken, or the role cannot sign them off", async () => {
    const res = await ashwin
      .post("/imports/agreements")
      .send({
        fileName: "agreements.xlsx",
        lines: [2, 3, 4],
        rows: [a("ZZZ", "Nobody"), a("KVR", "Kaveri again", { startDate: "2026-04-01" }), a("NVD", "Fine")],
      })
      .expect(400);
    expect(res.body.issues).toEqual([
      { path: "rows.0.clientCode", message: "No client with the code ZZZ" },
      { path: "rows.1.startDate", message: "Kaveri Organics already has an agreement starting on this day" },
    ]);
    const twice = await ashwin
      .post("/imports/agreements")
      .send({ fileName: "agreements.xlsx", lines: [7, 9], rows: [a("NVD", "Twice"), a("NVD", "Twice again")] })
      .expect(400);
    expect(twice.body.issues).toEqual([{ path: "rows.1.startDate", message: "Same client and start date as row 7" }]);

    // A role that changes agreements but does not sign them off brings in drafts only.
    await jana
      .post("/roles")
      .send({ name: "Account handler", permissions: { clients: { level: "view" }, agreements: { level: "edit" } } })
      .expect(201);
    const team = (await jana.get("/team").expect(200)).body as { members: { id: string; user: { email: string } }[] };
    const surya = team.members.find((m) => m.user.email === "surya@geniemagnet.test")!;
    await jana.patch(`/team/members/${surya.id}`).send({ role: "account_handler" }).expect(200);
    const handler = await t.signInAs("surya@geniemagnet.test");
    const refused = await handler
      .post("/imports/agreements")
      .send({ fileName: "a.xlsx", rows: [a("NVD", "Running one")] })
      .expect(400);
    expect(refused.body.issues).toEqual([{ path: "rows.0.status", message: "Your role cannot sign off agreements — import it as a draft" }]);
    const priya = await t.signInAs("priya@geniemagnet.test"); // team leader: sees agreements only
    await priya
      .post("/imports/agreements")
      .send({ fileName: "a.xlsx", rows: [a("NVD", "Draft", { status: "draft" })] })
      .expect(403);
  });

  it("brings each agreement in as it stands, with a check report to compare with the sheet", async () => {
    const res = await ashwin
      .post("/imports/agreements")
      .send({
        fileName: "running-agreements.xlsx",
        lines: [2, 3, 5, 6],
        leftOut: [{ line: 4, problems: ['Client: No client called "Zed Foods"'] }],
        rows: [
          a("SLS", "Sri Lakshmi · Wedding season", { endDate: d(20), packageId: starter.id, monthlyFee: 60000, platforms: ["instagram"] }),
          a("NVD", "Navadhanya · Podcast", { startDate: d(10), endDate: d(375), status: "draft" }),
          a("BPA", "Bharath · Clinic films", { startDate: d(-200), endDate: d(100), status: "ended", monthlyFee: 40000 }),
          a("SLS", "Sri Lakshmi · Old retainer", { startDate: d(-400), endDate: d(-10), monthlyFee: 30000 }),
        ],
      })
      .expect(201);
    importId = res.body.id;
    const report = res.body.report as ImportReport;
    expect(report).toMatchObject({ rows: 5, imported: 4, leftOut: [{ line: 4, problems: ['Client: No client called "Zed Foods"'] }] });
    expect(Object.fromEntries(report.totals.map((x) => [x.label, x.value]))).toEqual({
      Agreements: "4",
      Running: "2",
      Ended: "1",
      Draft: "1",
      Clients: "3",
      "Monthly fees, all rows": "₹1,80,000",
      "Monthly fees, running": "₹90,000",
      "Videos a month, running": "16",
      "Posts and stories a month, running": "0",
    });
    const notes = report.notes.map((n) => `${n.line}: ${n.text}`);
    expect(notes).toEqual(
      expect.arrayContaining([
        `2: Sri Lakshmi · Wedding season: ends on ${dateText(d(20))}, so it is due for renewal`,
        "2: Sri Lakshmi · Wedding season: the fee ₹60,000 is not the Social Starter Pack package's ₹65,000",
        `5: Bharath · Clinic films: marked ended, so it ends on ${dateText(d(0))} instead of ${dateText(d(100))}`,
        `6: Sri Lakshmi · Old retainer: its end date (${dateText(d(-10))}) has passed but it is marked running — end it or renew it`,
        "6: Sri Lakshmi · Old retainer: runs at the same time as Sri Lakshmi · Wedding season for Sri Lakshmi Silks",
      ]),
    );

    const running = (await ashwin.get("/agreements?status=active").expect(200)).body as Agreement[];
    expect(running.find((x) => x.title === "Sri Lakshmi · Wedding season")).toMatchObject({ status: "active", signedBy: { name: "Ashwin" } });
    const ended = (await ashwin.get("/agreements?status=ended").expect(200)).body as Agreement[];
    expect(ended.find((x) => x.title === "Bharath · Clinic films")).toMatchObject({ endDate: d(0) });
    const drafts = (await ashwin.get("/agreements?status=draft").expect(200)).body as Agreement[];
    expect(drafts.find((x) => x.title === "Navadhanya · Podcast")).toMatchObject({ signedBy: null });
    const n = (await jana.get("/notifications").expect(200)).body.items as { title: string; link: string }[];
    expect(n.find((x) => x.title === "1 imported agreement to sign off")).toMatchObject({ link: "/app/agreements?view=drafts" });
  });

  it("keeps the report with the import, for whoever may change agreements", async () => {
    const list = (await ashwin.get("/imports").expect(200)).body as ImportDetail[];
    expect(list.find((i) => i.id === importId)).toMatchObject({ kind: "agreements", rowCount: 4, hasReport: true });
    const one = (await ashwin.get(`/imports/${importId}`).expect(200)).body as ImportDetail;
    expect(one.report).toMatchObject({ rows: 5, imported: 4 });
    const divya = await t.signInAs("divya@geniemagnet.test");
    await divya.get(`/imports/${importId}`).expect(404);
    const zara = await t.signInAs("zara@zenstudio.test");
    await zara.get(`/imports/${importId}`).expect(404);
  });

  it("is undone while untouched, and not once an agreement is signed off", async () => {
    await ashwin.delete(`/imports/${importId}`).expect(200);
    const all = (await ashwin.get("/agreements").expect(200)).body as Agreement[];
    expect(all.some((x) => x.title === "Navadhanya · Podcast" || x.title === "Sri Lakshmi · Old retainer")).toBe(false);

    const again = (
      await ashwin
        .post("/imports/agreements")
        .send({ fileName: "drafts.xlsx", rows: [a("NVD", "Navadhanya · Podcast", { status: "draft" })] })
        .expect(201)
    ).body as { id: string };
    const draft = ((await ashwin.get("/agreements?status=draft").expect(200)).body as Agreement[]).find((x) => x.title === "Navadhanya · Podcast")!;
    await jana.post(`/agreements/${draft.id}/sign-off`).expect(200);
    expect((await ashwin.delete(`/imports/${again.id}`).expect(409)).body.message).toMatch(/worked on/);
  });
});
