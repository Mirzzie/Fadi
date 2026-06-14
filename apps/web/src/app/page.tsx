import {
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

import { ScoutBadge } from "@/components/ui/scout-badge";
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
      "Scout reads your resume and profile, maps your strengths, identifies skill gaps, and generates a career readiness score with concrete next steps.",
  },
  {
    icon: BriefcaseBusiness,
    title: "Smart Job Matching",
    description:
      "Scout matches you against curated opportunities, explains exactly why each role fits, and learns from what you save or skip.",
  },
  {
    icon: BookOpen,
    title: "Learning Paths",
    description:
      "From your skill gaps, Scout builds a prioritized learning plan tied directly to your target roles, with courses and certifications ranked by impact.",
  },
  {
    icon: ListChecks,
    title: "Application Workspace",
    description:
      "Track every application, prepare role-specific assets, and manage deadlines. Scout prepares everything for your review before anything is sent.",
  },
];

const howItWorks = [
  {
    step: "01",
    title: "Tell Scout who you are",
    body: "Paste your resume, add LinkedIn context, and share your career goals. Scout reads everything and builds your professional profile.",
  },
  {
    step: "02",
    title: "Get your first analysis",
    body: "Scout generates a Career Intelligence Report: strengths, gaps, role-fit score, and a prioritized list of next actions.",
  },
  {
    step: "03",
    title: "Act on recommendations",
    body: "Browse matched jobs, start your learning path, and track every application — all from one command center.",
  },
  {
    step: "04",
    title: "Scout keeps working",
    body: "As you progress, Scout updates recommendations, surfaces new opportunities, and helps you stay ahead of the market.",
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
    getRecommendedJobsForUser(user.id, 5),
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

// Aurora mesh — magenta left, blue crown, amber floor, violet corner.
const HERO_MESH =
  "radial-gradient(115% 130% at 0% 38%, oklch(0.52 0.24 332) 0%, transparent 44%)," +
  "radial-gradient(120% 115% at 100% -10%, oklch(0.56 0.21 264) 0%, transparent 50%)," +
  "radial-gradient(95% 95% at -6% 110%, oklch(0.63 0.14 56) 0%, transparent 46%)," +
  "radial-gradient(88% 98% at 108% 112%, oklch(0.52 0.24 312) 0%, transparent 50%)," +
  "oklch(0.14 0.04 295)";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Scout", href: "#trust" },
];

export default async function Home() {
  const { signals, personalized } = await buildSignals();

  return (
    // The marketing page is authored as a fixed dark experience (white text on a
    // dark mesh). Scope `dark` to it so it renders correctly even when the user's
    // saved theme is light — otherwise bg-background turns white and the white
    // text disappears. App screens still follow the global theme.
    <div className="dark min-h-screen bg-background text-foreground">
      {/* ── Framed mesh hero ───────────────────────────────────────────────── */}
      <div className="p-2.5 sm:p-3.5">
        <section
          className="relative overflow-hidden rounded-[1.75rem] ring-1 ring-white/12"
          style={{ backgroundImage: HERO_MESH }}
        >
          {/* Dotted texture, faded toward the centre-right */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage: "radial-gradient(oklch(1 0 0 / 0.7) 1px, transparent 1.4px)",
              backgroundSize: "18px 18px",
              maskImage: "radial-gradient(65% 75% at 72% 42%, black, transparent 75%)",
              WebkitMaskImage: "radial-gradient(65% 75% at 72% 42%, black, transparent 75%)",
            }}
          />
          {/* Top sheen */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 to-transparent"
          />

          <div className="relative">
            {/* Nav */}
            <nav className="flex items-center justify-between px-6 py-5 sm:px-10">
              <Link href="/" className="flex items-center gap-2.5">
                <div className="glow-primary flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-[oklch(0.7_0.2_330)] to-[oklch(0.6_0.2_270)]">
                  <Sparkles className="size-4 text-white" aria-hidden="true" />
                </div>
                <span className="font-semibold tracking-tight text-white">CareerOS</span>
              </Link>
              <div className="hidden items-center gap-8 md:flex">
                {navLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="text-sm text-white/70 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
              <div className="flex items-center gap-5">
                <Link
                  href="/auth/sign-in"
                  className="text-sm text-white/70 transition-colors hover:text-white"
                >
                  Login
                </Link>
                <Link
                  href="/auth/sign-up"
                  className="text-sm font-medium text-white/90 transition-colors hover:text-white"
                >
                  Register
                </Link>
              </div>
            </nav>

            {/* Top: headline + signals panel */}
            <div className="grid gap-10 px-6 pb-4 pt-10 sm:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:pt-16">
              {/* Left */}
              <div className="max-w-xl">
                <h1
                  className="text-[2.9rem] font-extrabold leading-[0.95] tracking-tight text-white sm:text-6xl lg:text-7xl"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  Take Control
                  <br />
                  of Your Career
                </h1>
                <p className="mt-6 max-w-md text-base leading-relaxed text-white/65">
                  Stay ahead of your search with an AI agent that reads your profile, finds the roles
                  that actually fit, and tracks every move — honestly.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/auth/sign-up"
                    className="inline-flex items-center justify-center gap-1.5 rounded-full bg-gradient-to-r from-[oklch(0.64_0.25_350)] to-[oklch(0.55_0.24_300)] px-6 py-3 text-sm font-semibold text-white shadow-[0_8px_30px_-6px_oklch(0.6_0.25_330_/_0.6)] transition-transform hover:-translate-y-0.5"
                  >
                    Sign Up Now
                  </Link>
                  <Link
                    href="#features"
                    className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    Learn More
                  </Link>
                </div>
              </div>

              {/* Right — career signals panel */}
              <div className="lg:pl-4">
                <p className="mb-1 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-white/55">
                  Your career signals
                  {personalized ? (
                    <span className="inline-flex items-center gap-1 text-emerald-300/90">
                      <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
                      Live
                    </span>
                  ) : (
                    <span className="rounded-full border border-white/20 px-1.5 py-0.5 text-[0.6rem] font-medium tracking-normal text-white/50">
                      Sample
                    </span>
                  )}
                </p>
                <div className="divide-y divide-white/10">
                  {signals.map((s) => (
                    <div
                      key={s.label}
                      className="flex items-center justify-between gap-4 py-5"
                    >
                      <span className="text-xs uppercase tracking-wide text-white/55">
                        {s.label}
                      </span>
                      <div className="flex items-center gap-5">
                        {/* Anonymous panel is a labeled sample (decorative bars OK);
                            for a live viewer, only show a sparkline that's a real trend. */}
                        {!personalized || s.realTrend ? <Sparkline bars={s.bars} /> : null}
                        <span
                          className="min-w-[3.5rem] text-right text-3xl font-light tabular-nums text-white sm:text-4xl"
                          style={{ fontFamily: "var(--font-display)" }}
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
            <div className="mt-6 grid border-t border-white/12 sm:grid-cols-3 sm:divide-x sm:divide-white/12">
              {[
                {
                  title: "From Profile to Plan: A Career Read Honestly",
                  body: "Turn your resume and goals into a clear, evidence-based readout — strengths, gaps, and the next real step.",
                },
                {
                  title: "Every Application Counts: Quality Over Volume",
                  body: "Skip the spray-and-pray. Scout helps you send fewer, sharper applications and learn from every outcome.",
                },
                {
                  title: "The Hidden Market: Signals Most People Miss",
                  body: "Live labour, skill, and economic signals — read in plain language, tied to your situation, never to alarm.",
                },
              ].map((col) => (
                <div key={col.title} className="px-6 py-8 sm:px-8">
                  <h3 className="text-lg font-semibold leading-snug text-white">{col.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/60">{col.body}</p>
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
            <div className="mx-auto mb-12 max-w-xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                Everything your career needs in one place.
              </h2>
              <p className="mt-3 text-muted-foreground">
                Scout connects your profile, the job market, and your learning goals into one
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
        <section id="how" className="border-b border-border/60 py-20 sm:py-28">
          <div className="mx-auto max-w-shell px-4 sm:px-6">
            <div className="mx-auto mb-14 max-w-xl text-center">
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">How Scout works.</h2>
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

        {/* Scout trust strip */}
        <section id="trust" className="border-b border-border/60 bg-primary/5 py-12">
          <div className="mx-auto max-w-shell px-4 sm:px-6">
            <div className="flex flex-col items-center gap-6 text-center sm:flex-row sm:justify-between sm:text-left">
              <div className="space-y-1">
                <p className="font-semibold">Scout never acts without your approval.</p>
                <p className="text-sm text-muted-foreground">
                  Every application, message, and external action requires your explicit sign-off.
                  Scout prepares. You decide.
                </p>
              </div>
              <TrendingUp className="size-10 shrink-0 text-primary opacity-60" aria-hidden="true" />
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 sm:py-32">
          <div className="mx-auto max-w-shell px-4 text-center sm:px-6">
            <ScoutBadge size="md" showName={false} className="justify-center mb-6" />
            <h2 className="text-4xl font-semibold tracking-tight sm:text-5xl">
              Ready to run your career
              <br />
              at full intelligence?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-muted-foreground">
              Create an account, complete a short profile, and Scout will have your first Career
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
            <div className="flex size-6 items-center justify-center rounded-md bg-primary">
              <Sparkles className="size-3 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="text-sm font-medium">CareerOS</span>
          </div>
          <p className="text-xs text-muted-foreground">
            Scout is an AI assistant. Always review recommendations before acting.
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
