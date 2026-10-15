"use server";

import { z } from "zod";

import { createLabResourcesRepository, createProjectRunsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";

/**
 * "Check it for me" inside the person's own VMware machine needs Fadi to sign in to it — with
 * Fadi's lab key, never a password. Setting that up is ONE line of PowerShell, typed into the
 * machine through its screen; nothing runs until the person presses Enter there.
 */

const ACCOUNT = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

async function machineOf(userId: string, runId: string) {
  const db = getDatabase();
  const project = await createProjectRunsRepository(db).getWithSteps(userId, runId);
  if (!project?.run.resourceId) return null;
  const resource = await createLabResourcesRepository(db).get(userId, project.run.resourceId);
  const { readVmxSummary, vmxPathOf } = await import("@/lib/lab/vmware");
  const vmx = vmxPathOf(resource?.endpoint);
  if (!resource || !vmx) return null;
  const summary = await readVmxSummary(vmx);
  return { resource, windows: Boolean(summary?.family.startsWith("windows")) };
}

export async function checksStateAction(input: {
  runId: string;
}): Promise<{ applicable: boolean; user: string | null }> {
  const user = await getCurrentAuthUser();
  const id = z.string().uuid().safeParse(input.runId);
  if (!user || !id.success) return { applicable: false, user: null };
  const machine = await machineOf(user.id, id.data);
  return machine?.windows
    ? { applicable: true, user: machine.resource.guestUser ?? null }
    : { applicable: false, user: null };
}

/** The setup line for this machine, and remember which account Fadi signs in as. */
export async function checksSetupAction(input: {
  runId: string;
  account: string;
}): Promise<{ ok: true; script: string } | { ok: false; message: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z
    .object({ runId: z.string().uuid(), account: z.string().trim().regex(ACCOUNT) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: "Use the machine's Windows account name." };
  const machine = await machineOf(user.id, parsed.data.runId);
  if (!machine?.windows) {
    return { ok: false, message: "This project isn't on one of your Windows VMware machines." };
  }

  const { ensureLabKey } = await import("@/lib/lab/lab-ssh");
  const { publicKey } = await ensureLabKey();
  const { hostAddressesOnVmnets } = await import("@/lib/lab/vmware");
  const hosts = hostAddressesOnVmnets();
  if (hosts.length === 0) {
    return {
      ok: false,
      message: "VMware's networks aren't up on this computer, so the machine can't be reached.",
    };
  }
  await createLabResourcesRepository(getDatabase()).setGuestUser(
    user.id,
    machine.resource.id,
    parsed.data.account
  );
  const { checksSetupScript } = await import("@/lib/lab/vmware-checks");
  return { ok: true, script: checksSetupScript(publicKey, hosts) };
}
