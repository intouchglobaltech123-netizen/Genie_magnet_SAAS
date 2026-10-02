import { describe, expect, it } from "vitest";
import {
  AGREEMENT_IMPORT_COLUMNS,
  agreementImportRow,
  CLIENT_IMPORT_COLUMNS,
  clientImport,
  matchColumns,
  parseAgreementStatus,
  parseDeliverables,
  parsePlatforms,
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

describe("agreements from a sheet", () => {
  it("matches the headings people use", () => {
    const m = matchColumns(["Client Name", "Plan", "From", "Valid till", "Retainer", "Scope", "Channels", "Status"], AGREEMENT_IMPORT_COLUMNS);
    expect(m).toMatchObject({ client: 0, package: 1, startDate: 2, endDate: 3, monthlyFee: 4, deliverables: 5, platforms: 6, status: 7, months: null });
  });

  it("reads deliverables the way they are written, and tells videos from posts", () => {
    expect(parseDeliverables("8 Reels, 4 Posts + 10 stories")).toEqual([
      { name: "Reels", perMonth: 8, kind: "video" },
      { name: "Posts", perMonth: 4, kind: "post" },
      { name: "Stories", perMonth: 10, kind: "story" },
    ]);
    expect(parseDeliverables("Reels x 8; Carousels: 2 and 1 YouTube video")).toEqual([
      { name: "Reels", perMonth: 8, kind: "video" },
      { name: "Carousels", perMonth: 2, kind: "post" },
      { name: "YouTube video", perMonth: 1, kind: "video" },
    ]);
    expect(parseDeliverables("2 Blogs")).toEqual([{ name: "Blogs", perMonth: 2, kind: "other" }]);
    expect(parseDeliverables("Reels")).toBeUndefined();
    expect(parseDeliverables("")).toBeUndefined();
  });

  it("reads platforms and statuses the way they are written", () => {
    expect(parsePlatforms("Instagram, YT & FB")).toEqual(["instagram", "youtube", "facebook"]);
    expect(parsePlatforms("Google My Business / Twitter")).toEqual(["gbp", "x"]);
    expect(parsePlatforms("Instagram, Orkut")).toBeUndefined();
    expect(parseAgreementStatus("On hold")).toBe("paused");
    expect(parseAgreementStatus("Expired")).toBe("ended");
    expect(parseAgreementStatus("running")).toBe("active");
    expect(parseAgreementStatus("maybe")).toBeUndefined();
  });

  it("needs a client, dates in order, a fee and a deliverable", () => {
    const row = {
      clientCode: "KVR",
      title: "Kaveri · Growth",
      startDate: "2026-07-01",
      endDate: "2027-06-30",
      monthlyFee: 60000,
      billing: "Monthly advance",
      revisionsPerDeliverable: 2,
      shootDays: 1,
      deliverables: [{ name: "Reels", perMonth: 8, kind: "video" }],
    };
    expect(agreementImportRow.safeParse(row).data).toMatchObject({ status: "active", platforms: [] });
    const bad = agreementImportRow.safeParse({ ...row, endDate: "2026-06-30", deliverables: [] });
    expect(bad.error?.issues.map((i) => i.path[0]).sort()).toEqual(["deliverables", "endDate"]);
  });
});
