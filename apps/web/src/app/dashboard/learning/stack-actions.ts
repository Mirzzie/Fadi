"use server";

import { z } from "zod";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";

/**
 * A project's services (lab stacks, C2): what it needs, whether each is up, and one click to
 * start or stop it. Every change is a broker proposal the person approves.
 */

export type ProjectService = {
  key: string;
  label: string;
  purpose: string;
  /** absent | starting | running | stopped | partial | waiting (approval) | failed | unknown */
  state: string;
  detail: string | null;
  running: number;
  total: number;
  open: { label: string; url: string; user: string; password: string } | null;
  /** Where the project's machine sends its logs. */
  agentAddress: string;
};

async function projectOf(userId: string, runId: string) {
  const { createProjectRunsRepository } = await import("@careeros/database");
  return createProjectRunsRepository(getDatabase()).getWithSteps(userId, runId);
}

export async function projectServicesAction(input: {
  runId: string;
}): Promise<{ ok: true; services: ProjectService[] } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };
  const project = await projectOf(user.id, id.data);
  if (!project) return { ok: false, message: "That project is unavailable." };

  const { STACKS, stackFolder, stackProject, stacksForProject, vmNetworkAddress } =
    await import("@/lib/lab/stacks");
  const { readStackSecrets } = await import("@/lib/lab/stack-secrets");
  const { WAZUH_DEMO_SECRETS } = await import("@/lib/lab/stack-secrets-core");
  const keys = stacksForProject({ title: project.run.title, detail: project.run.detail });
  if (keys.length === 0) return { ok: true, services: [] };

  const { observeStack } = await import("@/lib/lab/stack-observer");
  const { labNameForRun } = await import("@/lib/lab/templates");
  const { createLabActionRequestsRepository } = await import("@careeros/database");
  const requests = createLabActionRequestsRepository(getDatabase());
  const labName = labNameForRun(project.run.id);
  // A Fadi container lab reaches the manager by name on the stack's network; a VMware machine
  // on the VMware network address.
  const onContainerLab = await containerLabOf(project.run);

  const services = await Promise.all(
    keys.map(async (key): Promise<ProjectService> => {
      const stack = STACKS[key];
      const [observed, last] = await Promise.all([
        observeStack(stackProject(labName, key), key),
        requests.latestForRun(user.id, project.run.id, "stack.start"),
      ]);
      const asked = last?.status;
      const state =
        asked === "pending"
          ? "waiting"
          : asked === "approved"
            ? "starting"
            : observed === null
              ? "unknown"
              : observed.state === "absent" && asked === "failed"
                ? "failed"
                : observed.state;
      return {
        key,
        label: stack.label,
        purpose: stack.purpose,
        state,
        detail:
          state === "failed"
            ? (last?.detail ?? "It didn't start.")
            : state === "unknown"
              ? "Docker isn't answering, so Fadi can't see it."
              : null,
        running: observed?.running ?? 0,
        total: observed?.total ?? stack.services.length,
        // This project's own password; a stack started before per-project credentials existed
        // (no record beside it) runs with Wazuh's demo password, so that is what it shows.
        open: {
          ...stack.open,
          password:
            (await readStackSecrets(stackFolder(stackProject(labName, key))))?.admin ??
            WAZUH_DEMO_SECRETS.admin,
        },
        agentAddress: onContainerLab ? stack.agent.managerHost : vmNetworkAddress(),
      };
    })
  );
  return { ok: true, services };
}

export async function proposeServiceAction(input: {
  runId: string;
  stack: string;
  op: "start" | "stop";
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({ runId: z.string().uuid(), stack: z.string(), op: z.enum(["start", "stop"]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Unknown service." };
  const project = await projectOf(user.id, parsed.data.runId);
  if (!project) return { ok: false, message: "That project is unavailable." };

  const { isStackKey, stacksForProject, vmNetworkAddress } = await import("@/lib/lab/stacks");
  // Only a stack this project calls for.
  if (
    !isStackKey(parsed.data.stack) ||
    !stacksForProject({ title: project.run.title, detail: project.run.detail }).includes(
      parsed.data.stack
    )
  ) {
    return { ok: false, message: "This project doesn't use that service." };
  }
  const { labNameForRun } = await import("@/lib/lab/templates");
  const { proposeAction } = await import("@/lib/lab/broker");
  const name = labNameForRun(project.run.id);
  const proposal = await proposeAction({
    userId: user.id,
    recipe: parsed.data.op === "start" ? "stack.start" : "stack.stop",
    params:
      parsed.data.op === "start"
        ? {
            stack: parsed.data.stack,
            name,
            agentIp: vmNetworkAddress(),
            ...((await containerLabOf(project.run)) ? { lab: name } : {}),
          }
        : { stack: parsed.data.stack, name },
    actor: "user",
    origin: "dashboard:project_lab",
    runId: project.run.id,
    stepId: project.steps.find((step) => step.status === "pending")?.id ?? null,
  });
  return proposal.ok
    ? { ok: true, message: "Waiting for your approval. Nothing has run yet." }
    : { ok: false, message: proposal.message };
}

/** Whether the project runs on Fadi's own container lab on this computer (not a VMware machine). */
async function containerLabOf(run: { id: string; resourceId: string | null }): Promise<boolean> {
  if (run.resourceId) return false;
  const { labNameForRun } = await import("@/lib/lab/templates");
  const { containerState } = await import("@/lib/lab/runtime-observer");
  return Boolean(await containerState(labNameForRun(run.id)));
}
