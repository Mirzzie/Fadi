import {
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  ListChecks,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { FadiLogo } from "@/components/brand/fadi-logo";
import { FadiBadge } from "@/components/ui/fadi-badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Target,
    title: "See your starting point",
    description:
      "Keep your experience, goals, and evidence in one record. Compare what you have with what your target roles ask for.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Choose opportunities",
    description:
      "Review roles against your current direction, save the ones worth your time, and keep each application moving.",
  },
  {
    icon: BookOpen,
    title: "Practice the work",
    description:
      "Use projects, work simulations, and interview practice to build evidence you can discuss with an employer.",
  },
  {
    icon: ListChecks,
    title: "Prepare each application",
    description:
      "Bring the role, your CV, supporting notes, and follow-ups together without losing the source material behind them.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Add what you already have",
    body: "Bring in your CV, experience, projects, and the kind of work you want to move toward.",
  },
  {
    step: "02",
    title: "Choose a direction",
    body: "Compare your record with a target role and decide which gaps or opportunities deserve attention first.",
  },
  {
    step: "03",
    title: "Do the next piece of work",
    body: "Prepare an application, practise a task, or rehearse an interview from the same workspace.",
  },
  {
    step: "04",
    title: "Keep the record current",
    body: "Save completed work and outcomes so the next decision starts from what actually happened.",
  },
];

const WORKFLOW = [
  ["01", "Direction", "Choose the work you want to move toward."],
  ["02", "Opportunities", "Compare roles and prepare applications."],
  ["03", "Practice", "Build and rehearse evidence of the work."],
  ["04", "Record", "Keep useful outcomes for the next decision."],
] as const;

// Quiet signal field: the landing demonstrates the product instead of performing a brand effect.
const HERO_MESH =
  "radial-gradient(70% 90% at 84% 6%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 68%)," +
  "linear-gradient(180deg, color-mix(in oklab, var(--background) 94%, var(--primary)), var(--background))";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Fadi", href: "#trust" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Editorial product hero ──────────────────────────────────────────── */}
      <div>
        <section
          className="relative overflow-hidden border-b border-border"
          style={{ backgroundImage: HERO_MESH }}
        >
          {/* Dotted texture, faded toward the centre-right */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage: "radial-gradient(currentColor 0.7px, transparent 0.8px)",
              backgroundSize: "22px 22px",
              maskImage: "radial-gradient(65% 75% at 72% 42%, black, transparent 75%)",
              WebkitMaskImage: "radial-gradient(65% 75% at 72% 42%, black, transparent 75%)",
            }}
          />
          {/* Top sheen */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent"
          />

          <div className="relative">
            {/* Nav */}
            <nav className="mx-auto flex max-w-[90rem] items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
              <Link href="/" className="flex items-center gap-2.5">
                <FadiLogo className="glow-primary size-8" />
                <span className="font-semibold tracking-tight">Fadi</span>
              </Link>
              <div className="hidden items-center gap-8 md:flex">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-5">
                <Link
                  href="/auth/sign-in"
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  Login
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="rounded-md bg-foreground px-3 py-1.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
                >
                  Register
                </Link>
              </div>
            </nav>

            {/* Top: headline + signals panel */}
            <div className="mx-auto grid max-w-[90rem] gap-12 px-5 pb-16 pt-16 sm:px-8 lg:grid-cols-[1.12fr_0.88fr] lg:gap-16 lg:px-12 lg:pb-24 lg:pt-28">
              {/* Left */}
              <div className="max-w-3xl">
                <p className="mb-5 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                  Your career work, connected
                </p>
                <h1
                  className="text-[3.25rem] font-semibold leading-[0.94] tracking-[-0.045em] text-foreground sm:text-7xl lg:text-[5.5rem]"
                  style={{ fontFamily: "var(--font-inter-tight)" }}
                >
                  Turn your next
                  <br />
                  career move into a plan.
                </h1>
                <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                  Bring your direction, opportunities, applications, practice, and career record
                  into one workspace. Start with what you have and decide what to do next.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/auth/sign-up"
                    className="inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                  >
                    Sign Up Now
                  </Link>
                  <Link
                    href="#features"
                    className="inline-flex items-center justify-center rounded-md border border-border bg-background/50 px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted"
                  >
                    Learn More
                  </Link>
                </div>
              </div>

              {/* Right — product workflow, not invented outcome scores. */}
              <div className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-2">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  One working path
                </p>
                <div className="divide-y divide-border">
                  {WORKFLOW.map(([step, title, body]) => (
                    <div
                      key={step}
                      className="grid grid-cols-[2.25rem_1fr] gap-3 py-5"
                    >
                      <span className="font-mono text-xs text-muted-foreground">
                        {step}
                      </span>
                      <div>
                        <p className="font-medium text-foreground">{title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{body}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom: three feature columns */}
            <div className="mx-auto grid max-w-[90rem] border-t border-border sm:grid-cols-3 sm:divide-x sm:divide-border">
              {[
                {
                  title: "Start from your record",
                  body: "Keep your experience, goals, and evidence together before deciding what comes next.",
                },
                {
                  title: "Prepare one application at a time",
                  body: "Work from the role requirements and your own material, then keep the outcome with the application.",
                },
                {
                  title: "Build proof by doing the work",
                  body: "Use projects, simulations, and interview practice to create evidence you can explain.",
                },
              ].map((col) => (
                <div key={col.title} className="px-6 py-8 sm:px-8">
                  <h3 className="text-lg font-semibold leading-snug">{col.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{col.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <main>
        {/* Features */}
        <section id="features" className="border-b border-border/60 py-20 sm:py-28">
          <div className="mx-auto max-w-shell px-4 sm:px-6">
            <div className="mb-14 grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
              <h2 className="max-w-xl text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">
                One place for the work around your career.
              </h2>
              <p className="max-w-xl text-muted-foreground lg:justify-self-end">
                Keep decisions, applications, practice, and evidence connected without turning
                every step into another disconnected tool.
              </p>
            </div>

            <div className="grid border-y border-border sm:grid-cols-2">
              {features.map((feature) => (
                <div
                  key={feature.title}
                  className="group border-b border-border p-6 sm:odd:border-r lg:p-8"
                >
                  <feature.icon className="mb-8 size-5 text-primary" aria-hidden="true" />
                  <h3 className="mb-2 text-lg font-semibold">{feature.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="border-b border-border/60 py-20 sm:py-28">
          <div className="mx-auto max-w-shell px-4 sm:px-6">
            <div className="mb-14 max-w-xl">
              <h2 className="text-4xl font-semibold tracking-[-0.035em] sm:text-5xl">How Fadi works.</h2>
              <p className="mt-3 text-muted-foreground">
                Four steps from first sign-in to ongoing work.
              </p>
            </div>

            <div className="grid border-t border-border sm:grid-cols-2 lg:grid-cols-4 lg:divide-x lg:divide-border">
              {howItWorks.map((item) => (
                <div key={item.step} className="space-y-3 border-b border-border py-7 lg:px-6 lg:first:pl-0 lg:last:pr-0">
                  <div className="font-mono text-xs font-semibold text-primary">{item.step}</div>
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Fadi trust strip */}
        <section id="trust" className="border-b border-border/60 bg-primary/5 py-12">
          <div className="mx-auto max-w-shell px-4 sm:px-6">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
              <div className="space-y-1">
                <p className="font-semibold">Review external actions before they happen.</p>
                <p className="text-sm text-muted-foreground">
                  Applications and messages are prepared for your sign-off. You decide whether they
                  go any further.
                </p>
              </div>
              <TrendingUp className="size-10 shrink-0 text-primary opacity-60" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-shell px-4 text-center sm:px-6">
            <FadiBadge size="md" showName={false} className="justify-center mb-6" />
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                Start with your
              <br />
                current direction.
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Add what you already have, choose what you are working toward, and take one useful
              next step.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/auth/sign-up"
                className={cn(buttonVariants({ size: "lg" }), "glow-primary")}
              >
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
            <FadiLogo className="size-6" />
            <span className="text-sm font-medium">Fadi</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Fadi is an AI assistant. Always review recommendations before acting.
          </p>
        </div>
      </footer>
    </div>
  );
}
