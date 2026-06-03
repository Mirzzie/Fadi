import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import type { ZodSchema } from "zod";

import type { AIMessage, AIProvider, ChatOptions, ProviderCapability } from "./types";

export class OpenAIProvider implements AIProvider {
  readonly id = "openai";
  readonly name = "OpenAI";
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

  constructor(apiKey: string | undefined, model = "gpt-4.1-mini") {
    this.model = model;
    this.isConfigured = Boolean(apiKey);
    this.client = apiKey ? new OpenAI({ apiKey }) : null;
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    if (!this.client) {
      return "Kai is not configured. Add OPENAI_API_KEY to your environment to enable AI features.";
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
          controller.enqueue(
            "Kai is not configured. Add an AI provider API key to get started.",
          );
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
            if (delta) {
              controller.enqueue(delta);
            }
          }
        } catch (err) {
          controller.enqueue(
            "\n\nKai encountered an error. Please try again in a moment.",
          );
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
      throw new Error("OpenAI provider is not configured.");
    }

    const response = await this.client.chat.completions.parse({
      model: this.model,
      messages,
      response_format: zodResponseFormat(schema, schemaName),
      temperature: options?.temperature ?? 0.4,
      safety_identifier: options?.userId,
    });

    const parsed = response.choices[0]?.message.parsed;

    if (!parsed) {
      throw new Error("AI provider returned an unparseable structured response.");
    }

    return parsed;
  }
}
