import "server-only";

import { createUserAiSettingsRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import type { ProviderConfig } from "./providers/types";

export type SaveAiSettingsInput = {
  provider: string;
  model?: string | null;
  baseUrl?: string | null;
  /** Plaintext key from the form; empty keeps the existing key (or none for keyless). */
  apiKey?: string | null;
  // Optional fallback provider.
  fallbackProvider?: string | null;
  fallbackModel?: string | null;
  fallbackBaseUrl?: string | null;
  fallbackApiKey?: string | null;
};

export type AiSettingsView = {
  provider: string;
  model: string | null;
  baseUrl: string | null;
  hasKey: boolean;
  keyHint: string | null;
  fallbackProvider: string | null;
  fallbackModel: string | null;
  fallbackBaseUrl: string | null;
  hasFallbackKey: boolean;
  fallbackKeyHint: string | null;
};

function repo() {
  return createUserAiSettingsRepository(getDatabase());
}

export async function getUserAiSettingsView(userId: string): Promise<AiSettingsView | null> {
  const row = await repo().getByUserId(userId);
  if (!row) return null;
  return {
    provider: row.provider,
    model: row.model,
    baseUrl: row.baseUrl,
    hasKey: Boolean(row.apiKeyCiphertext),
    keyHint: row.apiKeyHint,
    fallbackProvider: row.fallbackProvider,
    fallbackModel: row.fallbackModel,
    fallbackBaseUrl: row.fallbackBaseUrl,
    hasFallbackKey: Boolean(row.fallbackApiKeyCiphertext),
    fallbackKeyHint: row.fallbackApiKeyHint,
  };
}

/** Primary provider config (decrypted), or null if unset. */
export async function getUserProviderConfig(userId: string): Promise<ProviderConfig | null> {
  const configs = await getUserProviderConfigs(userId);
  return configs[0] ?? null;
}

/** Ordered provider chain: [primary, fallback?] — decrypted, configured only. */
export async function getUserProviderConfigs(userId: string): Promise<ProviderConfig[]> {
  const row = await repo().getByUserId(userId);
  if (!row) return [];

  const configs: ProviderConfig[] = [];
  configs.push({
    id: row.provider,
    apiKey: row.apiKeyCiphertext ? (decryptSecret(row.apiKeyCiphertext) ?? "") : "",
    model: row.model ?? undefined,
    baseURL: row.baseUrl ?? undefined,
  });
  if (row.fallbackProvider) {
    configs.push({
      id: row.fallbackProvider,
      apiKey: row.fallbackApiKeyCiphertext
        ? (decryptSecret(row.fallbackApiKeyCiphertext) ?? "")
        : "",
      model: row.fallbackModel ?? undefined,
      baseURL: row.fallbackBaseUrl ?? undefined,
    });
  }
  return configs;
}

export async function saveUserAiSettings(
  userId: string,
  input: SaveAiSettingsInput
): Promise<void> {
  const existing = await repo().getByUserId(userId);

  const primaryKey = input.apiKey?.trim() ?? "";
  const fallbackKey = input.fallbackApiKey?.trim() ?? "";
  const hasFallback = Boolean(input.fallbackProvider);

  // SECURITY: a stored key belongs to the provider it was entered for. Only retain an existing
  // ciphertext when the provider id is UNCHANGED — otherwise an empty key box on a provider
  // switch would carry, say, an OpenAI key over to Anthropic and leak it to that vendor.
  const providerUnchanged = existing?.provider === input.provider;
  const fallbackUnchanged = hasFallback && existing?.fallbackProvider === input.fallbackProvider;

  await repo().upsert({
    userId,
    provider: input.provider,
    model: input.model?.trim() || null,
    baseUrl: input.baseUrl?.trim() || null,
    apiKeyCiphertext: primaryKey
      ? encryptSecret(primaryKey)
      : providerUnchanged
        ? (existing?.apiKeyCiphertext ?? null)
        : null,
    apiKeyHint: primaryKey
      ? primaryKey.slice(-4)
      : providerUnchanged
        ? (existing?.apiKeyHint ?? null)
        : null,
    fallbackProvider: hasFallback ? input.fallbackProvider : null,
    fallbackModel: hasFallback ? input.fallbackModel?.trim() || null : null,
    fallbackBaseUrl: hasFallback ? input.fallbackBaseUrl?.trim() || null : null,
    fallbackApiKeyCiphertext: !hasFallback
      ? null
      : fallbackKey
        ? encryptSecret(fallbackKey)
        : fallbackUnchanged
          ? (existing?.fallbackApiKeyCiphertext ?? null)
          : null,
    fallbackApiKeyHint: !hasFallback
      ? null
      : fallbackKey
        ? fallbackKey.slice(-4)
        : fallbackUnchanged
          ? (existing?.fallbackApiKeyHint ?? null)
          : null,
  });
}

export async function clearUserAiSettings(userId: string): Promise<void> {
  await repo().deleteForUser(userId);
}
