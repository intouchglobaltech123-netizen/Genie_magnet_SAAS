import { describe, expect, it } from "vitest";
import { DEFAULT_PAYROLL, deductionRule, type PayslipBasis, payrollSettingsInput, salaryInput, workOutPayslip } from "./payroll.js";

// October 2026: 31 days, Sundays on the 4th, 11th, 18th and 25th. The rates below are made up for the tests; the app
// never assumes any — each agency enters its own.
const SUNDAYS = new Set(["2026-10-04", "2026-10-11", "2026-10-18", "2026-10-25"]);
const SALARY = {
  from: "2026-01-01",
  earnings: [
    { name: "Basic", amount: 20000 },
    { name: "House rent allowance", amount: 8000 },
    { name: "Special allowance", amount: 2000 },
  ],
};
const RULES = payrollSettingsInput.parse({
  deductions: [
    { name: "Provident fund", kind: "percent", of: ["Basic"], percent: 12, ceiling: 15000 },
    { name: "Provident fund (agency)", kind: "percent", of: ["Basic"], percent: 12, ceiling: 15000, employer: true },
    { name: "Insurance", kind: "percent", percent: 0.75, onlyUpTo: 21000 },
    {
      name: "Professional tax",
      kind: "slabs",
      slabs: [
        { upTo: null, amount: 208 },
        { upTo: 21000, amount: 0 },
      ],
    },
    { name: "Income tax", kind: "each_person" },
  ],
});
const basis = (over: Partial<PayslipBasis> = {}): PayslipBasis => ({
  month: "2026-10",
  settings: RULES,
  salaries: [SALARY],
  joined: "2024-06-03",
  left: null,
  offDays: SUNDAYS,
  attendance: { "2026-10-01": "present" },
  unpaidLeave: {},
  change: { adjustments: [], entries: {}, extraLop: 0 },
  ...over,
});

describe("payroll rules", () => {
  it("need what each kind of deduction is worked out from, and names of their own", () => {
    expect(deductionRule.safeParse({ name: "PF", kind: "percent" }).success).toBe(false);
    expect(deductionRule.safeParse({ name: "PT", kind: "slabs" }).success).toBe(false);
    expect(deductionRule.safeParse({ name: "TDS", kind: "each_person" }).success).toBe(true);
    const twice = payrollSettingsInput.safeParse({
      deductions: [
        { name: "PF", kind: "fixed", amount: 1 },
        { name: "pf", kind: "fixed", amount: 2 },
      ],
    });
    expect(twice.error?.issues[0]?.message).toBe("Each deduction needs its own name");
    expect(salaryInput.safeParse({ from: "2026-10-01", earnings: [] }).error?.issues[0]?.message).toBe("Add at least one part");
    expect(DEFAULT_PAYROLL.deductions).toEqual([]);
  });
});

describe("a payslip", () => {
  it("pays a whole month in full, less the agency's own deductions; contributions are shown, not taken", () => {
    const p = workOutPayslip(basis({ change: { adjustments: [{ name: "Festival bonus", amount: 5000 }], entries: { "Income tax": 1500 }, extraLop: 0 } }));
    expect(p.gross).toBe(30000);
    expect(p.days).toMatchObject({ basis: 31, employed: 31, lop: 0, paid: 31 });
    // Insurance applies only up to 21,000 a month; professional tax by slab.
    expect(p.deductions).toEqual([
      { name: "Provident fund", amount: 1800 },
      { name: "Professional tax", amount: 208 },
      { name: "Income tax", amount: 1500 },
    ]);
    expect(p.contributions).toEqual([{ name: "Provident fund (agency)", amount: 1800 }]);
    expect(p.net).toBe(30000 - 3508 + 5000);
    expect(p.notes).toEqual([]);
  });

  it("takes off absent days, half days, unpaid leave and lateness by the agency's rule", () => {
    const p = workOutPayslip(
      basis({
        settings: { ...RULES, latesPerHalfDay: 3 },
        attendance: {
          "2026-10-01": "absent",
          "2026-10-02": "absent",
          "2026-10-05": "half_day",
          "2026-10-06": "late",
          "2026-10-07": "late",
          "2026-10-08": "late",
          "2026-10-09": "leave",
        },
        unpaidLeave: { "2026-10-09": 1 },
      }),
    );
    expect(p.days).toMatchObject({ absent: 2, halfDays: 1, unpaidLeave: 1, lates: 3, latePenalty: 0.5, lop: 4, paid: 27 });
    expect(p.earnings).toEqual([
      { name: "Basic", amount: 20000, paid: 17419 },
      { name: "House rent allowance", amount: 8000, paid: 6968 },
      { name: "Special allowance", amount: 2000, paid: 1742 },
    ]);
    expect(p.gross).toBe(26129);
    expect(p.deductions[0]).toEqual({ name: "Provident fund", amount: 1800 }); // 12% of 17,419, capped at 15,000
  });

  it("pays someone who joined in the month for their working days, on the working-days basis", () => {
    const p = workOutPayslip(
      basis({
        settings: { ...DEFAULT_PAYROLL, dayBasis: "working" },
        salaries: [{ from: "2026-10-15", earnings: [{ name: "Basic", amount: 27000 }] }],
        joined: "2026-10-15",
      }),
    );
    expect(p.days).toMatchObject({ basis: 27, employed: 15, paid: 15 });
    expect(p.gross).toBe(15000);
  });

  it("counts a whole month as 30 days on the 30-day basis, whatever its length", () => {
    const feb = workOutPayslip(
      basis({
        month: "2026-02",
        settings: { ...DEFAULT_PAYROLL, dayBasis: "thirty" },
        salaries: [{ from: "2026-01-01", earnings: [{ name: "Basic", amount: 30000 }] }],
        offDays: new Set(),
        attendance: { "2026-02-10": "absent" },
      }),
    );
    expect(feb.days).toMatchObject({ basis: 30, employed: 30, lop: 1, paid: 29 });
    expect(feb.gross).toBe(29000);
  });

  it("pays each salary for its days when it changes in the month", () => {
    const p = workOutPayslip(
      basis({
        settings: DEFAULT_PAYROLL,
        salaries: [
          { from: "2026-01-01", earnings: [{ name: "Basic", amount: 31000 }] },
          { from: "2026-10-16", earnings: [{ name: "Basic", amount: 62000 }] },
        ],
      }),
    );
    expect(p.earnings).toEqual([{ name: "Basic", amount: 62000, paid: 47000 }]);
    expect(p.notes).toEqual(["The salary changed on 2026-10-16; each is paid for its days."]);
  });

  it("points out what needs a look: no attendance, a part a rule needs, pay below zero", () => {
    const p = workOutPayslip(
      basis({
        salaries: [{ from: "2026-01-01", earnings: [{ name: "Consolidated", amount: 10000 }] }],
        attendance: {},
        change: { adjustments: [{ name: "Advance recovered", amount: -12000 }], entries: {}, extraLop: 0 },
      }),
    );
    expect(p.notes).toEqual([
      "No attendance this month: paid for every day unless you add days without pay.",
      "Provident fund is worked out on Basic, which this salary does not have.",
      "Provident fund (agency) is worked out on Basic, which this salary does not have.",
      "Net pay is below zero.",
    ]);
    expect(workOutPayslip(basis({ change: { adjustments: [], entries: {}, extraLop: 31 } }))).toMatchObject({ gross: 0, deductions: [], net: 0 });
  });
});
