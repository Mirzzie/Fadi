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
  "Turn your real evidence into tailored applications",
  "Surface jobs that match your actual skills",
  "Close your gaps with a clear learning path",
  "Track every application in one place",
];

const signInPoints = [
  "New job matches since your last visit",
  "Updated recommendations for your target market",
  "Your active learning path, continued",
  "Everything, in one calm workspace",
];

/**
 * Entering the OS — the sign-in / sign-up surface. Same calm system as the rest of
 * Fadi: a soft aurora wallpaper, one clean card, one clear action. Theme-aware
 * (follows the visitor's light/dark preference) — simple, modern, for everyone.
 */
export function AuthShell({ mode, socialProviders = [] }: AuthShellProps) {
  const isSignUp = mode === "sign-up";
  const points = isSignUp ? signUpPoints : signInPoints;

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
      {/* Soft aurora wallpaper — the ambient Fadi glow, kept quiet so it never fights the form. */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 aurora-bg">
        <div className="absolute -left-40 top-1/4 size-[520px] rounded-full opacity-[0.10] blur-3xl [background:var(--aurora-1)]" />
        <div className="absolute -right-32 bottom-0 size-[460px] rounded-full opacity-[0.10] blur-3xl [background:var(--aurora-2)]" />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 py-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <FadiLogo className="size-8" />
          <span className="font-heading text-lg font-semibold tracking-tight">Fadi</span>
        </Link>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="grid w-full max-w-4xl gap-12 lg:grid-cols-[1fr_420px] lg:items-center">
          {/* Left — the invitation */}
          <div className="hidden flex-col items-start gap-7 lg:flex">
            <FadiCore state="idle" size={120} />
            <div className="space-y-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">
                Your career, as one system
              </p>
              <h1 className="font-heading text-4xl font-semibold leading-[1.05] tracking-tight text-balance">
                {isSignUp ? "Everything you need, in one place." : "Welcome back."}
              </h1>
              <p className="max-w-md leading-relaxed text-muted-foreground">
                {isSignUp
                  ? "Evidence in, applications out — nothing invented. Fadi helps you claim every true thing at its full strength."
                  : "Pick up exactly where you left off. Fadi kept working while you were away."}
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

            <div className="rounded-xl border border-border bg-card/60 p-4 shadow-sm">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Private by default.</span> Every external action —
                applications, messages, profile updates — needs your explicit sign-off. Nothing leaves the system
                without you.
              </p>
            </div>
          </div>

          {/* Right — the form card */}
          <div className="w-full rounded-2xl border border-border bg-card p-6 shadow-lg">
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              <FadiCore state="idle" size={40} />
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
