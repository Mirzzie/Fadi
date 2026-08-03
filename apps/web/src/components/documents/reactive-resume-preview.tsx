"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { createResumePdfBlob } from "@reactive-resume/pdf/browser";
import { templateSchema, type Template } from "@reactive-resume/schema/templates";

import { fadiToReactiveResume } from "@/lib/documents/rr-bridge";
import type { ResumeData } from "@/lib/documents/resume";

// Live preview of the user's REAL résumé rendered through a Reactive Resume template
// (ADR 0010, Phase 3). Fadi's data → (bridge) → rxresume data → client-side PDF → iframe.
// Debounced, since a PDF render is heavy. Used inside the existing résumé editor when an
// rxresume template is chosen — nothing invented, just a different rendering shape.

export const REACTIVE_TEMPLATES = templateSchema.options as readonly Template[];

/** True when a template id belongs to the Reactive Resume set (vs. Fadi's own). */
export function isReactiveTemplate(t: string): t is Template {
  return (REACTIVE_TEMPLATES as readonly string[]).includes(t);
}

export function ReactiveResumePreview({ data, template }: { data: ResumeData; template: Template }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setBusy(true);
    const handle = setTimeout(() => {
      try {
        const rr = fadiToReactiveResume(data);
        createResumePdfBlob({ data: rr, template })
          .then((blob) => {
            if (cancelled) return;
            objectUrl = URL.createObjectURL(blob);
            setUrl(objectUrl);
            setError(null);
          })
          .catch((e: unknown) => {
            if (!cancelled) setError(e instanceof Error ? e.message : "Could not render this template.");
          })
          .finally(() => {
            if (!cancelled) setBusy(false);
          });
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not map this résumé.");
          setBusy(false);
        }
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data, template]);

  return (
    <div className="relative min-h-0 overflow-hidden rounded-xl border border-border/60 bg-muted/30 shadow-sm">
      {busy ? (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2 rounded-full bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm">
          <Loader2 className="size-3 animate-spin" aria-hidden="true" /> rendering…
        </div>
      ) : null}
      {error ? (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : null}
      {url ? <iframe title="Résumé preview" src={url} className="h-full min-h-[60vh] w-full" /> : null}
    </div>
  );
}

/** Map + render the résumé to a PDF and trigger a browser download. */
export async function downloadReactiveResumePdf(data: ResumeData, template: Template, filename: string) {
  const blob = await createResumePdfBlob({ data: fadiToReactiveResume(data), template });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(filename || "resume").trim() || "resume"}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
