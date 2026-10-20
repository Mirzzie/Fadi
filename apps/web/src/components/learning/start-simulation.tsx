"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startPracticeActivityAction } from "@/app/dashboard/learning/practice-actions";
import { GraderCheck } from "@/components/learning/grader-check";
import { Button } from "@/components/ui/button";
import type { GraderStatus } from "@/lib/practice/grader-check";

/**
 * Start (or continue) a work simulation, then go to its workspace. One action per state: while
 * the person's model hasn't passed the marking check, that check IS the action (it replaces
 * Start until it passes); then Start this simulation.
 */
export function StartSimulation({
  packId,
  activityId,
  grader,
}: {
  packId: string;
  activityId: string;
  /** Null when no step is model-reviewed. */
  grader: GraderStatus | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(grader);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (status && status.state !== "fit") {
    return <GraderCheck status={status} onFit={setStatus} />;
  }
  return (
    <div>
      <Button
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMessage(null);
            const result = await startPracticeActivityAction({ packId, activityId });
            if (!result.ok) return setMessage(result.message);
            router.push(`/dashboard/learning/projects/${result.runId}`);
          })
        }
      >
        {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
        Start this simulation
      </Button>
      {status?.state === "fit" ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Reviews by {status.model}, which passed Fadi&apos;s marking check.
        </p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
