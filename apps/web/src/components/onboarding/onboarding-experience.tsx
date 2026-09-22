"use client";

import { ArrowLeft, KeyRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { FadiOnboardingAI } from "@/components/onboarding/fadi-onboarding-ai";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * ONE ONBOARDING, PLUS THE FORM.
 *
 * There used to be a third: when the AI provider was unreachable, Fadi silently swapped the
 * conversation for a scripted lookalike — different wording, a different progress bar, no
 * microphone, no explanation. The owner watched it change mid-sentence and asked why, which is
 * the correct reaction to software quietly becoming a smaller version of itself.
 *
 * Now the missing piece is named. Fadi needs a key to do any of its work, so hiding that at the
 * front door only moves the discovery to the first document that fails to generate.
 */
type Mode = "ai" | "no-provider" | "form";

export function OnboardingExperience() {
  const [mode, setMode] = useState<Mode>("ai");

  if (mode === "form") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3">
        <button
          type="button"
          onClick={() => setMode("ai")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to setup with Fadi
        </button>
        <Card className="glow-primary">
          <CardHeader>
            <CardTitle>Profile foundation</CardTitle>
            <CardDescription>Complete these steps to unlock your dashboard.</CardDescription>
          </CardHeader>
          <CardContent>
            <OnboardingForm />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (mode === "no-provider") {
    return (
      <div className="mx-auto w-full max-w-2xl">
        <Card className="glow-primary">
          <CardHeader>
            <CardTitle>Fadi needs an AI key first</CardTitle>
            <CardDescription>
              Setting up by conversation — and everything after it, from reading your CV to
              drafting a résumé — runs on your own AI provider. Nothing here works without one, so
              this says it now rather than at the first document that fails.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-3">
            <Link
              href="/dashboard/settings"
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <KeyRound className="size-4" aria-hidden="true" />
              Add a key in Settings
            </Link>
            <button
              type="button"
              onClick={() => setMode("form")}
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Or fill in the short form instead
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <FadiOnboardingAI
      onUseForm={() => setMode("form")}
      onProviderUnavailable={() => setMode("no-provider")}
    />
  );
}
