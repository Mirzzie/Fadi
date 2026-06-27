import { createProfilesRepository } from "@careeros/database";

import { getDatabase } from "@/lib/database/client";

export type OnboardingStatus = "not_started" | "in_progress" | "completed";

/** Pure: derive status from an already-loaded profile — so pages that fetch the
 *  profile anyway don't pay a second `profiles` round-trip just to gate onboarding. */
export function onboardingStatusOf(
  profile: { onboardingCompleted: boolean } | null | undefined,
): OnboardingStatus {
  if (!profile) return "not_started";
  return profile.onboardingCompleted ? "completed" : "in_progress";
}

export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  try {
    const profile = await createProfilesRepository(getDatabase()).getByUserId(userId);
    return onboardingStatusOf(profile);
  } catch {
    return "not_started";
  }
}
