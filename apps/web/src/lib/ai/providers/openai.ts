import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ZodSchema } from "zod";

import { aiErrorMessage } from "./errors";
import type { AIMessage, AIProvider, ChatOptions, ProviderCapability } from "./types";

/**
 * OpenAI-compatible provider. Works for OpenAI itself and any compatible
 * endpoint (Groq, Ollama, Google's OpenAI-compat gateway) via `baseURL`.
 */
export class OpenAIProvider implements AIProvider {
  readonly id: string;
  readonly name: string;
  readonly model: string;
  readonly isConfigured: boolean;
  readonly capabilities: ProviderCapability[] = [
    "chat",
    "streaming",
    "structured_output",
    "realtime_voice",
    "tts",
    "stt",
    "vision",
  ];

  private client: OpenAI | null;

  constructor(
    apiKey: string | undefined,
    model = "gpt-4.1-mini",
    options: { baseURL?: string; id?: string; name?: string; keyless?: boolean } = {},
  ) {
    this.id = options.id ?? "openai";
    this.name = options.name ?? "OpenAI";
    this.model = model;
    // Keyless local endpoints (Ollama) are "configured" once a baseURL exists.
    this.isConfigured = Boolean(apiKey) || (Boolean(options.keyless) && Boolean(options.baseURL));
    this.client =
      apiKey || options.keyless
        ? new OpenAI({ apiKey: apiKey || "ollama", baseURL: options.baseURL })
        : null;
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    if (!this.client) {
      return "Kai is not configured. Add an AI provider and API key in Settings.";
    }
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages,
      temperature: options?.temperature ?? 0.5,
      max_tokens: options?.maxTokens,
    });
    return response.choices[0]?.message.content ?? "";
  }

  streamChat(messages: AIMessage[], options?: ChatOptions): ReadableStream<string> {
    const client = this.client;
    const model = this.model;

    if (!client) {
      return new ReadableStream<string>({
        start(controller) {
          controller.enqueue("Kai is not configured. Add an AI provider and API key in Settings.");
          controller.close();
        },
      });
    }

    return new ReadableStream<string>({
      async start(controller) {
        try {
          const stream = await client.chat.completions.create({
            model,
            messages,
            temperature: options?.temperature ?? 0.5,
            max_tokens: options?.maxTokens,
            stream: true,
          });
          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta.content ?? "";
            if (delta) controller.enqueue(delta);
          }
        } catch (err) {
          // Honest failure — tell the user the real cause.
          controller.enqueue(`\n\n${aiErrorMessage(err)}`);
        } finally {
          controller.close();
        }
      },
    });
  }

  async parseStructured<T>(
    messages: AIMessage[],
    schema: ZodSchema<T>,
    schemaName: string,
    options?: ChatOptions,
  ): Promise<T> {
    if (!this.client) {
      throw new Error("AI provider is not configured.");
    }
    const response = await this.client.chat.completions.parse({
      model: this.model,
      messages,
      response_format: zodResponseFormat(schema, schemaName),
      temperature: options?.temperature ?? 0.4,
    });
    const parsed = response.choices[0]?.message.parsed;
    if (!parsed) {
      throw new Error("AI provider returned an unparseable structured response.");
    }
    return parsed;
  }

  /** Cheap call to confirm the key/model/endpoint actually work. */
  async validate(): Promise<{ ok: boolean; message: string }> {
    if (!this.client) {
      return { ok: false, message: "No API key configured for this provider." };
    }
    try {
      await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: 1,
      });
      return { ok: true, message: `Connected to ${this.name} (${this.model}).` };
    } catch (err) {
      return { ok: false, message: aiErrorMessage(err) };
    }
  }
}
