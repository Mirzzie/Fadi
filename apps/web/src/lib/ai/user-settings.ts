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
};

/** Safe view for the settings UI — never includes the key, only a hint. */
export type AiSettingsView = {
  provider: string;
  model: string | null;
  baseUrl: string | null;
  hasKey: boolean;
  keyHint: string | null;
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
  };
}

/** Decrypted provider config for actually calling the model. Null if unset. */
export async function getUserProviderConfig(userId: string): Promise<ProviderConfig | null> {
  const row = await repo().getByUserId(userId);
  if (!row) return null;

  const apiKey = row.apiKeyCiphertext ? (decryptSecret(row.apiKeyCiphertext) ?? "") : "";
  return {
    id: row.provider,
    apiKey,
    model: row.model ?? undefined,
    baseURL: row.baseUrl ?? undefined,
  };
}

export async function saveUserAiSettings(
  userId: string,
  input: SaveAiSettingsInput,
): Promise<void> {
  const existing = await repo().getByUserId(userId);

  // A blank key on an existing row means "keep the current key".
  const trimmedKey = input.apiKey?.trim() ?? "";
  const apiKeyCiphertext = trimmedKey
    ? encryptSecret(trimmedKey)
    : (existing?.apiKeyCiphertext ?? null);
  const apiKeyHint = trimmedKey
    ? trimmedKey.slice(-4)
    : (existing?.apiKeyHint ?? null);

  await repo().upsert({
    userId,
    provider: input.provider,
    model: input.model?.trim() || null,
    baseUrl: input.baseUrl?.trim() || null,
    apiKeyCiphertext,
    apiKeyHint,
  });
}

export async function clearUserAiSettings(userId: string): Promise<void> {
  await repo().deleteForUser(userId);
}
