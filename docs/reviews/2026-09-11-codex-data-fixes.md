# Codex data implementation status — D05/D06/D13/F10

11 September 2026. Owner: Codex. Commits: `3c349c8` (D05/D06), `f31e335` (D13), `571be37` (F10).

## Fixed

| ID | Changed paths | Result |
|---|---|---|
| D05 | `apps/web/src/lib/portfolio/collector-sync.ts` | Event synchronization updates only `collectorCursor`; it can no longer advance the independent feedback stream. |
| D06 | `infrastructure/portfolio-collector/worker.js` | Event and feedback exports report the last row actually returned, rather than the table maximum, so a limited page cannot acknowledge unseen rows. |
| D13 | `apps/web/src/lib/jobs/sync.ts`, `apps/web/src/components/jobs/job-search-progress.tsx` | A discovery with zero successful writes preserves existing/seed jobs, retries sooner, records `persist_failed`, and no longer tells the user the search completed successfully. Partial persistence is also labelled separately. |
| F10 | `apps/web/src/lib/jobs/liveness.ts` | Liveness checks consume at most the first 24 KiB from the response stream and cancel it, instead of downloading the entire body before slicing. |

Regression coverage is in `apps/web/src/lib/portfolio/collector-sync.test.ts`. It calls the actual event sync and both Worker export endpoints. Five focused tests pass. Web typecheck passes with incremental output disabled, lint passes with zero errors, and `git diff --check` passes.

D13 regression coverage is in `apps/web/src/lib/jobs/sync.test.ts`. It runs the actual discovery coordinator with two returned postings and forced repository failures, and asserts that neither seed deactivation nor stale archival runs, the retry window shrinks to 60 seconds, and status is `persist_failed`. The combined focused data suite has six passing tests.

F10 regression coverage is in `apps/web/src/lib/jobs/liveness.test.ts`. It verifies bounded bytes and stream cancellation, and calls the actual liveness probe while asserting `Response.arrayBuffer()` is never invoked. The combined focused suite after this change has eight passing tests.

The full web suite reached 887 passing tests and failed two unrelated checks: the oracle test tried to write its report into a sandbox-read-only review folder, and the identity gate allow-list still expected the removed learning writer. Neither failure executed collector code, and neither was changed in this commit.

The cursor repair intentionally preserves incremental paging: one invocation may drain one page, and the next resumes from its final delivered ID. It does not claim atomic cursor/theme updates under simultaneous sync calls or retention/deletion of rows in the remote collector.

## Coordination

No lab, capture, learning, machine-access, document, job, deletion, migration, or credential source was touched. Claude may continue the mission work without overlap. D05/D06 are now claimed and completed by Codex; remaining findings retain their recorded ownership/status until separately verified.
