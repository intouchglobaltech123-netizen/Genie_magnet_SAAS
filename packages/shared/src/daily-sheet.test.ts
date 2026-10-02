import { describe, expect, it } from "vitest";
import { DEFAULT_SHEET_SETTINGS, sheetInput, sheetProblems, sheetTemplateInput, sheetTotals } from "./daily-sheet.js";

const row = (id: string, start: string, end: string, extra: object = {}) => ({ id, task: "Edit reel", start, end, ...extra });

describe("a daily sheet", () => {
  it("adds up the day: time on tasks, productive or not, and how far from the shift", () => {
    const s = sheetInput.parse({
      rows: [row("a", "09:30", "13:30"), row("b", "14:00", "16:00", { productive: false, status: "pending", delayReason: "Waiting for footage" })],
    });
    expect(sheetTotals(s, DEFAULT_SHEET_SETTINGS)).toEqual({ minutes: 360, productive: 240, completed: 1, pending: 1, gap: 120 });
  });

  it("needs each row's video or task, a start and later end, why a task is pending, and why the day is short", () => {
    const s = sheetInput.parse({ rows: [row("a", "09:30", "13:30", { task: "" }), row("b", "14:00", "13:00", { status: "pending" })] });
    expect(sheetProblems(s, DEFAULT_SHEET_SETTINGS).map((p) => p.message)).toEqual([
      "Row 1: the video or the task",
      "Row 2: a start and a later end",
      "Row 2: why it is pending",
      "Short of the day's shift — say why",
    ]);
    const full = sheetInput.parse({ rows: [row("a", "09:30", "13:30"), row("b", "14:00", "17:45")] });
    expect(sheetProblems(full, DEFAULT_SHEET_SETTINGS)).toEqual([]); // 15 minutes short is within the slack
    expect(sheetProblems(sheetInput.parse({}), DEFAULT_SHEET_SETTINGS)).toEqual([{ path: "rows", message: "Add at least one task" }]);
  });

  it("is signed by each signer once", () => {
    expect(sheetTemplateInput.safeParse({ name: "HR", signers: ["hr", "hr"] }).error?.issues[0]?.message).toBe("Each signs once");
    expect(sheetTemplateInput.parse({ name: "HR" }).signers).toEqual(["manager", "hr"]);
  });
});
