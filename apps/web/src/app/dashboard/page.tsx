import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { cookies } from "next/headers";

import { AppShell } from "@/components/layout/app-shell";
import { TodayView } from "@/components/today/today-view";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary } from "@/lib/career-report/data";
import { getToday } from "@/lib/work/today";
import { maybeRunAgentForUser } from "@/lib/agents/background";
import { deliverDigestToChat, getAgencyDigest } from "@/lib/agents/digest";
import { onboardingStatusOf } from "@/lib/onboarding/status";
import { MODE_COOKIE, type CareerMode } from "@/app/dashboard/mode";

export const metadata: Metadata = {
  title: "Today",
};

export const dynamic = "force-dynamic";

/**
 * Today — the first screen.
 *
 * It used to be a wall of cards: market signals, momentum, impact counters, a checklist and a
 * report, each independently useful and none of them an answer to "what do I do now". That
 * page still exists at /dashboard/overview. This one carries the sequence.
 */
export default async function TodayPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in");

  const profileSummary = await getDashboardProfileSummary(user.id);
  if (onboardingStatusOf(profileSummary) !== "completed") redirect("/onboarding");

  const mode: CareerMode =
    (await cookies()).get(MODE_COOKIE)?.value === "prepare" ? "prepare" : "apply";
  const firstName = profileSummary?.fullName?.trim().split(/\s+/)[0] || "there";

  const today = await getToday(user.id, firstName, mode);

  // The digest lands in Fadi's chat once per finding; the next background pass runs after the
  // response is sent, so the agency stays real on deployments with no cron scheduler.
  const digest = await getAgencyDigest(user.id);
  if (digest) await deliverDigestToChat(user.id, digest);
  after(() => maybeRunAgentForUser(user.id));

  return (
    <AppShell>
      <TodayView today={today} />
    </AppShell>
  );
}
