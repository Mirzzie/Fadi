import Anthropic from "@anthropic-ai/sdk";
import type { ZodSchema } from "zod";

import { aiErrorMessage } from "./errors";
import type { AIMessage, AIProvider, ChatOptions, ProviderCapability } from "./types";

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

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    if (!this.client) return "Scout is not configured. Add a Claude API key in Settings.";
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
          controller.enqueue("Scout is not configured. Add a Claude API key in Settings.");
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
