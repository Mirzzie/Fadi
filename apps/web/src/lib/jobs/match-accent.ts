import type { CSSProperties } from "react";

/**
 * Map a job match score to the current palette, never a separate fixed signal family.
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
        ? "var(--primary)"
        : score >= 50
          ? "color-mix(in srgb, var(--primary) 85%, var(--foreground))"
          : score >= 30
            ? "color-mix(in srgb, var(--primary) 65%, var(--muted-foreground))"
            : "var(--muted-foreground)";
  return { color, style: { "--accent-dynamic": color } as CSSProperties };
}
