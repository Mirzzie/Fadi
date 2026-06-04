import "server-only";

import type { ZodSchema } from "zod";

import { logger } from "@/lib/observability/logger";
import { aiErrorMessage, isProviderExhausted, isRateLimited } from "./providers/errors";
import type { AIMessage, AIProvider, ChatOptions, ProviderCapability } from "./providers/types";

const MAX_RATE_LIMIT_RETRIES = 2;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function streamToIterable(stream: ReadableStream<string>): Promise<AsyncIterable<string>> {
  const reader = stream.getReader();
  return {
    async *[Symbol.asyncIterator]() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) return;
          if (value) yield value;
        }
      } finally {
        reader.releaseLock();
      }
    },
  };
}

/** Open a provider's stream, retrying genuine rate limits with backoff. Throws otherwise. */
async function openWithRetry(
  provider: AIProvider,
  messages: AIMessage[],
  options?: ChatOptions,
): Promise<AsyncIterable<string>> {
  if (!provider.openChatStream) {
    // Provider can't signal early failure — pipe its stream as-is (no fallback).
    return streamToIterable(provider.streamChat(messages, options));
  }

  let attempt = 0;
  for (;;) {
    try {
      return await provider.openChatStream(messages, options);
    } catch (err) {
      if (isRateLimited(err) && attempt < MAX_RATE_LIMIT_RETRIES) {
        const delay = 800 * 2 ** attempt;
        logger.warn("ai.rate_limited_retry", { provider: provider.id, attempt, delayMs: delay });
        await sleep(delay);
        attempt += 1;
        continue;
      }
      throw err;
    }
  }
}

/**
 * Stream a chat across an ordered provider chain (primary → fallback). Retries
 * transient rate limits with backoff; when a provider is exhausted (no quota /
 * bad key), switches to the next. Emits an honest message only if all fail.
 */
export function createResilientChatStream(
  providers: AIProvider[],
  messages: AIMessage[],
  options?: ChatOptions,
): ReadableStream<string> {
  return new ReadableStream<string>({
    async start(controller) {
      for (let i = 0; i < providers.length; i++) {
        const provider = providers[i];
        const isLast = i === providers.length - 1;
        try {
          const iterable = await openWithRetry(provider, messages, options);
          for await (const chunk of iterable) controller.enqueue(chunk);
          controller.close();
          return;
        } catch (err) {
          logger.warn("ai.provider_failed", {
            provider: provider.id,
            isLast,
            exhausted: isProviderExhausted(err),
          });
          if (isLast) {
            controller.enqueue(`\n\n${aiErrorMessage(err)}`);
            controller.close();
            return;
          }
          // Transparent switch — the user sees Kai stay up via the fallback.
          controller.enqueue("\n\n_(Primary AI provider unavailable — switching to your fallback…)_\n\n");
        }
      }
      controller.close();
    },
  });
}

/**
 * A single AIProvider that wraps an ordered chain and applies retry + fallback.
 * Drop-in anywhere a provider is expected (Kai chat, application agent), so every
 * surface gets resilience for free.
 */
export class ResilientProvider implements AIProvider {
  readonly id = "resilient";
  readonly name: string;
  readonly model: string;
  readonly isConfigured: boolean;
  readonly capabilities: ProviderCapability[];

  constructor(private readonly chain: AIProvider[]) {
    const head = chain[0];
    this.name = head?.name ?? "AI";
    this.model = head?.model ?? "";
    this.isConfigured = chain.some((p) => p.isConfigured);
    this.capabilities = head?.capabilities ?? ["chat", "streaming"];
  }

  streamChat(messages: AIMessage[], options?: ChatOptions): ReadableStream<string> {
    return createResilientChatStream(this.chain, messages, options);
  }

  async chat(messages: AIMessage[], options?: ChatOptions): Promise<string> {
    let lastErr: unknown;
    for (const provider of this.chain) {
      try {
        return await provider.chat(messages, options);
      } catch (err) {
        lastErr = err;
        if (!isProviderExhausted(err) && !isRateLimited(err)) break;
      }
    }
    return aiErrorMessage(lastErr);
  }

  async parseStructured<T>(
    messages: AIMessage[],
    schema: ZodSchema<T>,
    schemaName: string,
    options?: ChatOptions,
  ): Promise<T> {
    let lastErr: unknown;
    for (const provider of this.chain) {
      try {
        return await provider.parseStructured(messages, schema, schemaName, options);
      } catch (err) {
        lastErr = err;
        if (!isProviderExhausted(err) && !isRateLimited(err)) break;
      }
    }
    throw lastErr ?? new Error("No AI provider available.");
  }
}
