import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { z } from "zod";

/**
 * Genie Assistant's model (P4-05, ADR 0008): Claude through the official Anthropic SDK on our own account, or a
 * stand-in that makes drafts up for development and tests. The model only ever writes drafts and answers; numbers
 * and findings come from the rules and the app's own data.
 */
export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface DraftCall<T> {
  /** What the model is asked to be and do — the same for every call of a kind, so it caches. */
  system: string;
  /** The client's brand voice and past approved work: stable per client, so it caches too. */
  context: string;
  /** This draft's specifics. */
  task: string;
  schema: z.ZodType<T>;
  effort: "low" | "medium" | "high";
  maxTokens: number;
  /** What the stand-in returns. */
  standIn: () => T;
}

export interface GenieModel {
  readonly kind: "claude" | "stand-in" | "off";
  readonly model: string;
  draft<T>(call: DraftCall<T>): Promise<{ output: T; usage: ModelUsage }>;
}

export const GENIE_MODEL = Symbol("GENIE_MODEL");

/** The model would not write this (a refusal), or could not be reached: the person writes it themselves. */
export class ModelError extends Error {}

const tokens = (s: string) => Math.ceil(s.length / 4);

export class ClaudeModel implements GenieModel {
  readonly kind = "claude" as const;
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    readonly model: string,
  ) {
    this.client = new Anthropic({ apiKey, maxRetries: 2, timeout: 120_000 });
  }

  async draft<T>(c: DraftCall<T>) {
    try {
      const r = await this.client.messages.parse({
        model: this.model,
        max_tokens: c.maxTokens,
        system: [
          { type: "text", text: c.system },
          { type: "text", text: c.context, cache_control: { type: "ephemeral" } },
        ],
        messages: [{ role: "user", content: c.task }],
        output_config: { effort: c.effort, format: zodOutputFormat(c.schema) },
      });
      const usage = {
        inputTokens: r.usage.input_tokens,
        outputTokens: r.usage.output_tokens,
        cacheReadTokens: r.usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: r.usage.cache_creation_input_tokens ?? 0,
      };
      if (r.stop_reason === "refusal") throw new ModelError("Genie Assistant would not write this one — please write it yourself.");
      if (r.parsed_output == null) throw new ModelError("The draft came back incomplete — try again, or write it yourself.");
      return { output: r.parsed_output as T, usage };
    } catch (e) {
      if (e instanceof ModelError) throw e;
      if (e instanceof Anthropic.RateLimitError) throw new ModelError("Genie Assistant is busy — try again in a minute.");
      if (e instanceof Anthropic.AuthenticationError) throw new ModelError("Genie Assistant's model is not set up correctly on this server.");
      if (e instanceof Anthropic.APIError) throw new ModelError(`Genie Assistant could not write the draft (${e.status ?? "no answer"}) — try again.`);
      throw new ModelError(`Genie Assistant could not be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

/** Made-up drafts from the same inputs (development and tests), with token counts estimated so budgets can be tried. */
export class StandInModel implements GenieModel {
  readonly kind = "stand-in" as const;
  readonly model = "stand-in";
  readonly calls: { system: string; context: string; task: string }[] = [];

  async draft<T>(c: DraftCall<T>) {
    this.calls.push({ system: c.system, context: c.context, task: c.task });
    const output = c.schema.parse(c.standIn());
    return {
      output,
      usage: { inputTokens: tokens(c.system + c.context + c.task), outputTokens: tokens(JSON.stringify(output)), cacheReadTokens: 0, cacheWriteTokens: 0 },
    };
  }
}

/** A real server without our key yet: drafting is off. */
export class NoModel implements GenieModel {
  readonly kind = "off" as const;
  readonly model = "none";

  async draft<T>(): Promise<{ output: T; usage: ModelUsage }> {
    throw new ModelError("Genie Assistant's drafting is not switched on for this server yet.");
  }
}
