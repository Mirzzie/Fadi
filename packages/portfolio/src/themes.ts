/**
 * The portfolio's accent follows the visitor's shared appearance preference.
 *
 * Was a per-template map back when there were four templates. There is one now, so a
 * lookup table would be a table with one row and a stale-key bug waiting to happen.
 * Colour is presentation, not an assertion that linked evidence was verified.
 */
export const PF_ACCENT = "var(--primary)";

/** Kept so existing callers (and the static export) need no edit. */
export function accentFor(_template?: string | null): string {
  return PF_ACCENT;
}
