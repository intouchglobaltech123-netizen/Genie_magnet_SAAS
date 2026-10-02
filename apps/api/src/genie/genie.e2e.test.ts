// Genie Assistant's rules (P4-01 to P4-04): each agency's thresholds, insights raised once and resolved by themselves,
// seen by the people who may see them, and acted on.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_PRODUCTION_SETTINGS, type GenieSettings, type InsightRow } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { JobRunner } from "../jobs/job-runner.js";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let jana: Agent; // owner: settings
let ashwin: Agent; // manager
let karthik: Agent; // team leader: production approve
let divya: Agent; // editor: only her own videos
let surya: Agent; // another editor
let runner: JobRunner;
let videoId: string;
let code: string;
const HOUR = 3_600_000;
/** The morning (03:00 UTC, after the daily jobs' time) a number of days from now. */
const morning = (days: number) => new Date(`${new Date(Date.now() + days * 24 * HOUR).toISOString().slice(0, 10)}T03:00:00Z`);
const insights = async (who: Agent, query = "") => (await who.get(`/genie/insights${query}`).expect(200)).body as InsightRow[];
const stuck = async (who: Agent, query = "") => (await insights(who, query)).filter((i) => i.rule === "video_stuck" && i.title.startsWith(code));

beforeAll(async () => {
  t = await startSeededApp();
  [jana, ashwin, karthik, divya, surya] = await Promise.all(["jana", "ashwin", "karthik", "divya", "surya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
  runner = t.app.get(JobRunner);
  const clientId = (
    await ashwin
      .post("/clients")
      .send({ name: "Erode Weaves", code: "ERW", contacts: [{ name: "Kumar", phone: "+91 98400 33003", approver: true }] })
      .expect(201)
  ).body.id as string;
  const v = (
    await ashwin
      .post("/videos")
      .send({ clientId, title: "Handloom, thread by thread", format: "Reel", dueDate: "2099-01-20", editorId: seedUserId("divya@geniemagnet.test") })
      .expect(201)
  ).body as { id: string; code: string };
  [videoId, code] = [v.id, v.code];
  await divya.post(`/videos/${videoId}/move`).send({ to: "shot" }).expect(200);
  await divya.put(`/videos/${videoId}/protect`).send({ done: true }).expect(200);
  await divya.post(`/videos/${videoId}/move`).send({ to: "editing" }).expect(200);
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("rules", () => {
  it("start from the defaults; the agency switches them and sets thresholds within each rule's range", async () => {
    const s = (await karthik.get("/genie/settings").expect(200)).body as GenieSettings;
    expect(s.rules.video_stuck).toEqual({ enabled: true, threshold: 3 });
    expect(s.rules.client_health).toEqual({ enabled: true, threshold: 60 });
    await karthik
      .put("/genie/settings")
      .send({ rules: { video_stuck: { enabled: true, threshold: 2 } } })
      .expect(403);
    const bad = await jana
      .put("/genie/settings")
      .send({ rules: { video_stuck: { enabled: true, threshold: 0 } } })
      .expect(400);
    expect(bad.body.issues).toEqual([{ path: "rules.video_stuck.threshold", message: "Between 1 and 30" }]);
    const saved = (
      await jana
        .put("/genie/settings")
        .send({ rules: { client_health: { enabled: true, threshold: 90 } } })
        .expect(200)
    ).body as GenieSettings;
    expect(saved.rules.client_health).toEqual({ enabled: true, threshold: 90 });
    expect(saved.rules.video_stuck).toEqual({ enabled: true, threshold: 3 });
  });
});

describe("insights", () => {
  it("are raised by the morning run once a video sits in one step too long, for the editor and the team leaders", async () => {
    await runner.tick(morning(1));
    expect(await stuck(karthik)).toEqual([]); // not three days yet
    await runner.tick(morning(4));
    const [i] = await stuck(karthik);
    expect(i).toMatchObject({
      severity: "warning",
      status: "open",
      title: expect.stringMatching(new RegExp(`^${code} has been in Editing for [34] days$`)),
      link: `/app/production/${videoId}`,
      client: { code: "ERW" },
      owner: { name: "Divya Lakshmi" },
    });
    for (const who of [karthik, divya]) {
      const n = (await who.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
      expect(n.filter((x) => x.kind === "genie_insight" && x.title === i!.title)).toHaveLength(1);
    }
  });

  it("are seen only by people who may see them — an editor sees their own videos only", async () => {
    expect(await stuck(divya)).toHaveLength(1);
    expect(await stuck(surya)).toEqual([]);
    expect((await insights(karthik)).some((i) => i.rule === "client_health" && i.title === "Kaveri Organics's health is 86")).toBe(true);
    expect((await insights(divya)).some((i) => i.rule === "client_health")).toBe(false); // editors do not see clients' health
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await insights(zara)).some((i) => i.title.startsWith(code))).toBe(false);
  });

  it("are kept up to date rather than raised again, and get worse with time", async () => {
    await runner.tick(morning(7));
    const [i] = await stuck(karthik);
    expect(i).toMatchObject({ severity: "critical", title: expect.stringMatching(/for [67] days$/) });
    const n = (await karthik.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.filter((x) => x.kind === "genie_insight" && x.title.startsWith(code))).toHaveLength(1);
  });

  it("are marked done or dismissed by the people who see them, and opened again", async () => {
    const [i] = await stuck(karthik);
    await surya.put(`/genie/insights/${i!.id}`).send({ status: "done" }).expect(404);
    await karthik.put(`/genie/insights/${i!.id}`).send({ status: "dismissed" }).expect(200);
    expect(await stuck(karthik)).toEqual([]);
    expect(await stuck(karthik, "?status=dismissed")).toHaveLength(1);
    await runner.tick(morning(8));
    expect(await stuck(karthik, "?status=dismissed")).toHaveLength(1); // stays as the person left it
    await karthik.put(`/genie/insights/${i!.id}`).send({ status: "open" }).expect(200);
    expect(await stuck(karthik, "?mine=1")).toEqual([]);
    expect(await stuck(divya, "?mine=1")).toHaveLength(1);
  });

  it("resolve by themselves when the rule no longer finds them, and come back if it does again", async () => {
    for (const step of DEFAULT_PRODUCTION_SETTINGS.editSteps) await divya.put(`/videos/${videoId}/edit-steps`).send({ step, done: true }).expect(200);
    await divya.post(`/videos/${videoId}/move`).send({ to: "internal_qc" }).expect(200);
    await karthik.post("/genie/run").expect(200);
    expect(await stuck(karthik)).toEqual([]);
    const [r] = await stuck(karthik, "?status=resolved");
    expect(r).toMatchObject({ status: "resolved", resolvedAt: expect.any(String) });
    // A new step that stalls is a new finding.
    await runner.tick(morning(12));
    expect((await stuck(karthik)).map((i) => i.title)).toEqual([expect.stringMatching(new RegExp(`^${code} has been in Internal QC for`))]);
  });

  it("stop when the rule is switched off", async () => {
    await jana
      .put("/genie/settings")
      .send({ rules: { video_stuck: { enabled: false, threshold: 3 } } })
      .expect(200);
    await karthik.post("/genie/run").expect(200);
    expect(await stuck(karthik)).toEqual([]);
  });
});

describe("other rules", () => {
  it("find a client waiting on a video, for whoever looks after clients", async () => {
    for (const q of DEFAULT_PRODUCTION_SETTINGS.qcChecks) await karthik.put(`/videos/${videoId}/qc`).send({ check: q.key, result: "pass" }).expect(200);
    await divya.post(`/videos/${videoId}/versions`).send({ link: "https://drive.example/erw-v1" }).expect(201);
    await divya.post(`/videos/${videoId}/versions/send`).expect(200);
    await runner.tick(morning(16));
    const all = await insights(ashwin);
    expect(all.find((i) => i.rule === "client_waiting" && i.title.startsWith("Erode Weaves has had"))).toMatchObject({
      title: expect.stringMatching(new RegExp(`^Erode Weaves has had ${code} \\(v1\\) for \\d+ days$`)),
      link: `/app/production/${videoId}`,
    });
    expect((await insights(divya)).some((i) => i.rule === "client_waiting")).toBe(false); // editors do not chase clients
  });
});
