import type { ModelUsage } from "./model.js";

/** US dollars per million tokens. */
export interface ModelPrices {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * Anthropic's list prices for the models Genie Assistant may run on
 * (https://platform.claude.com/docs/en/about-claude/pricing). Cache writes are the five-minute kind the app uses.
 */
export const MODEL_PRICES: Record<string, ModelPrices> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
  "claude-haiku-4-5": { input: 1, output: 5, cacheRead: 0.1, cacheWrite: 1.25 },
};

export type PriceOverrides = Partial<ModelPrices>;

/**
 * The prices each agency's budget is metered with: the server's own figures where it sets them (a negotiated rate, a
 * model not listed here), else the model's list price. Null when neither gives an input and an output price.
 */
export function pricesFor(model: string, overrides: PriceOverrides): ModelPrices | null {
  const list = MODEL_PRICES[model];
  const input = overrides.input ?? list?.input;
  const output = overrides.output ?? list?.output;
  if (input === undefined || output === undefined) return null;
  return {
    input,
    output,
    cacheRead: overrides.cacheRead ?? list?.cacheRead ?? input * 0.1,
    cacheWrite: overrides.cacheWrite ?? list?.cacheWrite ?? input * 1.25,
  };
}

/** The prices the server meters with, from its settings. */
export const aiPrices = (env: {
  GENIE_MODEL: string;
  AI_INPUT_USD_PER_MTOK?: number;
  AI_OUTPUT_USD_PER_MTOK?: number;
  AI_CACHE_READ_USD_PER_MTOK?: number;
  AI_CACHE_WRITE_USD_PER_MTOK?: number;
}) =>
  pricesFor(env.GENIE_MODEL, {
    input: env.AI_INPUT_USD_PER_MTOK,
    output: env.AI_OUTPUT_USD_PER_MTOK,
    cacheRead: env.AI_CACHE_READ_USD_PER_MTOK,
    cacheWrite: env.AI_CACHE_WRITE_USD_PER_MTOK,
  });

/** What a call cost, in paise. */
export function costPaise(u: ModelUsage, p: ModelPrices, usdToInr: number) {
  const usd = (u.inputTokens * p.input + u.cacheWriteTokens * p.cacheWrite + u.cacheReadTokens * p.cacheRead + u.outputTokens * p.output) / 1e6;
  return Math.round(usd * usdToInr * 100);
}
