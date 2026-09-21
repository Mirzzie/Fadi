# Identity containment implemented — 21 September 2026

Fadi no longer automatically merges or promotes evidence because descriptions are similar. Exact recorded-field replays reuse the existing record. Inferred matches become pending imports, excluded from canonical evidence reads until the person resolves them. This is a bounded containment fix, not completion of the source/claim/projection redesign.

## What changed

- Known record kinds are separate: employment, a project within that employment, a degree, and a certification cannot be merged across kinds.
- Exact replay works without a large corpus, independent of market ranking tags and import authorship. Employer, period, metrics, attribution and description participate in comparison.
- Same title or employer plus the exact stated period can retrieve a review candidate even in a small corpus. Employer/date context helps rank suggestions. Shared words, URLs and embedding similarity never authorize an inferred automatic merge.
- Single and batch admission execute inside a transaction, serialized per owner using the existing user row. Batch items see earlier writes. Admission also rolls back if its caller's transaction fails.
- Four additive columns store pending status, proposed target, review reasons and explicit distinct-work decisions. Normal canonical reads exclude pending rows; old rows default to accepted without claiming their historical grouping was correct.
- The Evidence review panel shows titles, organisations, dates and expandable descriptions. Actions: join wording while retaining existing facts, keep as separate work, or discard only that pending import. Failed decisions stay visible. Missing targets cannot be merged. New imports refresh the panel.
- “Different work” persists in the database. Exact reimport of the accepted variant reuses it. A genuinely new paraphrase may still require another decision.
- Canonical lookup now reads the actual fact leader instead of searching a renderings-only result. Switching canonical wording cannot silently change employer, period, attribution or metrics.
- Extraction carries attribution instead of dropping it. The older learning-completion path now uses shared transactional admission. Project-post drafting rejects pending evidence and uses the current accepted canonical. Completion messages no longer promise every existing document was updated.
- Portfolio reconciliation no longer treats an equal title alone as proof of identity across conflicting context.

## Verification

- Full application suite: **1,132 passed**, 50 skipped at that run. One additional integration test was added afterward; the default suite skips it without a database.
- **10 actual Postgres integration tests passed**, using a fresh `identity_test_…` database created from all migrations and removed afterward. Coverage includes concurrent replay, two pending rewrites, repeated explicit merges, canonical lookup, persistent separation, cross-kind rejection, batch rollback, caller rollback, pending-only discard, pending replay counting, and owner isolation.
- Type checking passed. Changed-file ESLint: zero errors and zero warnings.
- **6 browser checks passed**, using the production component with synthetic server-action responses: context/details, failed-save retention, separate action, merge action, discard action, and a mobile missing-target state. No browser runtime errors. These are not an authenticated live-account end-to-end test; database behavior was tested independently.
- Migration `0050_evidence_identity_review` was generated. A guarded local migration attempt found no pending migrations; read-only verification confirmed its timestamp and all four columns already present. No migration was replayed.
- The first full-suite attempt overlapped type checking and timed out in `local-probe.test.ts`, contaminating the next mock assertion. The file passed alone; the full suite passed with `--maxWorkers=4` without changing that test or the lab implementation.

## What is still unresolved

1. **Source versions and provenance.** Raw résumé/history stores still lack immutable document versions and per-claim source spans. Document generation still consumes those raw sources through a separate route. Holding a possible match out of the evidence pool does not quarantine an entire uploaded CV or prove a claim true.
2. **Previously corrupted groups.** The earlier audit found five cross-kind renderings across three groups. This change does not silently split or reassign them. Correct canonical counts never proved correct semantics.
3. **Historical Hexastack outputs.** Active raw sources and the one unlinked portfolio entry were removed in the earlier authorized cleanup. The previously identified 16 documents, six reports, four revisions and one interview story were not rewritten by this change. They remain a repair/staleness inventory, not safe factual inputs.
4. **Independent portfolio data.** Detached portfolio entries and the portfolio import holdback mechanism are not converted into a universal source-review system here. Existing output snapshots do not automatically repair themselves.
5. **Remaining identity limits.** Period matching is conservative text equality, not a date interval parser. Different wording with insufficient shared context can still be admitted separately. Attribution is extracted, not independently verified. The resolver still uses heuristic candidate retrieval.
6. **Structural enforcement.** Admission/review transactions improve transitions; this is not a new global database constraint proving one correct canonical for every fact across every possible writer. Old split/delete/update paths need the broader fact-lifecycle work.

The next slice should store immutable source versions, link extracted claims to those versions, and distinguish factual conflicts from audience-specific wording before updating canonical history. Then repair existing groups and identify stale outputs. Until those steps are done, Fadi should not be presented as a fully dependable career source of truth.

## Claude handoff

Job search remains yours. I read your job-search findings and the document-wiring follow-up. Your JD/locale/editor work can continue within that boundary, but `reviewStatus: accepted` means admitted to the evidence store, not independently verified employment or competence. Do not use it as permission to add missing ATS keywords or as a new truth-gate pass.

I additionally touched the admission call and completion copy in `app/dashboard/learning/actions.ts`, plus the saved-evidence status and canonical read in `learning/project-finish-actions.ts`. Your existing finish workflow is preserved. The extension evidence response now includes `reviewStatus` and `reviewUrl`; an extension UI that ignores them can still say a capture succeeded without explaining the pending review.

Migration ownership: 0050 is now allocated and generated, with snapshot/journal. Coordinate any next migration from 0051. I preserved your existing 0048/0049 and other dirty work. Nothing was committed or deployed by me.

Main implementation paths:

- `packages/portfolio/src/identity.ts`
- `packages/database/src/repositories/evidence.repository.ts`
- `packages/database/src/schema/index.ts`, `migrations/0050_evidence_identity_review.sql`, matching metadata
- `apps/web/src/lib/identity/{admit.ts,admit.test.ts,admit.integration.test.ts,identity.test.ts,gate.test.ts}`
- `apps/web/src/app/dashboard/evidence/actions.ts`
- `apps/web/src/components/evidence/{evidence-pool.tsx,same-thing-panel.tsx}`
- `apps/web/src/lib/evidence/{pool.ts,pool-schema.test.ts}`
- `apps/web/src/lib/portfolio/{admit-items.ts,reconcile.ts,reconcile.test.ts}`
- the two learning action files and extension evidence route noted above.

Audit artifacts and current data-flow diagram: `/home/mirzzie/Projects/your-linkedin-sidekick-main/audit/2026-09-21/identity-review/`.
