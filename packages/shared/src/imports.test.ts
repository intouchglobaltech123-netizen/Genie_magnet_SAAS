import { describe, expect, it } from "vitest";
import {
  CLIENT_IMPORT_COLUMNS,
  clientImport,
  matchColumns,
  parseDateText,
  parseRupees,
  parseVideoStage,
  parseYesNo,
  suggestCode,
  TEAM_IMPORT_COLUMNS,
  VIDEO_IMPORT_COLUMNS,
  videoImportRow,
} from "./imports.js";

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

describe("videos from a tracking sheet", () => {
  it("matches the headings people use", () => {
    const m = matchColumns(["#", "Code", "Urgency", "Video", "Clip No.", "VP", "Editor", "Status", "Deadline"], VIDEO_IMPORT_COLUMNS);
    expect(m).toMatchObject({ code: 1, urgency: 2, title: 3, clipNo: 4, footageProtected: 5, editor: 6, stage: 7, dueDate: 8, client: null });
  });

  it("reads stages the way they are written", () => {
    expect(parseVideoStage("Internal QC")).toBe("internal_qc");
    expect(parseVideoStage("qc")).toBe("internal_qc");
    expect(parseVideoStage("With client")).toBe("client_review");
    expect(parseVideoStage("Shoot scheduled")).toBe("shoot_scheduled");
    expect(parseVideoStage("posted")).toBe("published");
    expect(parseVideoStage("")).toBeUndefined();
    expect(parseVideoStage("somewhere")).toBeUndefined();
  });

  it("needs a client code, a title and a due date", () => {
    expect(videoImportRow.safeParse({ clientCode: "KVR", title: "Millet dosa", format: "Reel", dueDate: "2026-10-25" }).data).toMatchObject({
      stage: "planned",
      urgency: "standard",
      footageProtected: false,
    });
    const bad = videoImportRow.safeParse({ clientCode: "Kaveri", title: "", format: "Reel", dueDate: "25/10" });
    expect(bad.error?.issues.map((i) => i.path[0]).sort()).toEqual(["clientCode", "dueDate", "title"]);
  });
});
