"use client";

import { ExternalLink, FileText, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { generateJobDocumentAction } from "@/app/dashboard/applications/[jobId]/workspace/actions";
import { Button } from "@/components/ui/button";
import type { DocKind } from "@/lib/jobs/application-types";

type DocView = { id: string; kind: string; title: string };

const SECONDARY_ACTIONS: { kind: DocKind; label: string }[] = [
  { kind: "cover_letter", label: "Cover letter" },
  { kind: "email", label: "Cold email" },
];

export function WorkspaceDocActions({
  jobId,
  documents,
  canDraft = true,
}: {
  jobId: string;
  documents: DocView[];
  canDraft?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function draft(kind: DocKind) {
    setError(null);
    setBusy(kind);
    start(async () => {
      const result = await generateJobDocumentAction(jobId, kind);
      setBusy(null);
      if (result.ok && result.id) router.push(`/dashboard/documents/${result.id}`);
      else setError(result.message);
    });
  }

  if (!canDraft && documents.length === 0) return null;

  return (
    <section className="rounded-xl border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold">Application documents</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Drafts use this posting and your selected career evidence.
          </p>
        </div>
        {canDraft ? (
          <Button size="sm" disabled={pending} onClick={() => draft("resume")}>
            {busy === "resume" ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            Draft resume
          </Button>
        ) : null}
      </div>

      {canDraft ? (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-muted-foreground">Other documents</summary>
          <div className="mt-2 flex flex-wrap gap-2">
            {SECONDARY_ACTIONS.map((action) => (
              <Button
                key={action.kind}
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => draft(action.kind)}
              >
                {busy === action.kind ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                {action.label}
              </Button>
            ))}
          </div>
        </details>
      ) : null}

      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {documents.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {documents.map((document) => (
            <a
              key={document.id}
              href={`/dashboard/documents/${document.id}`}
              className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm hover:border-primary/40"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{document.title}</span>
              </span>
              <ExternalLink
                className="size-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </a>
          ))}
        </div>
      ) : null}
    </section>
  );
}
