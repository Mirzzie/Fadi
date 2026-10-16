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
