"use server";

import { revalidatePath } from "next/cache";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { createUserProvider } from "@/lib/ai/registry";
import {
  clearUserAiSettings,
  getUserProviderConfig,
  saveUserAiSettings,
} from "@/lib/ai/user-settings";
import { logger } from "@/lib/observability/logger";

type Result = { ok: boolean; message: string };

type AiSettingsInput = {
  provider: string;
  model?: string;
  baseUrl?: string;
  apiKey?: string;
  fallbackProvider?: string;
  fallbackModel?: string;
  fallbackBaseUrl?: string;
  fallbackApiKey?: string;
};

export async function saveAiSettingsAction(input: AiSettingsInput): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    await saveUserAiSettings(user.id, input);
    revalidatePath("/dashboard/settings");
    return { ok: true, message: "AI provider saved." };
  } catch (error) {
    logger.error("settings.save_ai_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't save your settings. Please try again." };
  }
}

export async function removeAiSettingsAction(): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  await clearUserAiSettings(user.id);
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "AI provider removed. Kai will use the server default if available." };
}

/**
 * Test a connection. Uses the key typed in the form if present, otherwise the
 * already-saved key. Returns an honest message either way.
 */
export async function testAiConnectionAction(input: AiSettingsInput): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  let config = {
    id: input.provider,
    apiKey: input.apiKey?.trim() ?? "",
    model: input.model?.trim() || undefined,
    baseURL: input.baseUrl?.trim() || undefined,
  };

  // No key typed → fall back to the saved (decrypted) key.
  if (!config.apiKey) {
    const saved = await getUserProviderConfig(user.id);
    if (saved && saved.id === input.provider) config = { ...saved, ...config, apiKey: saved.apiKey };
  }

  const provider = createUserProvider(config);
  if (!provider) return { ok: false, message: "Unknown provider." };
  if (!provider.validate) return { ok: false, message: "This provider can't be tested." };

  const result = await provider.validate();
  logger.info("settings.test_ai", { userId: user.id, provider: input.provider, ok: result.ok });
  return result;
}
