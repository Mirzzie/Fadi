"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArrowUpRight, BadgeCheck, ClipboardCheck, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { scoreApplicationDraft } from "@/app/dashboard/applications/actions";
// Type-only — the scorer module is server-only; importing its value helpers would
// drag server code into the client bundle. Tiny presentational helpers are inlined.
import type { ApplicationQualityResult } from "@/lib/intelligence/application-quality";

function scoreColor(score: number): string {
  if (score >= 88) return "text-emerald-300";
  if (score >= 75) return "text-green-300";
  if (score >= 58) return "text-amber-300";
  if (score >= 40) return "text-orange-300";
  return "text-rose-300";
}

function barColor(score: number): string {
  if (score >= 75) return "bg-emerald-400";
  if (score >= 58) return "bg-amber-400";
  if (score >= 40) return "bg-orange-400";
  return "bg-rose-400";
}

function sendLabel(r: ApplicationQualityResult["sendRecommendation"]): string {
  switch (r) {
    case "strong": return "Ready to send — strong application";
    case "ready": return "Ready to send";
    case "improve_first": return "Improve before sending";
    case "do_not_send": return "Not ready — significant gaps";
  }
}

const SEND_META: Record<ApplicationQualityResult["sendRecommendation"], string> = {
  strong: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
  ready: "text-green-300 border-green-500/40 bg-green-500/10",
  improve_first: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  do_not_send: "text-rose-300 border-rose-500/40 bg-rose-500/10",
};

const RISK_META: Record<"high" | "medium" | "low", string> = {
  high: "text-rose-300 border-rose-500/40 bg-rose-500/10",
  medium: "text-amber-300 border-amber-500/40 bg-amber-500/10",
  low: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
};

const PRIORITY_TONE: Record<"critical" | "high" | "medium", string> = {
  critical: "text-rose-400",
  high: "text-amber-400",
  medium: "text-primary",
};

const DIMENSIONS: Array<{ key: keyof ApplicationQualityResult["breakdown"]; label: string }> = [
  { key: "keywordMatch", label: "Keyword match" },
  { key: "formattingRisk", label: "Formatting / ATS" },
  { key: "experienceAlignment", label: "Experience fit" },
  { key: "specificity", label: "Specificity" },
  { key: "roleFit", label: "Role fit" },
];

export function ApplicationQualityPanel({
  jobId,
  jobTitle,
  jobCompany,
  jobDescription,
}: {
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  jobDescription?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ApplicationQualityResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasJd = Boolean(jobDescription && jobDescription.trim());

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await scoreApplicationDraft({
        jobId,
        jobTitle,
        company: jobCompany,
        jobDescription: jobDescription ?? "",
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setResult(res.result);
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ClipboardCheck className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Is it ready to send?</h2>
        </div>
        <Button size="sm" variant={result ? "outline" : "default"} onClick={run} disabled={pending || !hasJd}>
          {pending ? "Scoring…" : result ? "Re-score" : "Score my resume"}
        </Button>
      </div>

      {!hasJd ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Add the job description below and I&apos;ll score the resume you&apos;re about to send against
          this exact posting — keyword coverage, ATS risk, and the specific fixes that matter.
        </p>
      ) : !result && !error ? (
        <p className="mt-2 text-sm text-muted-foreground">
          An honest read on your tailored resume vs. this job — graded against real hiring data
          (11s recruiter scan, keyword coverage, AI-dismiss risk). Scores the resume drafted here, or
          your base resume if you haven&apos;t tailored one yet.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">{error}</p>
      ) : null}

      {result ? (
        <div className="mt-3 space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <span className={cn("text-2xl font-semibold tabular-nums", scoreColor(result.score))}>
              {result.score}
              <span className="text-sm text-muted-foreground">/100</span>
            </span>
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", SEND_META[result.sendRecommendation])}>
              {sendLabel(result.sendRecommendation)}
            </span>
            <span className="ml-auto flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn("rounded-full border px-2 py-0.5", RISK_META[result.atsRisk])}>ATS risk: {result.atsRisk}</span>
              <span className={cn("rounded-full border px-2 py-0.5", RISK_META[result.aiGeneratedRisk])}>AI-dismiss risk: {result.aiGeneratedRisk}</span>
            </span>
          </div>

          <p className="text-sm text-foreground/90">{result.summary}</p>

          {/* Dimension breakdown */}
          <div className="grid gap-1.5">
            {DIMENSIONS.map(({ key, label }) => {
              const dim = result.breakdown[key];
              return (
                <div key={key} className="grid grid-cols-[8.5rem_1fr_2.5rem] items-center gap-2">
                  <span className="truncate text-xs text-muted-foreground">{label}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <span className={cn("block h-full rounded-full", barColor(dim.score))} style={{ width: `${dim.score}%` }} />
                  </span>
                  <span className="text-right text-xs tabular-nums text-muted-foreground">{dim.score}</span>
                </div>
              );
            })}
          </div>

          {/* Keyword coverage — drawn from the real posting */}
          {result.breakdown.keywordMatch.missing.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">
                Missing keywords from the posting (add only where you genuinely match)
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.breakdown.keywordMatch.missing.map((k, i) => (
                  <span key={i} className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
          {result.breakdown.keywordMatch.matched.length > 0 ? (
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <BadgeCheck className="size-3.5 text-emerald-400" aria-hidden="true" /> Already covered
              </p>
              <div className="flex flex-wrap gap-1.5">
                {result.breakdown.keywordMatch.matched.map((k, i) => (
                  <span key={i} className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-200">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Formatting issues */}
          {result.breakdown.formattingRisk.issues.length > 0 ? (
            <div className="space-y-1">
              <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                <ShieldAlert className="size-3.5 text-amber-400" aria-hidden="true" /> Formatting risks
              </p>
              <ul className="space-y-1">
                {result.breakdown.formattingRisk.issues.map((it, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-400" aria-hidden="true" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {/* Top improvements — the concrete moves */}
          {result.topImprovements.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Highest-leverage fixes</p>
              <ul className="space-y-1.5">
                {result.topImprovements.map((imp, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
                    <ArrowUpRight className={cn("mt-0.5 size-3.5 shrink-0", PRIORITY_TONE[imp.priority])} aria-hidden="true" />
                    <span>
                      <span className="font-medium">{imp.action}</span>
                      <span className="text-muted-foreground"> — {imp.impact}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Recruiter read time: {result.estimatedRecruiterReadTime}.{" "}
            {result.sendRecommendation === "do_not_send" || result.sendRecommendation === "improve_first"
              ? "Close the gaps above before you send — a tighter match beats a fast send."
              : "Looks strong. Send it, then log the outcome below so Fadi can learn from the result."}
          </p>
        </div>
      ) : null}
    </div>
  );
}
