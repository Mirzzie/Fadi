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
import { getCurrentAuthUser } from "@/lib/auth/session";
import { getLatestCareerReport } from "@/lib/career-report/data";
import { getRecommendedJobsForUser } from "@/lib/jobs/data";
import { getMomentumSparkline, getMomentumSummary } from "@/lib/resilience/service";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const features = [
  {
    icon: Target,
    title: "Career Intelligence",
    description:
      "Fadi reads your resume and profile, maps your strengths, identifies skill gaps, and generates a career readiness score with concrete next steps.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Smart Job Matching",
    description:
      "Fadi matches you against curated opportunities, explains exactly why each role fits, and learns from what you save or skip.",
  },
  {
    icon: BookOpen,
    title: "Learning Paths",
    description:
      "From your skill gaps, Fadi builds a prioritized learning plan tied directly to your target roles, with courses and certifications ranked by impact.",
  },
  {
    icon: ListChecks,
    title: "Application Workspace",
    description:
      "Track every application, prepare role-specific assets, and manage deadlines. Fadi prepares everything for your review before anything is sent.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Tell Fadi who you are",
    body: "Paste your resume, add LinkedIn context, and share your career goals. Fadi reads everything and builds your professional profile.",
  },
  {
    step: "02",
    title: "Get your first analysis",
    body: "Fadi generates a Career Intelligence Report: strengths, gaps, role-fit score, and a prioritized list of next actions.",
  },
  {
    step: "03",
    title: "Act on recommendations",
    body: "Browse matched jobs, start your learning path, and track every application — all from one command center.",
  },
  {
    step: "04",
    title: "Fadi keeps working",
    body: "As you progress, Fadi updates recommendations, surfaces new opportunities, and helps you stay ahead of the market.",
  },
];

type Signal = { label: string; value: string; bars: number[]; realTrend?: boolean };

// Sample signals for anonymous visitors — replaced by the viewer's real numbers
// when they're signed in (see buildSignals).
const DEMO_SIGNALS: Signal[] = [
  { label: "Career readiness", value: "78", bars: [4, 6, 5, 8, 7, 9, 6, 8, 10, 7] },
  { label: "Resume quality", value: "84", bars: [5, 7, 6, 9, 8, 7, 10, 8, 9, 11] },
  { label: "Top job match", value: "69%", bars: [3, 5, 4, 6, 8, 5, 7, 9, 6, 8] },
  { label: "Momentum", value: "61", bars: [6, 4, 7, 5, 8, 6, 4, 7, 5, 6] },
];

/**
 * Real career signals for a signed-in viewer. When a metric doesn't exist yet
 * (e.g. no report generated) we show "—" rather than a fabricated number — the
 * panel is marked "live", so it must never present sample data as the user's
 * own. Anonymous visitors get the sample showcase instead.
 */
async function buildSignals(): Promise<{ signals: Signal[]; personalized: boolean }> {
  const user = await getCurrentAuthUser();
  if (!user) return { signals: DEMO_SIGNALS, personalized: false };

  const [report, jobs, momentum, momentumHistory] = await Promise.all([
    getLatestCareerReport(user.id),
    // Stored jobs only. The landing page shows one number; a live crawl and liveness probes
    // here held every visit to the home page for ~20s. The Jobs page does the live refresh.
    getRecommendedJobsForUser(user.id, 5, undefined, { skipSync: true }),
    getMomentumSummary(user.id),
    getMomentumSparkline(user.id, 10),
  ]);

  const topMatch = jobs.reduce((max, j) => Math.max(max, j.matchScore ?? 0), 0);
  const readiness = report?.career_readiness_score ?? null;
  const resume = report?.resume_quality_score ?? null;

  // realTrend gates the sparkline: only Momentum has a true history, so the other
  // metrics show their number without a decorative (fake) trend line.
  const signals: Signal[] = [
    {
      label: "Career readiness",
      value: readiness != null ? String(readiness) : "—",
      bars: DEMO_SIGNALS[0].bars,
      realTrend: false,
    },
    {
      label: "Resume quality",
      value: resume != null ? String(resume) : "—",
      bars: DEMO_SIGNALS[1].bars,
      realTrend: false,
    },
    {
      label: "Top job match",
      value: topMatch > 0 ? `${topMatch}%` : "—",
      bars: DEMO_SIGNALS[2].bars,
      realTrend: false,
    },
    {
      label: "Momentum",
      value: String(Math.round(momentum.momentum)),
      // Real momentum history — forward motion per day over the last 10 days.
      bars: momentumHistory,
      realTrend: true,
    },
  ];

  return { signals, personalized: true };
}

// Quiet signal field: the landing demonstrates the product instead of performing a brand effect.
const HERO_MESH =
  "radial-gradient(70% 90% at 84% 6%, color-mix(in oklab, var(--primary) 12%, transparent), transparent 68%)," +
  "linear-gradient(180deg, color-mix(in oklab, var(--background) 94%, var(--primary)), var(--background))";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Fadi", href: "#trust" },
];

export default async function Home() {
  const { signals, personalized } = await buildSignals();

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
                  One honest career system
                </p>
                <h1
                  className="text-[3.25rem] font-semibold leading-[0.94] tracking-[-0.045em] text-foreground sm:text-7xl lg:text-[5.5rem]"
                  style={{ fontFamily: "var(--font-inter-tight)" }}
                >
                  The career mentor
                  <br />
                  that tells you the truth
                </h1>
                <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg">
                  No ghost jobs. No spray-and-pray. No AI hype. Fadi surfaces roles you can actually
                  get, tells you honestly whether each one fits, and keeps you sane through a brutal
                  market — grounded in your real experience, never invented.
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

              {/* Right — career signals panel */}
              <div className="border-t border-border pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-2">
                <p className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Your career signals
                  {personalized ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300/90">
                      <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                      Live
                    </span>
                  ) : (
                    <span className="rounded-full border border-border px-1.5 py-0.5 text-[0.6rem] font-medium tracking-normal text-muted-foreground">
                      Sample
                    </span>
                  )}
                </p>
                <div className="divide-y divide-border">
                  {signals.map((s) => (
                    <div
                      key={s.label}
                      className="flex items-center justify-between gap-4 py-5"
                    >
                      <span className="text-xs uppercase tracking-wide text-muted-foreground">
                        {s.label}
                      </span>
                      <div className="flex items-center gap-5">
                        {/* Anonymous panel is a labeled sample (decorative bars OK);
                            for a live viewer, only show a sparkline that's a real trend. */}
                        {!personalized || s.realTrend ? <Sparkline bars={s.bars} /> : null}
                        <span
                          className="min-w-[3.5rem] text-right text-3xl font-light tabular-nums text-foreground sm:text-4xl"
                          style={{ fontFamily: "var(--font-inter-tight)" }}
                        >
                          {s.value}
                        </span>
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
                  title: "From Profile to Plan: A Career Read Honestly",
                  body: "Turn your resume and goals into a clear, evidence-based readout — strengths, gaps, and the next real step.",
                },
                {
                  title: "Every Application Counts: Quality Over Volume",
                  body: "Skip the spray-and-pray. Fadi helps you send fewer, sharper applications and learn from every outcome.",
                },
                {
                  title: "The Hidden Market: Signals Most People Miss",
                  body: "Live labour, skill, and economic signals — read in plain language, tied to your situation, never to alarm.",
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
                Everything your career needs in one place.
              </h2>
              <p className="max-w-xl text-muted-foreground lg:justify-self-end">
                Fadi connects your profile, the job market, and your learning goals into one
                intelligent career command center.
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
                Four steps from first sign-in to active career momentum.
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
                <p className="font-semibold">Fadi never acts without your approval.</p>
                <p className="text-sm text-muted-foreground">
                  Every application, message, and external action requires your explicit sign-off.
                  Fadi prepares. You decide.
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
              Ready to run your career
              <br />
              at full intelligence?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Create an account, complete a short profile, and Fadi will have your first Career
              Intelligence Report ready in minutes.
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

function Sparkline({ bars }: { bars: number[] }) {
  const max = Math.max(...bars, 0);
  return (
    <div className="flex h-8 items-end gap-[3px]" aria-hidden="true">
      {bars.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-white/45"
          // Flat baseline when there's no activity yet (max 0) — honest "no data".
          style={{ height: max > 0 ? `${Math.max(8, (h / max) * 100)}%` : "8%" }}
        />
      ))}
    </div>
  );
}
