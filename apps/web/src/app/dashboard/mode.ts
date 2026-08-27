/** Career PHASE — one product, two modes (never two forks). Shared constants/types live here
 *  (not in the "use server" actions file, which may only export async functions). */
export type CareerMode = "apply" | "prepare";

/** Cookie name — the SSR-readable copy so the shell renders the right phase with no flash and no
 *  hydration mismatch. The DB (jobPreferences.mode) stays the durable source of truth. */
export const MODE_COOKIE = "fadi_mode";

/** Pages that belong to only ONE phase (mirrors the dock's per-mode hiding). Switching INTO a
 *  mode that hides the current page sends the user to the dashboard, so the switch actually
 *  transforms the view instead of stranding them on a page the new mode has hidden. */
export const MODE_HIDDEN_PREFIXES: Record<CareerMode, string[]> = {
  // Apply = the pipeline. Hides the orient/build tools.
  apply: ["/dashboard/niche-finder", "/dashboard/interview", "/dashboard/learning"],
  // Prepare = building up. Hides the live pipeline.
  prepare: ["/dashboard/jobs", "/dashboard/applications", "/dashboard/network"],
};

export function isPathHiddenInMode(pathname: string, mode: CareerMode): boolean {
  return MODE_HIDDEN_PREFIXES[mode].some((prefix) => pathname.startsWith(prefix));
}
