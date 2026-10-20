"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { checkGraderAction } from "@/app/dashboard/learning/practice-actions";
import { Button } from "@/components/ui/button";
import type { GraderStatus } from "@/lib/practice/grader-check";

/**
 * WHETHER FADI MAY REVIEW WRITING WITH THIS PERSON'S MODEL — said plainly, with one action.
 *
 * Unchecked: Check my AI model (it spends their allowance, so it runs only when they ask).
 * Unfit: why, in plain words, and Open AI settings — never "not yet"s the model can't justify.
 * Switching model makes the new one "unchecked"; the same model isn't re-rolled.
 * Fit: nothing to do here; `onFit` hands the moment back to the caller's own action.
 */
export function GraderCheck({
  activity,
  status,
  onFit,
}: {
  /** The activity whose marking this check is about. */
  activity: { packId: string; activityId: string };
  status: Exclude<GraderStatus, { state: "fit" }>;
  onFit: (status: Extract<GraderStatus, { state: "fit" }>) => void;
}) {
  const [current, setCurrent] = useState<GraderStatus>(status);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, start] = useTransition();
  const check = () =>
    start(async () => {
      setMessage(null);
      const result = await checkGraderAction(activity);
      if (!result.ok) return setMessage(result.message);
      if (result.status.state === "fit") return onFit(result.status);
      setCurrent(result.status);
    });

  if (current.state === "fit") return null;
  if (current.state === "no_model") {
    return (
      <div className="space-y-2 text-sm">
        <p className="text-muted-foreground">
          Fadi reviews your writing with your own AI model, and you haven&apos;t added one yet.
        </p>
        <Button render={<Link href="/dashboard/settings" />}>Add an AI model</Button>
      </div>
    );
  }
  return (
    <div className="space-y-2 text-sm">
      {current.state === "unchecked" ? (
        <p className="text-muted-foreground">
          Fadi reviews your writing with your own AI model, so first it checks that{" "}
          <span className="text-foreground">{current.model}</span> marks fairly: up to{" "}
          {current.requests} short test reviews of answers whose fair result is known, including
          ones that try to trick the marker. It takes a few minutes and uses your AI allowance.
        </p>
      ) : (
        <p className="text-muted-foreground">
          <span className="text-foreground">{current.model}</span> didn&apos;t pass Fadi&apos;s
          marking check: {current.reason} Fadi won&apos;t review your work with it. Choose a
          stronger model in Settings, then check it.
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {current.state === "unchecked" ? (
          <Button onClick={check} disabled={checking}>
            {checking ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
            {checking ? "Checking your model — a few minutes…" : "Check my AI model"}
          </Button>
        ) : (
          // No "Check again" on the same model: re-rolling an inconsistent marker until one check
          // passes is exactly what the three runs are there to stop. A new model is unchecked.
          <Button render={<Link href="/dashboard/settings" />}>Open AI settings</Button>
        )}
      </div>
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
