"use client";

import { ArrowRight, Bookmark, BookmarkCheck, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import {
  saveJobAction,
  type JobActionResult,
  unsaveJobAction,
} from "@/app/dashboard/jobs/actions";
import { Button, buttonVariants } from "@/components/ui/button";
import type { ApplicationStatus } from "@/lib/jobs/types";

type JobActionsProps = {
  jobId: string;
  isSaved: boolean;
  applicationStatus: ApplicationStatus | null;
  /** The original posting URL on the source/company site, so the user can apply directly. */
  url?: string | null;
};

export function JobActions({ jobId, isSaved, applicationStatus, url }: JobActionsProps) {
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
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={`/dashboard/applications/${jobId}/workspace`}
          className={buttonVariants({ variant: "default", size: "sm" })}
        >
          {workspaceAction(applicationStatus)}
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
        <Button
          type="button"
          size="sm"
          variant="outline"
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
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className={buttonVariants({ variant: "ghost", size: "sm" })}
            title="Open the original posting on the source site to apply directly"
          >
            <ExternalLink className="size-4" aria-hidden="true" />
            View original
          </a>
        ) : null}
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

export function workspaceAction(status: ApplicationStatus | null): string {
  switch (status) {
    case "applied":
    case "interviewing":
      return "Prepare for interview";
    case "offer":
    case "rejected":
    case "withdrawn":
      return "Review outcome";
    case "interested":
      return "Continue application";
    default:
      return "Review role";
  }
}
