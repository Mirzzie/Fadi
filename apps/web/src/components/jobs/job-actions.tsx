"use client";

import { Bookmark, BookmarkCheck, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";

import {
  saveJobAction,
  type JobActionResult,
  unsaveJobAction,
  updateApplicationStatusAction,
} from "@/app/dashboard/jobs/actions";
import { Button } from "@/components/ui/button";
import type { ApplicationStatus } from "@/lib/jobs/types";

const applicationStatuses: Array<{ value: ApplicationStatus; label: string }> = [
  { value: "interested", label: "Interested" },
  { value: "applied", label: "Applied" },
  { value: "interviewing", label: "Interviewing" },
  { value: "offer", label: "Offer" },
  { value: "rejected", label: "Rejected" },
  { value: "withdrawn", label: "Withdrawn" },
];

type JobActionsProps = {
  jobId: string;
  isSaved: boolean;
  applicationStatus: ApplicationStatus | null;
};

export function JobActions({ jobId, isSaved, applicationStatus }: JobActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<JobActionResult | null>(null);

  function runAction(action: () => Promise<JobActionResult>) {
    setResult(null);
    startTransition(async () => {
      setResult(await action());
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          type="button"
          variant={isSaved ? "secondary" : "default"}
          disabled={isPending}
          onClick={() => runAction(() => (isSaved ? unsaveJobAction(jobId) : saveJobAction(jobId)))}
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : isSaved ? (
            <BookmarkCheck className="size-4" aria-hidden="true" />
          ) : (
            <Bookmark className="size-4" aria-hidden="true" />
          )}
          {isSaved ? "Saved" : "Save job"}
        </Button>
        <select
          value={applicationStatus ?? ""}
          disabled={isPending}
          className="h-10 rounded-md border bg-background px-3 text-sm"
          aria-label="Application status"
          onChange={(event) => {
            if (event.target.value) {
              runAction(() => updateApplicationStatusAction(jobId, event.target.value));
            }
          }}
        >
          <option value="">Set status</option>
          {applicationStatuses.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>
      {result?.message ? (
        <p
          className={result.ok ? "text-sm text-primary" : "text-sm text-destructive"}
          role="status"
        >
          {result.message}
        </p>
      ) : null}
    </div>
  );
}
