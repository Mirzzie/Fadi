"use client";

import { useState, useTransition } from "react";
import { ArrowRight, CheckCircle2, Heart, Search, Send, Target, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  logApplicationRejection,
  markApplicationApplied,
  submitRejectionAutopsy,
  type RejectionStage,
} from "@/app/dashboard/applications/actions";
import type { RejectionInsight } from "@/lib/resilience/autopsy";

type AutopsyPrompt = { key: string; question: string };

type Application = {
  id: string;
  hasApplied: boolean;
  outcome: string | null;
};

type Props = {
  jobId: string;
  jobCompany: string;
  jobTitle: string;
  application: Application | null;
  autopsyPrompts: AutopsyPrompt[];
};

type Phase = "not_sent" | "applied" | "autopsy" | "done";

const STAGE_OPTIONS: { value: RejectionStage; label: string }[] = [
  { value: "keyword", label: "No response" },
  { value: "screen", label: "Early screen" },
  { value: "interview", label: "After interview" },
  { value: "final", label: "Final round" },
];

function initialPhase(application: Application | null): Phase {
  if (!application?.hasApplied) return "not_sent";
  if (application.outcome === "rejected") return "autopsy";
  return "applied";
}

export function ApplicationOutcomePanel({
  jobId,
  jobCompany,
  jobTitle,
  application,
  autopsyPrompts,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [applicationId, setApplicationId] = useState<string | null>(application?.id ?? null);
  const [phase, setPhase] = useState<Phase>(initialPhase(application));
  const [stage, setStage] = useState<RejectionStage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectionMessage, setRejectionMessage] = useState<string | null>(null);
  const [nudge, setNudge] = useState<string | null>(null);
  const [reflection, setReflection] = useState<Record<string, string>>({});
  const [reward, setReward] = useState<{
    message: string;
    momentum: number;
    delta: number;
    insight: RejectionInsight;
  } | null>(null);

  // The "stage" prompt is captured up front with the chips below, so the autopsy
  // form only needs the reflective questions.
  const reflectivePrompts = autopsyPrompts.filter((p) => p.key !== "stage");

  function handleMarkApplied() {
    setError(null);
    startTransition(async () => {
      const res = await markApplicationApplied({ jobId, company: jobCompany, title: jobTitle });
      if (!res.ok || !res.applicationId) {
        setError(res.message);
        return;
      }
      setApplicationId(res.applicationId);
      setPhase("applied");
    });
  }

  function handleLogRejection() {
    if (!applicationId) return;
    setError(null);
    startTransition(async () => {
      const res = await logApplicationRejection({ jobId, applicationId, stage });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setRejectionMessage(res.motion.message);
      setNudge(res.anomalyNudge);
      setPhase("autopsy");
    });
  }

  function handleSubmitAutopsy() {
    if (!applicationId) return;
    setError(null);
    startTransition(async () => {
      const res = await submitRejectionAutopsy({
        jobId,
        applicationId,
        reflection: { stage: stage ?? undefined, ...reflection },
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setReward({
        message: res.message,
        momentum: res.momentum,
        delta: res.delta,
        insight: res.insight,
      });
      setPhase("done");
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">Application outcome</h2>
          <StatusBadge phase={phase} />
        </div>
      </div>

      {error ? (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 p-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {phase === "not_sent" ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Once you&apos;ve actually sent this application, mark it here. Logging a rejection only
            helps me find patterns when there&apos;s a real application behind it.
          </p>
          <Button size="sm" onClick={handleMarkApplied} disabled={pending}>
            <Send className="size-4" aria-hidden="true" />
            Mark as applied
          </Button>
        </div>
      ) : null}

      {phase === "applied" ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            Heard back with a no? Logging it isn&apos;t failure — it&apos;s data, and facing it is
            forward motion. How far did it get?
          </p>
          <div className="flex flex-wrap gap-2">
            {STAGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setStage(opt.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs transition-colors",
                  stage === opt.value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={handleLogRejection} disabled={pending}>
            <XCircle className="size-4" aria-hidden="true" />
            Log rejection
          </Button>
        </div>
      ) : null}

      {phase === "autopsy" ? (
        <div className="mt-3 space-y-4">
          {rejectionMessage ? (
            <p className="rounded-md border bg-muted/40 p-2 text-sm text-muted-foreground">
              {rejectionMessage}
            </p>
          ) : null}
          {nudge ? (
            <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">
              {nudge}
            </p>
          ) : null}
          <p className="text-sm text-muted-foreground">
            A two-minute autopsy is where the real value is — it turns a &ldquo;no&rdquo; into your
            next move. Skip any you want.
          </p>
          {reflectivePrompts.map((prompt) => (
            <div key={prompt.key} className="space-y-1.5">
              <label className="text-xs text-muted-foreground" htmlFor={`autopsy-${prompt.key}`}>
                {prompt.question}
              </label>
              <Textarea
                id={`autopsy-${prompt.key}`}
                rows={2}
                value={reflection[prompt.key] ?? ""}
                onChange={(e) =>
                  setReflection((prev) => ({ ...prev, [prompt.key]: e.target.value }))
                }
              />
            </div>
          ))}
          <Button size="sm" onClick={handleSubmitAutopsy} disabled={pending}>
            <Heart className="size-4" aria-hidden="true" />
            Complete autopsy
          </Button>
        </div>
      ) : null}

      {phase === "done" && reward ? (
        <div className="mt-3 space-y-4">
          <p className="flex items-start gap-2 text-sm">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{reward.message}</span>
          </p>

          {/* The "no" turned into information: a named pattern + a sharper next move. */}
          {reward.insight.pattern ? (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Search className="size-4 text-primary" aria-hidden="true" />
                {reward.insight.pattern.name}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{reward.insight.pattern.evidence}</p>
            </div>
          ) : null}

          {reward.insight.sharperNextApplication.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Target className="size-4 text-primary" aria-hidden="true" />
                Your sharper next application
              </div>
              <ul className="space-y-1.5">
                {reward.insight.sharperNextApplication.map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0 text-primary" aria-hidden="true" />
                    <span>{step}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {reward.insight.reframe ? (
            <p className="border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">
              {reward.insight.reframe}
            </p>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Momentum +{reward.delta} → {Math.round(reward.momentum)}/100. That counted because you
            faced it and learned from it — the part you control.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function StatusBadge({ phase }: { phase: Phase }) {
  if (phase === "not_sent") return <Badge variant="secondary">Not sent</Badge>;
  if (phase === "applied") return <Badge variant="secondary">Applied</Badge>;
  if (phase === "autopsy") return <Badge variant="secondary">Rejection logged</Badge>;
  return <Badge variant="secondary">Autopsy complete</Badge>;
}
