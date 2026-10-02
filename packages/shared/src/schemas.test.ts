import { describe, expect, it } from "vitest";
import { agencyProfileInput, clientInput, EXAMPLE_PACKAGES, packageInput, packageTotals } from "./schemas.js";

describe("clientInput", () => {
  it("accepts a client with an approver", () => {
    const r = clientInput.safeParse({
      name: "Kaveri Organics",
      code: "KVR",
      stage: "Success",
      fitment: "Bread-winning",
      contacts: [{ name: "Ramesh Gounder", phone: "+91 94430 55101", approver: true }],
    });
    expect(r.success).toBe(true);
  });

  it("rejects a lower-case video code and a client without contacts", () => {
    const r = clientInput.safeParse({ name: "Kaveri", code: "kvr", contacts: [] });
    expect(r.success).toBe(false);
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(expect.arrayContaining(["code", "contacts"]));
  });
});

describe("packageInput", () => {
  it("keeps money in whole rupees", () => {
    expect(
      packageInput.safeParse({
        name: "Growth Video Pack",
        monthlyFee: 85000.5,
        deliverables: [{ name: "Reels", perMonth: 8 }],
        shootDays: 2,
        revisionsPerDeliverable: 2,
      }).success,
    ).toBe(false);
  });

  it("needs at least one deliverable and counts videos and posts from them", () => {
    expect(packageInput.safeParse({ name: "Empty", monthlyFee: 1000, deliverables: [], shootDays: 0, revisionsPerDeliverable: 1 }).success).toBe(false);
    expect(
      packageTotals([
        { perMonth: 8, kind: "video" },
        { perMonth: 12, kind: "post" },
        { perMonth: 20, kind: "story" },
      ]),
    ).toEqual({ videosPerMonth: 8, postsPerMonth: 32 });
    for (const p of EXAMPLE_PACKAGES) expect(packageInput.safeParse(p).success, p.name).toBe(true);
  });
});

describe("agencyProfileInput", () => {
  it("turns empty fields into nothing and keeps reminders inside the window, in order", () => {
    expect(agencyProfileInput.parse({ phone: "", email: "", website: "", windowDays: 7, reminderDays: [5, 2, 5] })).toMatchObject({
      phone: null,
      email: null,
      website: null,
      reminderDays: [2, 5],
    });
    expect(agencyProfileInput.safeParse({ windowDays: 5, reminderDays: [2, 6] }).success).toBe(false);
    expect(agencyProfileInput.safeParse({ logo: "data:image/svg+xml;base64,AAAA" }).success).toBe(false);
  });
});
