// Round Table (P5-15): timed rounds, one person each, written before the buzzer; moderated by the facilitator;
// released, each person reading what was said about them without names and making their commitment.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CommitmentRow, RtFeedback, RtSessionRow } from "@gm/shared";
import { seedUserId } from "@gm/db/seed";
import { type Agent, type SeededApp, startSeededApp } from "../test/seeded-app.js";

let t: SeededApp;
let ashwin: Agent; // manager: facilitates
let divya: Agent;
let surya: Agent;
let karthik: Agent;
let rt: RtSessionRow;
const DIVYA = seedUserId("divya@geniemagnet.test");
const SURYA = seedUserId("surya@geniemagnet.test");
const KARTHIK = seedUserId("karthik@geniemagnet.test");

beforeAll(async () => {
  t = await startSeededApp();
  [ashwin, divya, surya, karthik] = await Promise.all(["ashwin", "divya", "surya", "karthik"].map((p) => t.signInAs(`${p}@geniemagnet.test`)));
}, 180_000);

afterAll(async () => {
  await t?.stop();
}, 60_000);

describe("a Round Table", () => {
  it("is set up with the people and the three questions", async () => {
    await divya
      .post("/round-tables")
      .send({ name: "Mine", participantIds: [DIVYA, SURYA] })
      .expect(403);
    rt = (
      await ashwin
        .post("/round-tables")
        .send({ name: "Strategic review — Round Table", participantIds: [DIVYA, SURYA, KARTHIK], secondsPerPerson: 60 })
        .expect(201)
    ).body as RtSessionRow;
    expect(rt).toMatchObject({
      status: "draft",
      facilitator: { name: "Ashwin" },
      questions: ["What does {name} do best?", "Where does {name} fall short?", "What can {name} do better in the next 45 days?"],
    });
    await divya.get(`/round-tables/${rt.id}`).expect(200);
    const zara = await t.signInAs("zara@zenstudio.test");
    await zara.get(`/round-tables/${rt.id}`).expect(404);
  });

  it("runs in timed rounds: everyone writes about the person whose round it is, before the buzzer", async () => {
    await divya.post(`/round-tables/${rt.id}/start`).expect(403);
    rt = (await ashwin.post(`/round-tables/${rt.id}/start`).expect(200)).body as RtSessionRow;
    expect(rt.current).toMatchObject({ index: 0, subject: { id: DIVYA, name: "Divya Lakshmi" } });
    await ashwin
      .put(`/round-tables/${rt.id}/answer`)
      .send({ answers: ["a", "b", "c"] })
      .expect(403); // not taking part
    await divya
      .put(`/round-tables/${rt.id}/answer`)
      .send({ answers: ["I keep the QC tidy", "I start late", "Start by 9:30"] })
      .expect(200);
    await surya
      .put(`/round-tables/${rt.id}/answer`)
      .send({ answers: ["Clean edits", "Rude in the group chat", "Be kinder"] })
      .expect(200);
    rt = (
      await karthik
        .put(`/round-tables/${rt.id}/answer`)
        .send({ answers: ["Fast colour work", "Misses the brief sometimes", "Read the brief twice"] })
        .expect(200)
    ).body as RtSessionRow;
    expect(rt).toMatchObject({ written: 3, myAnswer: ["Fast colour work", "Misses the brief sometimes", "Read the brief twice"] });

    rt = (await ashwin.post(`/round-tables/${rt.id}/next`).expect(200)).body as RtSessionRow;
    expect(rt.current!.subject.id).toBe(SURYA);
    await surya
      .put(`/round-tables/${rt.id}/answer`)
      .send({ answers: ["Patient", "", ""] })
      .expect(200);
    // The buzzer goes.
    await t.sql(`UPDATE rt_sessions SET round_ends_at = now() - interval '1 minute' WHERE id = $1`, [rt.id]);
    expect(
      (
        await divya
          .put(`/round-tables/${rt.id}/answer`)
          .send({ answers: ["Too late", "", ""] })
          .expect(409)
      ).body.message,
    ).toBe("The buzzer has gone for this round.");
    await ashwin.post(`/round-tables/${rt.id}/next`).expect(200);
    rt = (await ashwin.post(`/round-tables/${rt.id}/next`).expect(200)).body as RtSessionRow;
    expect(rt.status).toBe("moderation");
  });

  it("is moderated by the facilitator, who sees who wrote what; the rest do not", async () => {
    expect(((await divya.get(`/round-tables/${rt.id}`).expect(200)).body as RtSessionRow).answers).toBeUndefined();
    const missed = rt.answers!.filter((a) => a.missed).map((a) => `${a.author} on ${a.subject}`);
    expect(missed.sort()).toEqual([
      "Divya Lakshmi on Karthik Subramanian",
      "Divya Lakshmi on Surya Prakash",
      "Karthik Subramanian on Karthik Subramanian",
      "Karthik Subramanian on Surya Prakash",
      "Surya Prakash on Karthik Subramanian",
    ]);
    const rude = rt.answers!.find((a) => a.subjectId === DIVYA && a.author === "Surya Prakash")!;
    await ashwin.put(`/round-tables/answers/${rude.id}`).send({ hidden: true }).expect(400);
    await divya.put(`/round-tables/answers/${rude.id}`).send({ hidden: true, reason: "Personal" }).expect(403);
    rt = (await ashwin.put(`/round-tables/answers/${rude.id}`).send({ hidden: true, reason: "Personal, not about the work" }).expect(200)).body as RtSessionRow;
    expect(rt.answers!.find((a) => a.id === rude.id)).toMatchObject({ hidden: true, hiddenReason: "Personal, not about the work" });
    await divya.get(`/round-tables/${rt.id}/mine`).expect(409);
  });

  it("is released: each person reads what was said about them, without names, and commits", async () => {
    await ashwin.post(`/round-tables/${rt.id}/release`).expect(200);
    const n = (await divya.get("/notifications").expect(200)).body.items as { kind: string; title: string }[];
    expect(n.find((x) => x.kind === "round_table_released")!.title).toBe("Strategic review — Round Table: what your team said is ready");
    const mine = (await divya.get(`/round-tables/${rt.id}/mine`).expect(200)).body as RtFeedback;
    expect(mine).toMatchObject({
      self: ["I keep the QC tidy", "I start late", "Start by 9:30"],
      peers: [["Fast colour work", "Misses the brief sometimes", "Read the brief twice"]], // the hidden one is not passed on
      commitment: null,
    });
    expect(JSON.stringify(mine)).not.toMatch(/Karthik|Surya/);
    const made = (await divya.post(`/round-tables/${rt.id}/commitment`).send({ text: "Read every brief twice before cutting" }).expect(201)).body as RtFeedback;
    expect(made.commitment).toMatchObject({ text: "Read every brief twice before cutting" });
    await divya.post(`/round-tables/${rt.id}/commitment`).send({ text: "Again" }).expect(409);
    const commitments = (await divya.get("/commitments?mine=true").expect(200)).body as CommitmentRow[];
    expect(commitments.map((c) => c.text)).toEqual(["Read every brief twice before cutting"]);
    expect(((await surya.get(`/round-tables/${rt.id}/mine`).expect(200)).body as RtFeedback).self).toEqual(["Patient", "", ""]);
  });
});
