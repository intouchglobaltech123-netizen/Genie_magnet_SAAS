import { describe, expect, it } from "vitest";
import { agreementEndDate, agreementMonths, clientUpdate, dayAfter, daysUntil } from "./clients.js";
import { gstinState, gstinValid } from "./gst.js";

describe("GSTIN", () => {
  it("accepts a GSTIN whose check character is right, and nothing else", () => {
    expect(gstinValid("27AAPFU0939F1ZV")).toBe(true);
    expect(gstinValid("27AAPFU0939F1ZW")).toBe(false);
    expect(gstinValid("27AAPFU0939F1Z")).toBe(false);
    expect(gstinState("33AAKFK4821M1Z5")).toBe("33");
  });

  it("is upper-cased, and must match the client's state", () => {
    expect(clientUpdate.parse({ gstin: "33aakfk4821m1z5" }).gstin).toBe("33AAKFK4821M1Z5");
    expect(clientUpdate.parse({ gstin: "" }).gstin).toBeNull();
    const r = clientUpdate.safeParse({ gstin: "33AAKFK4821M1Z5", state: "29" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.path).toEqual(["state"]);
  });
});

describe("agreement dates", () => {
  it("ends the day before the same date, months later", () => {
    expect(agreementEndDate("2026-11-01", 12)).toBe("2027-10-31");
    expect(agreementEndDate("2026-01-31", 1)).toBe("2026-02-27");
    expect(agreementEndDate("2026-10-01", 3)).toBe("2026-12-31");
    expect(agreementEndDate("2026-05-15", 6)).toBe("2026-11-14");
  });

  it("counts months back from the dates", () => {
    expect(agreementMonths("2026-11-01", "2027-10-31")).toBe(12);
    expect(agreementMonths("2026-05-15", "2026-11-14")).toBe(6);
    expect(agreementMonths("2026-05-15", "2026-11-15")).toBe(6);
  });

  it("counts days", () => {
    expect(dayAfter("2026-12-31")).toBe("2027-01-01");
    expect(daysUntil("2026-10-31", "2026-10-02")).toBe(29);
    expect(daysUntil("2026-10-01", "2026-10-02")).toBe(-1);
  });
});
