"use client";

import { Check, ChevronDown, Loader2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  documentStepStateAction,
  submitPracticeWorkAction,
} from "@/app/dashboard/learning/practice-actions";
import type { StepView } from "@/app/dashboard/learning/lab-actions";
import { StepText } from "@/components/learning/step-text";
import { Button } from "@/components/ui/button";
import type { DocumentStepState, ReviewView } from "@/lib/practice/document-sim";

/**
 * A WORK-SIMULATION STEP: the person writes, Fadi reviews it against the step's criteria.
 *
 * One action — Submit for review (Submit again after a "not yet"). The case they work from sits
 * open above the writing area. A review shows each criterion with the person's own words it rests
 * on; an example answer is offered only after their own work passes, so it can't be copied into a
 * resubmission. The draft is kept in this browser while they write; every submitted attempt is
 * kept by Fadi, unchanged.
 *
 * Replaces, for document steps: Check and continue, the result field and the command blocks
 * (docs/UI_UX_GUIDELINES.md, interaction budget).
 */
export function DocumentStep({
  runId,
  step,
  brief,
  onPassed,
}: {
  runId: string;
  step: StepView;
  /** The run's case: the situation and this person's own figures. */
  brief: string | null;
  /** The step is done: the workspace moves on and keeps the review to show once. */
  onPassed: (review: ReviewView, stepTitle: string) => void;
}) {
  const draftKey = `fadi:practice-draft:${step.id}`;
  const [text, setText] = useState("");
  const [state, setState] = useState<DocumentStepState | null>(null);
  const [review, setReview] = useState<ReviewView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  useEffect(() => {
    let alive = true;
    void documentStepStateAction({ runId, stepId: step.id }).then((loaded) => {
      if (!alive) return;
      setState(loaded);
      let draft: string | null = null;
      try {
        draft = window.localStorage.getItem(draftKey);
      } catch {
        // Private window or blocked storage: start from the last attempt instead.
      }
      setText(draft ?? loaded?.draft ?? "");
    });
    return () => {
      alive = false;
    };
  }, [runId, step.id, draftKey]);

  const write = (value: string) => {
    setText(value);
    try {
      window.localStorage.setItem(draftKey, value);
    } catch {
      // Not saved in this browser; the text is still on screen.
    }
  };

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tried = Boolean(review || state?.lastReview);

  const submit = () =>
    startSubmit(async () => {
      setMessage(null);
      const result = await submitPracticeWorkAction({ runId, stepId: step.id, body: text });
      if (!result.ok) return setMessage(result.message);
      setReview(result.review);
      if (result.review.verdict === "pass") {
        try {
          window.localStorage.removeItem(draftKey);
        } catch {
          // Nothing to clear.
        }
        onPassed(result.review, step.title);
      }
    });

  return (
    <section className="rounded-2xl border border-primary/30 bg-card p-5">
      <p className="text-xs font-medium text-primary">
        Step {step.ordinal} <span className="text-muted-foreground">· your write-up</span>
      </p>
      <h2 className="mt-0.5 text-lg font-semibold">{step.title}</h2>
      <StepText
        text={step.instruction}
        className="mt-2 text-sm leading-relaxed text-muted-foreground"
      />

      {brief ? <CaseView brief={brief} /> : null}

      <label htmlFor={`write-${step.id}`} className="mt-4 block text-sm font-medium">
        Your answer
      </label>
      <textarea
        id={`write-${step.id}`}
        value={text}
        onChange={(event) => write(event.target.value)}
        rows={12}
        className="mt-1 w-full rounded-md border border-border bg-background p-3 text-sm leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button onClick={submit} disabled={submitting || text.trim().length < 40}>
          {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {submitting ? "Fadi is reviewing…" : tried ? "Submit again" : "Submit for review"}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">{words} words</span>
      </div>
      {message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}

      <div aria-live="polite">
        {review ? (
          <ReviewResult review={review} />
        ) : state?.lastReview ? (
          <PastReview review={state.lastReview} attempt={state.attempt} />
        ) : null}
      </div>
    </section>
  );
}

/** The case: its situation as text, its figures as a real table. */
function CaseView({ brief }: { brief: string }) {
  const lines = brief.split("\n");
  const tableLines = lines.filter((line) => line.trim().startsWith("|"));
  const prose = lines
    .filter((line) => !line.trim().startsWith("|"))
    .join("\n")
    .trim();
  const rows = tableLines
    .filter((line) => !/^\|\s*-/.test(line.trim()))
    .map((line) =>
      line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim())
    );
  const [head, ...body] = rows;
  return (
    <details open className="mt-4 rounded-lg border border-border/70">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">The case</summary>
      <div className="space-y-3 border-t border-border/70 px-3 py-3">
        {head ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  {head.map((cell) => (
                    <th key={cell} className="whitespace-nowrap px-2 py-1 font-medium">
                      {cell}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row) => (
                  <tr key={row[0]} className="border-t border-border/50">
                    {row.map((cell, index) => (
                      <td key={index} className="whitespace-nowrap px-2 py-1 text-muted-foreground">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        {prose ? (
          <StepText
            text={prose}
            className="space-y-2 text-sm leading-relaxed text-muted-foreground"
          />
        ) : null}
      </div>
    </details>
  );
}

export function ReviewResult({ review }: { review: ReviewView }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 space-y-2 border-t border-border/70 pt-3">
      <p className="text-sm font-medium">
        {review.verdict === "pass"
          ? `Passed — ${review.met} of ${review.total} criteria met.`
          : `Not yet — ${review.met} of ${review.total} criteria met. Revise and submit again.`}
      </p>
      <ul className="space-y-2">
        {review.results.map((result) => (
          <li key={result.id} className="flex gap-2 text-sm">
            {result.level === "not_yet" ? (
              <X className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
            ) : (
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" aria-hidden="true" />
            )}
            <div className="min-w-0">
              <p>
                {result.label}
                {result.level === "strong" ? (
                  <span className="text-muted-foreground"> · strong</span>
                ) : null}
              </p>
              <p className="text-xs text-muted-foreground">{result.feedback}</p>
              {result.quote ? (
                <p className="mt-0.5 text-xs italic text-muted-foreground">“{result.quote}”</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Fadi&apos;s review — a model scored this against the criteria. Facts about the case are
        checked exactly.
      </p>
      {review.exampleAnswer ? (
        <div>
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            Compare with an example answer
            <ChevronDown
              className={`size-3.5 transition ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {open ? (
            <p className="mt-2 rounded-md bg-muted/60 p-3 text-sm leading-relaxed">
              {review.exampleAnswer}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/** The last attempt's review, after a reload: its recorded account, line by line. */
function PastReview({
  review,
  attempt,
}: {
  review: NonNullable<DocumentStepState["lastReview"]>;
  attempt: number;
}) {
  return (
    <div className="mt-4 space-y-1 border-t border-border/70 pt-3 text-sm">
      <p className="font-medium">
        Attempt {attempt}: {review.verdict === "pass" ? "passed" : "not yet"} — {review.seen}
      </p>
      <ul className="space-y-1 text-xs text-muted-foreground">
        {review.lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
