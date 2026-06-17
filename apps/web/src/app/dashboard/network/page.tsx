import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { ReferralBoard } from "@/components/network/referral-board";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { listReferrals } from "@/lib/network/referrals";
import { getOnboardingStatus } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Network" };
export const dynamic = "force-dynamic";

export default async function NetworkPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/network");

  const onboardingStatus = await getOnboardingStatus(user.id);
  if (onboardingStatus !== "completed") redirect("/onboarding");

  const referrals = await listReferrals(user.id);

  return (
    <AppShell>
      <ReferralBoard referrals={referrals} />
    </AppShell>
  );
}
