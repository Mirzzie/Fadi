# Codex data implementation status — D05/D06/D12/D13/D14/F05/F10

11 September 2026. Owner: Codex. Commits: `3c349c8` (D05/D06), `72386af` (D12), `f31e335` (D13), `571be37` (F10), `cf74ffa` (F05), `7b83287` (D14).

## Fixed

| ID | Changed paths | Result |
|---|---|---|
| D05 | `apps/web/src/lib/portfolio/collector-sync.ts` | Event synchronization updates only `collectorCursor`; it can no longer advance the independent feedback stream. |
| D06 | `infrastructure/portfolio-collector/worker.js` | Event and feedback exports report the last row actually returned, rather than the table maximum, so a limited page cannot acknowledge unseen rows. |
| D12 | database canonical/job repository and tests | Automatic identity includes source and external posting ID, so identical company/title/city records do not merge distinct requisitions. A later snapshot with the same occurrence ID updates the existing job and accepts a shorter correction. |
| D13 | `apps/web/src/lib/jobs/sync.ts`, `apps/web/src/components/jobs/job-search-progress.tsx` | A discovery with zero successful writes preserves existing/seed jobs, retries sooner, records `persist_failed`, and no longer tells the user the search completed successfully. Partial persistence is also labelled separately. |
| D14 | `apps/web/src/lib/jobs/sync.ts`, `apps/web/src/lib/kv/store.ts` | In-flight work now holds a short, owner-token lease renewed by a heartbeat; completed freshness has a separate 30-minute key. A dead process loses its lease within two minutes, stale running status self-corrects, and an old owner cannot delete a replacement lease. |
| F05 | `apps/web/src/lib/security/ai-spend.ts`, extension capture, realtime and speech routes | Concrete rate-gate bypasses now consume per-user and global allowances before invoking the provider. The narrower allowance is checked first so a denied user cannot exhaust the shared counter by continuing to retry. |
| F10 | `apps/web/src/lib/jobs/liveness.ts` | Liveness checks consume at most the first 24 KiB from the response stream and cancel it, instead of downloading the entire body before slicing. |

Regression coverage is in `apps/web/src/lib/portfolio/collector-sync.test.ts`. It calls the actual event sync and both Worker export endpoints. Five focused tests pass. Web typecheck passes with incremental output disabled, lint passes with zero errors, and `git diff --check` passes.

D13 regression coverage is in `apps/web/src/lib/jobs/sync.test.ts`. It runs the actual discovery coordinator with two returned postings and forced repository failures, and asserts that neither seed deactivation nor stale archival runs, the retry window shrinks to 60 seconds, and status is `persist_failed`. The combined focused data suite has six passing tests.

F10 regression coverage is in `apps/web/src/lib/jobs/liveness.test.ts`. It verifies bounded bytes and stream cancellation, and calls the actual liveness probe while asserting `Response.arrayBuffer()` is never invoked. The combined focused suite after this change has eight passing tests.

F05 has two policy tests for independent user/global enforcement and three route tests. The route tests force denial and assert extension extraction, OpenAI session minting, and speech synthesis never reach their provider seams. This closes the two concrete bypasses in the audit and adds the same control to the adjacent speech path. It is not a claim that every future provider integration is automatically covered; new provider boundaries must use the shared guard or a provider wrapper that enforces it.

D14 extends the real KV seam with compare-and-delete and compare-and-expire operations. Tests verify the wrong owner cannot renew or release a lease, and that a missing lease changes orphaned `running` status to `failed`. The detached job is still not a durable queue: after a process dies, a later page load or scheduler must trigger the retry. The repair bounds and exposes the failure instead of claiming execution survives a process crash.

D12 has deterministic key tests and a repository integration test. The integration case ran against a newly created database after applying the complete migration journal, then the database was dropped. Historical jobs previously merged under the coarse key are not automatically split: source occurrences preserve information for a separate reviewed repair, but automatically guessing which historical cross-source rows represent the same requisition would repeat the defect.

The latest full web suite reached 910 passing tests and failed four unrelated checks while Claude's mission work was changing concurrently: two lab approval-TTL expectations, the identity gate allow-list still expecting a removed learning writer, and the oracle report attempting a sandbox-read-only write. Focused suites for Codex changes, typecheck and quiet lint pass.

The cursor repair intentionally preserves incremental paging: one invocation may drain one page, and the next resumes from its final delivered ID. It does not claim atomic cursor/theme updates under simultaneous sync calls or retention/deletion of rows in the remote collector.

## Coordination

No lab, learning, machine-access, document, deletion, migration, or credential source was touched. Claude may continue the mission work without overlap. D05/D06/D12/D13/D14/F05/F10 are now completed by Codex; remaining findings retain their recorded ownership/status until separately verified.
