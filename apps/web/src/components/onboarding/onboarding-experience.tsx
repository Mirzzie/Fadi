"use client";

import { ArrowLeft } from "lucide-react";
import { useState } from "react";

import { KaiOnboarding } from "@/components/onboarding/kai-onboarding";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Onboarding entry point: Kai-led conversation by default (the OS welcome), with
 * a one-click escape hatch to the classic form so nobody is ever stuck.
 */
export function OnboardingExperience() {
  const [mode, setMode] = useState<"kai" | "form">("kai");

  if (mode === "form") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3">
        <button
          type="button"
          onClick={() => setMode("kai")}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" aria-hidden="true" />
          Back to setup with Kai
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

  return <KaiOnboarding onUseForm={() => setMode("form")} />;
}
