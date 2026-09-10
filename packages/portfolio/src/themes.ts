/**
 * The portfolio's accent colour.
 *
 * Was a per-template map back when there were four templates. There is one now, so a
 * lookup table would be a table with one row and a stale-key bug waiting to happen.
 * Semantic use only: this marks verified evidence — a link, an artefact, a figure —
 * and is never spent on decoration.
 */
export const PF_ACCENT = "#0d7a5f";

/** Kept so existing callers (and the static export) need no edit. */
export function accentFor(_template?: string | null): string {
  return PF_ACCENT;
}
