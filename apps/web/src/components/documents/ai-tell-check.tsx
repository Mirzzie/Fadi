"use client";

import { CircleCheck, TriangleAlert } from "lucide-react";
import { useMemo } from "react";

import { findAiTells } from "@/lib/documents/humanize";
import { cn } from "@/lib/utils";

/**
 * Honest "reads human" check — surfaces the exact AI clichés present in a draft
 * so the writer can rewrite them. Deliberately NOT a fake "% human" detector
 * score (those are unreliable and dishonest): it shows real, fixable phrases,
 * or confirms there are none. Runs entirely client-side off `findAiTells`.
 */
export function AiTellCheck({ text, className }: { text: string; className?: string }) {
  const tells = useMemo(() => findAiTells(text ?? ""), [text]);

  if (!text?.trim()) return null;

  const clean = tells.length === 0;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-xs",
        clean
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
        className,
      )}
      role="status"
      aria-live="polite"
    >
      {clean ? (
        <>
          <CircleCheck className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span className="font-medium">No common AI clichés found.</span>
          <span className="w-full text-emerald-700/80 dark:text-emerald-300/70">
            This only checks for filler phrases — what truly reads human is specificity: real numbers,
            project and company names, and examples only you could write.
          </span>
        </>
      ) : (
        <>
          <TriangleAlert className="size-3.5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <span className="font-medium">
            {tells.length} AI cliché{tells.length === 1 ? "" : "s"} to rewrite:
          </span>
          <span className="flex flex-wrap gap-1">
            {tells.map((t) => (
              <code
                key={t}
                className="rounded bg-amber-500/15 px-1.5 py-0.5 font-mono text-[0.7rem] text-amber-900 dark:text-amber-100"
              >
                {t}
              </code>
            ))}
          </span>
          <span className="w-full text-amber-700/80 dark:text-amber-200/70">
            Swap these for plain, specific wording grounded in your real experience — that&apos;s what reads human.
          </span>
        </>
      )}
    </div>
  );
}
