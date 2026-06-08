/**
 * Pure posting-liveness decision logic — no IO, no server-only, so it stays
 * deterministic and unit-testable. The network probe lives in `liveness.ts`.
 *
 * Users' time is the priority: nobody should pour an hour into tailoring a CV
 * for a role the recruiter already closed. We can't know with certainty from
 * the outside, so we're deliberately CONSERVATIVE and HONEST:
 *   - "closed"  — strong evidence it's gone (404/410 or an explicit "no longer
 *                 accepting / expired / filled" message on the page).
 *   - "live"    — the page loads normally with no closed signal.
 *   - "unknown" — we couldn't tell (network error, bot wall, ambiguous page).
 * We only ever WARN on "closed", never block, and never cry wolf on "unknown".
 */
export type LivenessState = "live" | "closed" | "unknown";
export interface PostingLiveness {
  state: LivenessState;
  reason?: string;
  checkedAt: string;
}

// Strong, low-false-positive phrases that real job pages show when a posting is
// gone. Kept deliberately specific — generic words like "closed" alone aren't
// enough (a live page can say "close" in unrelated copy).
export const CLOSED_PHRASES = [
  /no longer (accepting|available|active|open|live)/i,
  /this (job|position|vacancy|listing|posting|role|opening)[^.]{0,40}(has )?(expired|closed|been filled|is no longer)/i,
  /(applications?|the posting) (are |is |has )?(now )?(closed|expired|ended)/i,
  /position has been filled/i,
  /this (job|posting|vacancy) (is )?(no longer|not) (available|accepting)/i,
  /(job|posting|vacancy) not found/i,
  /this opportunity is no longer/i,
  /we are no longer accepting applications/i,
];

/**
 * Decide liveness from an HTTP status + a snippet of the response body.
 * Deterministic and side-effect free.
 */
export function detectClosedSignal(status: number, bodySnippet: string): PostingLiveness {
  const checkedAt = new Date().toISOString();

  if (status === 404 || status === 410) {
    return { state: "closed", reason: `Source returned ${status}`, checkedAt };
  }
  // 5xx / 429 / blocked → we genuinely can't tell. Don't guess.
  if (status >= 400) {
    return { state: "unknown", reason: `Source returned ${status}`, checkedAt };
  }

  if (CLOSED_PHRASES.some((re) => re.test(bodySnippet))) {
    return { state: "closed", reason: "The posting page says it's no longer open", checkedAt };
  }

  return { state: "live", checkedAt };
}
