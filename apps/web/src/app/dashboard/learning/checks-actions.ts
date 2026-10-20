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

export type ChecksState = {
  applicable: boolean;
  /** The account Fadi will sign in as — only what was chosen, not proof it works. */
  user: string | null;
  /** What Fadi last saw when it actually signed in: pass, fail, or never tried. */
  proven: { verdict: "pass" | "fail" | "unknown"; seen: string | null; at: string } | null;
};

export async function checksStateAction(input: { runId: string }): Promise<ChecksState> {
  const none: ChecksState = { applicable: false, user: null, proven: null };
  const user = await getCurrentAuthUser();
  const id = z.string().uuid().safeParse(input.runId);
  if (!user || !id.success) return none;
  const machine = await machineOf(user.id, id.data);
  if (!machine?.windows) return none;
  // Proof is the conductor's observation of the check channel (sign in with Fadi's key, see
  // PowerShell answer) — never the saved account name (Codex review, 16 Oct 2026).
  const { createLabObservationsRepository } = await import("@careeros/database");
  const [row] = (
    await createLabObservationsRepository(getDatabase()).forSubjects(user.id, [`run:${id.data}`])
  ).filter((o) => o.predicateId === "machine.check_channel");
  return {
    applicable: true,
    user: machine.resource.guestUser ?? null,
    proven: row
      ? {
          verdict: row.verdict as "pass" | "fail" | "unknown",
          seen: typeof row.evidence.seen === "string" ? row.evidence.seen : null,
          at: row.observedAt.toISOString(),
        }
      : null,
  };
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
