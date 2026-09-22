"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createDocumentsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { buildCareerContext } from "@/lib/career/context";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

/**
 * "I'VE DEALT WITH THAT" — set by the person, never inferred.
 *
 * Codex's S2-R4: after acting on a freshness notice the document still carried the snapshot it
 * was generated from, so the notice stayed up and the person had no way to end it. The obvious
 * fix — quietly re-baselining whenever a document is saved — would have Fadi assert that a
 * document reflects the current record because somebody edited a phone number. It would also
 * erase the notice for a change they never actually worked in.
 *
 * So the baseline moves only when the person says it should. This captures the record as it
 * stands now and records it as what this document answers to. It is their claim, and it is the
 * one claim they are entitled to make about their own document.
 */
export async function markDocumentCurrentAction(input: {
  documentId: string;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.documentId);
  if (!id.success) return { ok: false, message: "Unknown document." };

  const db = getDatabase();
  const repo = createDocumentsRepository(db);
  const doc = await repo.getForUser(user.id, id.data);
  if (!doc) return { ok: false, message: "That document is unavailable." };

  try {
    const context = await buildCareerContext(
      user.id,
      {
        directionId: doc.careerProfileId,
        applicationId: doc.applicationId,
        jobId: doc.jobId,
      },
      { persist: true }
    );
    const result = await repo.updateForUser(user.id, doc.id, doc.version, {
      metadata: {
        ...doc.metadata,
        careerContextSnapshotId: context.snapshotId,
        careerContextFingerprint: context.fingerprint,
        contextSchemaVersion: 1,
        // Marked by the person, not generated — so a later reader can tell the difference
        // between "written from this" and "checked against this".
        baselineMarkedAt: new Date().toISOString(),
      },
    });
    if (result.status === "conflict") {
      return { ok: false, message: "This document changed in another tab. Reload and try again." };
    }
    if (result.status !== "updated") return { ok: false, message: "That document is unavailable." };

    revalidatePath(`/dashboard/documents/${doc.id}`);
    logger.info("documents.freshness_baseline_marked", { userId: user.id, documentId: doc.id });
    return { ok: true };
  } catch (error) {
    logger.error("documents.freshness_baseline_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't update this document just now. Try again." };
  }
}
