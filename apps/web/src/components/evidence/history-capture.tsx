"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CvUpload } from "@/components/profile/cv-upload";
import { saveResumeTextAction } from "@/app/dashboard/evidence/actions";

/**
 * Inline career-history capture — shared by the Evidence and Portfolio empty states.
 *
 * Building the evidence pool requires a CV/LinkedIn on file. Before this, a user with
 * nothing on file was told to go to Profile, add it, and come back — the one genuine
 * navigation deflection in the capture flow, and a direct cause of evidence_items
 * sitting at zero. Now they upload or paste it wherever they hit the wall, and the
 * caller continues immediately (`onSaved`).
 *
 * Lives in one file so the two screens share an implementation rather than growing two
 * copies of capture UI. Deliberately narrow: it writes only the résumé, via the same
 * repository call the profile form uses — it is not a second way to edit the profile.
 */
export function HistoryCapture({
  onSaved,
  title = "Add your career history",
  hint = "Upload your CV or paste it below — Fadi builds your evidence from it, here, without leaving this page.",
}: {
  /** Called after a successful save so the caller can continue (e.g. build/seed). */
  onSaved: () => void;
  title?: string;
  hint?: string;
}) {
  const [text, setText] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function save() {
    setError(null);
    startTransition(async () => {
      const r = await saveResumeTextAction(text);
      if (!r.ok) {
        setError(r.message);
        return;
      }
      setText("");
      onSaved();
    });
  }

  return (
    <div className="rounded-lg border border-border/70 bg-muted/20 p-4">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{hint}</p>

      <div className="mt-3 space-y-3">
        <CvUpload onExtracted={(t) => setText(t)} />
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
          placeholder="Or paste your CV text / a summary of your experience…"
        />
        {error ? <p className="text-xs text-amber-600 dark:text-amber-500">{error}</p> : null}
        <Button size="sm" onClick={save} disabled={pending || text.trim().length < 20}>
          <Sparkles className="size-4" aria-hidden="true" />
          {pending ? "Saving…" : "Save and build my evidence"}
        </Button>
      </div>
    </div>
  );
}
