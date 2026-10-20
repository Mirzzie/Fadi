"use client";

import { useRef, useState, useTransition } from "react";
import { Check, Loader2, Undo2, Wand2, X } from "lucide-react";

import { improveDocumentAction } from "@/app/dashboard/documents/improve-actions";
import { Button } from "@/components/ui/button";
import { DictateButton } from "@/components/documents/dictate-button";
import { diffDocuments, speakableDiff, type DocumentDiff } from "@/lib/documents/diff";
import { speakFadi } from "@/lib/voice/fadi-speech";
import type { TruthFinding } from "@/lib/documents/truth-gate";

/**
 * "Change this for me" — and it shows you what it would change.
 *
 * This is what a chat window in a document editor should have been. A transcript beside your CV
 * gives you two stories — what the assistant SAYS it did, and what the document now says — and
 * they drift. Here there is one: you say what to change, Fadi shows the change, and it does not
 * touch the document until you keep it.
 *
 * The proposal matters most when you cannot see: Fadi reads the change back — "Rewrote 2 lines.
 * Now reads: Ran the service desk for 200 staff" — and you say keep it or discard. Applying
 * first and offering undo afterwards is fine with your eyes open and useless without them.
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
  const [proposal, setProposal] = useState<{ content: string; diff: DocumentDiff } | null>(null);
  const askRef = useRef<HTMLTextAreaElement | null>(null);
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
      // Proposed, not applied. Nothing in the editor changes until "Keep it".
      const diff = diffDocuments(before, result.content);
      setProposal({ content: result.content, diff });
      setNote(result.note);
      setWarnings(result.warnings);
      setText("");
      void speakFadi(`${speakableDiff(diff)} Keep it?`);
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
        <textarea
          ref={askRef}
          rows={1}
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              run(text);
            }
          }}
          placeholder="Tell Fadi what to change — e.g. “lead with the Linux work, cut it to one page”"
          aria-label="What should Fadi change?"
          className="min-h-9 min-w-0 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm"
        />
        {/* Say it instead of typing it: the same instruction, hands free. */}
        <DictateButton
          value={text}
          onValue={setText}
          fieldRef={askRef}
          label="the change you want"
        />
        <Button onClick={() => run(text)} disabled={pending || !text.trim()}>
          {pending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Wand2 className="size-4" aria-hidden="true" />
          )}
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

      {proposal ? (
        <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3">
          <p className="text-sm font-medium">{proposal.diff.summary}</p>
          <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border/60 bg-background/60 p-2 font-mono text-xs">
            {proposal.diff.rows.map((row, index) => (
              <div
                key={`${index}-${row.text}`}
                className={
                  row.kind === "added"
                    ? "text-primary"
                    : row.kind === "removed"
                      ? "text-destructive line-through"
                      : "text-muted-foreground"
                }
              >
                {row.kind === "added" ? "+ " : row.kind === "removed" ? "− " : "  "}
                {row.text || "\u00a0"}
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => {
                setPrevious(currentContent());
                onApply(proposal.content);
                setProposal(null);
                setNote("Kept. Undo is there if you change your mind.");
              }}
            >
              <Check className="size-4" aria-hidden="true" /> Keep it
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setProposal(null);
                setNote("Left it as it was.");
              }}
            >
              <X className="size-4" aria-hidden="true" /> Discard
            </Button>
          </div>
        </div>
      ) : null}

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
