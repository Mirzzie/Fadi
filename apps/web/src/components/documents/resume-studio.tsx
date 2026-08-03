"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createResumePdfBlob } from "@reactive-resume/pdf/browser";
import { sampleResumeData } from "@reactive-resume/schema/resume/sample";
import { templateSchema, type Template } from "@reactive-resume/schema/templates";

// Phase 2 (ADR 0010): a live preview of the Reactive Resume template engine inside Fadi.
// Renders entirely CLIENT-side (createResumePdfBlob → object URL → iframe), which sidesteps
// the App Router `react-server` limit on @react-pdf. This is additive — a new tab alongside
// the existing document editor, nothing replaced. For now it previews the sample document;
// the next slice wires the interactive editor + your real résumé (mapped from history).

const TEMPLATES = templateSchema.options as readonly Template[];

export function ResumeStudio() {
  const [template, setTemplate] = useState<Template>(sampleResumeData.metadata.template ?? "azurill");
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setBusy(true);
    setError(null);
    createResumePdfBlob({ data: sampleResumeData, template })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not render this template.");
      })
      .finally(() => {
        if (!cancelled) setBusy(false);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [template]);

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-3">
        <div>
          <h3 className="text-sm font-semibold">Templates</h3>
          <p className="text-xs text-muted-foreground">
            Reactive Resume templates, rendered live. Preview uses sample data for now.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {TEMPLATES.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={t === template ? "default" : "outline"}
              onClick={() => setTemplate(t)}
              className="justify-start capitalize"
            >
              {t}
            </Button>
          ))}
        </div>
      </aside>

      <div className="relative min-h-[80vh] overflow-hidden rounded-xl border bg-muted/30">
        {busy ? (
          <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 bg-background/60 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Rendering{" "}
            <span className="capitalize">{template}</span>…
          </div>
        ) : null}
        {error ? (
          <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-destructive">
            {error}
          </div>
        ) : null}
        {url ? (
          <iframe title="Résumé preview" src={url} className="h-full min-h-[80vh] w-full" />
        ) : null}
      </div>
    </div>
  );
}
