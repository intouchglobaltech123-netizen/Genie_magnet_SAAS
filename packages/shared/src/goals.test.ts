import { describe, expect, it } from "vitest";
import { cascade, DEFAULT_GOAL_SETTINGS, goalInput, goalProgress, goalStatus } from "./goals.js";

const L = 100_000;

describe("a goal", () => {
  it("is on track, at risk or off track by its progress against where it should be by now", () => {
    const g = { baseline: 0, target: 100, startDate: "2026-04-01", dueDate: "2027-03-31" };
    // Halfway through the year: 50 is on track, 42 at risk, 30 off track; reaching 100 is done.
    const mid = "2026-09-30";
    expect(goalStatus({ ...g, actual: 50 }, mid, DEFAULT_GOAL_SETTINGS)).toBe("on_track");
    expect(goalStatus({ ...g, actual: 42 }, mid, DEFAULT_GOAL_SETTINGS)).toBe("at_risk");
    expect(goalStatus({ ...g, actual: 30 }, mid, DEFAULT_GOAL_SETTINGS)).toBe("off_track");
    expect(goalStatus({ ...g, actual: 100 }, mid, DEFAULT_GOAL_SETTINGS)).toBe("done");
    expect(goalStatus({ ...g, actual: 0 }, "2026-04-10", DEFAULT_GOAL_SETTINGS)).toBe("on_track"); // too early to judge
    // Going down: from 12 revisions to 4.
    expect(goalProgress({ baseline: 12, target: 4, actual: 8 })).toBe(0.5);
  });

  it("serves a goal above it, unless it is the company's", () => {
    const base = { level: "department", title: "Win 10 clients", target: 10, startDate: "2026-04-01", dueDate: "2027-03-31" };
    expect(goalInput.safeParse(base).error?.issues[0]?.message).toBe("Choose the goal it serves");
    expect(goalInput.safeParse({ ...base, level: "company" }).success).toBe(true);
    expect(goalInput.safeParse({ ...base, level: "company", dueDate: "2026-01-01" }).error?.issues[0]?.message).toBe("After the start");
  });
});

describe("the revenue cascade", () => {
  it("works the year's target back to deals, proposals, leads, ad spend and editing capacity", () => {
    const c = cascade({
      revenueTarget: 60 * L,
      baseBook: 36 * L,
      retention: 0.89,
      churn: 0.05,
      avgDeal: 5 * L,
      winRate: 0.28,
      proposalRate: 0.135,
      costPerLead: 450,
      editors: 2,
      productiveHours: 150,
      hoursPerVideo: 7.5,
      videosPerClient: 5,
      currentLoad: 41,
    });
    expect(c).toEqual({
      kept: 3_024_000,
      newNeeded: 2_976_000,
      deals: 6,
      proposals: 22,
      leads: 163,
      leadsPerMonth: 14,
      adBudget: 73_350,
      requiredVideos: 64,
      capacity: 40,
      utilisation: 160,
      hires: 2,
    });
  });
});
