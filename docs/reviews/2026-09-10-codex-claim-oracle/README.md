# Independent claim oracle — Codex to Claude

10 September 2026. Task A accepted and delivered. Claude retains checker/corpus/UI/export files. D05/D06 remain unclaimed by Codex. No application source changed.

## Deliverable

`cases.json` contains 46 hand-labelled synthetic cases, independent of checker implementation. `evaluate.cjs` validates the fixture and evaluates predictions with separate error counts and a full three-way confusion matrix. All data is synthetic; no provider requests or user records were used.

Supported means the supplied record warrants the wording, not that its real-world truth has been externally verified. Unsupported does not mean proven false. Uncertain is a substantive expected outcome, not a catch-all passing result. The attestation and unqualified rounding cases deliberately pin conservative policy; discuss a policy change before changing labels merely to satisfy the checker.

Coverage includes substring matches, precision, unit conversion, currencies, separators, dates, ranges, percentages versus points, counts versus identifiers, team/role attribution, job-description contamination, conflicting/superseded sources, seniority, negation, environment, instructions in source text, and post-generation edits. Supported cases exercise false rejection as well as unsupported cases exercising missed detection. No single weighted accuracy target is imposed: neither type of harm should be hidden by an average.

## Run

From this folder:

```
node evaluate.cjs
node evaluate.cjs predictions.json
```

Predictions must contain exactly one `{ "id": "...", "verdict": "supported|unsupported|uncertain" }` object per case. Missing, duplicate, extra and invalid predictions fail validation. The second command prints separate false-reassurance, wrong-rejection and deferral counts, and exits nonzero on any label mismatch.

Claude should supply an adapter from production checker results to these labels. **Do not map an empty findings list to supported** unless the checker actually evaluated the applicable claims. A numeric-only checker should report unverified non-numeric assertions as uncertain; the resulting mismatch records a capability gap, not permission to delete the case. Preserve raw checker output with predictions for diagnosis. The empty-document control has no assertions and must be recorded as zero evaluated claims, not used to inflate coverage.

`beforeGenerated` and `beforeCorpus` are lifecycle context for edit cases. The ordinary runner evaluates the final supplied text/corpus. These fixtures alone do not test cache invalidation, export enforcement, authorization or document persistence. Add route/integration checks that edit after generation, change/delete evidence, then invoke actual DOCX and JSON exports. Any cached validity must be bound to document revision, evidence revision and checker version.

## Verification and limits

Fixture schema/IDs validated. Runner self-checks cover exact predictions, deliberately wrong supported/unsupported/uncertain predictions, and incomplete predictions. No production checker score is claimed: Claude is actively changing it, and this deliverable deliberately specifies the target separately. This published suite is a development benchmark, not a statistically representative or held-out estimate of real-world quality. Keep separate future held-out examples for release evaluation.

## Related design answer

Attribution and provenance should be one coherent model with separate properties, not one overloaded field. Keep a source observation (source ID/version, visibility, observed/event time), actor/contribution attribution, extracted claim, transformation history and attestation/verification status linked explicitly. `personal|employment|education|platform|client` describes context; it cannot encode who authored a claim or what observation establishes. A source observation can support several claims, and a claim can depend on several sources, so preserve those links rather than copying an all-purpose `verified` flag.
