import Anthropic from "@anthropic-ai/sdk";
import type { ZodSchema } from "zod";

import { aiErrorMessage } from "./errors";
import type {
  AIMessage,
  AIProvider,
  ChatOptions,
  ProviderCapability,
  ToolExecutor,
  ToolRunCallbacks,
  ToolRunResult,
  ToolSpec,
} from "./types";

/** Split our flat messages into Anthropic's (system string, messages[]) shape. */
function toAnthropic(messages: AIMessage[]) {
  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const turns = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));
  return { system, turns };
}

/** Same ceiling as the other provider: enough to chain, low enough to bound a mistake. */
const MAX_TOOL_ROUNDS = 5;

export class AnthropicProvider implements AIProvider {
  readonly id = "anthropic";
  readonly name = "Anthropic";
  readonly model: string;
  readonly isConfigured: boolean;
  readonly capabilities: ProviderCapability[] = [
    "chat",
    "streaming",
    "structured_output",
    "vision",
  ];

  private client: Anthropic | null;

  constructor(apiKey: string | undefined, model = "claude-sonnet-4-6") {
    this.model = model;
    this.isConfigured = Boolean(apiKey);
    this.client = apiKey ? new Anthropic({ apiKey }) : null;
  }

  /**
   * TOOL CALLING ON ANTHROPIC — absent until now, and absent SILENTLY.
   *
   * `runWithTools` is optional on the provider interface, and only the OpenAI-compatible
   * provider implemented it. The chat route filters for providers that have it and falls
   * through to "plain resilient stream (no tools)" when none do — so choosing Claude as
   * the provider turned Fadi from something that acts into something that answers, with no
   * error and no warning. That is a bug, not a limitation.
   *
   * Same bounded loop as the other provider: tools stay on the table each round, it stops
   * when the model stops asking, and it is told when it runs out so the answer can say so.
   */
  async runWithTools(
    messages: AIMessage[],
    tools: ToolSpec[],
    executeTool: ToolExecutor,
    options?: ChatOptions,
    callbacks?: ToolRunCallbacks,
  ): Promise<ToolRunResult> {
    if (!this.client) throw new Error("Fadi is not configured. Add a Claude API key in Settings.");
    const client = this.client;

    const { system, turns } = toAnthropic(messages);
    // Anthropic takes a flat {name, description, input_schema}; the registry speaks the
    // OpenAI function shape. Converted here rather than at the call site, so the registry
    // stays one vocabulary.
    const anthropicTools = tools.map((t) => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters as Anthropic.Tool.InputSchema,
    }));

    const convo: Anthropic.MessageParam[] = turns.map((t) => ({
      role: t.role,
      content: t.content as unknown as Anthropic.MessageParam["content"],
    }));
    const toolResults: ToolRunResult["toolResults"] = [];
    let rounds = 0;

    while (rounds < MAX_TOOL_ROUNDS) {
      rounds += 1;

      const step = await client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: system || undefined,
        messages: convo,
        tools: anthropicTools,
      });

      const calls = step.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      if (calls.length === 0) {
        const text = step.content
          .filter((block): block is Anthropic.TextBlock => block.type === "text")
          .map((block) => block.text)
          .join("");
        callbacks?.onToken?.(text);
        return { text, toolResults };
      }

      convo.push({ role: "assistant", content: step.content });

      // Every tool_result for one assistant turn goes back in ONE user message. Splitting
      // them across messages is accepted and quietly teaches the model to stop calling
      // tools in parallel.
      const results: Anthropic.ToolResultBlockParam[] = [];
      const executedThisRound = new Set<string>();

      for (const call of calls) {
        const args = (call.input ?? {}) as Record<string, unknown>;
        const key = `${call.name}:${JSON.stringify(args)}`;
        if (executedThisRound.has(key)) {
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: "(already provided above)",
          });
          continue;
        }
        executedThisRound.add(key);

        try {
          const result = await executeTool(call.name, args);
          toolResults.push({ name: call.name, view: result.view ?? "none", data: result.data });
          results.push({ type: "tool_result", tool_use_id: call.id, content: result.summary });
        } catch (error) {
          // A failed tool comes back AS a result with is_error, not as a dropped block.
          // Omitting it leaves a tool_use with no answer, which the API rejects.
          results.push({
            type: "tool_result",
            tool_use_id: call.id,
            content: error instanceof Error ? error.message : "That tool failed.",
            is_error: true,
          });
        }
      }

      convo.push({ role: "user", content: results });
      callbacks?.onToolResults?.(toolResults);
    }

    // Out of rounds. Told to the model rather than hidden, so its answer can admit
    // something is unfinished instead of sounding complete.
    convo.push({
      role: "user",
      content:
        "You have used all the tool calls available for this turn. Answer now with what you have, and say plainly if something is still unfinished.",
    });

    const final = await client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: system || undefined,
      messages: convo,
    });
    const text = final.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");
    callbacks?.onToken?.(text);
    return { text, toolResults };
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    if (!this.client) return "Fadi is not configured. Add a Claude API key in Settings.";
    const { system, turns } = toAnthropic(messages);
    const res = await this.client.messages.create({
      model: this.model,
      system: system || undefined,
      messages: turns,
      max_tokens: options?.maxTokens ?? 1024,
      temperature: options?.temperature ?? 0.5,
    });
    return res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");
  }

  async openChatStream(
    messages: AIMessage[],
    options?: ChatOptions,
  ): Promise<AsyncIterable<string>> {
    if (!this.client) throw new Error("AI provider is not configured.");
    const client = this.client;
    const model = this.model;
    const { system, turns } = toAnthropic(messages);
    // A probing message create would be ideal, but the stream helper surfaces
    // auth/quota errors on first iteration; we normalize that into a throw.
    async function* iterate() {
      const stream = client.messages.stream({
        model,
        system: system || undefined,
        messages: turns,
        max_tokens: options?.maxTokens ?? 1024,
        temperature: options?.temperature ?? 0.5,
      });
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          yield event.delta.text;
        }
      }
    }
    const iterator = iterate();
    // Pull the first chunk now so initial errors throw here (before streaming).
    const first = await iterator.next();
    async function* prepend() {
      if (!first.done) yield first.value;
      yield* iterator;
    }
    return prepend();
  }

  streamChat(messages: AIMessage[], options?: ChatOptions): ReadableStream<string> {
    if (!this.client) {
      return new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Fadi is not configured. Add a Claude API key in Settings.");
          controller.close();
        },
      });
    }
    const open = () => this.openChatStream(messages, options);
    return new ReadableStream<string>({
      async start(controller) {
        try {
          for await (const chunk of await open()) controller.enqueue(chunk);
        } catch (err) {
          controller.enqueue(`\n\n${aiErrorMessage(err, { id: "anthropic", name: "Anthropic" })}`);
        } finally {
          controller.close();
        }
      },
    });
  }

  async parseStructured<T>(
    messages: AIMessage[],
    schema: ZodSchema<T>,
    _schemaName: string,
    options?: ChatOptions,
  ): Promise<T> {
    if (!this.client) throw new Error("AI provider is not configured.");
    const { system, turns } = toAnthropic(messages);
    // Claude has no structured-output flag — instruct JSON and parse.
    const res = await this.client.messages.create({
      model: this.model,
      system: `${system}\n\nRespond ONLY with valid JSON matching the requested schema. No prose, no code fences.`,
      messages: turns,
      max_tokens: options?.maxTokens ?? 2048,
      temperature: options?.temperature ?? 0.4,
    });
    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim()
      .replace(/^```(?:json)?\s*|\s*```$/g, "");
    return schema.parse(JSON.parse(text));
  }

  async validate(): Promise<{ ok: boolean; message: string }> {
    if (!this.client) return { ok: false, message: "No Claude API key configured." };
    try {
      await this.client.messages.create({
        model: this.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      });
      return { ok: true, message: `Connected to Claude (${this.model}).` };
    } catch (err) {
      return { ok: false, message: aiErrorMessage(err, { id: this.id, name: this.name }) };
    }
  }
}
