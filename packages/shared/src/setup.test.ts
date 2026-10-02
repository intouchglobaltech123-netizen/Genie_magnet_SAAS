import { describe, expect, it } from "vitest";
import { recommendSuites } from "./setup.js";

const none = { services: [], packages: [], team: 0, goal: false };

describe("the suites worth having", () => {
  it("come only from what the answers say, each with why", () => {
    expect(recommendSuites(none)).toEqual([]);
    expect(recommendSuites({ ...none, team: 2 })).toEqual([]);
    expect(recommendSuites({ ...none, team: 5 })).toEqual([
      { key: "people", why: "5 people on the team: attendance, leave, payroll and reviews in one place." },
    ]);
    expect(recommendSuites({ ...none, packages: [{ price: null, shootDays: 1 }] }).map((s) => s.key)).toEqual(["operations"]);
    expect(recommendSuites({ ...none, packages: [{ price: 25000, shootDays: null }] }).map((s) => s.key)).toEqual(["finance"]);
    expect(recommendSuites({ ...none, services: ["Personal branding"], goal: true }).map((s) => s.key)).toEqual(["management", "genie"]);
  });
});
