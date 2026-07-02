"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, PenLine, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { applyReviewFixes, reviewDocForJob } from "@/app/dashboard/applications/actions";
import type { CvReview, ReviewVerdict, ReviewableKind } from "@/lib/documents/cv-review";

const KINDS: Array<{ id: ReviewableKind; label: string }> = [
  { id: "resume", label: "Resume" },
  { id: "cover_letter", label: "Cover letter" },
  { id: "email", label: "Cold email" },
  { id: "value_proposition", label: "Value prop" },
];

const VERDICT: Record<ReviewVerdict, { label: string; chip: string; dot: string }> = {
  critical: { label: "Critical", chip: "text-rose-300 border-rose-500/40 bg-rose-500/10", dot: "bg-rose-400" },
  reframe: { label: "Reframe", chip: "text-amber-300 border-amber-500/40 bg-amber-500/10", dot: "bg-amber-400" },
  strength: { label: "Strength", chip: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10", dot: "bg-emerald-400" },
  advantage: { label: "Advantage", chip: "text-sky-300 border-sky-500/40 bg-sky-500/10", dot: "bg-sky-400" },
};

const DECISION: Record<CvReview["hireProbability"]["decision"], { label: string; chip: string }> = {
  shortlist: { label: "Shortlist", chip: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10" },
  maybe: { label: "Maybe pile", chip: "text-amber-300 border-amber-500/40 bg-amber-500/10" },
  bin: { label: "Bin", chip: "text-rose-300 border-rose-500/40 bg-rose-500/10" },
};

/**
 * The red-pen review — Fadi as a merciless senior recruiter, section by section,
 * against THIS job. Works on every document you'd send (resume, cover letter,
 * cold email, value prop), and "Apply fixes" folds the rewrites into a fresh
 * draft — reshaping only what's really yours ([ADD REAL NUMBER] stays for you).
 */
export function CvReviewPanel({
  jobId,
  jobTitle,
  jobCompany,
  jobDescription,
}: {
  jobId: string;
  jobTitle: string;
  jobCompany: string;
  jobDescription?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<ReviewableKind>("resume");
  const [review, setReview] = useState<CvReview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<number | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const hasJd = Boolean(jobDescription && jobDescription.trim());

  function switchKind(next: ReviewableKind) {
    setKind(next);
    setReview(null);
    setError(null);
    setApplied(null);
  }

  function run() {
    setError(null);
    setApplied(null);
    startTransition(async () => {
      const res = await reviewDocForJob({
        jobId,
        jobTitle,
        company: jobCompany,
        jobDescription: jobDescription ?? "",
        kind,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setReview(res.review);
      setOpenSection(0);
    });
  }

  function applyFixes() {
    if (!review) return;
    setError(null);
    startTransition(async () => {
      const res = await applyReviewFixes({
        jobId,
        jobTitle,
        company: jobCompany,
        jobDescription: jobDescription ?? "",
        kind,
        review,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setApplied(res.message);
      router.refresh(); // the redrafted document appears in the docs list above
    });
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PenLine className="size-4 text-primary" aria-hidden="true" />
          <h2 className="text-sm font-semibold">Red-pen review</h2>
        </div>
        <Button size="sm" variant={review ? "outline" : "default"} onClick={run} disabled={pending || !hasJd}>
          {pending ? "Working…" : review ? "Re-review" : "Review like a recruiter"}
        </Button>
      </div>

      {/* Which document to mark up */}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => switchKind(k.id)}
            aria-pressed={kind === k.id}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              kind === k.id
                ? "border-primary/40 bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {k.label}
          </button>
        ))}
      </div>

      {!hasJd ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Add the job description and I&apos;ll mark up each document section by section, the way the
          hiring manager for this exact role would — no sugar-coating.
        </p>
      ) : !review && !error ? (
        <p className="mt-2 text-sm text-muted-foreground">
          A senior recruiter&apos;s written markup of the {KINDS.find((k) => k.id === kind)?.label.toLowerCase()}{" "}
          you&apos;d send here: what the JD demands, what yours actually says, the gap, and the rewrite.
          Blunt on purpose — then one click folds the fixes into a fresh draft.
        </p>
      ) : null}

      {error ? (
        <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">{error}</p>
      ) : null}
      {applied ? (
        <p className="mt-2 flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-sm">
          <Check className="size-4 text-emerald-400" aria-hidden="true" /> {applied}
        </p>
      ) : null}

      {review ? (
        <div className="mt-3 space-y-4">
          {/* Overall verdict strip */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-semibold tabular-nums">
              {review.atsScore}
              <span className="text-sm text-muted-foreground">/100 JD alignment</span>
            </span>
            <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", DECISION[review.hireProbability.decision].chip)}>
              {DECISION[review.hireProbability.decision].label}
            </span>
            <Button size="sm" className="ml-auto" onClick={applyFixes} disabled={pending || Boolean(applied)}>
              <Wand2 className="size-3.5" aria-hidden="true" />
              {pending ? "Redrafting…" : applied ? "Fixes applied" : "Apply fixes → redraft"}
            </Button>
          </div>
          {review.sixSecondImpression ? (
            <p className="text-sm text-foreground/90">
              <span className="font-medium">6-second impression:</span> {review.sixSecondImpression}
            </p>
          ) : null}
          {review.hireProbability.reason ? (
            <p className="text-sm text-muted-foreground">{review.hireProbability.reason}</p>
          ) : null}

          {review.missingKeywords.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs font-medium text-muted-foreground">Missing JD keywords</p>
              <div className="flex flex-wrap gap-1.5">
                {review.missingKeywords.map((k, i) => (
                  <span key={i} className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                    {k}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Section-by-section red pen */}
          <div className="space-y-2">
            {review.sections.map((s, i) => {
              const v = VERDICT[s.verdict];
              const open = openSection === i;
              return (
                <div key={i} className="overflow-hidden rounded-md border">
                  <button
                    type="button"
                    onClick={() => setOpenSection(open ? null : i)}
                    className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40"
                  >
                    <span className="flex items-center gap-2 text-sm font-medium">
                      <span className={cn("size-2 rounded-full", v.dot)} aria-hidden="true" />
                      {s.name}
                    </span>
                    <span className="flex items-center gap-2">
                      <span className={cn("rounded-full border px-2 py-0.5 text-[0.65rem] font-medium", v.chip)}>{v.label}</span>
                      <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
                    </span>
                  </button>
                  {open ? (
                    <div className="space-y-2.5 border-t px-3 py-2.5 text-sm">
                      {s.jdDemands ? (
                        <p><span className="text-xs font-medium text-muted-foreground">What the JD demands:</span> {s.jdDemands}</p>
                      ) : null}
                      {s.cvSays ? (
                        <p className="text-muted-foreground"><span className="text-xs font-medium">Yours says:</span> {s.cvSays}</p>
                      ) : null}
                      {s.diagnosis ? (
                        <p><span className="text-xs font-medium text-rose-300">Diagnosis:</span> {s.diagnosis}</p>
                      ) : null}
                      {s.rewrite ? (
                        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-2.5">
                          <p className="text-xs font-medium text-emerald-300">Recruiter rewrite (your content, sharpened)</p>
                          <p className="mt-1 whitespace-pre-wrap text-foreground/90">{s.rewrite}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          {(review.topCriticalFixes.length > 0 || review.quickWins.length > 0) ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {review.topCriticalFixes.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-rose-300">Must fix before sending</p>
                  <ol className="list-inside list-decimal space-y-0.5 text-sm text-foreground/90">
                    {review.topCriticalFixes.map((f, i) => (<li key={i}>{f}</li>))}
                  </ol>
                </div>
              ) : null}
              {review.quickWins.length > 0 ? (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-emerald-300">Quick wins</p>
                  <ol className="list-inside list-decimal space-y-0.5 text-sm text-foreground/90">
                    {review.quickWins.map((f, i) => (<li key={i}>{f}</li>))}
                  </ol>
                </div>
              ) : null}
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Rewrites reshape only what&apos;s genuinely yours — fill every [ADD REAL NUMBER] with your real
            figure before sending. &ldquo;Apply fixes&rdquo; redrafts the document with this markup folded in;
            it lands in the documents list above for your final edit.
          </p>
        </div>
      ) : null}
    </div>
  );
}
