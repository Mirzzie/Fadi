import "server-only";

import {
  createCareerProfilesRepository,
  createLearningCommitmentsRepository,
} from "@careeros/database";

import { getDatabase } from "@/lib/database/client";
import { toCommitmentView, type CommitmentView } from "@/lib/learning/commitments-view";
import {
  DEFAULT_WORKSPACE,
  deservesWorkspace,
  workspaceSlug,
} from "@/lib/learning/workspace-choice";
import { logger } from "@/lib/observability/logger";

/**
 * Commit to a project or course, for a known user. Lives here — not in the server-action file
 * — because everything exported from a "use server" file is callable from the browser, and a
 * function that takes a userId there would let anyone act for anyone. The page's action checks
 * the session and calls this; Fadi's tools (voice included) call it with the caller's own id.
 */
export async function commitToProject(
  userId: string,
  input: { gap: string; title: string; detail?: string; kind?: string; searchQuery?: string | null }
): Promise<{ ok: boolean; message?: string; commitment?: CommitmentView; runId?: string | null }> {
  if (!input.title.trim()) return { ok: false, message: "The commitment needs a title." };

  try {
    const db = getDatabase();
    const track = await createCareerProfilesRepository(db).getActiveForUser(userId);
    const row = await createLearningCommitmentsRepository(db).createForUser(userId, {
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
        const planned = await planProjectRun(userId, {
          title: input.title.trim(),
          detail: input.detail?.trim() ?? null,
          commitmentId: row.id,
        });
        if (planned.ok) {
          runId = planned.plan.runId;
          await attachLocalWorkspace(userId, planned.plan.runId, input.title.trim());
        }
      } catch (error) {
        logger.warn("learning.commit_plan_failed", {
          userId: userId,
          error: error instanceof Error ? error.message : "unknown",
        });
      }
    }

    return { ok: true, commitment: toCommitmentView(row), runId };
  } catch (error) {
    logger.error("learning.commit_failed", {
      userId: userId,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't save the commitment. Please try again." };
  }
}

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
