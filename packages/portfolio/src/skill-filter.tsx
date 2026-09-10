"use client";

import { useState } from "react";

import type { SkillEntry } from "./work-index";

/**
 * Skills as a filter over the work, not a list of adjectives.
 *
 * Clicking a skill hides every case that doesn't demonstrate it, so a visitor can
 * ask "show me where you actually did this" and get an answer. Filtering is done by
 * toggling `hidden` on the rendered cases rather than by re-rendering them, so this
 * stays a tiny island of interactivity in an otherwise static page — which is what
 * lets the same component work in the GitHub Pages export.
 *
 * It always announces what it has done and offers the way back, for the same reason
 * the rest of the platform does: a filtered view that doesn't say it is filtered is
 * indistinguishable from a different set of facts.
 */
export function SkillFilter({ skills }: { skills: SkillEntry[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [shown, setShown] = useState(0);

  if (skills.length === 0) return null;

  function apply(slug: string | null) {
    setActive(slug);
    if (typeof document === "undefined") return;
    let visible = 0;
    document.querySelectorAll<HTMLElement>("[data-case]").forEach((el) => {
      const has = !slug || (el.dataset.skills || "").split(" ").includes(slug);
      el.hidden = !has;
      if (has) visible += 1;
    });
    setShown(visible);
  }

  const activeLabel = skills.find((s) => s.slug === active)?.label;

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {skills.map((s) => (
          <button
            key={s.slug}
            type="button"
            aria-pressed={active === s.slug}
            onClick={() => apply(active === s.slug ? null : s.slug)}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[12.5px] transition-colors ${
              active === s.slug
                ? "border-[var(--pf-ink)] bg-[var(--pf-ink)] text-[var(--pf-invert)]"
                : "border-[var(--pf-line)] bg-[var(--pf-surface)] text-[var(--pf-ink-2)] hover:border-[var(--pf-accent)] hover:text-[var(--pf-ink)]"
            }`}
          >
            {s.label}
            <span className="text-[11px] tabular-nums opacity-60">{s.count}</span>
          </button>
        ))}
      </div>

      {active ? (
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm text-[var(--pf-ink-2)]">
          <span>
            Showing {shown} piece{shown === 1 ? "" : "s"} of work that demonstrate{" "}
            <span className="font-medium text-[var(--pf-ink)]">{activeLabel}</span>.
          </span>
          <button
            type="button"
            onClick={() => apply(null)}
            className="text-[var(--pf-accent)] underline underline-offset-2"
          >
            show everything
          </button>
        </p>
      ) : null}
    </div>
  );
}
