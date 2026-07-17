/**
 * Report staleness — the first piece of making outputs a LIVING projection of the
 * evidence pool instead of a frozen one-shot snapshot.
 *
 * The career report is generated once per track and then never changes, so it silently
 * drifts out of sync the moment the user adds evidence, updates their résumé, or closes
 * a skill gap. This detects that drift. It deliberately does NOT auto-regenerate — the
 * doctrine says detect → tell → let the user decide (regeneration spends their AI
 * budget, which must never happen silently). So this returns "stale, here's why", and
 * the UI offers a one-click refresh.
 *
 * Pure + deterministic so the comparison logic is testable without a DB or a clock.
 */

export type ReportStaleness = {
  stale: boolean;
  /** User-facing reason, present only when stale. */
  reason: string | null;
};

const FRESH: ReportStaleness = { stale: false, reason: null };

function ms(value: Date | string | number | null | undefined): number | null {
  if (value == null) return null;
  const t = new Date(value).getTime();
  return Number.isNaN(t) ? null : t;
}

/**
 * Is the report out of date relative to the inputs it was built from?
 *
 * A report is stale when any source it summarises (the evidence pool, the résumé, the
 * LinkedIn record) changed AFTER the report was generated. No report yet ⇒ never
 * "stale" (there's nothing to refresh — that's an empty state, not a drift).
 */
export function reportStaleness(input: {
  reportGeneratedAt: Date | string | null | undefined;
  latestEvidenceAt?: Date | string | null;
  latestResumeAt?: Date | string | null;
  latestLinkedInAt?: Date | string | null;
}): ReportStaleness {
  const report = ms(input.reportGeneratedAt);
  if (report == null) return FRESH;

  const changedAfter = (source: Date | string | null | undefined): boolean => {
    const t = ms(source);
    return t != null && t > report;
  };

  if (changedAfter(input.latestEvidenceAt)) {
    return { stale: true, reason: "Your evidence changed after this report was generated." };
  }
  if (changedAfter(input.latestResumeAt)) {
    return { stale: true, reason: "Your résumé changed after this report was generated." };
  }
  if (changedAfter(input.latestLinkedInAt)) {
    return { stale: true, reason: "Your LinkedIn record changed after this report was generated." };
  }
  return FRESH;
}
