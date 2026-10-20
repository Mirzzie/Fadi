import "server-only";

import { consumeRateLimit } from "./rate-limit";

export type AiSpendLimit = {
  userId: string;
  operation: string;
  perUserLimit: number;
  globalLimit: number;
  windowMs: number;
};

export type AiSpendDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
  scope: "user" | "global" | null;
};

/**
 * Guard a provider-spend boundary at both blast-radius levels.
 *
 * Per-user limits protect one person's key or account. The global limit protects a
 * server-default key when many accounts or leaked extension tokens hit the same path.
 * Both are needed for F05; a user-only limit can still drain the shared credential.
 */
export async function consumeAiSpendLimit(input: AiSpendLimit): Promise<AiSpendDecision> {
  // Check the narrower allowance first. Otherwise one user continuing after their
  // own limit would consume the shared counter and could deny service to everyone.
  const user = await consumeRateLimit({
    key: `ai-spend:user:${input.operation}:${input.userId}`,
    limit: input.perUserLimit,
    windowMs: input.windowMs,
  });
  if (!user.allowed) {
    return { allowed: false, retryAfterSeconds: user.retryAfterSeconds, scope: "user" };
  }

  const global = await consumeRateLimit({
    key: `ai-spend:global:${input.operation}`,
    limit: input.globalLimit,
    windowMs: input.windowMs,
  });
  if (!global.allowed) {
    return { allowed: false, retryAfterSeconds: global.retryAfterSeconds, scope: "global" };
  }

  return { allowed: true, retryAfterSeconds: 0, scope: null };
}
