import {
  BookOpen,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronRight,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { KaiBadge } from "@/components/ui/kai-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Target,
    title: "Career Intelligence",
    description:
      "Kai reads your resume and profile, maps your strengths, identifies skill gaps, and generates a career readiness score with concrete next steps.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Smart Job Matching",
    description:
      "Kai matches you against curated opportunities, explains exactly why each role fits, and learns from what you save or skip.",
  },
  {
    icon: BookOpen,
    title: "Learning Paths",
    description:
      "From your skill gaps, Kai builds a prioritized learning plan tied directly to your target roles, with courses and certifications ranked by impact.",
  },
  {
    icon: ListChecks,
    title: "Application Workspace",
    description:
      "Track every application, prepare role-specific assets, and manage deadlines. Kai prepares everything for your review before anything is sent.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Tell Kai who you are",
    body: "Paste your resume, add LinkedIn context, and share your career goals. Kai reads everything and builds your professional profile.",
  },
  {
    step: "02",
    title: "Get your first analysis",
    body: "Kai generates a Career Intelligence Report: strengths, gaps, role-fit score, and a prioritized list of next actions.",
  },
  {
    step: "03",
    title: "Act on recommendations",
    body: "Browse matched jobs, start your learning path, and track every application — all from one command center.",
  },
  {
    step: "04",
    title: "Kai keeps working",
    body: "As you progress, Kai updates recommendations, surfaces new opportunities, and helps you stay ahead of the market.",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border/60 bg-background/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="mx-auto flex h-16 max-w-shell items-center justify-between px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="size-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="font-semibold tracking-tight">CareerOS</span>
          </Link>
          <nav className="flex items-center gap-2">
            <Link href="/auth/sign-in" className={buttonVariants({ variant: "ghost", size: "sm" })}>
              Sign in
            </Link>
            <Link href="/auth/sign-up" className={buttonVariants({ size: "sm" })}>
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border/60">
          {/* Subtle background grid */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.025]"
            style={{
              backgroundImage:
                "linear-gradient(to right, oklch(0.72 0.19 192) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.19 192) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
            aria-hidden="true"
          />
          {/* Aurora glows — teal core + violet crown */}
          <div
            className="pointer-events-none absolute right-1/4 top-1/2 size-[620px] -translate-y-1/2 rounded-full opacity-[0.14] blur-3xl"
            style={{ background: "oklch(0.72 0.19 192)" }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -right-20 top-0 size-[460px] rounded-full opacity-[0.12] blur-3xl"
            style={{ background: "oklch(0.66 0.22 285)" }}
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -left-24 bottom-0 size-[420px] rounded-full opacity-[0.08] blur-3xl"
            style={{ background: "oklch(0.7 0.17 230)" }}
            aria-hidden="true"
          />

          <div className="mx-auto grid max-w-shell gap-12 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-28">
            {/* Left */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                Kai is ready
              </div>

              <div className="space-y-4">
                <h1 className="text-5xl font-semibold tracking-tight text-foreground sm:text-6xl">
                  Your career,
                  <br />
                  <span className="bg-gradient-to-r from-primary via-[oklch(0.7_0.17_230)] to-[oklch(0.68_0.22_285)] bg-clip-text text-transparent">
                    run by Kai.
                  </span>
                </h1>
                <p className="max-w-lg text-lg leading-relaxed text-muted-foreground">
                  Kai is an AI career agent that analyzes your profile, surfaces the right
                  opportunities, builds your learning plan, and tracks every application. Not a job
                  board. An operating system for your career.
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/auth/sign-up"
                  className={cn(buttonVariants({ size: "lg" }), "glow-primary")}
                >
                  Start with Kai
                  <ChevronRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/auth/sign-in"
                  className={buttonVariants({ size: "lg", variant: "outline" })}
                >
                  Sign in
                </Link>
              </div>

              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
                {["No credit card required", "Free to get started", "Approval-gated automation"].map(
                  (item) => (
                    <div key={item} className="flex items-center gap-1.5">
                      <CheckCircle2 className="size-3.5 text-primary" aria-hidden="true" />
                      {item}
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Right — Kai intro card */}
            <div className="lg:pl-8">
              <div className="gradient-border glass-card glow-primary rounded-2xl p-6 space-y-5">
                <div className="flex items-center justify-between">
                  <KaiBadge size="sm" />
                  <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-xs font-medium text-emerald-400">
                    Online
                  </span>
                </div>

                <div className="space-y-3">
                  <p className="text-sm leading-relaxed text-card-foreground">
                    Hello. I&apos;m your career agent.
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Share your resume and goals, and I&apos;ll analyze where you stand, what&apos;s
                    holding you back, and what the smartest next move is. I&apos;ll surface matching
                    jobs, build your learning plan, and keep your applications organized.
                  </p>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    You stay in control. I do the heavy analysis.
                  </p>
                </div>

                <div className="border-t border-border/60 pt-4">
                  <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    What I can do for you
                  </p>
                  <ul className="space-y-2">
                    {[
                      "Career analysis and readiness score",
                      "Job matching with match explanations",
                      "Personalized learning paths",
                      "Application tracking and preparation",
                    ].map((capability) => (
                      <li key={capability} className="flex items-center gap-2.5 text-sm">
                        <Sparkles
                          className="size-3.5 shrink-0 text-primary"
                          aria-hidden="true"
                        />
                        <span className="text-card-foreground">{capability}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <Link
                  href="/auth/sign-up"
                  className={cn(
                    buttonVariants({ size: "sm" }),
                    "w-full justify-center",
                  )}
                >
                  Start your career analysis
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-b border-border/60 py-20 sm:py-28">
          <div className="mx-auto max-w-shell px-4 sm:px-6">
            <div className="mx-auto mb-12 max-w-xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything your career needs in one place.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Kai connects your profile, the job market, and your learning goals into one
                intelligent career command center.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-xl border border-border/60 bg-card p-5 transition-colors hover:border-primary/30 hover:bg-card"
                >
                  <div className="mb-4 inline-flex size-9 items-center justify-center rounded-lg bg-primary/10">
                    <feature.icon className="size-4.5 text-primary" aria-hidden="true" />
                  </div>
                  <h3 className="mb-2 font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-b border-border/60 py-20 sm:py-28">
          <div className="mx-auto max-w-shell px-4 sm:px-6">
            <div className="mx-auto mb-14 max-w-xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How Kai works.</h2>
              <p className="mt-3 text-muted-foreground">
                Four steps from first sign-in to active career momentum.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {howItWorks.map((item) => (
                <div key={item.step} className="space-y-3">
                  <div className="text-3xl font-bold text-primary/30">{item.step}</div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Kai trust strip */}
        <section className="border-b border-border/60 bg-primary/5 py-12">
          <div className="mx-auto max-w-shell px-4 sm:px-6">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
              <div className="space-y-1">
                <p className="font-semibold">Kai never acts without your approval.</p>
                <p className="text-sm text-muted-foreground">
                  Every application, message, and external action requires your explicit sign-off.
                  Kai prepares. You decide.
                </p>
              </div>
              <TrendingUp
                className="size-10 shrink-0 text-primary opacity-60"
                aria-hidden="true"
              />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-shell px-4 text-center sm:px-6">
            <KaiBadge size="md" showName={false} className="justify-center mb-6" />
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Ready to run your career
              <br />
              at full intelligence?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Create an account, complete a short profile, and Kai will have your first Career
              Intelligence Report ready in minutes.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link href="/auth/sign-up" className={buttonVariants({ size: "lg" })}>
                Create your account
                <ChevronRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/auth/sign-in"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                Sign in
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 py-8">
        <div className="mx-auto flex max-w-shell items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex size-6 items-center justify-center rounded-md bg-primary">
              <Sparkles className="size-3 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-sm font-medium">CareerOS</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Kai is an AI assistant. Always review recommendations before acting.
          </p>
        </div>
      </footer>
    </div>
  );
}
