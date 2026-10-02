import { describe, expect, it } from "vitest";
import { bfaRow, bfaScores, fitmentOf, healthOf, project, roadMapInput, scenarioInputs } from "./diagnostic.js";

describe("the BFA scorecard", () => {
  it("scores each function out of four and shows how much rests on the founder", () => {
    const rows = [
      bfaRow.parse({ function: "Sales", consistent: true, ownerDependent: true, results: "High", leader: false }),
      bfaRow.parse({ function: "Operations / delivery", consistent: true, ownerDependent: false, results: "High", leader: true }),
      bfaRow.parse({ function: "HR", consistent: false, ownerDependent: true, results: "Low", leader: true }),
      bfaRow.parse({ function: "R&D" }), // not answered
    ];
    const s = bfaScores(rows);
    expect(s.functions.map((f) => [f.function, f.points, f.percent])).toEqual([
      ["Sales", 2, 50],
      ["Operations / delivery", 4, 100],
      ["HR", 1, 25],
      ["R&D", 0, 0],
    ]);
    expect(s.overall).toBe(58); // 7 of 12 across the three answered
    expect(s.founderDependency).toBe(50); // Sales fully, HR half (it has a second line), delivery not
  });
});

describe("a client", () => {
  it("sits on the fitment map by its fee against the hours it takes", () => {
    expect(fitmentOf(80_000, 20, 50_000, 30)).toBe("Amazing");
    expect(fitmentOf(80_000, 50, 50_000, 30)).toBe("Bread-winning");
    expect(fitmentOf(20_000, 10, 50_000, 30)).toBe("Convenience");
    expect(fitmentOf(20_000, 60, 50_000, 30)).toBe("Dangerous");
  });

  it("has a health score from delivery, revisions, payments, the agreement and onboarding", () => {
    expect(healthOf({ onTimeShare: 1, revisionsPerVideo: 1, daysOverdue: 0, agreement: "running", onboarded: true }).score).toBe(100);
    const poor = healthOf({ onTimeShare: 0.5, revisionsPerVideo: 2, daysOverdue: 40, agreement: "renewal_due", onboarded: false });
    expect(poor).toEqual({ score: 15 + 10 + 0 + 8 + 0, parts: { delivery: 15, revisions: 10, payments: 0, agreement: 8, onboarding: 0 } });
  });
});

describe("the road map and scenarios", () => {
  it("keeps road map items in order of months", () => {
    expect(
      roadMapInput.safeParse({ function: "Sales", title: "Hire a salesperson", startMonth: "2026-12", endMonth: "2026-10" }).error?.issues[0]?.message,
    ).toBe("Not before the start");
  });

  it("projects clients, revenue, costs and profit month by month", () => {
    const p = project(
      scenarioInputs.parse({
        months: 3,
        startClients: 10,
        avgFee: 40_000,
        newClientsPerMonth: 1,
        churnPerMonth: 0.1,
        teamCostPerMonth: 300_000,
        overheadPerMonth: 50_000,
        hires: [{ month: 2, cost: 25_000 }],
      }),
    );
    expect(p.rows).toEqual([
      { month: 1, clients: 10, revenue: 400_000, costs: 350_000, profit: 50_000 },
      { month: 2, clients: 10, revenue: 400_000, costs: 375_000, profit: 25_000 },
      { month: 3, clients: 10, revenue: 400_000, costs: 375_000, profit: 25_000 },
    ]);
    expect(p).toMatchObject({ revenue: 1_200_000, costs: 1_100_000, profit: 100_000, margin: 8.3, firstProfitable: 1 });
  });
});
