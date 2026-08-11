"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";

import { labelForInterest, PERSONA_EVENT, readPersona } from "./persona";

/**
 * CV download that follows the visitor's chosen lens (like the original portfolio):
 * if the owner set a résumé for that audience, it links to it and labels it
 * ("Cloud CV"); otherwise it falls back to the default résumé.
 */
export function ResumeButton({
  resumeLinks,
  variant = "outline",
}: {
  resumeLinks: Record<string, string>;
  variant?: "outline" | "solid";
}) {
  const [interest, setInterest] = useState<string | null>(null);

  useEffect(() => {
    const p = readPersona();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (p?.interest) setInterest(p.interest);
    const onChange = (e: Event) => {
      const d = (e as CustomEvent).detail as { interest?: string };
      if (d?.interest) setInterest(d.interest);
    };
    window.addEventListener(PERSONA_EVENT, onChange);
    return () => window.removeEventListener(PERSONA_EVENT, onChange);
  }, []);

  const specific = interest && interest !== "all" ? resumeLinks[interest] : undefined;
  const href = specific || resumeLinks.default;
  if (!href) return null;

  const label = specific ? `${labelForInterest(interest!)} CV` : "Download CV";
  const cls =
    variant === "solid"
      ? "border border-[var(--pf-accent)] bg-[var(--pf-accent)] text-black hover:bg-[color-mix(in_srgb,var(--pf-accent)_90%,transparent)]"
      : "border border-zinc-700 text-zinc-200 hover:border-[var(--pf-accent)] hover:text-[var(--pf-accent)]";

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      data-cursor
      className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-medium transition-colors ${cls}`}
    >
      <Download className="size-4" /> {label}
    </a>
  );
}
