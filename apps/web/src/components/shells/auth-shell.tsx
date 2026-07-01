import { CheckCircle2 } from "lucide-react";
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

const signUpFadiPoints = [
  "Analyze your resume and LinkedIn profile",
  "Surface jobs that match your actual skills",
  "Build a learning path to close your gaps",
  "Track every application in one place",
];

const signInFadiPoints = [
  "Check for new job matches since your last visit",
  "Review any updated career recommendations",
  "Continue your active learning path",
  "See what's changed in your target market",
];

/** Holographic Fadi sign-in / sign-up — entering the OS. Forced-dark so the
 *  JARVIS aesthetic reads regardless of the visitor's saved theme. */
export function AuthShell({ mode, socialProviders = [] }: AuthShellProps) {
  const isSignUp = mode === "sign-up";
  const fadiPoints = isSignUp ? signUpFadiPoints : signInFadiPoints;

  return (
    <div className="dark relative flex min-h-screen flex-col overflow-hidden bg-[oklch(0.09_0.03_245)] text-foreground">
      {/* Living holographic wallpaper */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_50%_-10%,oklch(0.66_0.22_285/0.2),transparent_60%)]" />
        <div className="holo-grid absolute inset-0 opacity-50" />
        <div className="holo-scanlines absolute inset-0 opacity-40" />
        <div className="absolute -left-32 top-1/4 size-[520px] rounded-full opacity-[0.14] blur-3xl" style={{ background: "oklch(0.72 0.19 192)" }} />
        <div className="absolute -right-24 bottom-0 size-[480px] rounded-full opacity-[0.12] blur-3xl" style={{ background: "oklch(0.66 0.22 285)" }} />
      </div>

      {/* Header */}
      <header className="relative z-10 px-4 py-5 sm:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <FadiLogo className="size-8" />
          <span className="font-semibold tracking-tight">Fadi</span>
        </Link>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <div className="grid w-full max-w-4xl gap-12 lg:grid-cols-[1fr_420px] lg:items-center">
          {/* Left — Fadi intro */}
          <div className="hidden flex-col items-start gap-7 lg:flex">
            <FadiCore state="idle" size={132} />
            <div className="space-y-3">
              <p className="text-xs uppercase tracking-[0.3em] text-primary/80">Fadi · Honest Career Mentor</p>
              <h1 className="text-glow text-3xl font-semibold tracking-tight">
                {isSignUp ? "Your career agent is ready." : "Welcome back. Fadi's been working."}
              </h1>
              <p className="max-w-md leading-relaxed text-muted-foreground">
                {isSignUp
                  ? "Create your account and Fadi immediately begins analyzing your profile, finding opportunities, and building your career intelligence."
                  : "Sign in and Fadi will brief you on everything it found since you were last here."}
              </p>
            </div>

            <ul className="space-y-2.5">
              {fadiPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>

            <div className="glass-holo rounded-xl p-4">
              <p className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-primary">Fadi never acts without your approval.</span> Every external
                action — applications, messages, profile updates — requires your explicit sign-off.
              </p>
            </div>
          </div>

          {/* Right — Form */}
          <div className="glass-holo glow-edge w-full rounded-2xl p-6">
            <div className="mb-4 flex items-center gap-3 lg:hidden">
              <FadiCore state="idle" size={44} />
              <span className="font-semibold tracking-tight">Fadi</span>
            </div>
            <h2 className="text-xl font-semibold tracking-tight">
              {isSignUp ? "Create your account" : "Welcome back"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignUp ? "Boot up your first Career Intelligence Report." : "Return to your Fadi workspace."}
            </p>
            <div className="mt-5 space-y-5">
              <SocialButtons providers={socialProviders} />
              <Suspense
                fallback={
                  <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">Loading…</div>
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
