"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createLabResourcesRepository, createProjectRunsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";

/**
 * A PROJECT'S FRESH START: progress to zero, no earlier plans, and its environment new — the
 * OS too. Fadi's container lab gets a fresh disk (copied from the saved base at the next start,
 * so no download and no Setup); the person's VMware machine returns to its clean-start
 * snapshot; the services beside it lose their data. One typed approval for the environment;
 * the project itself is cleared when that has run. Then the person can pick where it runs —
 * Docker or VMware — and plan it against the fresh machine.
 */

async function freshStartPlan(userId: string, runId: string) {
  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(userId, runId);
  if (!project) return { ok: false as const, message: "That project is gone." };
  const { labNameForRun, storageVolumeFor } = await import("@/lib/lab/templates");
  const { containerState, volumeExists } = await import("@/lib/lab/runtime-observer");
  const { stacksForProject, stackFolder, stackProject } = await import("@/lib/lab/stacks");
  const { existsSync } = await import("node:fs");
  const name = labNameForRun(project.run.id);

  let vmware: { resourceId: string; label: string } | null = null;
  if (project.run.resourceId) {
    const resource = await createLabResourcesRepository(db).get(userId, project.run.resourceId);
    const { hasCleanSnapshot, vmxPathOf } = await import("@/lib/lab/vmware");
    const vmx = vmxPathOf(resource?.endpoint);
    if (resource && vmx) {
      if ((await hasCleanSnapshot(vmx)) !== true) {
        return {
          ok: false as const,
          needsSnapshot: true,
          message: `${resource.label} has no clean start to return to yet. Put it in the state every fresh start should begin from, then “Save clean start”.`,
        };
      }
      vmware = { resourceId: resource.id, label: resource.label };
    }
  }
  const container = Boolean(await containerState(name));
  const disk = await volumeExists(storageVolumeFor(`fadi-${name}`));
  const stacks = stacksForProject({ title: project.run.title, detail: project.run.detail }).filter(
    (key) => existsSync(stackFolder(stackProject(name, key)))
  );
  return { ok: true as const, project, name, container, disk, stacks, vmware };
}

export async function proposeFreshStartAction(input: {
  runId: string;
}): Promise<{ ok: boolean; message: string; needsSnapshot?: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };
  const plan = await freshStartPlan(user.id, id.data);
  if (!plan.ok) return plan;

  // Nothing of the environment exists yet: only the project itself to clear.
  if (!plan.vmware && !plan.container && !plan.disk && plan.stacks.length === 0) {
    await createProjectRunsRepository(getDatabase()).resetProgress(user.id, plan.project.run.id);
    revalidatePath("/dashboard/learning");
    return { ok: true, message: "Fresh start: no progress, no earlier plans. Choose where it runs, start it, then plan the steps." };
  }

  const { proposeAction } = await import("@/lib/lab/broker");
  const proposal = await proposeAction({
    userId: user.id,
    recipe: "project.reset",
    params: {
      name: plan.name,
      container: plan.container,
      disk: plan.disk,
      stacks: plan.stacks,
      ...(plan.vmware ? { resourceId: plan.vmware.resourceId } : {}),
    },
    actor: "user",
    origin: "dashboard:project_reset",
    runId: plan.project.run.id,
  });
  return proposal.ok
    ? { ok: true, message: "The fresh start is waiting for your approval — type the lab's name. Nothing has changed yet." }
    : { ok: false, message: proposal.message };
}

/** Mark the VMware machine's current state as the clean start a reset returns to. */
export async function proposeCleanSnapshotAction(input: {
  runId: string;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };
  const project = await createProjectRunsRepository(getDatabase()).getWithSteps(user.id, id.data);
  if (!project?.run.resourceId) {
    return { ok: false, message: "This project isn't on one of your VMware machines." };
  }
  const { proposeAction } = await import("@/lib/lab/broker");
  const proposal = await proposeAction({
    userId: user.id,
    recipe: "vmware.snapshot",
    params: { resourceId: project.run.resourceId },
    actor: "user",
    origin: "dashboard:project_reset",
    runId: project.run.id,
  });
  return proposal.ok
    ? { ok: true, message: "Saving the clean start is waiting for your approval." }
    : { ok: false, message: proposal.message };
}
