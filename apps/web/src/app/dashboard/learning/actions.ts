"use server";

import { revalidatePath } from "next/cache";

import {
  createCareerProfilesRepository,
  createEvidenceRepository,
  createLearningCommitmentsRepository,
} from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { toCommitmentView, type CommitmentView } from "@/lib/learning/commitments-view";
import { suggestProjectsForGap, type SuggestResult } from "@/lib/learning/suggest";
import { logger } from "@/lib/observability/logger";

const PATH = "/dashboard/learning";

/** Gap → 2–3 smallest-real-project suggestions (search queries, never URLs). */
export async function suggestForGapAction(input: {
  gapTitle: string;
  gapDetail?: string;
}): Promise<SuggestResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  return suggestProjectsForGap(user.id, input);
}

/** Commit to a project/course — it appears in "In progress" until completed. */
export async function commitToProjectAction(input: {
  gap: string;
  title: string;
  detail?: string;
  kind?: string;
  searchQuery?: string | null;
}): Promise<{ ok: boolean; message?: string; commitment?: CommitmentView }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!input.title.trim()) return { ok: false, message: "The commitment needs a title." };

  try {
    const db = getDatabase();
    const track = await createCareerProfilesRepository(db).getActiveForUser(user.id);
    const row = await createLearningCommitmentsRepository(db).createForUser(user.id, {
      careerProfileId: track?.id ?? null,
      gap: input.gap.trim(),
      title: input.title.trim(),
      detail: input.detail?.trim() ?? "",
      kind: input.kind ?? "project",
      searchQuery: input.searchQuery?.trim() || null,
    });
    revalidatePath(PATH);
    return { ok: true, commitment: toCommitmentView(row) };
  } catch (error) {
    logger.error("learning.commit_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't save the commitment. Please try again." };
  }
}

/**
 * Complete a commitment — the growth loop's payoff. The user's OWN words about
 * what they actually built become an evidence item, which flows into this
 * direction's base resume and every future document (human-editable in Evidence).
 * Honesty rule: no completion without real specifics — we never auto-write
 * achievements the user didn't describe.
 */
export async function completeCommitmentAction(input: {
  id: string;
  whatIBuilt: string;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const built = input.whatIBuilt.trim();
  if (built.length < 20) {
    return {
      ok: false,
      message:
        "Tell me what you actually built or learned (a sentence or two, real specifics) — that's what goes on the resume, in your words.",
    };
  }

  try {
    const db = getDatabase();
    const commitments = createLearningCommitmentsRepository(db);
    const commitment = await commitments.getForUser(user.id, input.id);
    if (!commitment) return { ok: false, message: "Commitment not found." };
    if (commitment.status === "completed") return { ok: true, message: "Already completed." };

    // Their words → evidence. kind maps: project → project; course/cert → education.
    const evidence = await createEvidenceRepository(db).create(user.id, {
      kind: commitment.kind === "project" ? "project" : "education",
      title: commitment.title,
      organization: null,
      period: new Date().getFullYear().toString(),
      detail: built,
      metrics: null,
      tags: commitment.gap ? [commitment.gap.toLowerCase().trim()] : [],
      origin: "learning",
    });

    await commitments.completeForUser(user.id, commitment.id, evidence.id);
    revalidatePath(PATH);
    revalidatePath("/dashboard/evidence");
    logger.info("learning.commitment_completed", {
      userId: user.id,
      commitmentId: commitment.id,
      evidenceId: evidence.id,
    });
    return {
      ok: true,
      message:
        "Done — added to your Evidence, so it now strengthens this direction's resume and every document Fadi drafts. You can edit it any time in Evidence.",
    };
  } catch (error) {
    logger.error("learning.complete_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't complete it. Please try again." };
  }
}

/** Drop a commitment (no shame — refocusing is a valid move). */
export async function deleteCommitmentAction(input: { id: string }): Promise<{ ok: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };
  await createLearningCommitmentsRepository(getDatabase()).deleteForUser(user.id, input.id);
  revalidatePath(PATH);
  return { ok: true };
}
