import { describe, expect, it } from "vitest";
import { DEFAULT_PRODUCTION_SETTINGS as S, formatVideoCode, moveBlock, productionSettingsInput, type VideoFacts } from "./production.js";

const allSteps = Object.fromEntries(S.editSteps.map((s) => [s, { at: "x" }]));
const allPass = Object.fromEntries(S.qcChecks.map((c) => [c.key, { result: "pass" as const }]));
const v = (over: Partial<VideoFacts>): VideoFacts => ({ stage: "planned", protectedAt: null, editSteps: {}, qc: {}, latestVersion: null, ...over });

describe("moving a video", () => {
  it("checks each stage it passes going forward", () => {
    expect(moveBlock(v({ stage: "planned" }), "shot", S)).toBeNull();
    expect(moveBlock(v({ stage: "shot" }), "editing", S)).toMatch(/not backed up/);
    expect(moveBlock(v({ stage: "shot", protectedAt: "2026-10-02" }), "editing", S)).toBeNull();
    expect(moveBlock(v({ stage: "planned" }), "internal_qc", S)).toMatch(/not backed up/);
    expect(moveBlock(v({ stage: "editing", editSteps: { "Rough cut": {} } }), "internal_qc", S)).toBe("8 of 9 edit steps are still open.");
    expect(moveBlock(v({ stage: "editing", editSteps: allSteps }), "internal_qc", S)).toBeNull();
  });

  it("holds a video with a failed or open quality check", () => {
    const qc = { ...allPass, audio: { result: "fail" as const } };
    expect(moveBlock(v({ stage: "internal_qc", qc, latestVersion: "sent" }), "client_review", S)).toBe("Failed quality check: Audio levels & clarity.");
    expect(moveBlock(v({ stage: "internal_qc", qc: { brief: { result: "pass" } }, latestVersion: "sent" }), "client_review", S)).toBe(
      "10 quality checks are not done yet.",
    );
    expect(moveBlock(v({ stage: "internal_qc", qc: allPass }), "client_review", S)).toBe("Send a version to the client first.");
    expect(moveBlock(v({ stage: "internal_qc", qc: allPass, latestVersion: "sent" }), "client_review", S)).toBeNull();
  });

  it("needs the client's approval, sends revisions back through QC, and publishes only from Publishing", () => {
    expect(moveBlock(v({ stage: "client_review", latestVersion: "sent" }), "approved", S)).toMatch(/not approved/);
    expect(moveBlock(v({ stage: "client_review", latestVersion: "approved" }), "approved", S)).toBeNull();
    expect(moveBlock(v({ stage: "client_review" }), "revision", S)).toBeNull();
    expect(moveBlock(v({ stage: "editing" }), "revision", S)).toMatch(/follows the client's review/);
    expect(moveBlock(v({ stage: "revision" }), "client_review", S)).toMatch(/quality check again/);
    expect(moveBlock(v({ stage: "revision" }), "internal_qc", S)).toBeNull();
    expect(moveBlock(v({ stage: "approved" }), "published", S)).toMatch(/from Publishing/);
    expect(moveBlock(v({ stage: "published" }), "approved", S)).toMatch(/stays published/);
  });

  it("allows moving back", () => {
    expect(moveBlock(v({ stage: "internal_qc" }), "editing", S)).toBeNull();
    expect(moveBlock(v({ stage: "shot" }), "planned", S)).toBeNull();
  });
});

describe("video codes and settings", () => {
  it("follow the agency's format", () => {
    expect(formatVideoCode(S.videoCodeFormat, "KVR", "2026-09", 5)).toBe("KVR-0926-05");
    expect(formatVideoCode("{CLIENT}/{YYYY}{MM}/{000}", "SLS", "2026-11", 12)).toBe("SLS/202611/012");
  });

  it("the Growth OS defaults pass the settings rules", () => {
    expect(productionSettingsInput.safeParse(S).success).toBe(true);
    expect(productionSettingsInput.safeParse({ ...S, videoCodeFormat: "{MM}{YY}" }).error?.issues[0]?.path).toEqual(["videoCodeFormat"]);
  });
});
