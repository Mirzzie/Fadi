"use server";

import { z } from "zod";

import { createLabActionsRepository, createLabGrantsRepository } from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { CAPABILITIES, CAPABILITY_IDS, type Capability } from "@/lib/lab/broker";

/**
 * THE CONSENT SURFACE.
 *
 * "Fadi may use my computer" is not a permission anyone can meaningfully give. These
 * actions exist so the user grants one named capability at a time, sees in the same
 * breath what it cannot do, and can watch afterwards what was actually attempted.
 *
 * Everything here is scoped to the signed-in user and re-reads the catalogue from the
 * broker, so a capability cannot be granted that the broker does not implement — the
 * catalogue is the only list, in one file.
 */

const grantInput = z.object({
  capability: z.enum(CAPABILITY_IDS),
  /** Bounded on purpose. A permission nobody remembers giving is not consent. */
  minutes: z.number().int().min(5).max(1440).optional(),
});

export type CapabilityView = {
  capability: Capability;
  summary: string;
  limit: string;
  defaultMinutes: number;
  /** ISO string when live, null when not granted. */
  grantedUntil: string | null;
  grantId: string | null;
};

export type ActionView = {
  id: string;
  actor: string;
  origin: string | null;
  capability: string;
  command: string | null;
  decision: string;
  detail: string | null;
  at: string;
};

export async function listPermissions(): Promise<{
  ok: boolean;
  capabilities?: CapabilityView[];
  recent?: ActionView[];
  denials?: number;
  message?: string;
}> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const db = getDatabase();
  const grants = createLabGrantsRepository(db);
  const audit = createLabActionsRepository(db);

  const capabilities: CapabilityView[] = [];
  for (const capability of CAPABILITY_IDS) {
    const spec = CAPABILITIES[capability];
    const live = await grants.findLive(user.id, capability);
    capabilities.push({
      capability,
      summary: spec.summary,
      limit: spec.limit,
      defaultMinutes: spec.defaultMinutes,
      grantedUntil: live?.expiresAt ? live.expiresAt.toISOString() : null,
      grantId: live?.id ?? null,
    });
  }

  const rows = await audit.recent(user.id, 40);
  const denials = await audit.recentDenials(user.id, 20);

  return {
    ok: true,
    capabilities,
    recent: rows.map((r) => ({
      id: r.id,
      actor: r.actor,
      origin: r.origin,
      capability: r.capability,
      command: r.command,
      decision: r.decision,
      detail: r.detail,
      at: r.createdAt.toISOString(),
    })),
    denials: denials.length,
  };
}

/**
 * Allow one capability, for a bounded time.
 *
 * The `reason` stored is the text the user was shown, not a summary written afterwards.
 * If the wording of a capability ever changes, the log still says what THIS person agreed
 * to on the day — which is the only version that matters when someone asks later.
 */
export async function grantCapability(input: {
  capability: string;
  minutes?: number;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  const parsed = grantInput.safeParse(input);
  if (!parsed.success) return { ok: false, message: "That isn't a capability Fadi implements." };

  const spec = CAPABILITIES[parsed.data.capability];
  const db = getDatabase();
  await createLabGrantsRepository(db).grant({
    userId: user.id,
    capability: parsed.data.capability,
    minutes: parsed.data.minutes ?? spec.defaultMinutes,
    reason: spec.summary + " Limit: " + spec.limit,
  });

  // The grant itself is an audited event. Someone reading the log needs to see the moment
  // permission widened, not only what happened afterwards.
  await createLabActionsRepository(db).record({
    userId: user.id,
    actor: "user",
    origin: "dashboard:permissions",
    capability: parsed.data.capability,
    decision: "allowed",
    detail: "Granted for " + (parsed.data.minutes ?? spec.defaultMinutes) + " minutes.",
  });

  return { ok: true };
}

/**
 * Close a capability — every live grant for it, not just the newest.
 *
 * The panel shows one row per capability, so "Revoke" has to close the capability. Older
 * overlapping grants left live behind a UI that says "not allowed" would be a permission
 * screen that lies.
 */
export async function revokeCapability(input: {
  capability: string;
}): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  const parsed = z.enum(CAPABILITY_IDS).safeParse(input.capability);
  if (!parsed.success) return { ok: false, message: "Unknown capability." };

  const db = getDatabase();
  const closed = await createLabGrantsRepository(db).revokeCapability(user.id, parsed.data);
  await createLabActionsRepository(db).record({
    userId: user.id,
    actor: "user",
    origin: "dashboard:permissions",
    capability: parsed.data,
    decision: "denied",
    detail: "Revoked by you — " + closed + " grant(s) closed.",
  });
  return { ok: true };
}

/**
 * The panic button.
 *
 * One click closes everything. It exists because the moment a person suspects something
 * is wrong is exactly the moment they should not have to work out which of six toggles
 * to find.
 */
export async function revokeAllCapabilities(): Promise<{ ok: boolean; revoked?: number }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false };

  const db = getDatabase();
  const revoked = await createLabGrantsRepository(db).revokeAll(user.id);
  await createLabActionsRepository(db).record({
    userId: user.id,
    actor: "user",
    origin: "dashboard:permissions",
    capability: "grant.revoke_all",
    decision: "allowed",
    detail: "Revoked " + revoked + " live grant(s).",
  });
  return { ok: true, revoked };
}
