"use client";

import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { FadiOnboarding } from "@/components/onboarding/fadi-onboarding";
import { FadiOnboardingAI } from "@/components/onboarding/fadi-onboarding-ai";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Onboarding entry point. Default = Fadi as a REAL AI conversation. If the user
 * has no working AI provider, it auto-drops to the scripted Fadi welcome (still a
 * conversation, no AI needed). A one-click "Prefer a form?" escape hatch to the
 * classic form is always available, so nobody is ever stuck.
 */
type Mode = "ai" | "scripted" | "form";

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

  if (mode === "scripted") {
    return <FadiOnboarding onUseForm={() => setMode("form")} />;
  }

  return (
    <FadiOnboardingAI
      onUseForm={() => setMode("form")}
      onProviderUnavailable={() => setMode("scripted")}
    />
  );
}
