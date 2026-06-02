import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  GraduationCap,
  MessageSquareText,
  TrendingUp,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const dashboardCards = [
  {
    title: "Career readiness",
    description: "Score shell reserved for the first Career Intelligence Report.",
    icon: TrendingUp,
  },
  {
    title: "Recommended jobs",
    description: "Static placeholder for personalized job recommendations.",
    icon: BriefcaseBusiness,
  },
  {
    title: "Learning path",
    description: "Shell for skill-gap based learning recommendations.",
    icon: GraduationCap,
  },
  {
    title: "AI assistant",
    description: "Entry point for grounded career questions once AI is implemented.",
    icon: MessageSquareText,
  },
];

type DashboardShellProps = {
  userEmail?: string;
};

export function DashboardShell({ userEmail }: DashboardShellProps) {
  return (
    <div className="mx-auto max-w-shell space-y-6">
      <section className="rounded-lg border bg-card p-6">
        <Badge variant="secondary">Dashboard shell</Badge>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight">Your career command center</h2>
            <p className="text-muted-foreground">
              The MVP dashboard foundation is ready for onboarding status, report scores, job
              recommendations, learning actions, and application tracking.
            </p>
            {userEmail ? (
              <p className="text-sm text-muted-foreground">Signed in as {userEmail}</p>
            ) : null}
          </div>
          <Link href="/onboarding" className={buttonVariants()}>
            Start onboarding
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {dashboardCards.map((card) => (
          <Card key={card.title} id={card.title.toLowerCase().replaceAll(" ", "-")}>
            <CardHeader className="flex flex-row items-start gap-4 space-y-0">
              <div className="grid size-10 place-items-center rounded-md bg-primary/10 text-primary">
                <card.icon className="size-5" aria-hidden="true" />
              </div>
              <div>
                <CardTitle>{card.title}</CardTitle>
                <CardDescription>{card.description}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
                Awaiting MVP business logic.
              </div>
            </CardContent>
          </Card>
        ))}
      </section>
    </div>
  );
}
