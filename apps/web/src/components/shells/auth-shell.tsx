import { Check } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { FadiLogo } from "@/components/brand/fadi-logo";
import { FadiCore } from "@/components/os/fadi-core";
import { AuthForm } from "@/components/auth/auth-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import type { SocialProvider } from "@/lib/auth/social";

type AuthShellProps = {
  mode: "sign-in" | "sign-up";
  socialProviders?: SocialProvider[];
};

const signUpPoints = [
  "Bring your experience and constraints into view",
  "Compare opportunities with your chosen direction",
  "Practise the work and review what you learned",
  "Keep applications and outcomes connected",
];

const signInPoints = [
  "Review your current direction and next step",
  "Continue saved applications and practice",
  "Record outcomes, not just completed tasks",
  "Change course when your circumstances change",
];

/**
 * Entering the OS — the sign-in / sign-up surface. Same calm system as the rest of
 * Fadi: an editorial split, one contained form, one clear action. Theme-aware
 * (follows the visitor's light/dark preference) — simple, modern, for everyone.
 */
export function AuthShell({ mode, socialProviders = [] }: AuthShellProps) {
  const isSignUp = mode === "sign-up";
  const points = isSignUp ? signUpPoints : signInPoints;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* One quiet signal field, kept to the invitation side. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="absolute inset-y-0 left-0 hidden w-1/2 bg-[linear-gradient(135deg,color-mix(in_oklab,var(--primary)_10%,var(--background)),var(--background)_70%)] lg:block" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-border px-5 py-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <FadiLogo className="size-8" />
          <span className="font-heading text-lg font-semibold tracking-tight">Fadi</span>
        </Link>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-stretch">
        <div className="grid w-full lg:grid-cols-2">
          {/* Left — the invitation */}
          <div className="hidden flex-col items-start justify-center gap-9 border-r border-border px-12 py-16 lg:flex xl:px-20">
            <FadiCore state="ready" size={120} />
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                Your career, as one system
              </p>
              <h1 className="max-w-xl font-heading text-5xl font-semibold leading-[0.98] tracking-[-0.04em] text-balance xl:text-6xl">
                {isSignUp ? "Start with your next move." : "Welcome back."}
              </h1>
              <p className="max-w-md leading-relaxed text-muted-foreground">
                {isSignUp
                  ? "Connect your experience, the work you want and the steps you take. Review what goes into your career record."
                  : "Return to your plans, applications and practice. Review what changed before deciding what to do next."}
              </p>
            </div>

            <ul className="space-y-2.5">
              {points.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm">
                  <span
                    className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-success/15 text-success"
                    aria-hidden="true"
                  >
                    <Check className="size-3" strokeWidth={3} />
                  </span>
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>

            <div className="max-w-lg border-l-2 border-primary pl-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Review before acting.</span> Approving a draft
                is separate from sending or publishing it. AI features process relevant content with your
                selected provider; check your connections and permissions in Settings.
              </p>
            </div>
          </div>

          {/* Right — the form card */}
          <div className="mx-auto flex w-full max-w-lg flex-col justify-center px-5 py-12 sm:px-10 lg:px-14">
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              <FadiCore state="ready" size={40} />
              <span className="font-heading font-semibold tracking-tight">Fadi</span>
            </div>
            <h2 className="font-heading text-xl font-semibold tracking-tight">
              {isSignUp ? "Create your account" : "Sign in"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignUp ? "Start with your real evidence." : "Return to your workspace."}
            </p>
            <div className="mt-5 space-y-5">
              <SocialButtons providers={socialProviders} />
              <Suspense
                fallback={
                  <div className="rounded-lg border border-border p-3 text-sm text-muted-foreground">Loading…</div>
                }
              >
                <AuthForm mode={mode} />
              </Suspense>
              <p className="text-center text-sm text-muted-foreground">
                {isSignUp ? "Already have an account?" : "New to Fadi?"}{" "}
                <Link
                  href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {isSignUp ? "Sign in" : "Create one"}
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
