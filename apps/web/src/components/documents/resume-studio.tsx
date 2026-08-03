"use client";

import { useEffect, useState } from "react";
import { Loader2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createResumePdfBlob } from "@reactive-resume/pdf/browser";
import { templateSchema, type Template } from "@reactive-resume/schema/templates";

import { useResumeStore } from "./resume-store";
import { EducationEditor, ExperienceEditor, SkillsEditor } from "./section-editors";

// Phase 2b (ADR 0010): the interactive editing loop. Edit the résumé on the left → the store
// updates → the Reactive Resume engine re-renders the preview on the right (debounced,
// because a PDF render is heavy). Additive — a new tab beside Fadi's existing editor.
// This slice edits the "basics"; more sections + drag-reorder + rich text come next, and
// Phase 3 swaps the sample for the user's real résumé mapped from verified history.

const TEMPLATES = templateSchema.options as readonly Template[];

export function ResumeStudio() {
  const data = useResumeStore((s) => s.data);
  const setBasics = useResumeStore((s) => s.setBasics);
  const setSummary = useResumeStore((s) => s.setSummary);
  const setTemplate = useResumeStore((s) => s.setTemplate);
  const reset = useResumeStore((s) => s.reset);

  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debounced live render: collapse rapid keystrokes into one PDF render.
  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    setBusy(true);
    const handle = setTimeout(() => {
      createResumePdfBlob({ data })
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setUrl(objectUrl);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Could not render this résumé.");
        })
        .finally(() => {
          if (!cancelled) setBusy(false);
        });
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(handle);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [data]);

  const b = data.basics;

  return (
    <div className="grid gap-4 lg:grid-cols-[340px_1fr]">
      <aside className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="tpl">Template</Label>
          <select
            id="tpl"
            value={data.metadata.template}
            onChange={(e) => setTemplate(e.target.value as Template)}
            className="w-full rounded-md border bg-background px-3 py-2 text-sm capitalize"
          >
            {TEMPLATES.map((t) => (
              <option key={t} value={t} className="capitalize">
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3 rounded-xl border bg-card p-4">
          <h3 className="text-sm font-semibold">Basics</h3>
          <TextField label="Full name" value={b.name} onChange={(v) => setBasics({ name: v })} />
          <TextField label="Headline" value={b.headline} onChange={(v) => setBasics({ headline: v })} />
          <TextField label="Email" value={b.email} onChange={(v) => setBasics({ email: v })} />
          <TextField label="Phone" value={b.phone} onChange={(v) => setBasics({ phone: v })} />
          <TextField label="Location" value={b.location} onChange={(v) => setBasics({ location: v })} />
          <div className="space-y-1.5">
            <Label htmlFor="summary">Summary</Label>
            <Textarea
              id="summary"
              rows={5}
              value={data.summary.content}
              onChange={(e) => setSummary(e.target.value)}
            />
          </div>
        </div>

        <ExperienceEditor />
        <EducationEditor />
        <SkillsEditor />

        <Button variant="outline" size="sm" onClick={reset}>
          <RotateCcw className="size-4" aria-hidden="true" /> Reset to sample
        </Button>
        <p className="text-xs text-muted-foreground">
          Edits update the preview live. More sections, drag-reorder and your real résumé data
          come next.
        </p>
      </aside>

      <div className="relative min-h-[80vh] overflow-hidden rounded-xl border bg-muted/30">
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
        {url ? (
          <iframe title="Résumé preview" src={url} className="h-full min-h-[80vh] w-full" />
        ) : null}
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
