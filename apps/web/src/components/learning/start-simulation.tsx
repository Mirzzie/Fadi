"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { startPracticeActivityAction } from "@/app/dashboard/learning/practice-actions";
import { Button } from "@/components/ui/button";

/** Start (or continue) a work simulation, then go to its workspace. */
export function StartSimulation({ packId, activityId }: { packId: string; activityId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
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
      {message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
