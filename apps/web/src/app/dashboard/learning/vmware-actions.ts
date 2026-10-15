"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { createLabActionsRepository, createLabResourcesRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";

/**
 * USE ONE OF YOUR VMWARE MACHINES FOR THIS PROJECT — in one click.
 *
 * Fadi lists the machines in the person's VMware library that fit the project (a Windows
 * Server project is offered the Windows Server VM), registers the one they pick and places the
 * project on it. Nothing starts here: starting is its own approval on the project page.
 */

type Family = "windows-server" | "windows" | "linux";

const FAMILY_FOR_TEMPLATE: Record<string, Family | null> = {
  "windows-server-2025": "windows-server",
  "windows-11": "windows",
  "linux-ubuntu": "linux",
  // Services run as containers; a whole VM would only cost memory.
  "linux-web": null,
  "linux-postgres": null,
};

export type VmwareChoice = {
  vmxPath: string;
  name: string;
  family: string;
  memoryMb: number | null;
  running: boolean;
  /** Fits what this project needs. */
  fits: boolean;
  /** This project already runs on it. */
  current: boolean;
};

export type VmwareChoices = {
  /** What the project's lab needs, in words; null when it needs no machine. */
  needs: string | null;
  vmwareInstalled: boolean;
  machines: VmwareChoice[];
};

const NEEDS_LABEL: Record<Family, string> = {
  "windows-server": "a Windows Server machine",
  windows: "a Windows machine",
  linux: "a Linux machine",
};

async function projectFor(userId: string, runId: string) {
  const { createProjectRunsRepository } = await import("@careeros/database");
  return createProjectRunsRepository(getDatabase()).getWithSteps(userId, runId);
}

export async function vmwareChoicesAction(input: {
  runId: string;
}): Promise<{ ok: true; choices: VmwareChoices } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };
  const project = await projectFor(user.id, id.data);
  if (!project) return { ok: false, message: "That project is unavailable." };

  const { templateForProject } = await import("@/lib/lab/spec-from-project");
  const template = templateForProject({ title: project.run.title, detail: project.run.detail });
  const family = template ? (FAMILY_FOR_TEMPLATE[template] ?? null) : null;

  const { discoverVmwareMachines, runningVmxPaths, vmxPathOf } = await import("@/lib/lab/vmware");
  const vmwareInstalled = (await runningVmxPaths()) !== null;
  const resources = await createLabResourcesRepository(getDatabase()).listForUser(user.id);
  const currentPath = vmxPathOf(
    resources.find((resource) => resource.id === project.run.resourceId)?.endpoint
  );
  const machines = (await discoverVmwareMachines()).map((machine) => ({
    vmxPath: machine.vmxPath,
    name: machine.name,
    family: machine.family,
    memoryMb: machine.memoryMb,
    running: machine.running,
    fits: family !== null && machine.family === family,
    current: machine.vmxPath === currentPath,
  }));
  // The ones that fit first; the rest stay listed, because the person may know better.
  machines.sort((a, b) => Number(b.current) - Number(a.current) || Number(b.fits) - Number(a.fits));
  return {
    ok: true,
    choices: { needs: family ? NEEDS_LABEL[family] : null, vmwareInstalled, machines },
  };
}

/** Register (if needed) the picked VMware machine and run this project on it. Starts nothing. */
export async function placeOnVmwareAction(input: {
  runId: string;
  vmxPath: string;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({ runId: z.string().uuid(), vmxPath: z.string().min(1).max(1000) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick one of your VMware machines." };
  const project = await projectFor(user.id, parsed.data.runId);
  if (!project) return { ok: false, message: "That project is unavailable." };

  // Only a machine VMware itself lists: a path from the browser is a choice among those, never
  // a free-typed file.
  const { discoverVmwareMachines, vmxPathOf, VMWARE_ENDPOINT_PREFIX } =
    await import("@/lib/lab/vmware");
  const machine = (await discoverVmwareMachines()).find((m) => m.vmxPath === parsed.data.vmxPath);
  if (!machine) {
    return { ok: false, message: "That machine isn't in your VMware library any more." };
  }

  const fs = await import("node:fs/promises");
  const resolved = await fs.realpath(machine.vmxPath).catch(() => null);
  if (!resolved) return { ok: false, message: "Fadi could not read that machine's settings." };

  const db = getDatabase();
  const resources = createLabResourcesRepository(db);
  const all = await resources.listForUser(user.id);
  let resource = all.find((r) => vmxPathOf(r.endpoint) === resolved) ?? null;
  if (!resource) {
    // Registration is keyed by name; never let a VM take over another machine's record.
    const taken = new Set(all.map((r) => r.label));
    const label = taken.has(machine.name) ? `${machine.name} (VMware)` : machine.name;
    resource = await resources.upsertDetected(user.id, {
      label,
      kind: "vm",
      arch: "x86_64",
      memoryMb: machine.memoryMb,
      diskGb: null,
      virtualization: "none",
      alwaysOn: false,
      notes: `Your VMware machine (${machine.guestOs || "unknown OS"}). Fadi starts it in the background and never deletes or reverts it.`,
      scopes: ["read", "provision"],
      endpoint: `${VMWARE_ENDPOINT_PREFIX}${encodeURI(resolved)}`,
      secretCiphertext: null,
      secretHint: null,
      lastSeenAt: null,
    });
  }

  const { createProjectRunsRepository } = await import("@careeros/database");
  await createProjectRunsRepository(db).placeOnResource(user.id, project.run.id, {
    id: resource.id,
    label: resource.label,
  });
  await createLabActionsRepository(db).record({
    userId: user.id,
    actor: "user",
    origin: "dashboard:project_lab",
    capability: "project.placement",
    resourceId: resource.id,
    decision: "allowed",
    detail: `"${project.run.title}" now runs on ${resource.label}.`,
  });
  revalidatePath("/dashboard/learning");
  return {
    ok: true,
    message: machine.running
      ? `This project now uses ${resource.label}. It's already running, so Fadi uses it as it is.`
      : `This project now uses ${resource.label}. Start it when you're ready.`,
  };
}

/** Back to a fresh lab on this computer, Fadi's own container — the project's own decision. */
export async function placeOnFreshLabAction(input: {
  runId: string;
}): Promise<{ ok: boolean; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const id = z.string().uuid().safeParse(input.runId);
  if (!id.success) return { ok: false, message: "Unknown project." };
  const { createProjectRunsRepository } = await import("@careeros/database");
  const runs = createProjectRunsRepository(getDatabase());
  if (!(await runs.placeOnThisComputer(user.id, id.data))) {
    return { ok: false, message: "That project is unavailable." };
  }
  revalidatePath("/dashboard/learning");
  return { ok: true, message: "This project will use a fresh lab on this computer." };
}
