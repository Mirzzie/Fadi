"use server";

import { cpus } from "node:os";

import { z } from "zod";

import { createLabResourcesRepository, createProjectRunsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import type { MachineSettings } from "@/lib/lab/vmware-config";

/** The settings of the VMware machine a project runs on, and one approval to change them. */

export type MachineSettingsView = {
  label: string;
  running: boolean;
  settings: MachineSettings;
  /** This computer, so choices can be shown against what it has. */
  hostCpus: number;
  hostFreeMb: number;
};

async function machineFor(userId: string, runId: string) {
  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(userId, runId);
  if (!project?.run.resourceId) return null;
  const resource = await createLabResourcesRepository(db).get(userId, project.run.resourceId);
  const { vmxPathOf } = await import("@/lib/lab/vmware");
  const vmx = vmxPathOf(resource?.endpoint);
  return resource && vmx ? { project, resource, vmx } : null;
}

export async function machineSettingsAction(input: {
  runId: string;
}): Promise<{ ok: true; machine: MachineSettingsView } | { ok: false }> {
  const user = await getCurrentAuthUser();
  const id = z.string().uuid().safeParse(input.runId);
  if (!user || !id.success) return { ok: false };
  const machine = await machineFor(user.id, id.data);
  if (!machine) return { ok: false };
  const { readFile } = await import("node:fs/promises");
  const { parseVmx, readMachineSettings } = await import("@/lib/lab/vmware-config");
  const { runningVmxPaths } = await import("@/lib/lab/vmware");
  const { availableMemoryMb } = await import("@/lib/lab/readiness-facts");
  const text = await readFile(machine.vmx, "utf8").catch(() => null);
  if (!text) return { ok: false };
  return {
    ok: true,
    machine: {
      label: machine.resource.label,
      running: (await runningVmxPaths())?.has(machine.vmx) ?? false,
      settings: readMachineSettings(parseVmx(text)),
      hostCpus: cpus().length,
      hostFreeMb: await availableMemoryMb(),
    },
  };
}

export async function proposeMachineChangeAction(input: {
  runId: string;
  kind: "configure" | "shutdown";
  changes?: Record<string, unknown>;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };
  const machine = await machineFor(user.id, id.data);
  if (!machine) return { ok: false, message: "This project isn't on one of your VMware machines." };
  const { proposeAction } = await import("@/lib/lab/broker");
  const proposal = await proposeAction({
    userId: user.id,
    recipe: input.kind === "shutdown" ? "vmware.shutdown" : "vmware.configure",
    params:
      input.kind === "shutdown"
        ? { resourceId: machine.resource.id }
        : { resourceId: machine.resource.id, changes: input.changes ?? {} },
    actor: "user",
    origin: "dashboard:machine_settings",
    runId: machine.project.run.id,
  });
  return proposal.ok
    ? { ok: true, message: "Waiting for your approval. Nothing has changed yet." }
    : { ok: false, message: proposal.message };
}
