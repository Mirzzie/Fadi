/** Career PHASE — one product, two modes (never two forks). Shared constants/types live here
 *  (not in the "use server" actions file, which may only export async functions). */
export type CareerMode = "apply" | "prepare";

/** Cookie name — the SSR-readable copy so the shell renders the right phase with no flash and no
 *  hydration mismatch. The DB (jobPreferences.mode) stays the durable source of truth. */
export const MODE_COOKIE = "fadi_mode";

/**
 * NO PAGE BELONGS TO ONE PHASE.
 *
 * This used to list the destinations each mode HID, and switching modes redirected anyone
 * standing on one of them. Career work crosses the line — a posting reveals a gap, the gap needs
 * practice, the practice belongs on the application — so hiding made the person track which half
 * of the product they were in. The phase now only orders the dock and steers what Fadi leads
 * with; nothing is removed and nobody is redirected.
 */
export function isPathHiddenInMode(): boolean {
  return false;
}
