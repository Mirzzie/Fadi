"use server";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { tidyDictation } from "@/lib/documents/dictation";
import { consumeRateLimit } from "@/lib/security/rate-limit";

/**
 * Clean up a dictated transcript for a document field (speak-to-edit).
 *
 * Never fails into an error the user has to handle: if there's no AI provider, the
 * rate limit bites, or the cleanup gets caught inventing something, they simply get
 * their own spoken words back. Raw speech is always publishable — it's theirs.
 */
export async function tidyDictationAction(input: { transcript: string }): Promise<{
  ok: boolean;
  text: string;
  tidied: boolean;
  /** Set when a cleanup was thrown away for inventing something. Shown honestly. */
  note?: string;
}> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, text: input.transcript, tidied: false };

  // Generous: dictation is many small calls by design (a bullet at a time), and the
  // whole point is that speaking never feels rationed.
  const limit = await consumeRateLimit({
    key: `dictation:${user.id}`,
    limit: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return {
      ok: true,
      text: input.transcript,
      tidied: false,
      note: "Using your words as spoken (cleanup is catching its breath).",
    };
  }

  const result = await tidyDictation(user.id, input.transcript);
  return {
    ok: true,
    text: result.text,
    tidied: result.tidied,
    note: result.rejected
      ? result.rejected.reason === "invented_numbers"
        ? `Kept your exact words — the cleanup tried to add a figure you didn't say (${result.rejected.details.join(", ")}).`
        : `Kept your exact words — the cleanup tried to add praise you didn't say (${result.rejected.details.join(", ")}).`
      : undefined,
  };
}
