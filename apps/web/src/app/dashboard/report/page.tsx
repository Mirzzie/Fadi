import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { AppShell } from "@/components/layout/app-shell";
import { CareerReportView } from "@/components/dashboard/career-report-view";
import { GenerateReportButton } from "@/components/dashboard/generate-report-button";
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getDashboardProfileSummary, getLatestCareerReport } from "@/lib/career-report/data";
import { onboardingStatusOf } from "@/lib/onboarding/status";

export const metadata: Metadata = { title: "Career report" };
export const dynamic = "force-dynamic";

/** The full Career Intelligence Report — its own page so the dashboard stays a launchpad.
 *  Scoped (like the dashboard) to the ACTIVE direction via getLatestCareerReport. */
export default async function ReportPage() {
  const user = await getCurrentAuthUser();
  if (!user) redirect("/auth/sign-in?next=/dashboard/report");

  const [report, profile] = await Promise.all([
    getLatestCareerReport(user.id),
    getDashboardProfileSummary(user.id),
  ]);
  if (onboardingStatusOf(profile) !== "completed") redirect("/onboarding");

  return (
    <AppShell>
      <div className="mx-auto max-w-shell space-y-6 p-4 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Dashboard
            </Link>
            <h1 className="mt-1 font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              Career Intelligence Report
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {profile?.targetRole
                ? `For your ${profile.targetRole} direction.`
                : "Structured insights from your profile, résumé, and goals."}
            </p>
          </div>
          <GenerateReportButton />
        </div>

        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          AI recommendations may be imperfect. Review every suggestion before making career,
          learning, or application decisions.
        </div>

        {report ? (
          <CareerReportView report={report} />
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            No report yet for this direction. Use “Generate report” above to create your first one.
          </div>
        )}
      </div>
    </AppShell>
  );
}
