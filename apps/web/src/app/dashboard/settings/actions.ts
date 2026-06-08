"use server";

import { revalidatePath } from "next/cache";

import { createProfilesRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { createUserProvider } from "@/lib/ai/registry";
import {
  clearUserAiSettings,
  getUserProviderConfigs,
  saveUserAiSettings,
} from "@/lib/ai/user-settings";
import { getDatabase } from "@/lib/database/client";
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

/** Toggle Kai's auto-prep — auto-draft the full doc packet when engaging a job. */
export async function setAutoPrepAction(enabled: boolean): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    await createProfilesRepository(getDatabase()).setAutoPrep(user.id, enabled);
    revalidatePath("/dashboard/settings");
    return {
      ok: true,
      message: enabled
        ? "Auto-prep on — Kai will draft your packet when you open a role."
        : "Auto-prep off — you'll draft documents manually.",
    };
  } catch (error) {
    logger.error("settings.set_auto_prep_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't update auto-prep. Please try again." };
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
export async function testAiConnectionAction(
  input: AiSettingsInput & { role?: "primary" | "fallback" },
): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  let config = {
    id: input.provider,
    apiKey: input.apiKey?.trim() ?? "",
    model: input.model?.trim() || undefined,
    baseURL: input.baseUrl?.trim() || undefined,
  };

  // No key typed → use the SAVED key for this exact slot (primary vs fallback).
  if (!config.apiKey) {
    const saved = await getUserProviderConfigs(user.id);
    const savedCfg = saved[input.role === "fallback" ? 1 : 0];
    if (savedCfg && savedCfg.id === input.provider) {
      config = { ...savedCfg, ...config, apiKey: savedCfg.apiKey };
    }
  }

  const provider = createUserProvider(config);
  if (!provider) return { ok: false, message: "Unknown provider." };
  if (!provider.validate) return { ok: false, message: "This provider can't be tested." };

  const result = await provider.validate();
  logger.info("settings.test_ai", { userId: user.id, provider: input.provider, ok: result.ok });
  return result;
}
