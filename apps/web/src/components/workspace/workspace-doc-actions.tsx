"use client";

import { ExternalLink, FileText, Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { generateJobDocumentAction } from "@/app/dashboard/applications/[jobId]/workspace/actions";
import type { DocKind } from "@/lib/jobs/application-types";

type DocView = { id: string; kind: string; title: string };

const ACTIONS: { kind: DocKind; label: string }[] = [
  { kind: "resume", label: "Build a resume" },
  { kind: "cover_letter", label: "Cover letter" },
  { kind: "email", label: "Cold email" },
  { kind: "value_proposition", label: "Value-prop doc" },
];

/** Real, saved, JD-tailored document generation for this specific job. */
export function WorkspaceDocActions({ jobId, documents }: { jobId: string; documents: DocView[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function draft(kind: DocKind) {
    setError(null);
    setBusy(kind);
    start(async () => {
      const res = await generateJobDocumentAction(jobId, kind);
      setBusy(null);
      if (res.ok && res.id) router.push(`/dashboard/documents/${res.id}`);
      else setError(res.message);
    });
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card p-4">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Sparkles className="size-3.5 text-primary" aria-hidden="true" />
        Have Fadi draft — tailored to this job&apos;s description, saved to Documents
      </p>
      <div className="grid grid-cols-2 gap-2">
        {ACTIONS.map((a) => (
          <Button key={a.kind} variant="outline" size="sm" disabled={pending} onClick={() => draft(a.kind)}>
            {busy === a.kind ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Sparkles className="size-4" aria-hidden="true" />
            )}
            {a.label}
          </Button>
        ))}
      </div>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}

      {documents.length > 0 ? (
        <div className="mt-3 space-y-1.5">
          {documents.map((d) => (
            <a
              key={d.id}
              href={`/dashboard/documents/${d.id}`}
              className="flex items-center justify-between rounded-md border border-border/60 bg-background/40 px-3 py-2 text-sm hover:border-primary/40"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="truncate">{d.title}</span>
              </span>
              <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}
