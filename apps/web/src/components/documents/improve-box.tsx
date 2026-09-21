"use client";

import { useState, useTransition } from "react";
import { Loader2, Undo2, Wand2 } from "lucide-react";

import { improveDocumentAction } from "@/app/dashboard/documents/improve-actions";
import { Button } from "@/components/ui/button";
import type { TruthFinding } from "@/lib/documents/truth-gate";

/**
 * "Change this for me" — and it changes.
 *
 * Reviewing, scoring and listing fixes still left every edit to the person. This applies the
 * change to the document in the editor, so the next thing they see is the revised text rather
 * than advice about it. Undo restores exactly what was there a moment ago, and the document's
 * own history keeps the saved versions.
 */
export function ImproveBox({
  documentId,
  currentContent,
  onApply,
  hasJob,
  quick,
}: {
  documentId: string;
  /** Read at the moment of asking, so Fadi revises what is on screen — not the last save. */
  currentContent: () => string;
  onApply: (content: string) => void;
  hasJob: boolean;
  /** Ready-made instructions for this kind of document. */
  quick: string[];
}) {
  const [text, setText] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [blocked, setBlocked] = useState<TruthFinding[]>([]);
  const [previous, setPrevious] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (askText: string) => {
    if (!askText.trim()) return;
    start(async () => {
      setNote(null);
      setWarnings([]);
      setBlocked([]);
      const before = currentContent();
      const result = await improveDocumentAction({
        documentId,
        currentContent: before,
        instruction: askText,
      });
      if (!result.ok) {
        setNote(result.message);
        setBlocked(result.blocked ?? []);
        return;
      }
      setPrevious(before);
      onApply(result.content);
      setNote(result.note);
      setWarnings(result.warnings);
      setText("");
    });
  };

  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {quick.map((ask) => (
          <button
            key={ask}
            type="button"
            disabled={pending}
            onClick={() => run(ask)}
            className="rounded-full border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-50"
          >
            {ask}
          </button>
        ))}
        {!hasJob ? (
          <span className="text-[11px] text-muted-foreground">
            Not linked to a job — Fadi will tailor to your record only.
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex gap-2">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") run(text);
          }}
          placeholder="Tell Fadi what to change — e.g. “lead with the Linux work, cut it to one page”"
          aria-label="What should Fadi change?"
          className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm"
        />
        <Button onClick={() => run(text)} disabled={pending || !text.trim()}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Wand2 className="size-4" aria-hidden="true" />}
          {pending ? "Rewriting…" : "Change it"}
        </Button>
        {previous ? (
          <Button
            variant="ghost"
            disabled={pending}
            onClick={() => {
              onApply(previous);
              setPrevious(null);
              setNote("Put back the previous version.");
              setWarnings([]);
            }}
          >
            <Undo2 className="size-4" aria-hidden="true" /> Undo
          </Button>
        ) : null}
      </div>

      {note ? <p className="mt-2 text-xs text-muted-foreground">{note}</p> : null}

      {blocked.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {blocked.map((finding) => (
            <li key={finding.offending} className="text-xs text-destructive">
              {finding.message}
            </li>
          ))}
        </ul>
      ) : null}

      {warnings.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {warnings.map((warning) => (
            <li key={warning} className="text-xs text-amber-500">
              {warning}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
