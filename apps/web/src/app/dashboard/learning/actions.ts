"use server";

import { revalidatePath } from "next/cache";

import {
  createLearningCommitmentsRepository,
  createProjectRunsRepository,
} from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { commitToProject } from "@/lib/learning/commit";
import { kickOutbox } from "@/lib/outbox";
import { enqueueOutbox } from "@/lib/outbox/topics";
import { getDatabase } from "@/lib/database/client";
import { generateBlueprint, type BlueprintResult } from "@/lib/learning/blueprint";
import type { CommitmentView } from "@/lib/learning/commitments-view";
import { suggestProjectsForGap, type SuggestResult } from "@/lib/learning/suggest";
import { logger } from "@/lib/observability/logger";
import { recordForwardMotion } from "@/lib/resilience/service";
import { consumeRateLimit } from "@/lib/security/rate-limit";

const PATH = "/dashboard/learning";

/**
 * Direction-level Career Blueprint — the certification ladder + portfolio
 * proof-projects + in-demand skills to actually become the active role. Its
 * projects/certs feed the SAME growth loop (commit → complete → evidence).
 */
export async function generateBlueprintAction(): Promise<BlueprintResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const rate = await consumeRateLimit({
    key: `blueprint:${user.id}`,
    limit: 8,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return {
      ok: false,
      message:
        "A few blueprints in an hour is plenty — sit with this one and pick your next cert or project.",
    };
  }
  return generateBlueprint(user.id);
}

/** Gap → 2–3 smallest-real-project suggestions (search queries, never URLs). */
export async function suggestForGapAction(input: {
  gapTitle: string;
  gapDetail?: string;
}): Promise<SuggestResult> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const rate = await consumeRateLimit({
    key: `gap-suggest:${user.id}`,
    limit: 15,
    windowMs: 60 * 60 * 1000,
  });
  if (!rate.allowed) {
    return {
      ok: false,
      message:
        "That's a lot of project ideas in one hour — pick one and build it. More suggestions unlock shortly.",
    };
  }
  return suggestProjectsForGap(user.id, input);
}

/** Commit to a project/course — it appears in "In progress" until completed. */

export async function commitToProjectAction(input: {
  gap: string;
  title: string;
  detail?: string;
  kind?: string;
  searchQuery?: string | null;
}): Promise<{ ok: boolean; message?: string; commitment?: CommitmentView; runId?: string | null }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const result = await commitToProject(user.id, input);
  if (result.ok) revalidatePath(PATH);
  return result;
}

/**
 * Complete a commitment — the growth loop's payoff. The user's OWN words about
 * what they actually built become an evidence item, which flows into this
 * direction's base resume and every future document (human-editable in Evidence).
 * Honesty rule: no completion without real specifics — we never auto-write
 * achievements the user didn't describe.
 */
export async function completeCommitmentAction(input: { id: string; whatIBuilt: string }): Promise<{
  ok: boolean;
  message: string;
  /** A hands-on commitment must be finished from its project workspace. */
  runId?: string;
  /** Present when the completion earned momentum, so the UI can show the gain. */
  momentum?: { value: number; delta: number; band: string };
}> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    const db = getDatabase();
    const commitments = createLearningCommitmentsRepository(db);
    const commitment = await commitments.getForUser(user.id, input.id);
    if (!commitment) return { ok: false, message: "Commitment not found." };
    if (commitment.status === "completed") return { ok: true, message: "Already completed." };

    // A hands-on project already has its own verified finish path. Completing it here would
    // bypass its steps, artifacts and review screen, then create a second evidence record.
    const run = await createProjectRunsRepository(db).getForCommitment(user.id, commitment.id);
    if (run) {
      return {
        ok: false,
        message: "Finish this from its project workspace so the steps and proof stay together.",
        runId: run.id,
      };
    }

    const built = input.whatIBuilt.trim();
    if (built.length < 20) {
      return {
        ok: false,
        message:
          "Tell me what you actually built or learned (a sentence or two, real specifics) — that's what goes on the resume, in your words.",
      };
    }

    const { admitEvidence } = await import("@/lib/identity/admit");
    const candidate = {
      kind: commitment.kind === "project" ? "project" : "education",
      title: commitment.title,
      organization: null,
      period: new Date().getFullYear().toString(),
      detail: built,
      metrics: null,
      tags: commitment.gap ? [commitment.gap.toLowerCase().trim()] : [],
      origin: "learning",
    };
    const evidence = await db.transaction(async (tx) => {
      const admitted = await admitEvidence(user.id, candidate, { db: tx });
      await createLearningCommitmentsRepository(tx).completeForUser(
        user.id,
        commitment.id,
        admitted.insertedId
      );
      await enqueueOutbox(
        tx,
        user.id,
        "learning.completed",
        { evidenceItemId: admitted.insertedId, commitmentId: commitment.id },
        admitted.insertedId
      );
      return admitted.row;
    });

    // Momentum and the event stay OUTSIDE the transaction on purpose. They are
    // downstream effects, not part of the record: if the momentum write fails the
    // user still keeps the evidence they earned, which is the outcome that matters.
    // Holding a transaction open across them would also mean holding it across the
    // event bus's subscribers.
    //
    // Closing a skill gap is the most controllable forward motion there is — it is
    // the one thing a user with no network and no callbacks can always do — and the
    // engine has always priced it highest of the non-referral actions (+15). It was
    // simply never awarded: `skill_closed` was defined and never emitted (see
    // docs/DATA_FLOW_AUDIT.md, F1). The guard at the top of this function (already
    // "completed" → early return) is what keeps this idempotent.
    const motion = await recordForwardMotion(user.id, "skill_closed", {
      metadata: { commitmentId: commitment.id, evidenceItemId: evidence.id, gap: commitment.gap },
    });

    // The career record grew. Whoever cares (portfolio, Today, report staleness) hears it
    // through the outbox row written with the record, delivered from here on.
    kickOutbox();
    revalidatePath(PATH);
    revalidatePath("/dashboard/evidence");
    logger.info("learning.commitment_completed", {
      userId: user.id,
      commitmentId: commitment.id,
      evidenceId: evidence.id,
      momentumDelta: motion.delta,
    });
    return {
      ok: true,
      message:
        evidence.reviewStatus === "pending"
          ? "Completed and saved for review. Open Your evidence to decide whether this work is already recorded."
          : "Saved to Your evidence for future drafts. Existing documents have not been changed.",
      momentum: { value: motion.momentum, delta: motion.delta, band: motion.band },
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
