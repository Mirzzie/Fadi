"use server";

import { z } from "zod";

import { getCurrentAuthUser } from "@/lib/auth/session";
import type { ConductorView } from "@/lib/lab/conductor/evaluate";

/**
 * What this project's lab needs, what's true of it now, and the one next thing (guided labs,
 * G-1). Read-only: fixed probes from source, owner-scoped through the project. `recheck` asks
 * for fresh observations of named requirements — after a remedy, or "Check again".
 */
export async function conductorAction(input: {
  runId: string;
  recheck?: string[];
}): Promise<{ ok: true; view: ConductorView } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({
      runId: z.string().uuid(),
      recheck: z
        .array(z.string().regex(/^[a-z][a-z0-9-]{0,40}$/))
        .max(20)
        .optional(),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown project." };
  const { evaluateConductor } = await import("@/lib/lab/conductor/evaluate");
  const view = await evaluateConductor(user.id, parsed.data.runId, {
    recheck: parsed.data.recheck,
  });
  return view ? { ok: true, view } : { ok: false, message: "That project is unavailable." };
}

/**
 * Let Fadi apply the fix it diagnosed inside the person's VMware machine — after they approve
 * it (one click; it is reversible). Only a fix the conductor's last observation named, with the
 * addresses Fadi read itself: nothing about the fix comes from the page.
 */
export async function proposeLabFixAction(input: {
  runId: string;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };

  const { getDatabase } = await import("@/lib/database/client");
  const {
    createLabObservationsRepository,
    createLabResourcesRepository,
    createProjectRunsRepository,
  } = await import("@careeros/database");
  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(user.id, id.data);
  const resource = project?.run.resourceId
    ? await createLabResourcesRepository(db).get(user.id, project.run.resourceId)
    : null;
  if (!project || !resource?.guestUser) {
    return { ok: false, message: "Fadi can't sign in to this project's machine yet." };
  }
  const [seen] = (
    await createLabObservationsRepository(db).forSubjects(user.id, [`run:${id.data}`])
  ).filter((o) => o.predicateId === "lab.internet" && o.verdict === "fail");
  const remedy = seen?.evidence.remedy;
  if (remedy !== "lab.dns_forwarder" && remedy !== "lab.dns_client") {
    return { ok: false, message: "Fadi hasn't found a fix it can apply. Check again first." };
  }
  const evidence = seen!.evidence as { forwarders?: unknown; servers?: unknown };
  const previous = (remedy === "lab.dns_forwarder" ? evidence.forwarders : evidence.servers) ?? [];
  const { vmwareNatGateway } = await import("@/lib/lab/conductor/observe");
  const { proposeAction } = await import("@/lib/lab/broker");
  const proposal = await proposeAction({
    userId: user.id,
    recipe: "vmware.guestFix",
    params: {
      resourceId: resource.id,
      user: resource.guestUser,
      fix: remedy === "lab.dns_forwarder" ? "dns_forwarder" : "dns_client",
      gateway: (await vmwareNatGateway()) ?? "",
      previous: Array.isArray(previous) ? previous : [],
      label: resource.label,
    },
    actor: "user",
    origin: "dashboard:project_lab",
    runId: project.run.id,
    stepId: project.steps.find((step) => step.status === "pending")?.id ?? null,
  });
  return proposal.ok
    ? { ok: true, message: "The fix is waiting for your approval. Nothing has changed yet." }
    : { ok: false, message: proposal.message };
}
