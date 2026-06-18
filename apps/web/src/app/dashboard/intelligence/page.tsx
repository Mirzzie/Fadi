import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { CareerWeatherView } from "@/components/intelligence/career-weather-view";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getCareerWeather } from "@/lib/intelligence/career-weather";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Career Weather" };
export const dynamic = "force-dynamic";

export default async function IntelligencePage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/intelligence");

  const onboardingStatus = await getOnboardingStatus(user.id);
  if (onboardingStatus !== "completed") redirect("/onboarding");

  const weather = await getCareerWeather(user.id);

  return (
    <AppShell>
      <CareerWeatherView weather={weather} />
    </AppShell>
  );
}
