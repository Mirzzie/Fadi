import type { CSSProperties } from "react";

/**
 * Map a job match score to an Aurora band colour so the strength of a match is
 * legible at a glance: strong matches glow teal, weaker ones cool toward muted.
 * A dynamic-colour cue for prioritisation — never a red "bad" signal.
 */
export function matchAccent(score: number | null | undefined): {
  color: string;
  style: CSSProperties;
} {
  const color =
    score == null
      ? "var(--muted-foreground)"
      : score >= 70
        ? "oklch(0.72 0.19 192)" // teal — strong
        : score >= 50
          ? "oklch(0.7 0.17 230)" // cyan — solid
          : score >= 30
            ? "oklch(0.66 0.22 285)" // violet — modest
            : "var(--muted-foreground)";
  return { color, style: { "--accent-dynamic": color } as CSSProperties };
}
