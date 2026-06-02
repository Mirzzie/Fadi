import Link from "next/link";

import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-shell px-4 py-16 sm:px-6 lg:py-24">
        <section className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
          <div className="space-y-6">
            <Badge variant="secondary">MVP foundation</Badge>
            <div className="space-y-4">
              <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                Your AI career operating system.
              </h1>
              <p className="max-w-2xl text-lg text-muted-foreground">
                CareerOS AI helps users turn CVs, LinkedIn context, goals, jobs, and learning
                actions into one career command center.
              </p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link href="/auth/sign-up" className={buttonVariants({ size: "lg" })}>
                Create account
              </Link>
              <Link
                href="/auth/sign-in"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                Sign in
              </Link>
            </div>
          </div>

          <Card>
            <CardContent className="space-y-5 p-6">
              <p className="text-sm font-medium text-muted-foreground">First experience shell</p>
              <div className="space-y-3">
                {[
                  "Upload a CV",
                  "Add LinkedIn context",
                  "Confirm career goals",
                  "View the first Career Intelligence Report",
                ].map((item, index) => (
                  <div key={item} className="flex items-center gap-3 rounded-md border p-3">
                    <span className="grid size-7 place-items-center rounded-md bg-primary text-xs text-primary-foreground">
                      {index + 1}
                    </span>
                    <span className="text-sm">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </section>
      </main>
    </div>
  );
}
