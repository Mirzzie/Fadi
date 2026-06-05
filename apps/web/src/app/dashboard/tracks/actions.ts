"use server";

import { createCareerProfilesRepository } from "@careeros/database";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

/**
 * Career tracks — the user's parallel career directions. A track IS a
 * career_profiles row; exactly one is active and drives jobs/report/docs/Kai.
 * These actions back the menu-bar track switcher + the "New direction" flow.
 */

export type TrackIntent = "career" | "exploration" | "trial" | "part_time";

export type TrackSummary = {
  id: string;
  label: string;
  targetRole: string;
  domain: string | null;
  intent: string;
  roleCluster: string[] | null;
  isActive: boolean;
};

function toSummary(t: {
  id: string;
  label: string | null;
  targetRole: string;
  domain: string | null;
  intent: string;
  roleCluster: string[] | null;
  isActive: boolean;
}): TrackSummary {
  return {
    id: t.id,
    label: t.label?.trim() || t.targetRole,
    targetRole: t.targetRole,
    domain: t.domain,
    intent: t.intent,
    roleCluster: t.roleCluster,
    isActive: t.isActive,
  };
}

export async function listTracksAction(): Promise<TrackSummary[]> {
  const user = await getCurrentAuthUser();
  if (!user) return [];

  const repo = createCareerProfilesRepository(getDatabase());
  const [tracks, active] = await Promise.all([
    repo.listForUser(user.id),
    repo.getActiveForUser(user.id),
  ]);

  // Reflect the active-or-latest fallback so the UI always shows one as active,
  // even for users whose rows predate the is_active flag.
  return tracks.map((t) => toSummary({ ...t, isActive: t.isActive || t.id === active?.id }));
}

export async function switchTrackAction(
  trackId: string,
): Promise<{ ok: boolean; message?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const id = z.string().uuid().safeParse(trackId);
  if (!id.success) return { ok: false, message: "Invalid track." };

  const updated = await createCareerProfilesRepository(getDatabase()).setActiveForUser(
    user.id,
    id.data,
  );
  if (!updated) return { ok: false, message: "That track isn't yours." };

  logger.info("tracks.switched", { userId: user.id, trackId: id.data });
  revalidatePath("/dashboard", "layout");
  return { ok: true };
}

const createTrackSchema = z.object({
  label: z.string().trim().min(1).max(80),
  targetRole: z.string().trim().min(1).max(120),
  domain: z.string().trim().max(80).optional(),
  intent: z.enum(["career", "exploration", "trial", "part_time"]).default("career"),
  careerGoal: z.string().trim().min(1).max(2000),
  location: z.string().trim().max(120).optional(),
  experienceLevel: z.string().trim().max(40).optional(),
  /** Comma/newline separated roles for exploration tracks. */
  roleCluster: z.array(z.string().trim().min(1)).max(8).optional(),
});

export type CreateTrackInput = z.input<typeof createTrackSchema>;

export async function createTrackAction(
  input: CreateTrackInput,
): Promise<{ ok: boolean; message?: string; trackId?: string }> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Not signed in." };

  const parsed = createTrackSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const data = parsed.data;

  const track = await createCareerProfilesRepository(getDatabase()).createForUser(user.id, {
    targetRole: data.targetRole,
    careerGoal: data.careerGoal,
    location: data.location ?? null,
    experienceLevel: data.experienceLevel ?? null,
    label: data.label,
    domain: data.domain ?? null,
    intent: data.intent,
    roleCluster: data.roleCluster && data.roleCluster.length > 0 ? data.roleCluster : null,
    makeActive: true,
  });

  logger.info("tracks.created", {
    userId: user.id,
    trackId: track.id,
    intent: data.intent,
    domain: data.domain ?? null,
  });
  revalidatePath("/dashboard", "layout");
  return { ok: true, trackId: track.id };
}
