import { createProfilesRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";

export type OnboardingStatus = "not_started" | "in_progress" | "completed";

export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  try {
    const profilesRepository = createProfilesRepository(getDatabase());
    const profile = await profilesRepository.getByUserId(userId);

    if (!profile) {
      return "not_started";
    }

    return profile.onboardingCompleted ? "completed" : "in_progress";
  } catch {
    return "not_started";
  }
}
