import { CheckCircle2, Sparkles } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { SocialButtons } from "@/components/auth/social-buttons";
import { FadiBadge } from "@/components/ui/fadi-badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

export function AuthShell({ mode, socialProviders = [] }: AuthShellProps) {
  const isSignUp = mode === "sign-up";
  const fadiPoints = isSignUp ? signUpFadiPoints : signInFadiPoints;

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* Subtle background grid */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            "linear-gradient(to right, oklch(0.72 0.19 192) 1px, transparent 1px), linear-gradient(to bottom, oklch(0.72 0.19 192) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
        aria-hidden="true"
      />
      {/* Aurora glows */}
      <div
        className="pointer-events-none fixed -left-32 top-1/4 size-[520px] rounded-full opacity-[0.12] blur-3xl"
        style={{ background: "oklch(0.72 0.19 192)" }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed -right-24 bottom-0 size-[480px] rounded-full opacity-[0.1] blur-3xl"
        style={{ background: "oklch(0.66 0.22 285)" }}
        aria-hidden="true"
      />

      {/* Header */}
      <header className="relative z-10 border-b border-border/60 bg-background/80 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-shell items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary">
              <Sparkles className="size-4 text-primary-foreground" aria-hidden="true" />
            </div>
            <span className="font-semibold tracking-tight">FadiOS</span>
          </Link>
        </div>
      </header>

      {/* Main */}
      <main className="relative z-10 flex flex-1 items-center justify-center px-4 py-12 sm:px-6">
        <div className="grid w-full max-w-4xl gap-10 lg:grid-cols-[1fr_420px] lg:items-center">

          {/* Left — Fadi intro */}
          <div className="hidden space-y-8 lg:block">
            <div className="space-y-4">
              <FadiBadge size="md" />
              <h1 className="text-3xl font-semibold tracking-tight">
                {isSignUp
                  ? "Your career agent is ready to start."
                  : "Welcome back. Fadi has been working."}
              </h1>
              <p className="text-muted-foreground leading-relaxed">
                {isSignUp
                  ? "Create your account and Fadi will immediately begin analyzing your profile, finding opportunities, and building your career intelligence."
                  : "Sign in and Fadi will brief you on everything it found since you were last here."}
              </p>
            </div>

            <ul className="space-y-3">
              {fadiPoints.map((point) => (
                <li key={point} className="flex items-start gap-3 text-sm">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span className="text-muted-foreground">{point}</span>
                </li>
              ))}
            </ul>

            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
              <p className="text-xs text-muted-foreground leading-relaxed">
                <span className="font-medium text-primary">Fadi never acts without your approval.</span>{" "}
                Every external action — applications, messages, profile updates — requires your
                explicit sign-off.
              </p>
            </div>
          </div>

          {/* Right — Form */}
          <Card className="fadi-glow-sm w-full">
            <CardHeader>
              <CardTitle className="text-xl">
                {isSignUp ? "Create your account" : "Welcome back"}
              </CardTitle>
              <CardDescription>
                {isSignUp
                  ? "Start your first Career Intelligence Report."
                  : "Return to your FadiOS workspace."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <SocialButtons providers={socialProviders} />
              <Suspense
                fallback={
                  <div className="rounded-lg border border-border/60 p-3 text-sm text-muted-foreground">
                    Loading...
                  </div>
                }
              >
                <AuthForm mode={mode} />
              </Suspense>
              <p className="text-center text-sm text-muted-foreground">
                {isSignUp ? "Already have an account?" : "New to FadiOS?"}{" "}
                <Link
                  href={isSignUp ? "/auth/sign-in" : "/auth/sign-up"}
                  className="font-medium text-primary underline-offset-4 hover:underline"
                >
                  {isSignUp ? "Sign in" : "Create one"}
                </Link>
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
