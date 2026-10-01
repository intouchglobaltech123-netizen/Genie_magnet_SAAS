import { describe, expect, it } from "vitest";
import { CLIENT_IMPORT_COLUMNS, clientImport, matchColumns, parseDateText, parseRupees, parseYesNo, suggestCode, TEAM_IMPORT_COLUMNS } from "./imports.js";

describe("matching a sheet's columns", () => {
  it("uses the template headings, then the headings people usually write", () => {
    const m = matchColumns(["Company Name", "Mobile", "Contact Person", "E-mail", "City", "Notes"], CLIENT_IMPORT_COLUMNS);
    expect(m).toMatchObject({ name: 0, contactPhone: 1, contactName: 2, contactEmail: 3, city: 4, code: null, industry: null });
    expect(matchColumns(["Email", "Role"], TEAM_IMPORT_COLUMNS)).toEqual({ email: 0, role: 1 });
  });

  it("never uses one sheet column for two fields", () => {
    const m = matchColumns(["Name", "Name"], CLIENT_IMPORT_COLUMNS);
    expect(m.name).toBe(0);
    expect(Object.values(m).filter((v) => v === 0)).toHaveLength(1);
  });
});

describe("client codes", () => {
  it("are made from the name and never clash", () => {
    const taken = new Set(["KO"]);
    expect(suggestCode("Sri Lakshmi Silks", new Set())).toBe("SLS");
    expect(suggestCode("Kaveri Organics", taken)).toBe("KOA");
    expect(suggestCode("Nova", new Set())).toBe("NOV");
    expect(suggestCode("Q", new Set())).toBe("QC");
    expect(suggestCode("123", new Set())).toBe("CL");
  });
});

describe("rows sent to the API", () => {
  it("are checked with the client rules and need at least one row", () => {
    expect(clientImport.safeParse({ fileName: "clients.xlsx", rows: [] }).success).toBe(false);
    const ok = clientImport.safeParse({
      fileName: "clients.xlsx",
      rows: [{ name: "Kaveri Organics", code: "KVR", contacts: [{ name: "Ramesh", phone: "9443055101" }], accountOwnerEmail: "Ashwin@GM.test" }],
    });
    expect(ok.success && ok.data.rows[0]?.accountOwnerEmail).toBe("ashwin@gm.test");
  });

  it("understand dates and amounts the way people write them", () => {
    expect(["2026-10-05", "05/10/2026", "5-10-26", "31/02/2026", "next week"].map(parseDateText)).toEqual([
      "2026-10-05",
      "2026-10-05",
      "2026-10-05",
      undefined,
      undefined,
    ]);
    expect(["₹60,000", "Rs. 1,20,000", "45000.4", "", "lots"].map(parseRupees)).toEqual([60000, 120000, 45000, undefined, undefined]);
  });

  it("understand yes and no", () => {
    expect([parseYesNo("Yes"), parseYesNo("N"), parseYesNo(""), parseYesNo("maybe")]).toEqual([true, false, undefined, undefined]);
  });
});
