import { describe, expect, it } from "vitest";
import { loadEnv } from "../env.js";
import { aiPrices, costPaise, pricesFor } from "./pricing.js";

const usage = (inputTokens: number, outputTokens: number, cacheReadTokens = 0, cacheWriteTokens = 0) => ({
  inputTokens,
  outputTokens,
  cacheReadTokens,
  cacheWriteTokens,
});

describe("what Genie Assistant's calls cost an agency", () => {
  it("follows each model's list price, cache reads and writes included", () => {
    const opus = pricesFor("claude-opus-5-5", {})!;
    // A million tokens in at $4 and a million out at $20, at ₹85 to the dollar: ₹2,040.
    expect(costPaise(usage(1_000_000, 1_000_000), opus, 85)).toBe(204_000);
    // Read from the cache, a million tokens cost $0.20 on Opus 5.5; written to it, $5.
    expect(costPaise(usage(0, 0, 1_000_000), opus, 85)).toBe(1_700);
    expect(costPaise(usage(0, 0, 0, 1_000_000), opus, 85)).toBe(42_500);
    expect(costPaise(usage(1_000_000, 1_000_000), pricesFor("claude-sonnet-5-5", {})!, 85)).toBe(102_000);
    expect(costPaise(usage(1_000_000, 1_000_000), pricesFor("claude-haiku-4-5", {})!, 85)).toBe(51_000);
    // A typical draft: 3,000 tokens in, 1,500 out, about ₹3.57 on Opus 5.5.
    expect(costPaise(usage(3_000, 1_500), opus, 85)).toBe(357);
  });

  it("uses the server's own figures where it sets them, and needs them for a model it does not know", () => {
    expect(pricesFor("claude-opus-5-5", { input: 3, output: 15 })).toEqual({ input: 3, output: 15, cacheRead: 0.2, cacheWrite: 5 });
    expect(pricesFor("some-new-model", {})).toBeNull();
    expect(pricesFor("some-new-model", { input: 2, output: 8 })).toEqual({ input: 2, output: 8, cacheRead: 0.2, cacheWrite: 2.5 });

    const db = { DATABASE_URL: "postgresql://x" };
    expect(aiPrices(loadEnv(db))).toEqual({ input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 });
    expect(aiPrices(loadEnv({ ...db, GENIE_MODEL: "claude-sonnet-5-5", AI_INPUT_USD_PER_MTOK: "" }))).toMatchObject({ input: 2, output: 10 });
    expect(() => loadEnv({ ...db, GENIE_MODEL: "some-new-model" })).toThrow(/GENIE_MODEL has no list price here/);
    expect(aiPrices(loadEnv({ ...db, GENIE_MODEL: "some-new-model", AI_INPUT_USD_PER_MTOK: "2", AI_OUTPUT_USD_PER_MTOK: "8" }))).toMatchObject({
      input: 2,
      output: 8,
    });
  });
});
