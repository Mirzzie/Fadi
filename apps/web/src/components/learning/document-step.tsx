"use client";

import { Check, ChevronDown, Lightbulb, Loader2, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import {
  documentStepStateAction,
  graderStatusAction,
  revealHintAction,
  submitPracticeWorkAction,
} from "@/app/dashboard/learning/practice-actions";
import { GraderCheck } from "@/components/learning/grader-check";
import type { StepView } from "@/app/dashboard/learning/lab-actions";
import { StepText } from "@/components/learning/step-text";
import { Button } from "@/components/ui/button";
import type { DocumentStepState, ReviewView } from "@/lib/practice/document-sim";
import type { GraderStatus } from "@/lib/practice/grader-check";

/**
 * A WORK-SIMULATION STEP: the person writes, Fadi reviews it against the step's criteria.
 *
 * One action — Submit for review (Submit again after a "not yet") — and one quieter choice that
 * changes the outcome: Get a hint (nudge → concept → structure), recorded with every later attempt.
 * The case they work from sits open above the writing area; a step that asks for a decision has
 * its picks there too, checked exactly. A review shows each criterion with the person's own words it rests
 * on; an example answer is offered only after their own work passes, so it can't be copied into a
 * resubmission. The draft is kept in this browser while they write; every submitted attempt is
 * kept by Fadi, unchanged.
 *
 * Replaces, for document steps: Check and continue, the result field and the command blocks
 * (docs/UI_UX_GUIDELINES.md, interaction budget). The "Step N · your write-up" label went with the
 * hint link: the project header already says "Step N of M".
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
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [hints, setHints] = useState<string[]>([]);
  const [hinting, startHint] = useTransition();
  // Set when a submission was refused because the model hasn't passed the marking check.
  const [grader, setGrader] = useState<Exclude<GraderStatus, { state: "fit" }> | null>(null);
  const [state, setState] = useState<DocumentStepState | null>(null);
  const [review, setReview] = useState<ReviewView | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();

  useEffect(() => {
    let alive = true;
    void documentStepStateAction({ runId, stepId: step.id }).then((loaded) => {
      if (!alive) return;
      setState(loaded);
      setHints(loaded?.hints ?? []);
      let draft: { text: string; choices: Record<string, string> } | null = null;
      try {
        const saved = window.localStorage.getItem(draftKey);
        if (saved) {
          // Older drafts were the plain text.
          draft = saved.startsWith("{") ? JSON.parse(saved) : { text: saved, choices: {} };
        }
      } catch {
        // Private window, blocked storage or a damaged draft: start from the last attempt.
      }
      setText(draft?.text ?? loaded?.draft ?? "");
      setChoices({ ...(loaded?.draftChoices ?? {}), ...(draft?.choices ?? {}) });
    });
    return () => {
      alive = false;
    };
  }, [runId, step.id, draftKey]);

  const save = (next: { text: string; choices: Record<string, string> }) => {
    try {
      window.localStorage.setItem(draftKey, JSON.stringify(next));
    } catch {
      // Not saved in this browser; the work is still on screen.
    }
  };
  const write = (value: string) => {
    setText(value);
    save({ text: value, choices });
  };
  const pick = (id: string, value: string) => {
    const next = { ...choices, [id]: value };
    setChoices(next);
    save({ text, choices: next });
  };
  const fields = state?.choices ?? [];
  const picked = fields.every((field) => choices[field.id]);
  const hintsLeft = (state?.hintsAvailable ?? 0) - hints.length;
  const openHint = () =>
    startHint(async () => {
      const result = await revealHintAction({ runId, stepId: step.id });
      if (!result.ok) return setMessage(result.message);
      setHints(result.hints);
    });

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const tried = Boolean(review || state?.lastReview);

  const submit = () =>
    startSubmit(async () => {
      setMessage(null);
      const result = await submitPracticeWorkAction({
        runId,
        stepId: step.id,
        body: text,
        choices,
      });
      if (!result.ok) {
        if (result.graderCheck) {
          const status = await graderStatusAction();
          if (status && status.state !== "fit") return setGrader(status);
        }
        return setMessage(result.message);
      }
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
      <h2 className="text-lg font-semibold">{step.title}</h2>
      <StepText
        text={step.instruction}
        className="mt-2 text-sm leading-relaxed text-muted-foreground"
      />
      {hints.length ? (
        <ol className="mt-3 space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
          {hints.map((hint, index) => (
            <li key={index} className="flex gap-2">
              <Lightbulb className="mt-0.5 size-4 shrink-0 text-amber-500" aria-hidden="true" />
              <span>{hint}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {brief ? <CaseView brief={brief} /> : null}

      {fields.length ? (
        <fieldset className="mt-4 grid gap-3 sm:grid-cols-3">
          <legend className="mb-1 text-sm font-medium">Your calls</legend>
          {fields.map((field) => (
            <label key={field.id} className="block text-xs text-muted-foreground">
              {field.label}
              <select
                value={choices[field.id] ?? ""}
                onChange={(event) => pick(field.id, event.target.value)}
                className="mt-1 block w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm text-foreground"
              >
                <option value="" disabled>
                  Choose…
                </option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </fieldset>
      ) : null}

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
        <Button
          onClick={submit}
          disabled={submitting || Boolean(grader) || !picked || text.trim().length < 40}
        >
          {submitting ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
          {submitting ? "Fadi is reviewing…" : tried ? "Submit again" : "Submit for review"}
        </Button>
        <span className="text-xs text-muted-foreground tabular-nums">{words} words</span>
        {hintsLeft > 0 ? (
          <button
            type="button"
            onClick={openHint}
            disabled={hinting}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground hover:underline"
          >
            {hints.length ? "Another hint" : "Stuck? Get a hint"}
          </button>
        ) : null}
      </div>
      {hints.length ? (
        <p className="mt-1 text-xs text-muted-foreground">
          Your record will say this was done with {hints.length} hint{hints.length > 1 ? "s" : ""}.
        </p>
      ) : null}
      {message ? <p className="mt-2 text-sm text-destructive">{message}</p> : null}
      {grader ? (
        // Takes the place of the refusal: the check, then Submit again (the draft is kept).
        <div className="mt-3 rounded-lg border border-border/70 p-3">
          <GraderCheck status={grader} onFit={() => setGrader(null)} />
        </div>
      ) : null}

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
  // Text and table in the order the case was written: the situation first, then the figures,
  // then the CRM notes (the browser pass showed the intro landing after the table, 19 Oct 2026).
  const blocks: Array<{ kind: "text"; text: string } | { kind: "table"; rows: string[][] }> = [];
  for (const line of brief.split("\n")) {
    const isRow = line.trim().startsWith("|");
    const last = blocks[blocks.length - 1];
    if (isRow) {
      if (/^\|\s*-/.test(line.trim())) continue;
      const cells = line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim());
      if (last?.kind === "table") last.rows.push(cells);
      else blocks.push({ kind: "table", rows: [cells] });
    } else if (last?.kind === "text") last.text += `\n${line}`;
    else blocks.push({ kind: "text", text: line });
  }
  return (
    <details open className="mt-4 rounded-lg border border-border/70">
      <summary className="cursor-pointer px-3 py-2 text-sm font-medium">The case</summary>
      <div className="space-y-3 border-t border-border/70 px-3 py-3">
        {blocks.map((block, index) =>
          block.kind === "table" ? (
            <CaseTable key={index} rows={block.rows} />
          ) : block.text.trim() ? (
            <StepText
              key={index}
              text={block.text.trim()}
              className="space-y-2 text-sm leading-relaxed text-muted-foreground"
            />
          ) : null
        )}
      </div>
    </details>
  );
}

/** Every column visible: cells wrap rather than run off the card (no clipped "Exec sponsor"). */
function CaseTable({ rows }: { rows: string[][] }) {
  const [head, ...body] = rows;
  if (!head) return null;
  return (
    <div className="overflow-x-auto">
      <table className="w-full table-auto text-left text-xs">
        <thead>
          <tr>
            {head.map((cell) => (
              <th key={cell} className="px-2 py-1 align-bottom font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row) => (
            <tr key={row[0]} className="border-t border-border/50 align-top">
              {row.map((cell, index) => (
                <td
                  key={index}
                  className={`px-2 py-1 text-muted-foreground ${index === 0 ? "font-medium text-foreground" : ""}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
