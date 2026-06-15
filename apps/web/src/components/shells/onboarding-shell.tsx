import { OnboardingExperience } from "@/components/onboarding/onboarding-experience";

/**
 * Onboarding shell — the OS "first boot". Fadi welcomes the user and guides them
 * through setting up their first track conversationally (with a form fallback).
 */
export function OnboardingShell() {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <OnboardingExperience />
    </div>
  );
}
