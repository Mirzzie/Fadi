"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ExternalLink, Gauge, Loader2, MapPin } from "lucide-react";

import { reviewOpenDocumentAction } from "@/app/dashboard/documents/tailoring-actions";
import { Button } from "@/components/ui/button";
import type { CvReview } from "@/lib/documents/cv-review";

/**
 * WHAT THIS DOCUMENT IS FOR, AND HOW IT READS AGAINST IT.
 *
 * A résumé written for one posting used to open as an anonymous text box: nothing named the job,
 * nothing said what that country expects of a CV, and the recruiter-style score Fadi can already
 * produce was never offered here. Three facts, at the top, before the editing starts.
 */
export function TailoringPanel({
  documentId,
  job,
  standard,
}: {
  documentId: string;
  job: { id: string; title: string; company: string; location: string | null } | null;
  /** The written norms for where this job is — document term, length, photo, date format. */
  standard: { label: string; documentTerm: string; lengthPages: string; photo: string; dateFormat: string; notes: string };
}) {
  const [review, setReview] = useState<CvReview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const score = () =>
    start(async () => {
      setMessage(null);
      const result = await reviewOpenDocumentAction({ documentId });
      if (!result.ok) return setMessage(result.message);
      setReview(result.review);
    });

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          {job ? (
            <p className="text-sm">
              Written for <span className="font-semibold">{job.title}</span> at{" "}
              <span className="font-semibold">{job.company}</span>
              {job.location ? <span className="text-muted-foreground"> · {job.location}</span> : null}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Not linked to a job — open one from Applications to tailor and score it.
            </p>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden="true" />
            <span>
              {standard.label}: called a <span className="font-medium">{standard.documentTerm}</span>,{" "}
              {standard.lengthPages} pages, photo {standard.photo}, dates {standard.dateFormat}
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2">
          {job ? (
            <Button
              size="sm"
              variant="outline"
              nativeButton={false}
              render={<Link href={`/dashboard/applications/${job.id}/workspace`} />}
            >
              <ExternalLink className="size-3.5" aria-hidden="true" /> The application
            </Button>
          ) : null}
          {job ? (
            <Button size="sm" onClick={score} disabled={pending}>
              {pending ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Gauge className="size-3.5" aria-hidden="true" />}
              {pending ? "Reading it…" : review ? "Score again" : "Score against this posting"}
            </Button>
          ) : null}
        </div>
      </div>

      <p className="mt-2 text-[11px] text-muted-foreground">{standard.notes}</p>

      {message ? <p className="mt-3 text-xs text-warning">{message}</p> : null}

      {review ? (
        <div className="mt-4 space-y-3 border-t border-border/60 pt-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-2xl font-semibold tabular-nums">{review.atsScore}</span>
            <span className="text-xs text-muted-foreground">
              keyword match against this posting, for the{" "}
              <span className="font-medium">saved</span> version. An estimate from the posting&apos;s
              own words — not a score any employer gives.
            </span>
          </div>

          <p className="text-sm">{review.sixSecondImpression}</p>

          {review.missingKeywords.length > 0 ? (
            <div>
              <p className="text-xs font-medium">From the posting, missing here</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {review.missingKeywords.slice(0, 12).map((word) => (
                  <span key={word} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                    {word}
                  </span>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Add only the ones you have actually done. A keyword you cannot back up fails at the
                interview, not at the filter.
              </p>
            </div>
          ) : null}

          {review.topCriticalFixes.length > 0 ? (
            <div>
              <p className="text-xs font-medium">Fix first</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-muted-foreground">
                {review.topCriticalFixes.slice(0, 4).map((fix) => (
                  <li key={fix}>{fix}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
