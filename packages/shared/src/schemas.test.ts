import { describe, expect, it } from "vitest";
import { clientInput, packageInput, questionnaireTemplateSchema } from "./schemas.js";

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
      packageInput.safeParse({ name: "Growth Video Pack", monthlyFee: 85000.5, videosPerMonth: 12, postsPerMonth: 0, shootDays: 2, revisionsPerDeliverable: 2 })
        .success,
    ).toBe(false);
  });
});

describe("questionnaireTemplateSchema", () => {
  it("defaults the completion window to 7 days", () => {
    const t = questionnaireTemplateSchema.parse({
      kind: "client",
      version: "1.0",
      sections: [{ key: "basics", title: "Business basics", when: "required", questions: [{ key: "legal_name", label: "Business name", type: "text" }] }],
    });
    expect(t.windowDays).toBe(7);
  });
});
