"use client";

import { AlertTriangle, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

import { checkJobLivenessAction } from "@/app/dashboard/applications/[jobId]/workspace/actions";
import type { LivenessState } from "@/lib/jobs/liveness";

/**
 * Honest freshness guard for the application workspace. Probes whether the
 * posting is still open and — ONLY when there's strong evidence it's closed —
 * surfaces a calm, non-blocking heads-up so the user doesn't sink time into a
 * dead role. We never block and never warn on uncertainty (locus of control:
 * inform, don't alarm).
 */
export function JobLivenessBanner({ jobId, jobUrl }: { jobId: string; jobUrl?: string | null }) {
  const [state, setState] = useState<LivenessState>("live");
  const [reason, setReason] = useState<string>();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let active = true;
    checkJobLivenessAction(jobId)
      .then((res) => {
        if (!active) return;
        setState(res.state);
        setReason(res.reason);
      })
      .catch(() => {
        /* best-effort — stay silent on failure */
      });
    return () => {
      active = false;
    };
  }, [jobId]);

  if (state !== "closed" || dismissed) return null;

  return (
    <div
      role="status"
      className="flex items-start gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning "
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning " aria-hidden="true" />
      <div className="flex-1 space-y-1">
        <p className="font-medium">This posting may no longer be accepting applications.</p>
        <p className="text-warning/90 dark:text-warning/80">
          {reason ? `${reason}. ` : ""}Worth confirming on the source before you invest more time —
          your effort is better spent on a role that&apos;s still open.
        </p>
        {jobUrl ? (
          <a
            href={jobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:no-underline"
          >
            Open the posting <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="shrink-0 text-xs text-warning/70 hover:text-warning  dark:hover:text-warning"
      >
        Dismiss
      </button>
    </div>
  );
}
