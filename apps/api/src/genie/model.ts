import Anthropic from "@anthropic-ai/sdk";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";
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

/** A read-only tool Ask Genie may use: it runs as the person asking, with their permissions. */
export interface AskTool {
  name: string;
  description: string;
  input: z.ZodObject;
  run(input: Record<string, unknown>): Promise<unknown>;
}

export interface AskCall {
  system: string;
  /** The conversation so far, oldest first, ending with the new question. */
  messages: { role: "user" | "assistant"; content: string }[];
  tools: AskTool[];
  /** What the stand-in answers (it uses the same tools). */
  standIn: () => Promise<string>;
}

export interface GenieModel {
  readonly kind: "claude" | "stand-in" | "off";
  readonly model: string;
  draft<T>(call: DraftCall<T>): Promise<{ output: T; usage: ModelUsage }>;
  ask(call: AskCall): Promise<{ text: string; usage: ModelUsage }>;
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

  /** Answers with the SDK's tool runner: the model calls the read-only tools as often as it needs (a few rounds at most). */
  async ask(c: AskCall) {
    const usage: ModelUsage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 };
    try {
      const runner = this.client.beta.messages.toolRunner({
        model: this.model,
        max_tokens: 8000,
        max_iterations: 6,
        output_config: { effort: "medium" },
        system: [{ type: "text", text: c.system, cache_control: { type: "ephemeral" } }],
        messages: c.messages,
        tools: c.tools.map((t) =>
          betaZodTool({
            name: t.name,
            description: t.description,
            inputSchema: t.input,
            run: async (input) => JSON.stringify(await t.run(input as Record<string, unknown>)),
          }),
        ),
      });
      let last: Anthropic.Beta.BetaMessage | null = null;
      for await (const message of runner) {
        last = message;
        usage.inputTokens += message.usage.input_tokens;
        usage.outputTokens += message.usage.output_tokens;
        usage.cacheReadTokens += message.usage.cache_read_input_tokens ?? 0;
        usage.cacheWriteTokens += message.usage.cache_creation_input_tokens ?? 0;
      }
      if (!last) throw new ModelError("Genie Assistant did not answer — try again.");
      if (last.stop_reason === "refusal") throw new ModelError("Genie Assistant would not answer that one.");
      const text = last.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      if (!text) throw new ModelError("Genie Assistant ran out of steps before answering — ask a narrower question.");
      return { text, usage };
    } catch (e) {
      if (e instanceof ModelError) throw e;
      if (e instanceof Anthropic.RateLimitError) throw new ModelError("Genie Assistant is busy — try again in a minute.");
      if (e instanceof Anthropic.AuthenticationError) throw new ModelError("Genie Assistant's model is not set up correctly on this server.");
      if (e instanceof Anthropic.APIError) throw new ModelError(`Genie Assistant could not answer (${e.status ?? "no answer"}) — try again.`);
      throw new ModelError(`Genie Assistant could not be reached: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

/** Made-up drafts from the same inputs (development and tests), with token counts estimated so budgets can be tried. */
export class StandInModel implements GenieModel {
  readonly kind = "stand-in" as const;
  readonly model = "stand-in";
  readonly calls: { system: string; context: string; task: string }[] = [];
  readonly questions: AskCall["messages"][] = [];

  async draft<T>(c: DraftCall<T>) {
    this.calls.push({ system: c.system, context: c.context, task: c.task });
    const output = c.schema.parse(c.standIn());
    return {
      output,
      usage: { inputTokens: tokens(c.system + c.context + c.task), outputTokens: tokens(JSON.stringify(output)), cacheReadTokens: 0, cacheWriteTokens: 0 },
    };
  }

  async ask(c: AskCall) {
    this.questions.push(c.messages);
    const text = await c.standIn();
    return {
      text,
      usage: { inputTokens: tokens(c.system + c.messages.map((m) => m.content).join("")), outputTokens: tokens(text), cacheReadTokens: 0, cacheWriteTokens: 0 },
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

  async ask(): Promise<{ text: string; usage: ModelUsage }> {
    throw new ModelError("Ask Genie is not switched on for this server yet.");
  }
}
