/** Career PHASE — one product, two modes (never two forks). Shared constants/types live here
 *  (not in the "use server" actions file, which may only export async functions). */
export type CareerMode = "apply" | "prepare";

/** Cookie name — the SSR-readable copy so the shell renders the right phase with no flash and no
 *  hydration mismatch. The DB (jobPreferences.mode) stays the durable source of truth. */
export const MODE_COOKIE = "fadi_mode";
