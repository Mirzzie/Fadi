import "server-only";

import { and, eq } from "drizzle-orm";

import { careerContextSnapshots } from "@careeros/database";

import { buildCareerContext } from "@/lib/career/context";
import { getDatabase } from "@/lib/database/client";
import {
  capturedContextOf,
  freshnessAsk,
  freshnessNote,
  nothingChanged,
  whatChanged,
  type ContextRecord,
  type DocumentFreshness,
} from "@/lib/documents/freshness";
import { logger } from "@/lib/observability/logger";

type DocumentLike = {
  metadata: Record<string, unknown>;
  careerProfileId: string | null;
  applicationId: string | null;
  jobId: string | null;
};

export async function documentFreshness(
  userId: string,
  doc: DocumentLike
): Promise<DocumentFreshness> {
  const captured = capturedContextOf(doc.metadata);
  if (!captured) return { state: "unknown" };

  try {
    const db = getDatabase();
    const current = await buildCareerContext(userId, {
      directionId: doc.careerProfileId,
      applicationId: doc.applicationId,
      jobId: doc.jobId,
    });
    if (captured.fingerprint && captured.fingerprint === current.fingerprint) {
      return { state: "current" };
    }
    // The person saw this exact state of their record and chose to keep the document. That is a
    // dismissal, not an update — the document is not claimed to be current, the notice simply
    // does not repeat itself until the record moves again (Codex C15-06).
    if (captured.acknowledged && captured.acknowledged === current.fingerprint) {
      return { state: "kept" };
    }

    // The fingerprint covers the job text and the direction too, so a changed fingerprint is not
    // by itself a changed RECORD. Only the person's own material is worth interrupting them for.
    const snapshot = captured.snapshotId
      ? (
          await db
            .select()
            .from(careerContextSnapshots)
            .where(
              and(
                eq(careerContextSnapshots.userId, userId),
                eq(careerContextSnapshots.id, captured.snapshotId)
              )
            )
            .limit(1)
        )[0]
      : null;
    if (!snapshot) {
      // The fingerprint says it differs but the material it was written from is gone, so there is
      // nothing to name. Saying "something changed" without saying what is no better than silence.
      return { state: "unknown" };
    }

    const before = ((snapshot.payload as { records?: ContextRecord[] }).records ?? []) as ContextRecord[];
    const after = (current.payload.records ?? []) as ContextRecord[];
    const changes = whatChanged(before, after);
    if (nothingChanged(changes)) return { state: "current" };

    return {
      state: "stale",
      note: freshnessNote(changes),
      ask: freshnessAsk(changes),
      changes,
    };
  } catch (error) {
    // A document whose direction or application has since been removed cannot be compared. That
    // is an unknown, never a claim in either direction.
    logger.warn("documents.freshness_unavailable", {
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { state: "unknown" };
  }
}
