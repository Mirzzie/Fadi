import "server-only";

import type { DocGenerate } from "@/lib/ai/doc-generate";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { buildProviderChain } from "./registry";
import { getUserProviderConfigs } from "./user-settings";

/**
 * Thrown when a user has spent their AI allowance for the window. Distinct from a
 * provider failure: nothing is wrong, they simply need to wait.
 */
export class AiRateLimitError extends Error {
  constructor(public readonly retryAfterSeconds: number) {
    const mins = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    super(
      `That's a lot of drafting in one go — your AI allowance resets in about ${mins} minute${mins === 1 ? "" : "s"}. Nothing is lost; everything you've written is saved.`,
    );
    this.name = "AiRateLimitError";
  }
}

/**
 * Generous by design: a real session might draft a résumé + cover letter, review both,
 * and fit-check several roles — easily a dozen calls. This is not a usage quota, it is
 * a runaway guard. It exists to stop a retry loop, a held-down button, or a leaked MCP
 * token from emptying the user's own API key while they sleep.
 */
const AI_CALLS_PER_HOUR = 60;

/**
 * The rate limit lives HERE, at the chokepoint, and not in the server actions.
 *
 * Every AI call in the platform funnels through the two methods below, so guarding
 * them is the only way to make the limit unforgettable. The alternative — a
 * `consumeRateLimit` in each of the 12 call sites across 5 action files — is precisely
 * the pattern that produced F1 (docs/DATA_FLOW_AUDIT.md): a "single chokepoint" that
 * every caller was trusted to invoke, and which some simply never did. A guard that
 * relies on being remembered is not a guard.
 *
 * This is BYO-key: the blast radius of an unmetered loop lands on the user's own
 * OpenAI/Groq bill, which makes it their money, not ours.
 */
async function chargeOrThrow(userId: string): Promise<void> {
  const rate = await consumeRateLimit({
    key: `ai-generate:${userId}`,
    limit: AI_CALLS_PER_HOUR,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    logger.warn("ai.rate_limited", { userId, retryAfterSeconds: rate.retryAfterSeconds });
    throw new AiRateLimitError(rate.retryAfterSeconds);
  }
}

/** Build the document-generation capability from the user's configured provider. */
export async function getUserDocGenerate(userId: string): Promise<DocGenerate | null> {
  const chain = buildProviderChain(await getUserProviderConfigs(userId));
  const provider = chain[0];
  if (!provider) return null;
  return {
    structured: async (system, user, schema, name) => {
      await chargeOrThrow(userId);
      return provider.parseStructured(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        schema,
        name,
        { temperature: 0.4 },
      );
    },
    text: async (system, user) => {
      await chargeOrThrow(userId);
      return provider.chat(
        [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        { temperature: 0.6 },
      );
    },
  };
}
