"use server";

import {
  createCareerProfilesRepository,
  createLinkedInProfilesRepository,
  createProfilesRepository,
  createResumesRepository,
} from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import { onboardingFormSchema, type OnboardingFormValues } from "@/lib/onboarding/validation";

export type OnboardingActionResult = {
  ok: boolean;
  message?: string;
  redirectTo?: string;
};

function firstValidationMessage(values: unknown) {
  const parsed = onboardingFormSchema.safeParse(values);

  if (parsed.success) {
    return null;
  }

  return parsed.error.issues[0]?.message ?? "Check the onboarding form and try again.";
}

export async function completeOnboardingAction(
  values: OnboardingFormValues
): Promise<OnboardingActionResult> {
  const validationMessage = firstValidationMessage(values);

  if (validationMessage) {
    logger.warn("onboarding.complete.validation_failed");

    return {
      ok: false,
      message: validationMessage,
    };
  }

  const parsed = onboardingFormSchema.parse(values);

  try {
    const user = await getCurrentAuthUser();

    if (!user?.email) {
      logger.warn("onboarding.complete.unauthenticated");

      return {
        ok: false,
        message: "You need to be signed in to complete onboarding.",
      };
    }

    const db = getDatabase();
    const profilesRepository = createProfilesRepository(db);
    const careerProfilesRepository = createCareerProfilesRepository(db);
    const linkedInProfilesRepository = createLinkedInProfilesRepository(db);
    const resumesRepository = createResumesRepository(db);

    const profile = await profilesRepository.upsertForUser(user.id, {
      fullName: parsed.fullName,
      email: user.email,
      onboardingCompleted: false,
    });

    await careerProfilesRepository.createForUser(user.id, {
      profileId: profile.id,
      targetRole: parsed.targetRole,
      location: parsed.locationPreference,
      experienceLevel: parsed.experienceLevel,
      careerGoal: parsed.careerGoals,
      // The first track a user creates is their active one.
      makeActive: true,
    });

    const linkedInText = parsed.linkedInProfile?.trim();

    if (linkedInText) {
      await linkedInProfilesRepository.createForUser(user.id, {
        profileId: profile.id,
        profileUrl: linkedInText.startsWith("http") ? linkedInText : null,
        rawText: linkedInText,
        importStatus: "pending",
      });
    }

    await resumesRepository.createForUser(user.id, {
      profileId: profile.id,
      filePath: `text-paste/${user.id}/${Date.now()}`,
      fileName: "pasted-resume.txt",
      fileMimeType: "text/plain",
      rawText: parsed.resumeText,
      parsedText: parsed.resumeText,
      parseStatus: "parsed",
    });

    await profilesRepository.markOnboardingCompleted(user.id);
    logger.info("onboarding.complete.succeeded", {
      userId: user.id,
    });

    return {
      ok: true,
      message: "Onboarding complete. Your career profile has been saved.",
      redirectTo: "/dashboard",
    };
  } catch (error) {
    logger.error("onboarding.complete.failed", {
      errorName: error instanceof Error ? error.name : "UnknownError",
    });

    return {
      ok: false,
      message: "Could not save onboarding data right now. Please try again later.",
    };
  }
}
