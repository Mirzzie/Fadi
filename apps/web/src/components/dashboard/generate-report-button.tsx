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

  function generateReport() {
    setResult(null);

    startTransition(async () => {
      const actionResult = await generateCareerReportAction();
      setResult(actionResult);

      if (actionResult.ok) {
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      <Button type="button" onClick={generateReport} disabled={isPending}>
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
