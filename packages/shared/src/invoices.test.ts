import { describe, expect, it } from "vitest";
import { financialYear, formatInvoiceNumber, invoiceSettingsInput, invoiceTotals, numberFormat, numberSeries, rupeesInWords } from "./invoices.js";

describe("invoice numbers", () => {
  it("follow the agency's format", () => {
    expect(formatInvoiceNumber("GM/{FY}/{0000}", 42, "2026-10-02")).toBe("GM/26-27/0042");
    expect(formatInvoiceNumber("INV-{YYYY}{MM}-{000}", 7, "2027-02-15")).toBe("INV-202702-007");
    expect(formatInvoiceNumber("{YY}/{0}", 1234, "2026-05-01")).toBe("26/1234");
  });

  it("restart each financial year only when the number shows it", () => {
    expect(financialYear("2026-03-31").label).toBe("2025-26");
    expect(financialYear("2026-04-01")).toEqual({ start: 2026, label: "2026-27", short: "26-27" });
    expect(numberSeries("GM/{FY}/{0000}", "2027-01-10")).toBe("2026-27");
    expect(numberSeries("GM/{0000}", "2027-01-10")).toBe("all");
  });

  it("must include the running number", () => {
    expect(numberFormat.safeParse("GM/{FY}").success).toBe(false);
    expect(numberFormat.safeParse("GM {0000}").success).toBe(false);
    expect(numberFormat.safeParse("GM/{FY}/{0000}").success).toBe(true);
  });
});

describe("GST", () => {
  const lines = [
    { quantity: 1, rate: 85000, taxRate: 18 as const },
    { quantity: 2, rate: 1501, taxRate: 18 as const },
  ];

  it("is split into CGST and SGST within the state", () => {
    expect(invoiceTotals(lines, { intraState: true, registered: true })).toEqual({
      taxable: 88002,
      cgst: 7650 + 270,
      sgst: 7650 + 270,
      igst: 0,
      total: 88002 + 2 * 7920,
      amounts: [85000, 3002],
    });
  });

  it("is IGST for another state, and nothing for an agency without a GSTIN", () => {
    expect(invoiceTotals(lines, { intraState: false, registered: true })).toMatchObject({ igst: 15300 + 540, cgst: 0, total: 88002 + 15840 });
    expect(invoiceTotals(lines, { intraState: true, registered: false })).toMatchObject({ cgst: 0, sgst: 0, igst: 0, total: 88002 });
  });

  it("checks the settings' GSTIN against the registered state", () => {
    const base = {
      legalName: "Genie Magnet",
      state: "29",
      address: "Appakudal, Erode",
      services: [{ name: "Videos", sac: "998361", rate: 18 }],
      numberFormat: "GM/{0000}",
      paymentTermsDays: 7,
    };
    const r = invoiceSettingsInput.safeParse({
      ...base,
      gstin: "33AAKFK4821M1Z5",
      bankName: "",
      accountName: "",
      accountNumber: "",
      ifsc: "",
      upiId: "",
      footer: "",
    });
    expect(r.error?.issues.map((i) => i.path.join("."))).toEqual(["state"]);
  });
});

describe("amounts in words", () => {
  it("use lakh and crore", () => {
    expect(rupeesInWords(85000)).toBe("Rupees eighty-five thousand only");
    expect(rupeesInWords(100300)).toBe("Rupees one lakh three hundred only");
    expect(rupeesInWords(2_34_56_789)).toBe("Rupees two crore thirty-four lakh fifty-six thousand seven hundred and eighty-nine only");
    expect(rupeesInWords(1)).toBe("Rupees one only");
  });
});
