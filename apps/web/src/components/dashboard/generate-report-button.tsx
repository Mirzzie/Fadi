"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  generateCareerReportAction,
  type GenerateCareerReportResult,
} from "@/app/dashboard/actions";
import { Button } from "@/components/ui/button";

export function GenerateReportButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<GenerateCareerReportResult | null>(null);
  const [aiPrivacyConsentAccepted, setAiPrivacyConsentAccepted] = useState(false);

  function generateReport() {
    setResult(null);

    startTransition(async () => {
      const actionResult = await generateCareerReportAction({
        aiPrivacyConsentAccepted,
      });
      setResult(actionResult);

      if (actionResult.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <label className="flex gap-3 rounded-md border bg-muted/30 p-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={aiPrivacyConsentAccepted}
          onChange={(event) => setAiPrivacyConsentAccepted(event.target.checked)}
          className="mt-1"
        />
        <span>
          I understand Fadi will send my onboarding profile, resume text, LinkedIn context, and
          career goals to the AI provider to generate this report. I will review recommendations
          before acting on them.
        </span>
      </label>
      <Button
        type="button"
        onClick={generateReport}
        disabled={isPending || !aiPrivacyConsentAccepted}
      >
        {isPending ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <Sparkles className="size-4" aria-hidden="true" />
        )}
        {isPending ? "Generating..." : "Generate Career Intelligence Report"}
      </Button>
      {result?.message ? (
        <div
          className={
            result.ok
              ? "rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary"
              : "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          }
          role="status"
        >
          {result.message}
        </div>
      ) : null}
    </div>
  );
}
