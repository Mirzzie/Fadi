import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { UserRoundCog } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { ProfileForm } from "@/components/profile/profile-form";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDatabase } from "@/lib/database/client";
import { getOnboardingStatus } from "@/lib/onboarding/status";
import { createCareerProfilesRepository, createProfilesRepository } from "@careeros/database";

export const metadata: Metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");

  const onboardingStatus = await getOnboardingStatus(user.id);
  if (onboardingStatus !== "completed") redirect("/onboarding");

  const db = getDatabase();
  const [profile, careerProfile] = await Promise.all([
    createProfilesRepository(db).getByUserId(user.id),
    createCareerProfilesRepository(db).getLatestForUser(user.id),
  ]);

  return (
    <AppShell>
      <div className="mx-auto max-w-3xl space-y-6">
        <section className="relative overflow-hidden rounded-xl border bg-card p-6">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full opacity-[0.12] blur-3xl"
            style={{ background: "oklch(0.66 0.22 285)" }}
          />
          <div className="relative flex items-start gap-4">
            <div className="glow-primary grid size-10 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-primary to-[oklch(0.66_0.22_285)]">
              <UserRoundCog className="size-5 text-primary-foreground" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-xl font-semibold tracking-tight">
                Your{" "}
                <span className="bg-gradient-to-r from-primary to-[oklch(0.7_0.17_230)] bg-clip-text text-transparent">
                  profile
                </span>
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                This is what Kai reasons from. Keep it current — accurate inputs mean sharper advice.
              </p>
            </div>
          </div>
        </section>

        <ProfileForm
          email={user.email ?? ""}
          initial={{
            fullName: profile?.fullName ?? "",
            targetRole: careerProfile?.targetRole ?? "",
            location: careerProfile?.location ?? "",
            experienceLevel: careerProfile?.experienceLevel ?? "",
            careerGoal: careerProfile?.careerGoal ?? "",
          }}
        />
      </div>
    </AppShell>
  );
}
