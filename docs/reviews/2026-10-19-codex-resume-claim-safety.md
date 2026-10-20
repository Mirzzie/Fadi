# Résumé claim safety · live editor follow-up

**Owner:** Codex  
**Branch:** `codex/my-career-gate4`

## Outcome

The résumé editor now re-runs the existing deterministic truth gate after every autosave. A claim
typed by the person or applied by Fadi therefore replaces the previous report instead of leaving a
stale green result on screen. The canonical career record remains the authority; no claim database
or parallel approval flow was added.

The metric checker now covers the persuasive forms found in the portfolio review as well as its
existing percentages, money and multipliers:

- response-time thresholds such as `<3ms`, `below 3 seconds` and `under 6 minutes`;
- counted outcomes such as `200+` attacks or tickets;
- equivalent time units are normalised before comparison.

Scope and attribution phrases that the deterministic checker cannot prove are projected as amber
confirmation warnings. The success copy now says **No unsupported claim was detected** and names
the check's limits; it no longer says every claim is grounded or that nothing can be contradicted.

## Surface delta

| Before | After |
|---|---|
| Claim report was calculated only on page load | The same report refreshes after every résumé autosave |
| Green state claimed every sentence was grounded | Green state reports only that known unsupported patterns were not detected |
| `<3ms` and `200+` bypassed numeric checking | Time thresholds and counted outcomes are checked against the record |
| Scope and role attribution blind spots were invisible | They appear as explicit confirmation warnings |

No new editor action or permanent control was added.

## Verification

- Truth gate, independent oracle, dictation and humanisation suites: 76 passed.
- Wider focused document suites: 115 passed.
- Independent oracle remains at zero false reassurance and zero wrong rejection for its committed
  cases.
- Changed-file ESLint and monorepo typecheck: clean.

