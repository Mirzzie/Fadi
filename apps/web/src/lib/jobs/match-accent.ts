import type { CSSProperties } from "react";

/**
 * Map a job match score to an Aurora band colour so the strength of a match is
 * legible at a glance: stronger evidence uses the primary indigo, weaker evidence fades to muted.
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
        ? "#7d87ff" // primary indigo — strong
        : score >= 50
          ? "#a4b3ff" // pale indigo — solid
          : score >= 30
            ? "#584dfc" // violet — modest
            : "var(--muted-foreground)";
  return { color, style: { "--accent-dynamic": color } as CSSProperties };
}
