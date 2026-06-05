"use server";

import {
  createCareerProfilesRepository,
  createLinkedInProfilesRepository,
  createProfilesRepository,
  createResumesRepository,
  createUsersRepository,
} from "@careeros/database";
import { revalidatePath } from "next/cache";

import { signOutAction } from "@/app/auth/actions";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";

type Result = { ok: boolean; message: string };

export type UpdateProfileInput = {
  fullName: string;
  targetRole: string;
  location: string;
  experienceLevel: string;
  careerGoal: string;
  linkedInUrl: string;
  linkedInText: string;
  resumeText: string;
};

export async function updateProfileAction(input: UpdateProfileInput): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };
  if (!input.fullName.trim() || !input.targetRole.trim()) {
    return { ok: false, message: "Name and target role are required." };
  }

  try {
    const db = getDatabase();
    await createProfilesRepository(db).upsertForUser(user.id, {
      fullName: input.fullName.trim(),
      email: user.email ?? "",
      onboardingCompleted: true,
    });
    await createCareerProfilesRepository(db).updateLatestForUser(user.id, {
      targetRole: input.targetRole.trim(),
      location: input.location.trim() || null,
      experienceLevel: input.experienceLevel.trim() || null,
      careerGoal: input.careerGoal.trim(),
    });

    // LinkedIn URL + context and resume text are the richest AI inputs — keep
    // them editable here too. Only touch them when the user provided something,
    // so saving the basic fields never wipes an existing import.
    const linkedInUrl = input.linkedInUrl.trim();
    const linkedInText = input.linkedInText.trim();
    if (linkedInUrl || linkedInText) {
      await createLinkedInProfilesRepository(db).upsertLatestForUser(user.id, {
        profileUrl: linkedInUrl || null,
        rawText: linkedInText || null,
      });
    }

    const resumeText = input.resumeText.trim();
    if (resumeText) {
      await createResumesRepository(db).upsertLatestForUser(user.id, resumeText);
    }

    revalidatePath("/dashboard/profile");
    revalidatePath("/dashboard");
    return { ok: true, message: "Profile updated." };
  } catch (error) {
    logger.error("profile.update_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't save your profile. Please try again." };
  }
}

/**
 * Delete all of the user's career data (profile, reports, jobs, momentum, AI
 * settings — everything cascades from the domain user row) and sign out.
 */
export async function deleteAccountDataAction(): Promise<Result> {
  const user = await getCurrentAuthUser();
  if (!user) return { ok: false, message: "Please sign in again." };

  try {
    await createUsersRepository(getDatabase()).deleteById(user.id);
    logger.info("profile.account_data_deleted", { userId: user.id });
  } catch (error) {
    logger.error("profile.delete_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : "unknown",
    });
    return { ok: false, message: "Couldn't delete your data. Please try again." };
  }

  // signOutAction redirects, ending the session.
  await signOutAction();
  return { ok: true, message: "Your data has been deleted." };
}
