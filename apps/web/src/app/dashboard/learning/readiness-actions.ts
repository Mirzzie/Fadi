"use server";

import { z } from "zod";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import type { Readiness } from "@/lib/lab/readiness";

/** Can this project's lab run here, and will it run well? Measured; changes nothing. */
export async function projectReadinessAction(input: {
  runId: string;
}): Promise<{ ok: true; readiness: Readiness } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };
  const { createProjectRunsRepository } = await import("@careeros/database");
  const project = await createProjectRunsRepository(getDatabase()).getWithSteps(user.id, id.data);
  if (!project) return { ok: false, message: "That project is unavailable." };

  const { readinessFor } = await import("@/lib/lab/readiness-run");
  return { ok: true, readiness: await readinessFor(user.id, project.run) };
}

/** One click from a readiness warning to the fix: proposed, then approved by the person. */
export async function proposeMachineFixAction(input: {
  runId: string;
  fix: "memory" | "move";
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({ runId: z.string().uuid(), fix: z.enum(["memory", "move"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown fix." };
  const { createProjectRunsRepository } = await import("@careeros/database");
  const project = await createProjectRunsRepository(getDatabase()).getWithSteps(
    user.id,
    parsed.data.runId
  );
  if (!project?.run.resourceId) {
    return { ok: false, message: "This project isn't on one of your VMware machines." };
  }
  const { readVmxSummary, vmxPathOf } = await import("@/lib/lab/vmware");
  const { createLabResourcesRepository } = await import("@careeros/database");
  const resource = await createLabResourcesRepository(getDatabase()).get(
    user.id,
    project.run.resourceId
  );
  const vmx = vmxPathOf(resource?.endpoint);
  if (!resource || !vmx) {
    return { ok: false, message: "This project isn't on one of your VMware machines." };
  }
  const family = (await readVmxSummary(vmx))?.family ?? "other";
  const { proposeAction } = await import("@/lib/lab/broker");
  const proposal = await proposeAction({
    userId: user.id,
    recipe: parsed.data.fix === "memory" ? "vmware.memory" : "vmware.move",
    params:
      parsed.data.fix === "memory"
        ? { resourceId: resource.id, memoryMb: family === "linux" ? 2048 : 4096 }
        : { resourceId: resource.id },
    actor: "user",
    origin: "dashboard:project_lab",
    runId: project.run.id,
  });
  return proposal.ok
    ? { ok: true, message: "Waiting for your approval. Nothing has changed yet." }
    : { ok: false, message: proposal.message };
}
