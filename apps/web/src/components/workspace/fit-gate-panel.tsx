"use client";

import { useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Check, Gauge } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { evaluateJobFit } from "@/app/dashboard/applications/actions";
import type { FitEvaluation, FitVerdict } from "@/lib/jobs/fit";

const VERDICT_META: Record<FitVerdict, { label: string; cls: string; bar: string }> = {
  apply: { label: "Worth applying", cls: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10", bar: "bg-emerald-400" },
  stretch: { label: "A stretch", cls: "text-amber-300 border-amber-500/40 bg-amber-500/10", bar: "bg-amber-400" },
  skip: { label: "Probably skip", cls: "text-rose-300 border-rose-500/40 bg-rose-500/10", bar: "bg-rose-400" },
};

export function FitGatePanel({
  jobTitle,
  jobCompany,
  jobDescription,
}: {
  jobTitle: string;
  jobCompany: string;
  jobDescription?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [evaluation, setEvaluation] = useState<FitEvaluation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasJd = Boolean(jobDescription && jobDescription.trim());

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await evaluateJobFit({
        jobTitle,
        company: jobCompany,
        jobDescription: jobDescription ?? "",
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setEvaluation(res.evaluation);
    });
  }

  const meta = evaluation ? VERDICT_META[evaluation.verdict] : null;

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Gauge className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Should you apply?</h2>
        </div>
        <Button size="sm" variant={evaluation ? "outline" : "default"} onClick={run} disabled={pending || !hasJd}>
          {pending ? "Checking…" : evaluation ? "Re-check" : "Run fit check"}
        </Button>
      </div>

      {!hasJd ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Add the job description below and I&apos;ll tell you honestly whether it&apos;s worth your
          time — before you spend it. Applying to fewer, closer-fit roles beats spraying.
        </p>
      ) : !evaluation && !error ? (
        <p className="mt-2 text-sm text-muted-foreground">
          A 10-second honest read on whether this role is worth your time — graded against your real
          experience, not hype. Focus is the strategy.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">{error}</p>
      ) : null}

      {evaluation && meta ? (
        <div className="mt-3 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums">{evaluation.overall.toFixed(1)}<span className="text-sm text-muted-foreground">/5</span></span>
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", meta.cls)}>
              {meta.label}
            </span>
          </div>
          <p className="text-sm text-foreground/90">{evaluation.verdictReason}</p>

          {/* Dimension breakdown */}
          <div className="grid gap-1.5">
            {evaluation.dimensions.map((d) => (
              <div key={d.id} className="grid grid-cols-[8.5rem_1fr_2rem] items-center gap-2" title={d.note}>
                <span className="truncate text-xs text-muted-foreground">{d.label}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <span
                    className={cn("block h-full rounded-full", meta.bar)}
                    style={{ width: `${(d.score / 5) * 100}%` }}
                  />
                </span>
                <span className="text-right text-xs tabular-nums text-muted-foreground">{d.score.toFixed(1)}</span>
              </div>
            ))}
          </div>

          {evaluation.topReasons.length > 0 ? (
            <List icon={Check} tone="text-emerald-400" title="Why" items={evaluation.topReasons} />
          ) : null}
          {evaluation.gapsToClose.length > 0 ? (
            <List icon={ArrowRight} tone="text-primary" title="To close the gap" items={evaluation.gapsToClose} />
          ) : null}
          {evaluation.redFlags.length > 0 ? (
            <List icon={AlertTriangle} tone="text-amber-400" title="Red flags" items={evaluation.redFlags} />
          ) : null}

          <p className="text-xs text-muted-foreground">
            {evaluation.verdict === "skip"
              ? "Not a fit? That's a win — you just saved the time. Put it toward a closer role, or ask for a referral on the Network page."
              : "Going for it? Tailor the documents below, then run the quality scorer before you send."}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function List({
  icon: Icon,
  tone,
  title,
  items,
}: {
  icon: typeof Check;
  tone: string;
  title: string;
  items: string[];
}) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <ul className="space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-foreground/90">
            <Icon className={cn("mt-0.5 size-3.5 shrink-0", tone)} aria-hidden="true" />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
