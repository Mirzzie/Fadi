"use server";

import { revalidatePath } from "next/cache";

import {
  createCareerProfilesRepository,
  createEvidenceRepository,
  createLearningCommitmentsRepository,
} from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { publish } from "@/lib/events/bus";
import { generateBlueprint, type BlueprintResult } from "@/lib/learning/blueprint";
import { toCommitmentView, type CommitmentView } from "@/lib/learning/commitments-view";
import { suggestProjectsForGap, type SuggestResult } from "@/lib/learning/suggest";
import {
  DEFAULT_WORKSPACE,
  deservesWorkspace,
  workspaceSlug,
} from "@/lib/learning/workspace-choice";
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
  const rate = await consumeRateLimit({ key: `blueprint:${user.id}`, limit: 8, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return { ok: false, message: "A few blueprints in an hour is plenty — sit with this one and pick your next cert or project." };
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
  const rate = await consumeRateLimit({ key: `gap-suggest:${user.id}`, limit: 15, windowMs: 60 * 60 * 1000 });
  if (!rate.allowed) {
    return { ok: false, message: "That's a lot of project ideas in one hour — pick one and build it. More suggestions unlock shortly." };
  }
  return suggestProjectsForGap(user.id, input);
}

/** Commit to a project/course — it appears in "In progress" until completed. */
/**
 * Give the project somewhere to work, on this machine.
 *
 * LOCAL, because that is the default the owner chose: no account, no token, nothing leaves
 * the laptop. Pushing to GitHub or GitLab is a separate decision they make later, if the
 * work turns out to be worth pushing.
 *
 * Records the intent even when there is no workspace configured yet — the folder is made
 * when Fadi first writes into it, and recording "this project works locally" is true
 * regardless of whether the directory exists this second.
 */
async function attachLocalWorkspace(userId: string, runId: string, title: string): Promise<void> {
  const slug = workspaceSlug(title);
  const db = getDatabase();
  const { createProjectRunsRepository, createLabSettingsRepository, createLabActionsRepository } =
    await import("@careeros/database");

  await createProjectRunsRepository(db).setWorkspace(userId, runId, {
    workspaceKind: DEFAULT_WORKSPACE,
    workspaceRef: slug,
    repoUrl: null,
  });

  // AND ACTUALLY MAKE IT.
  //
  // Recording "this project works locally" and creating nothing left people with a
  // workspace that existed only in a column. The folder is the point.
  //
  // No approval prompt for this one, and the line is worth stating: the person nominated
  // this directory FOR Fadi to work in, and the path is derived from a project title they
  // just committed to — no model chose it, so there is no injected instruction to launder.
  // Writing FILES still goes through approval; making the project's own folder inside the
  // workspace is what nominating a workspace meant.
  const root = await createLabSettingsRepository(db).workspaceRoot(userId);
  if (!root) return;

  try {
    const { resolveInWorkspace } = await import("@/lib/lab/workspace");
    const resolved = await resolveInWorkspace(root, slug);
    if (!resolved.ok) return;

    const fs = await import("node:fs/promises");
    await fs.mkdir(resolved.path, { recursive: true });

    await createLabActionsRepository(db).record({
      userId,
      actor: "user",
      origin: "learning:commit",
      capability: "workspace.create",
      runId,
      decision: "allowed",
      detail: "Created the folder " + slug + " in your workspace.",
    });
  } catch (error) {
    // A folder that could not be made must not lose the project. The workspace column
    // still says where it belongs, and it is created the first time something writes.
    logger.warn("learning.workspace_create_failed", {
      userId,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}

export async function commitToProjectAction(input: {
  gap: string;
  title: string;
  detail?: string;
  kind?: string;
  searchQuery?: string | null;
}): Promise<{ ok: boolean; message?: string; commitment?: CommitmentView; runId?: string | null }> {
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
    // COMMITTING TO A BUILD SHOULD GIVE YOU THE BUILD.
    //
    // It used to create a commitment and stop; the project itself only appeared if you
    // then found "Plan the steps" on the card. That is two decisions for one intention,
    // and the second one was buried. One click now produces the project, its steps, and a
    // folder to work in.
    //
    // Best-effort on purpose: planning needs a model, and a model being rate-limited must
    // not lose the commitment the person just made. They get the commitment either way and
    // can plan it later.
    let runId: string | null = null;
    if (deservesWorkspace(input.kind ?? "project")) {
      try {
        const { planProjectRun } = await import("@/lib/lab/plan-run");
        const planned = await planProjectRun(user.id, {
          title: input.title.trim(),
          detail: input.detail?.trim() ?? null,
        });
        if (planned.ok) {
          runId = planned.plan.runId;
          await attachLocalWorkspace(user.id, planned.plan.runId, input.title.trim());
        }
      } catch (error) {
        logger.warn("learning.commit_plan_failed", {
          userId: user.id,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    revalidatePath(PATH);
    return { ok: true, commitment: toCommitmentView(row), runId };
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
}): Promise<{
  ok: boolean;
  message: string;
  /** Present when the completion earned momentum, so the UI can show the gain. */
  momentum?: { value: number; delta: number; band: string };
}> {
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

    // ATOMIC: the evidence insert and the commitment update are one unit.
    //
    // Run as two independent writes, a failure between them left the user with an
    // orphaned evidence item AND a commitment still marked in-progress — so the
    // obvious retry inserted the evidence a SECOND time. The idempotence guard above
    // only holds if the status update is guaranteed to land with the insert.
    // Resolve BEFORE opening the transaction: the read is what needs the whole pool,
    // and doing it inside would hold the transaction open across it for no benefit.
    // A finished commitment is very often work the user already recorded by hand while
    // they were doing it — that is the duplicate this catches.
    const { admitAgainst, toIdentity, UNCONFIRMED_LINK } = await import("@/lib/identity/admit");
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
    const poolRows = await createEvidenceRepository(db).listForUser(user.id);
    const metaOf = new Map(
      poolRows.map((e) => [e.id, { factId: e.factId ?? e.id, origin: e.origin, detail: e.detail }]),
    );
    const admission = admitAgainst(
      candidate,
      poolRows.map((e) =>
        toIdentity(
          { kind: e.kind, title: e.title, organization: e.organization, period: e.period, detail: e.detail, tags: e.tags },
          e.id,
        ),
      ),
      (id) => metaOf.get(id) ?? { factId: id },
    );

    const evidence = await db.transaction(async (tx) => {
      const created = await createEvidenceRepository(tx).create(user.id, {
        ...candidate,
        ...(admission.decision === "absorb"
          ? {
              factId: admission.factId,
              isCanonical: false,
              renderingFor: admission.sure ? null : UNCONFIRMED_LINK,
            }
          : {}),
      });
      await createLearningCommitmentsRepository(tx).completeForUser(
        user.id,
        commitment.id,
        created.id,
      );
      return created;
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

    // The career record grew — tell whoever cares (portfolio, and later the
    // résumé projection) rather than importing them from here.
    await publish("evidence.changed", {
      userId: user.id,
      reason: "learning_completed",
      evidenceItemId: evidence.id,
    });
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
        "Done — added to your Evidence, so it now strengthens this direction's resume and every document Fadi drafts. You can edit it any time in Evidence.",
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
