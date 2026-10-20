"use client";

import { useState, useTransition } from "react";
import { MessageSquareQuote, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { prepareInterview } from "@/app/dashboard/applications/actions";
import type { PrepQuestion } from "@/lib/interview/jd-prep";

const STAR_ROWS: Array<[keyof Pick<PrepQuestion, "situation" | "task" | "action" | "result">, string]> = [
  ["situation", "Situation"],
  ["task", "Task"],
  ["action", "Action"],
  ["result", "Result"],
];

export function InterviewPrepPanel({
  jobTitle,
  jobCompany,
  jobDescription,
}: {
  jobTitle: string;
  jobCompany: string;
  jobDescription?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [questions, setQuestions] = useState<PrepQuestion[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const hasJd = Boolean(jobDescription && jobDescription.trim());

  function run() {
    setError(null);
    startTransition(async () => {
      const res = await prepareInterview({
        jobTitle,
        company: jobCompany,
        jobDescription: jobDescription ?? "",
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setQuestions(res.prep.questions);
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <MessageSquareQuote className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Interview prep for this role</h2>
        </div>
        <Button size="sm" variant={questions ? "outline" : "default"} onClick={run} disabled={pending || !hasJd}>
          <Sparkles className="size-3.5" aria-hidden="true" />
          {pending ? "Prepping…" : questions ? "Re-prep" : "Prep me"}
        </Button>
      </div>

      {!hasJd ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Add the job description below and I&apos;ll draft the behavioral questions this role will
          likely ask — with STAR answers pulled from your real LinkedIn &amp; career history.
        </p>
      ) : !questions && !error ? (
        <p className="mt-2 text-sm text-muted-foreground">
          I&apos;ll infer the behavioral questions for <span className="text-foreground">{jobTitle}</span>{" "}
          and answer each in STAR form from your real experience. The more you&apos;ve added to your
          LinkedIn (achievements, projects), the sharper this gets.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">{error}</p>
      ) : null}

      {questions ? (
        <ul className="mt-3 space-y-3">
          {questions.map((q, i) => (
            <li key={i} className="rounded-md border bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium">{q.question}</p>
                {q.competency ? (
                  <Badge variant="secondary" className="text-[0.6rem]">{q.competency}</Badge>
                ) : null}
              </div>

              {q.needsRealExample ? (
                <p className="mt-1.5 rounded border-l-2 border-amber-500/50 bg-amber-500/10 py-1 pl-2 text-xs text-amber-200/90">
                  No real example on file for this yet — prepare one from your experience; Fadi won&apos;t invent it.
                </p>
              ) : null}

              <dl className="mt-2 grid gap-1 text-sm">
                {STAR_ROWS.filter(([k]) => q[k]?.trim()).map(([k, label]) => (
                  <div key={k} className="grid grid-cols-[4.5rem_1fr] gap-2">
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="text-foreground/90">{q[k]}</dd>
                  </div>
                ))}
              </dl>

              {q.basedOn ? (
                <p className="mt-1.5 text-xs text-muted-foreground">From your story: &ldquo;{q.basedOn}&rdquo;</p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {questions ? (
        <p className="mt-3 text-xs text-muted-foreground">
          Deliver these in your own words — they&apos;re your real stories, shaped to this role. Save the
          strong ones to your <span className="text-foreground">story bank</span> to reuse everywhere.
        </p>
      ) : null}
    </div>
  );
}
