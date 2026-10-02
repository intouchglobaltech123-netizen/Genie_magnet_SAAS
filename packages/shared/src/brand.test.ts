import { describe, expect, it } from "vitest";
import { brandPalette, contrast, portalDomainInput } from "./brand.js";

describe("the app in the agency's colour", () => {
  it("keeps buttons and the sidebar readable, whatever colour was picked", () => {
    for (const colour of ["#0F766E", "#FFE066", "#FFFFFF", "#000000", "#E11D48"]) {
      const { light, dark } = brandPalette(colour);
      expect(contrast(light["--color-primary"]!, "#f8f5f0")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(light["--color-secondary"]!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(light["--color-sidebar"]!, "#c9cfdd")).toBeGreaterThanOrEqual(4.5);
      expect(contrast(dark["--color-primary"]!, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      for (const v of [...Object.values(light), ...Object.values(dark)]) expect(v).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("leaves a colour dark enough as it is", () => {
    expect(brandPalette("#0F766E").light["--color-primary"]).toBe("#0f766e");
  });
});

describe("the agency's own portal address", () => {
  it("is a sub-domain, taken from whatever was pasted", () => {
    expect(portalDomainInput.parse({ domain: " https://Portal.ZenStudio.in/c/abc " }).domain).toBe("portal.zenstudio.in");
    expect(portalDomainInput.safeParse({ domain: "zenstudio.in" }).error?.issues[0]?.message).toBe("Use a sub-domain, like portal.youragency.com");
    expect(portalDomainInput.safeParse({ domain: "portal zen studio" }).error?.issues[0]?.message).toBe("Enter an address like portal.youragency.com");
  });
});
