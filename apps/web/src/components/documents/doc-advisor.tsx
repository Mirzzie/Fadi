"use client";

import { ChevronDown, Lightbulb } from "lucide-react";
import { useMemo, useState, useSyncExternalStore } from "react";

import {
  DOC_GUIDANCE,
  DOC_GUIDANCE_VERSION,
  lengthStatus,
  wordCount,
  type DocGuidance,
} from "@/lib/documents/doc-guidance";
import type { DocKind } from "@/lib/jobs/application-types";
import { cn } from "@/lib/utils";

const SEEN_KEY = "careeros.docGuidanceSeen";

// Read which guidance version the user last acknowledged from localStorage,
// without setState-in-effect (mirrors the theme toggle). Server assumes "seen"
// so there's no hydration flash; a re-render (e.g. on toggle) re-reads it.
const seenStore = {
  subscribe() {
    return () => {};
  },
  getSnapshot() {
    try {
      return localStorage.getItem(SEEN_KEY) ?? "";
    } catch {
      return DOC_GUIDANCE_VERSION;
    }
  },
  getServerSnapshot() {
    return DOC_GUIDANCE_VERSION;
  },
};

const STATUS_COPY: Record<string, { text: (g: DocGuidance) => string; tone: string }> = {
  empty: { text: (g) => `Target ${g.words.min}–${g.words.max} words`, tone: "text-muted-foreground" },
  short: { text: (g) => `under target (${g.words.min}–${g.words.max})`, tone: "text-amber-600 dark:text-amber-400" },
  long: { text: (g) => `over target (${g.words.min}–${g.words.max})`, tone: "text-amber-600 dark:text-amber-400" },
  ok: { text: () => "in the recruiter-recommended range", tone: "text-emerald-600 dark:text-emerald-400" },
};

/**
 * Recruiter-grounded guidance for a specific prose document (cover letter, cold
 * email, value proposition) — the per-doc equivalent of the resume advisor. Live
 * word-count meter against the document's recommended length, plus sourced tips.
 * Alerts the user (an "Updated" badge) when the guidance version has changed.
 */
export function DocAdvisor({ kind, text }: { kind: DocKind; text: string }) {
  const guidance = DOC_GUIDANCE[kind];
  const [open, setOpen] = useState(false);
  const seenVersion = useSyncExternalStore(
    seenStore.subscribe,
    seenStore.getSnapshot,
    seenStore.getServerSnapshot,
  );
  const isNew = seenVersion !== DOC_GUIDANCE_VERSION;

  const count = useMemo(() => wordCount(text), [text]);

  if (!guidance) return null;

  const status = lengthStatus(count, guidance.words);
  const meter = STATUS_COPY[status];

  function toggle() {
    // Persisting the seen version + the setOpen re-render clears the "Updated" badge.
    if (isNew) {
      try {
        localStorage.setItem(SEEN_KEY, DOC_GUIDANCE_VERSION);
      } catch {
        /* ignore */
      }
    }
    setOpen((v) => !v);
  }

  return (
    <div className="rounded-xl border border-border/60 bg-card/50">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <Lightbulb className="size-3.5 text-primary" aria-hidden="true" />
        {guidance.label} tips
        {isNew ? (
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[0.62rem] font-semibold text-primary">
            Updated
          </span>
        ) : null}
        <span className="ml-auto flex items-center gap-2 font-normal">
          <span className={meter.tone}>
            {count} {count === 1 ? "word" : "words"}
            {status !== "empty" ? ` · ${meter.text(guidance)}` : ` · ${meter.text(guidance)}`}
          </span>
          <ChevronDown className={cn("size-3.5 transition-transform", open && "rotate-180")} aria-hidden="true" />
        </span>
      </button>

      {open ? (
        <div className="space-y-2.5 border-t border-border/50 px-3 py-2.5 text-xs text-muted-foreground">
          {guidance.tips.map((tip) => (
            <p key={tip.label} className="leading-relaxed">
              <span className="mr-2 inline-block w-14 shrink-0 align-top text-[0.62rem] font-semibold uppercase tracking-wide text-muted-foreground/70">
                {tip.label}
              </span>
              {tip.text}
            </p>
          ))}
          <p className="pt-1 text-[0.68rem] text-muted-foreground/70">
            Source: {guidance.sources} · reviewed {guidance.reviewed}. Recruiter norms change — we
            refresh this and flag it when it does.
          </p>
        </div>
      ) : null}
    </div>
  );
}
