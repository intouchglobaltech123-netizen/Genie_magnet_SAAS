// SOPs and checklists (P5-17): an SOP with its doer, checker and approver, linked to a KRA;
// versions approved before use; checklist runs checked, failures counted in the reviews; new versions replacing old.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { KraTemplateRow, MeetingRow, SopRow, SopRunRow } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let ashwin: Agent; // manager: approves
let harini: Agent; // HR: KRAs
let karthik: Agent; // team leader: owns the SOP
let vignesh: Agent; // shooter: does it
let divya: Agent; // editor: checks it
let surya: Agent; // editor
let sop: SopRow;
let run: SopRunRow;
const ASHWIN = seedUserId("ashwin@geniemagnet.test");
const KARTHIK = seedUserId("karthik@geniemagnet.test");
const VIGNESH = seedUserId("vignesh@geniemagnet.test");
const DIVYA = seedUserId("divya@geniemagnet.test");
const CHECKS = [
  { key: "batteries", text: "Batteries charged" },
  { key: "cards", text: "Memory cards empty and formatted" },
  { key: "lights", text: "Lights and stands packed" },
];

beforeAll(async () => {
  t = await startSeededApp();
  [ashwin, harini, karthik, vignesh, divya, surya] = await Promise.all(
    ["ashwin", "harini", "karthik", "vignesh", "divya", "surya"].map((p) => t.signInAs(`${p}@geniemagnet.test`)),
  );
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("an SOP", () => {
  it("is set up with who does, checks and approves it, and the KRA it serves", async () => {
    const kras = (
      await harini
        .post("/performance/templates")
        .send({ name: "Camera", kras: [{ key: "kit", name: "Kit ready on time", target: 95, weight: 100, metric: "checklists_passed" }] })
        .expect(201)
    ).body as KraTemplateRow;
    const body = {
      title: "Shoot kit check",
      ownerId: KARTHIK,
      kraTemplateId: kras.id,
      kraKey: "kit",
      doerIds: [VIGNESH],
      checkerId: DIVYA,
      approverId: ASHWIN,
    };
    await surya.post("/sops").send(body).expect(403);
    await karthik
      .post("/sops")
      .send({ ...body, kraKey: "nope" })
      .expect(400);
    sop = (await karthik.post("/sops").send(body).expect(201)).body as SopRow;
    expect(sop).toMatchObject({
      kra: { template: "Camera", name: "Kit ready on time" },
      current: null,
      draft: { number: 1, status: "draft" },
    });
    expect((await vignesh.get("/sops").expect(200)).body).toEqual([]); // nothing in use yet
  });

  it("has each version approved by its approver before it is used", async () => {
    await karthik.post(`/sops/versions/${sop.draft!.id}/submit`).expect(400); // nothing written yet
    await karthik
      .put(`/sops/versions/${sop.draft!.id}`)
      .send({
        purpose: "Nothing forgotten at a shoot",
        steps: [{ text: "Pack the night before" }, { text: "Tick the list at the studio door" }],
        checklist: CHECKS,
      })
      .expect(200);
    await karthik.post(`/sops/versions/${sop.draft!.id}/submit`).expect(200);
    const n = (await ashwin.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "sop_to_approve")!.title).toBe("Shoot kit check, version 1, waits for approval");
    await karthik.post(`/sops/versions/${sop.draft!.id}/decision`).send({ approved: true }).expect(403);
    sop = (await ashwin.post(`/sops/versions/${sop.draft!.id}/decision`).send({ approved: true }).expect(200)).body as SopRow;
    expect(sop).toMatchObject({ current: { number: 1, status: "approved", approvedBy: "Ashwin" }, draft: null });
    expect(((await vignesh.get("/sops").expect(200)).body as SopRow[]).map((s) => s.title)).toEqual(["Shoot kit check"]);
  });

  it("is run by its doers and checked by its checker; a failed run counts in the reviews", async () => {
    await surya
      .post(`/sops/${sop.id}/runs`)
      .send({ items: CHECKS.map((c) => ({ key: c.key, result: "done" })) })
      .expect(403);
    await vignesh
      .post(`/sops/${sop.id}/runs`)
      .send({ items: [{ key: "batteries", result: "done" }] })
      .expect(400);
    run = (
      await vignesh
        .post(`/sops/${sop.id}/runs`)
        .send({
          about: "Lakshmi Textiles shoot",
          items: [
            { key: "batteries", result: "done" },
            { key: "cards", result: "not_done", note: "No time" },
            { key: "lights", result: "done" },
          ],
        })
        .expect(201)
    ).body as SopRunRow;
    expect(run).toMatchObject({
      status: "submitted",
      version: 1,
      items: [expect.objectContaining({ text: "Batteries charged" }), expect.anything(), expect.anything()],
    });
    const n = (await divya.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "checklist_to_check")!.title).toBe("Shoot kit check — Lakshmi Textiles shoot: checklist to check");
    await vignesh.post(`/sops/runs/${run.id}/check`).send({ passed: true }).expect(403);
    await divya.post(`/sops/runs/${run.id}/check`).send({ passed: false }).expect(400);
    run = (await divya.post(`/sops/runs/${run.id}/check`).send({ passed: false, note: "Cards were full — footage nearly lost" }).expect(200)).body as SopRunRow;
    expect(run).toMatchObject({ status: "failed", checkedBy: "Divya Lakshmi" });

    const meeting = (
      await ashwin
        .post("/reviews/meetings")
        .send({ cadence: "tactical", startsAt: new Date(Date.now() + 3_600_000).toISOString() })
        .expect(201)
    ).body as MeetingRow;
    const block = meeting.figures.find((f) => f.key === "sop_failures")!;
    expect(block.lines).toEqual([
      { label: "Failed this month", value: "1", tone: "bad" },
      { label: "Shoot kit check", value: "1" },
      { label: "Waiting to be checked", value: "0" },
    ]);
    expect(((await karthik.get(`/sops/${sop.id}`).expect(200)).body as SopRow).runs).toEqual({ month: 1, failed: 1 });
  });

  it("gets a new version, sent back once, approved, and the old one replaced", async () => {
    sop = (await karthik.post(`/sops/${sop.id}/versions`).expect(201)).body as SopRow;
    await karthik.post(`/sops/${sop.id}/versions`).expect(409);
    const draft = sop.draft!;
    expect(draft).toMatchObject({ number: 2, checklist: CHECKS });
    await karthik
      .put(`/sops/versions/${draft.id}`)
      .send({
        purpose: "Nothing forgotten at a shoot",
        checklist: [...CHECKS, { key: "backup", text: "Footage backed up before leaving" }],
        changeNote: "Backup added",
      })
      .expect(200);
    await karthik.post(`/sops/versions/${draft.id}/submit`).expect(200);
    sop = (await ashwin.post(`/sops/versions/${draft.id}/decision`).send({ approved: false, note: "Say where to back up" }).expect(200)).body as SopRow;
    expect(sop.draft).toMatchObject({ status: "draft", changeNote: "Backup added\nSent back: Say where to back up" });
    await karthik.post(`/sops/versions/${draft.id}/submit`).expect(200);
    sop = (await ashwin.post(`/sops/versions/${draft.id}/decision`).send({ approved: true }).expect(200)).body as SopRow;
    expect(sop.current!.number).toBe(2);
    expect(sop.versions!.map((v) => [v.number, v.status])).toEqual([
      [2, "approved"],
      [1, "superseded"],
    ]);
  });

  it("belongs to its agency only", async () => {
    const zara = await t.signInAs("zara@zenstudio.test");
    expect((await zara.get("/sops").expect(200)).body).toEqual([]);
    await zara.get(`/sops/${sop.id}`).expect(404);
  });
});
