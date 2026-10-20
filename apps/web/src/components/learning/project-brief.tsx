"use client";

import { ChevronDown, FileText } from "lucide-react";
import { useState } from "react";

/**
 * ABOUT THIS PROJECT — the whole description, before and during the work: the problem it
 * answers, what gets built and broken, why it matters now, where it runs. It was stored with
 * every project and never shown on the project page.
 */
export function ProjectBrief({
  detail,
  runsOn,
}: {
  detail: string | null;
  /** Where the lab runs, in words. */
  runsOn: string | null;
}) {
  const [open, setOpen] = useState(false);
  if (!detail?.trim() && !runsOn) return null;
  const paragraphs = (detail ?? "")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <section className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-2 px-4 py-3 text-left"
      >
        <FileText className="size-4 text-muted-foreground" aria-hidden="true" />
        <span className="flex-1 text-sm font-semibold">About this project</span>
        {!open && paragraphs[0] ? (
          <span className="hidden max-w-[60%] truncate text-xs text-muted-foreground sm:block">
            {paragraphs[0]}
          </span>
        ) : null}
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div className="space-y-3 border-t border-border/70 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
          {paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-line">
              {paragraph}
            </p>
          ))}
          {runsOn ? <p className="text-xs">Runs on: {runsOn}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
