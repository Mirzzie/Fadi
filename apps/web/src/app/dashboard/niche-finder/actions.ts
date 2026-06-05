"use server";

import { buildProviderChain } from "@/lib/ai/registry";
import { ResilientProvider } from "@/lib/ai/resilient";
import { getUserProviderConfigs } from "@/lib/ai/user-settings";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { aiErrorMessage } from "@/lib/ai/providers/errors";
import { runNicheFinder } from "@/lib/niche/analyze";
import { nicheFinderInputSchema, type NicheFinderResult } from "@/lib/niche/schema";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";

export type NicheFinderActionResult =
  | { ok: true; result: NicheFinderResult }
  | { ok: false; message: string };

const LIMIT = 8;
const WINDOW_MS = 60 * 60 * 1000; // 8 analyses / hour — it's a heavier, multi-call op

export async function findNichesAction(
  input: unknown,
): Promise<NicheFinderActionResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Sign in to use the Niche Finder." };

  const parsed = nicheFinderInputSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Tell me a bit more about your situation (at least a sentence or two).",
    };
  }

  const rate = consumeRateLimit({ key: `niche-finder:${user.id}`, limit: LIMIT, windowMs: WINDOW_MS });
  if (!rate.allowed) {
    return {
      ok: false,
      message: `You've run a few analyses recently — try again in ${Math.ceil(rate.retryAfterSeconds / 60)} minute(s).`,
    };
  }

  const provider = new ResilientProvider(buildProviderChain(await getUserProviderConfigs(user.id)));
  if (!provider.isConfigured) {
    return {
      ok: false,
      message: "Add an AI provider in Settings → AI provider to run the Niche Finder.",
    };
  }

  try {
    logger.info("niche.started", { userId: user.id, model: provider.model });
    const result = await runNicheFinder(provider, parsed.data);
    return { ok: true, result };
  } catch (err) {
    logger.error("niche.failed", {
      userId: user.id,
      error: err instanceof Error ? err.message : "unknown",
    });
    return { ok: false, message: aiErrorMessage(err, { id: provider.id, name: provider.name }) };
  }
}
