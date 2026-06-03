import type { ZodSchema } from "zod";

import type { AIMessage, AIProvider, ChatOptions, ProviderCapability } from "./types";

/**
 * Anthropic/Claude provider stub.
 * Install @anthropic-ai/sdk and implement when switching to Claude.
 * The interface contract is identical to OpenAIProvider so the swap is seamless.
 */
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

  constructor(apiKey: string | undefined, model = "claude-sonnet-4-6") {
    this.model = model;
    this.isConfigured = Boolean(apiKey);
  }

  async chat(_messages: AIMessage[], _options?: ChatOptions): Promise<string> {
    if (!this.isConfigured) {
      return "Kai is not configured. Add ANTHROPIC_API_KEY to your environment.";
    }
    throw new Error(
      "Anthropic provider: install @anthropic-ai/sdk and implement AnthropicProvider.chat().",
    );
  }

  streamChat(_messages: AIMessage[], _options?: ChatOptions): ReadableStream<string> {
    const isConfigured = this.isConfigured;

    return new ReadableStream<string>({
      start(controller) {
        if (!isConfigured) {
          controller.enqueue(
            "Kai is not configured. Add ANTHROPIC_API_KEY to your environment.",
          );
        } else {
          controller.enqueue(
            "Anthropic streaming: install @anthropic-ai/sdk and implement AnthropicProvider.streamChat().",
          );
        }
        controller.close();
      },
    });
  }

  async parseStructured<T>(
    _messages: AIMessage[],
    _schema: ZodSchema<T>,
    _schemaName: string,
    _options?: ChatOptions,
  ): Promise<T> {
    throw new Error(
      "Anthropic provider: install @anthropic-ai/sdk and implement AnthropicProvider.parseStructured().",
    );
  }
}
