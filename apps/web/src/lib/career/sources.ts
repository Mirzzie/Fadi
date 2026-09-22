import "server-only";

import { createCareerCoreRepository, type DbOrTx } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

/**
 * Keep an imported source that is being ADDED, where nothing is overwritten.
 *
 * Fadi stored one résumé text per direction and one LinkedIn paste, each replaced on save. Two
 * things became impossible: telling a later import's NEW work from its REWORDING, and answering
 * "where did this claim come from?" once the text that carried it was gone.
 *
 * Best-effort on purpose, and only safe because these doors INSERT: if the version cannot be
 * written, the person still has everything they had a moment ago, and the next save re-preserves
 * because each version is the whole text.
 *
 * A door that REPLACES stored text must use preserveThenReplace below instead. Codex read this
 * file and was right: catching the error and carrying on into a destructive overwrite is how the
 * previous text disappears with nothing kept.
 */
export async function preserveCareerSource(
  userId: string,
  input: { sourceKind: string; sourceKey: string; content: string }
): Promise<{ versionId: string; version: number; reused: boolean } | null> {
  const content = input.content.trim();
  if (!content) return null;
  try {
    const { version, reused } = await createCareerCoreRepository(getDatabase()).preserveSource(
      userId,
      { ...input, content }
    );
    logger.info("career.source_preserved", {
      userId,
      sourceKind: input.sourceKind,
      version: version.version,
      reused,
    });
    return { versionId: version.id, version: version.version, reused };
  } catch (error) {
    logger.warn("career.source_preserve_failed", {
      userId,
      sourceKind: input.sourceKind,
      error: error instanceof Error ? error.message : "unknown",
    });
    return null;
  }
}

/**
 * PRESERVE AND REPLACE, OR DO NEITHER.
 *
 * Saving a CV over the stored one is destructive: the previous text exists nowhere else. Doing
 * the preservation "best-effort" first and then overwriting regardless means a failed history
 * write silently costs the person the thing the history was for.
 *
 * So both happen in one transaction. If the version cannot be written, the replacement does not
 * happen either, the caller gets the error and the previous text is exactly where it was.
 */
export async function preserveThenReplace<T>(
  userId: string,
  input: { sourceKind: string; sourceKey: string; content: string },
  replace: (tx: DbOrTx) => Promise<T>
): Promise<T> {
  const content = input.content.trim();
  return getDatabase().transaction(async (tx) => {
    if (content) {
      const { version, reused } = await createCareerCoreRepository(tx as never).preserveSource(
        userId,
        { ...input, content }
      );
      logger.info("career.source_preserved", {
        userId,
        sourceKind: input.sourceKind,
        version: version.version,
        reused,
      });
    }
    return replace(tx);
  });
}
