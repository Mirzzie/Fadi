# Codex → Claude: split the next work before making fixes

20 September 2026. The owner explicitly asked us to divide the work: “fadi's own job search system is broken and not at all reliable … before starting to fix, lets divide task for claude too … tell it directly.”

**Claude: own job-search reliability, from query to usable result. Codex: own career-data identity, conflicting résumé imports and downstream factual consistency.** These are the next two priorities. Earlier unfinished lab/VMware work remains on the backlog; this note does not mark it complete.

The product goal is to make Fadi reliable enough to manage the owner's career end to end. Today the owner also creates documents in external platforms and imports them into Fadi. That round trip must remain supported. Do not require Fadi's current document generator as the only intake channel.

## Claude — job search

Please reproduce the current failures before redesigning the implementation. The user has reported unreliability broadly; we have not yet established whether a specific provider, filtering, ranking, state, or several paths are responsible. Do not assume that adding providers or increasing result count fixes it.

Trace one real search through: active direction + explicit query/location → provider selection and configuration → fetch → parse/normalise → deduplicate → persist → location/seniority/work-mode filters → relevance/eligibility → visible results → actual job/apply page. Then fix the proven faults and simplify competing paths where that removes inconsistent behavior.

Entry points:
- `apps/web/src/app/dashboard/jobs/{page,actions}.tsx` (actions is `.ts`).
- `apps/web/src/components/jobs/` — notably unified-job-search, jobs-shell, progress and filters.
- `apps/web/src/lib/jobs/` — data, sync, web-search, web-surfer, ai-search, matching, validation, filters, liveness, dedupe.
- `apps/web/src/lib/data-sources/` — registry, provider capabilities and actual adapters.
- `packages/database/src/repositories/jobs.repository.ts` and saved-jobs repository where needed.
- Locate the concrete search API routes and worker/trigger paths before changing them; don't assume the dashboard is the only entry point.

Use a concrete target relevant to the owner (IT support in Ireland/Dublin, with explicit remote/onsite choices), then a second role/direction and a controlled no-results case. Confirm current profile settings rather than silently changing them. Record which providers are actually configured and tested; protect credentials in logs.

Acceptance evidence:
1. Requested role/location/work-mode survive the full pipeline. Track switching and explicit query changes do not show stale results/status from another search.
2. Provider failures, unavailable configuration, partial success and a successful zero-result query are distinguishable. The UI never describes a failed fetch as “no jobs exist”.
3. Progress terminates or reports a recoverable error. Refresh/retry does not strand the search or spawn duplicate work. Show cached results as cached, with observation time.
4. Duplicate postings are grouped with their sources; saved/application state survives refresh/deduplication. Explicit filters behave consistently between search paths.
5. Job URLs point to actual postings where verified. Closed, unavailable and unknown are distinct; a blocked/failed liveness request does not prove that the role is closed. A high relevance score does not override a known eligibility/legitimacy failure.
6. Account for losses: fetched, rejected parsing, duplicates, excluded by filters, excluded by ranking, displayed. Report reasons in diagnostics rather than adding a debug dashboard to the normal user flow.
7. A visible result can be opened and saved; selected filters, empty/error states, pagination and retry work in the browser. Record fixture/unit, live-provider and authenticated-browser evidence separately.

Use bounded live checks through existing configured access. Do not add a paid service, bulk crawl, replace provider credentials, or submit job applications as part of this assignment. Fix the existing useful path first; more adapters are not an acceptance criterion. Do not claim production reliability from unit tests alone.

## Codex — career record and import reconciliation

I own:
- Containment of uncertain/cross-kind identity mutations; correct canonical lookup, preserved attribution, atomic transitions and durable different/same/related decisions.
- The stable career-fact/source-version/rendering model and external résumé import comparison.
- A reviewed repair of the corrupted groups, then portfolio/document dependency and correction handling.
- Regression evidence for one job described for DevOps and IT support, separate organisations, degrees versus projects, source conflicts, repeated imports, concurrency and corrections.

Relevant ownership: `lib/identity/`, `lib/evidence/`, `lib/career/evidence.ts`, evidence/profile import actions and UI, evidence/resume/history repositories, `packages/portfolio/src/{identity,integrity,view}.ts`, portfolio admission/reconciliation, and the career-record schema work. Document writing quality is a later workstream after factual inputs and external editing round trips are dependable; it is not silently included as already fixed.

Read `2026-09-20-codex-data-identity-root-causes.md` for verified findings. The current evidence pool can be factually wrong even when its canonical-row count is correct. Job search should not depend on that repaired model before you can diagnose discovery/filter failures. Keep existing context read contracts stable; flag any matching conclusions that depend on disputed evidence.

The owner confirmed Hexastack was not their employment and requested removal. It was removed from the active portfolio, DevOps résumé and shared history with a recovery copy. Older documents/reports/story/revisions still contain references and are part of my repair inventory. Do not import, regenerate or rewrite the owner's career history while testing search. Employer choice must not become a job-search “optimisation”.

## Shared files and coordination

The tree already contains substantial uncommitted work by both of us. Preserve it; use file diffs and focused tests, and avoid sweeping formatting/reset/reverts.

`packages/database/src/schema/index.ts`, migration journal/snapshots, `lib/ai/tools/registry.ts`, common AI/provider and embedding utilities, career-profile context, shared UI shell, and event contracts are shared boundaries. I coordinate career schema/migration edits. If job reliability needs a job schema change, put the exact required change in the reply first so we can allocate the migration and avoid racing the journal. Work in your own job modules meanwhile; no further user permission is needed for ordinary scoped fixes.

Please acknowledge ownership in `docs/reviews/2026-09-20-claude-job-search-ack.md`, then proceed. Your next substantive handoff should include:
- concrete reproduction and root cause, not only a plan;
- changed paths;
- before/after behavior and validation evidence;
- provider/environment gaps still untested;
- any shared contract needed from me.

I will independently review your acceptance evidence; please review my identity/import behavior against the user's multiple-résumé workflow. Do not mark one workstream complete merely because the other passed tests.

This is the assignment handoff. No new job-search or data-model implementation was made as part of writing it, and your acknowledgement has not yet been observed.
