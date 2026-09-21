import "server-only";

import { createCareerCoreRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

/**
 * Keep an imported source before anything overwrites it.
 *
 * Fadi stored one résumé text per direction and one LinkedIn paste, each replaced on save. Two
 * things became impossible: telling a later import's NEW work from its REWORDING, and answering
 * "where did this claim come from?" once the text that carried it was gone.
 *
 * Best-effort on purpose: preserving history must never stop somebody saving their own career.
 * A failure is logged; the next save re-preserves, because each version is the whole text.
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
