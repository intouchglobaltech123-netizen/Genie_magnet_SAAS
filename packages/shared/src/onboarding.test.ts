import { describe, expect, it } from "vitest";
import {
  checkAnswer,
  checklistOf,
  DEFAULT_QUESTIONNAIRES,
  dueReminders,
  gateOf,
  optionLabels,
  progressOf,
  type Question,
  questionnaireDefinition,
  translated,
  windowOf,
} from "./onboarding.js";

const client = DEFAULT_QUESTIONNAIRES.client;
const q = (key: string) => client.sections.flatMap((s) => s.questions).find((x) => x.key === key)!;

describe("the Growth OS question sets", () => {
  it("pass the question builder's own rules", () => {
    expect(questionnaireDefinition.safeParse(DEFAULT_QUESTIONNAIRES.client).error?.issues).toBeUndefined();
    expect(questionnaireDefinition.safeParse(DEFAULT_QUESTIONNAIRES.agency).error?.issues).toBeUndefined();
  });

  it("have three required client sections and the rest within the window", () => {
    expect(client.sections.filter((s) => s.when === "required").map((s) => s.key)).toEqual(["basics", "goals", "brand"]);
    expect(q("c6")).toMatchObject({ type: "choice", mapsTo: "client.stage" });
    expect(q("c8").showIf).toEqual({ key: "c7", includes: "Businesses (B2B)" });
  });
});

describe("the question builder", () => {
  const base = (questions: Partial<Question>[]) => ({
    name: "Test",
    sections: [
      { key: "s", title: "Section", when: "required", questions: questions.map((x, i) => ({ key: `q${i}`, label: "A question", type: "text", ...x })) },
    ],
  });

  it("refuses duplicate keys, choices without options, and fields of the wrong type", () => {
    const r = questionnaireDefinition.safeParse(
      base([{ key: "a" }, { key: "a" }, { type: "choice", options: ["Only one"] }, { type: "long", mapsTo: "client.stage" }]),
    );
    expect(r.error?.issues.map((i) => i.message)).toEqual(["Two questions have this key", "Give at least two options", "Only a one choice can fill this"]);
  });

  it("allows branching only on an earlier choice question", () => {
    const r = questionnaireDefinition.safeParse(base([{ showIf: { key: "q1", includes: "Yes" } }, { type: "choice", options: ["Yes", "No"] }]));
    expect(r.error?.issues[0]?.message).toMatch(/earlier choice question/);
  });
});

describe("answers", () => {
  it("are checked against their question and cleaned up", () => {
    expect(checkAnswer(q("c27b"), "₹ 50,000")).toEqual({ value: "50000" });
    expect(checkAnswer(q("c27b"), "fifty thousand")).toEqual({ error: "Enter an amount in whole rupees" });
    expect(checkAnswer(q("c6"), "Scale")).toEqual({ value: "Scale" });
    expect(checkAnswer(q("c6"), "Huge")).toEqual({ error: "Choose one of the options" });
    expect(checkAnswer(q("c28"), ["Brand awareness", "Festive campaigns", "Customer education", "More enquiries and leads"])).toEqual({
      error: "Choose at most 3",
    });
    expect(checkAnswer(q("c1"), "  ")).toEqual({ value: null });
    expect(checkAnswer(q("c29"), ["file:019a0000-0000-7000-8000-00000000abcd", "https://drive.example/brand"])).toEqual({
      value: ["file:019a0000-0000-7000-8000-00000000abcd", "https://drive.example/brand"],
    });
    expect(checkAnswer(q("c29"), "https://a.example https://b.example")).toEqual({ value: ["https://a.example", "https://b.example"] });
    expect(checkAnswer(q("c29"), ["logo.png"])).toMatchObject({ error: expect.stringMatching(/Upload a file/) });
  });

  it("in tables keep only filled rows and check each cell", () => {
    const rows = [
      { metric: "Followers", now: "1,200", target: "5000" },
      { metric: "", now: "", target: "" },
    ];
    expect(checkAnswer(q("c27"), rows)).toEqual({ value: [{ metric: "Followers", now: "1200", target: "5000" }] });
    expect(checkAnswer(q("c27"), [{ metric: "Leads", now: "many" }])).toMatchObject({ error: "Today, row 1: enter a number" });
  });
});

describe("progress", () => {
  it("counts required and within-window questions apart, and skips hidden ones", () => {
    const p = progressOf(client, {});
    expect(p.required).toMatchObject({ answered: 0, total: 19, complete: false });
    expect(p.window.total).toBe(16); // c8–c10 are hidden until c7 is answered
    expect(p.next).toEqual({ section: "basics", question: "c1" });
    const withB2b = progressOf(client, { c7: ["Businesses (B2B)"] });
    expect(withB2b.window).toMatchObject({ answered: 1, total: 17 });
  });

  it("ticks the checklist from answers, the agreement and approvers, and opens the gate", () => {
    const required = Object.fromEntries(
      client.sections
        .filter((s) => s.when === "required")
        .flatMap((s) => s.questions)
        .map((x) => [
          x.key,
          x.type === "multi" ? [x.options![0]!] : x.type === "table" ? [{ [x.columns![0]!.key]: "x" }] : x.type === "choice" ? x.options![0]! : "12",
        ]),
    );
    const p = progressOf(client, required);
    expect(p.required.complete).toBe(true);
    const list = checklistOf(client, required, {}, { agreement: true, approver: true });
    expect(list.filter((c) => !c.done).map((c) => c.key)).toEqual(["deliverables", "channel", "files"]);
    expect(gateOf(p, list, false)).toEqual({ open: false, byException: false, missing: ["Deliverables confirmed"] });
    const ticked = checklistOf(client, required, { deliverables: { at: "2026-10-02", by: "u1" } }, { agreement: true, approver: true });
    expect(gateOf(p, ticked, false).open).toBe(true);
    expect(gateOf(progressOf(client, {}), ticked, true)).toMatchObject({ open: true, byException: true });
  });
});

describe("the window and reminders", () => {
  it("runs from the day the link was shared", () => {
    expect(windowOf(null, 7, false, "2026-10-02").state).toBe("not_sent");
    expect(windowOf("2026-10-01T10:00:00Z", 7, false, "2026-10-02")).toEqual({ state: "on_track", day: 2, dueOn: "2026-10-07" });
    expect(windowOf("2026-10-01T10:00:00Z", 7, false, "2026-10-07").state).toBe("due_soon");
    expect(windowOf("2026-10-01T10:00:00Z", 7, false, "2026-10-08").state).toBe("overdue");
    expect(windowOf("2026-10-01T10:00:00Z", 7, true, "2026-10-08").state).toBe("complete");
  });

  it("reminds on the agency's days, once each, and stops when complete", () => {
    expect(dueReminders([2, 5], 1, [], false)).toEqual([]);
    expect(dueReminders([2, 5], 5, [2], false)).toEqual([5]);
    expect(dueReminders([2, 5], 6, [2, 5], false)).toEqual([]);
    expect(dueReminders([2, 5], 6, [], true)).toEqual([]);
  });
});

describe("translations", () => {
  it("show the client's language where a translation exists", () => {
    const d = {
      sections: [
        {
          key: "s",
          title: "Basics",
          when: "required" as const,
          questions: [
            { key: "a", label: "Your name", type: "text" as const, translations: { ta: { label: "உங்கள் பெயர்" } } },
            { key: "b", label: "Stage", type: "choice" as const, options: ["Struggle", "Scale"], translations: { ta: { options: ["போராட்டம்"] } } },
          ],
        },
      ],
    };
    const ta = translated(d, "ta");
    expect(ta[0]!.questions.map((x) => x.label)).toEqual(["உங்கள் பெயர்", "Stage"]);
    expect(optionLabels(d.sections[0]!.questions[1]!, "ta")).toEqual(["போராட்டம்", "Scale"]);
  });
});
