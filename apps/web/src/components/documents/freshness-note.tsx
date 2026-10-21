"use client";

import { useState, useTransition } from "react";
import { History, Loader2 } from "lucide-react";

import { markDocumentCurrentAction } from "@/app/dashboard/documents/freshness-actions";
import type { DocumentFreshness } from "@/lib/documents/freshness";

/**
 * The document says when it has fallen behind the person's record.
 *
 * Quiet by design: this is information, not an alarm. A document can be exactly what someone
 * wants while their record has moved on, so it names the difference and leaves the decision
 * alone — the one-click version of acting on it sits in "Change it" below, where the rewrite
 * guard and the truth gate already apply.
 *
 * What it does NOT claim matters as much. This compares career records only: a changed job
 * posting, direction or contact detail is not what it is looking at, and it says so rather than
 * implying the document has been checked in every respect.
 */
export function FreshnessNote({
  documentId,
  freshness,
}: {
  documentId: string;
  freshness: DocumentFreshness;
}) {
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (freshness.state !== "stale" || done) return null;
  const { changes } = freshness;

  return (
    <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5">
      <History className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm text-foreground">{freshness.note}</p>
        <p className="text-xs text-muted-foreground">
          {changes.added.length > 0
            ? `Ask for “${freshness.ask}” below to work it in, or leave this document as it is.`
            : "Ask Fadi below to bring it in line, or leave this document as it is."}{" "}
          This compares your career records — not the posting or your contact details.
        </p>
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const result = await markDocumentCurrentAction({ documentId });
            if (result.ok) setDone(true);
            else setError(result.message ?? "Couldn't update this document.");
          })
        }
        className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          // NOT "it's up to date": nothing has checked whether this document contains the change.
          // It records that they saw it and kept this version (Codex C15-06).
          "Keep this version"
        )}
      </button>
    </div>
  );
}
