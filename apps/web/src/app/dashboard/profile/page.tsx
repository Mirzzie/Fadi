import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ActiveSessions } from "@/components/profile/active-sessions";
import { ChangePasswordForm } from "@/components/profile/change-password-form";
import { ProfileForm } from "@/components/profile/profile-form";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { onboardingStatusOf } from "@/lib/onboarding/status";
import {
  createCareerProfilesRepository,
  createLinkedInProfilesRepository,
  createProfilesRepository,
} from "@careeros/database";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");

  const db = getDatabase();
  // The CV is no longer edited here — intake is Evidence — so the résumé row is not loaded.
  const careerProfile = await createCareerProfilesRepository(db).getActiveForUser(user.id);
  const [profile, linkedIn] = await Promise.all([
    createProfilesRepository(db).getByUserId(user.id),
    createLinkedInProfilesRepository(db).getLatestForUser(user.id),
  ]);
  // Gate on the profile we already loaded — no second profiles round-trip.
  if (onboardingStatusOf(profile) !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-8 pb-12">
        <header className="border-b border-border pb-8 pt-3">
          <p className="mb-3 font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Account</p>
          <h1 className="font-heading text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">Your profile.</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            The facts Fadi uses when it reasons about your direction. Keep them current so advice
            stays relevant.
          </p>
        </header>

        <ProfileForm
          email={user.email ?? ""}
          initial={{
            fullName: profile?.fullName ?? "",
            targetRole: careerProfile?.targetRole ?? "",
            location: careerProfile?.location ?? "",
            experienceLevel: careerProfile?.experienceLevel ?? "",
            careerGoal: careerProfile?.careerGoal ?? "",
            linkedInUrl: linkedIn?.profileUrl ?? "",
          }}
        />

        {/* Security */}
        <div className="space-y-2 border-t border-border pt-8">
          <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Security
          </h2>
        </div>
        <ChangePasswordForm />
        <ActiveSessions />
      </div>
    </AppShell>
  );
}
