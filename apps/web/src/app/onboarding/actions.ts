"use server";

import { after } from "next/server";

import {
  createCareerProfilesRepository,
  createLinkedInProfilesRepository,
  createProfilesRepository,
  createResumesRepository,
} from "@careeros/database";

import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { logger } from "@/lib/observability/logger";
import {
  onboardingEssentialsSchema,
  type OnboardingFormValues,
} from "@/lib/onboarding/validation";

export type OnboardingActionResult = {
  ok: boolean;
  message?: string;
  redirectTo?: string;
};

function firstValidationMessage(values: unknown) {
  const parsed = onboardingEssentialsSchema.safeParse(values);

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

  const parsed = onboardingEssentialsSchema.parse(values);

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

    // Only persist a resume when the user actually gave us substantive text —
    // the conversational welcome often completes without one, and the OS
    // guidance layer prompts for a CV afterward. Avoid creating empty rows.
    const resumeText = parsed.resumeText?.trim();
    if (resumeText && resumeText.length >= 20) {
      await resumesRepository.createForUser(user.id, {
        profileId: profile.id,
        filePath: `text-paste/${user.id}/${Date.now()}`,
        fileName: "pasted-resume.txt",
        fileMimeType: "text/plain",
        rawText: resumeText,
        parsedText: resumeText,
        parseStatus: "parsed",
      });
    }

    await profilesRepository.markOnboardingCompleted(user.id);
    logger.info("onboarding.complete.succeeded", {
      userId: user.id,
    });

    // Build the evidence pool in the background so the user lands on a POPULATED
    // Evidence tab instead of a blank one they have to discover and manually trigger
    // (the #1 reason that flagship feature looked broken). Runs after the response is
    // sent, so onboarding stays fast. Best-effort and self-guarding: extractEvidencePool
    // no-ops when there's no career history or no AI provider configured yet, and a
    // failure here can never break onboarding.
    const uid = user.id;
    after(async () => {
      try {
        const [{ extractEvidencePool }, { publish }] = await Promise.all([
          import("@/lib/evidence/pool"),
          import("@/lib/events/bus"),
        ]);
        const res = await extractEvidencePool(uid);
        if (res.ok) await publish("evidence.changed", { userId: uid, reason: "extracted" });
        logger.info("onboarding.evidence_autobuild", { userId: uid, ok: res.ok, reason: res.ok ? undefined : res.reason });
      } catch (err) {
        logger.warn("onboarding.evidence_autobuild_failed", {
          userId: uid,
          error: err instanceof Error ? err.message : "unknown",
        });
      }
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
