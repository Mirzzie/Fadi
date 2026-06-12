"use client";

import { ChevronDown, Lightbulb } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/**
 * Recruiter-grounded formatting guidance (2026 data), shown right in the editor
 * so Scout's advice is visible where it matters. Honest and sourced — not opinion:
 * fonts that pass ATS, recruiter size norms, and a length call based on the
 * user's real experience level.
 */
function lengthAdvice(experienceLevel?: string | null): { headline: string; detail: string } {
  const lvl = (experienceLevel ?? "").toLowerCase();
  if (/exec|lead|principal|staff|director|vp|chief/.test(lvl)) {
    return {
      headline: "One or two pages",
      detail:
        "At your level two pages is fine and common (10+ years) — most recruiters now accept it. Put your strongest, most recent wins on page one.",
    };
  }
  if (/senior|\bsr\b/.test(lvl)) {
    return {
      headline: "One page (two only if 10+ years)",
      detail:
        "Keep it to one tight page unless you genuinely have 10+ years and the second page earns its place.",
    };
  }
  return {
    headline: "One page",
    detail:
      "With under ~10 years of experience, recruiters expect a single, focused page. Cut anything that doesn't earn its place.",
  };
}

export function ResumeAdvisor({ experienceLevel }: { experienceLevel?: string | null }) {
  const [open, setOpen] = useState(false);
  const len = lengthAdvice(experienceLevel);

  return (
    <div className="rounded-xl border border-border/60 bg-card/50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Lightbulb className="size-3.5 text-primary" aria-hidden="true" />
        Recruiter-backed tips
        <span className="ml-auto flex items-center gap-2 font-normal">
          <span className="hidden sm:inline text-primary">{len.headline}</span>
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </span>
      </button>

      {open ? (
        <div className="space-y-2.5 border-t border-border/50 px-3 py-2.5 text-xs text-muted-foreground">
          <Tip label="Length">
            <span className="font-medium text-foreground">{len.headline}.</span> {len.detail}
          </Tip>
          <Tip label="Font">
            Use an ATS-safe font: <span className="text-foreground">Calibri</span> or{" "}
            <span className="text-foreground">Arial</span> pass every parser; <span className="text-foreground">Georgia</span> or{" "}
            <span className="text-foreground">Garamond</span> suit finance/law. Avoid decorative fonts.
          </Tip>
          <Tip label="Size">
            Body <span className="text-foreground">10–12pt</span>, section headings{" "}
            <span className="text-foreground">12–14pt bold</span>, your name{" "}
            <span className="text-foreground">18–24pt</span>.
          </Tip>
          <Tip label="Format">
            Single column, reverse-chronological, standard section names (Experience, Education, Skills). It&apos;s
            what ATS parsers are trained on.
          </Tip>
          <p className="pt-1 text-[0.68rem] text-muted-foreground/70">
            Based on 2026 recruiter &amp; ATS-parser guidance (Jobscan, Microsoft, recruiter surveys).
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Tip({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p className="leading-relaxed">
      <span className="mr-2 inline-block w-12 shrink-0 font-semibold uppercase tracking-wide text-[0.62rem] text-muted-foreground/70">
        {label}
      </span>
      {children}
    </p>
  );
}
