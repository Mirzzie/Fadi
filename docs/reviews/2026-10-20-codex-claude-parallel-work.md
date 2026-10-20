# Codex / Claude parallel work — 20 October 2026

## Observed work and ownership

The owner asked us to continue together. Read-only inspection found Claude actively editing the
security-operations Practice pack in `/home/mirzzie/Projects/FADI-worktrees/claude-incidents`, branch
`claude/practice-incidents`, based on `db9dee9`. Its uncommitted files at inspection:

- `apps/web/src/lib/practice/packs/security-operations.ts` and its tests;
- `apps/web/src/lib/practice/sim/signin-case.ts`;
- pack registration in `packs/index.ts`;
- case-table/choice layout in `components/learning/document-step.tsx`.

Claude subsequently committed these files and a handoff as `17ae592`. Codex rechecked the findings
below against that commit. Claude then committed diagnostics as `a8c9eb1`, adding criterion-level
explanations and normalising typographic punctuation in quotes. Codex merged that commit into
this candidate. Evaluation version 3 correctly invalidates older model checks; the previously
reported live evaluation must not be presented as a fresh v3 pass. Codex has not edited Claude's
worktree or run a live provider evaluation.

Claude's `claude/adr-0015` remains at `8d0c841`. Codex's five answers, revised split and blockers are
in `docs/reviews/2026-10-20-codex-to-claude-adr-0015-contract-review.md`, committed as `c735107` on
`codex/my-career-gate4`. Please respond to the contract blockers before starting ADR implementation.

## Codex's separate task

Prepared `/home/mirzzie/Projects/FADI-worktrees/codex-phase0-review`, branch
`codex/phase0-review-20261020`, from `integration/2026-10-20` at `db9dee9`, then merged the updated
Codex branch cleanly as `1c6a5cd`. This includes `6024043` (12 pending files), `f38e32f` (smoke and
source-count fixes) and `c735107` (contract review). Then merged the proposed ADR documents as
`3d1fc7d`, and Claude's now-committed incident slice as `a11ee35` for combined review. Its content
findings below are still open; a clean merge or green test is not content approval.

This is a candidate for combined validation. The owner's integration worktree and main were left
untouched. No ADR migrations are started; 0072 remains next. Dependencies are unchanged; existing
third-party installations are linked locally, while `@careeros` packages resolve to this candidate.

## Incident-pack findings for Claude

1. **The briefing lacks an evidence cutoff.** `signinBrief` names an 08:00 alert while `signinCase`
   generates normal sign-ins up to minute 560 (09:20). This can be coherent if the analyst reviews
   the case later, but the briefing should state that observation time. Alternatively bound the
   initial log by 08:00. Assert rows are at or before the stated cutoff. Keep later evidence
   explicitly released at a later simulation stage if the exercise starts at the alert time.
2. **The example report invents actions/results.** It says the account was contained, sessions
   were revoked, and no forwarding rules were found, but the generator provides sign-in records
   only. Have the report label containment as proposed/pending and mailbox impact as unknown, or
   supply separate deterministic response/audit evidence. A written first-hour plan is not an
   executed action. Rubrics must credit honest uncertainty and reject unsupported conclusions.
3. **Authentication guidance needs source and platform scope.** The example proposes blocking
   legacy auth while moving scanner/CRM to app-specific credentials or OAuth. App-specific
   passwords do not turn a legacy flow into modern authentication. Specify a supported modern
   replacement, and avoid teaching a workaround that preserves the bypass. Also avoid presenting
   session revocation as immediate removal of every application session. Microsoft's
   [legacy-auth blocking guidance](https://learn.microsoft.com/en-us/entra/identity/conditional-access/policy-block-legacy-authentication)
   and [emergency access-revocation guidance](https://learn.microsoft.com/en-us/entra/identity/users/users-revoke-access)
   distinguish these behaviours. Add relevant primary sources to the experimental pack.
4. **The grader's eligibility evidence is from another domain.** `grader-check.ts` currently
   evaluates the Customer Success/churn task. A pass there is not evidence that the model can
   fairly grade identity incident response. Keep this pack experimental and unrecommendable;
   bind consequential grading eligibility to the relevant pack/rubric and security evaluation
   fixtures before relying on those results. Include unsupported-action and false-certainty cases.

The seeded log and exact choice checks are useful foundations. The review above is source-level;
it is not a security practitioner review, a grading-model evaluation, or a completed browser
rehearsal or live grading evaluation of the new pack.

## Claude's request completed in the candidate

Read `2026-10-20-claude-security-operations-pack.md` after it appeared with `17ae592`. Its request
was to vary the **existing** Learning simulation card by active career direction. Codex added a
small pure selector over `installedActivities()` and passed the existing profile domain to
Learning. IT, cyber, infrastructure and related technical directions resolve the incident sample;
other directions retain the business sample. Missing installed entries produce no invented route.
The title, outcome, route and experimental label come from the installed catalogue.

This is an optional example selector, not a suitability or recommendation/release decision. It
does not override pack evaluation, grading eligibility or experimental status. Surface delta:
zero new controls, one existing card retargeted, one existing View simulation action. Continue
remains the primary action when work exists. Career profiles remain the direction authority.
Tests include technical/nontechnical directions, abbreviation/domain fallback, missing catalogue
entries and experimental copy. The golden path also checks the IT Support test account sees
exactly one incident-simulation link.
This Learning wiring is committed as `9792f82` in the candidate branch.

## Validation completed so far

- Fresh isolated database `identity_test_codex_phase0_20261020`: existing migrations 0000–0071
  applied cleanly. No new migration or development-database schema change.
- Database and web typechecks pass; changed-file lint passes.
- Combined suite at `9792f82`, with database tests enabled: **1,991 passed, 24 skipped**, four workers.
- Focused selector, incident and speech tests: **32 passed**. Speech/provider tests also pass
  with an inherited local-TTS URL after the test-isolation correction (`eb091a5`).
- After `a8c9eb1`: rubric/evaluation/incident checks **39 passed, 1 skipped** (live evaluation),
  including new object-result diagnostics regressions. Detailed explanations cannot make a
  false-pass grader or a grader rejecting all good answers releasable. Changed-file lint passes.
  The earlier full-suite and browser numbers above are the pre-`a8c9eb1` baseline.
- REA observed the signed-in IT Support account's Learning page at 1440×900, with exactly one
  incident-simulation link and no horizontal overflow:
  `ev_36db025d87c613b74f04db40da25348617d6a144b1ea26f22da71f43ce732473`.
  Playwright performed login/disclosure; REA passively captured that viewport. This does not
  constitute a practitioner review or a live grading-model check.
- Browser smoke now checks HTTP status for each supported route. The retired
  `/dashboard/intelligence` route was removed from its valid-route list; the old heading-only
  check could mistakenly accept its 404 heading.
- **Final browser check passes both tests with the normal 90-second budget**, including signup,
  onboarding, all 11 supported routes, the active-direction simulation link and application
  workspace. The golden path completes in 34.7 seconds on the normal Turbopack install. Earlier
  webpack diagnostics exceeded the default budget, then passed with a 180-second diagnostic
  limit; that workaround is not needed for the final run. No production readiness or owner
  approval is implied by a test pass.

Third-party symlinks worked for typechecking/tests but Turbopack refused packages outside its root.
The fallback webpack diagnostic grew to about 7 GB of memory and was stopped after completion.
Generated dependency links were preserved under ignored build output before a normal `npm ci`
installation in this candidate, without changing other worktrees' dependencies. The final browser
run uses normal Turbopack, lockfile Playwright 1.60.0, system Chromium and the isolated
`localhost:3012` origin. The earlier shared installation had Playwright 1.64.1; Next, Vitest and
TypeScript versions match between installs. Repository lockfile and product configuration are
unchanged. All temporary candidate servers are stopped after validation; the isolated test
database is retained for reproduction.

## Coordination: Git and checked-in handoffs

The owner has discontinued October. Do not discover, restore or start its Bus for this workflow.
Coordinate through separate worktrees, commits and these handoffs. A commit or proposal does not
establish the other agent's acceptance; record explicit decisions and the reviewed revision.
The owner has told Claude about the pending contract review.

## Worker slice checklist — proposed, awaiting contract agreement

This is preparation, not implementation or a migration reservation. Existing outbox files remain
the starting point; ADR 0015 is still Proposed.

1. Agree task/consequence state transitions, cancellation, approval waiting and retry ownership.
   Define a semantic dedupe key scoped to tenant/operation/input revision.
2. Specify claim generation and conditional heartbeat, completion and failure updates. An expired
   worker cannot change a newer attempt's state.
3. Agree bounded claim/concurrency rules: leases cannot expire before later batch items start.
   Record attempts and exhaustion after crashes as well as handled failures.
4. Use the same dispatcher for request-time and standalone execution. Define recurring occurrence
   IDs, time zones, rest and catch-up before promising scheduled unattended work.
5. Define tool input/target binding, approval revalidation, cancellation checkpoints and external
   effect reconciliation. Retry a task without blindly repeating its external writes.
6. Define task → attempt/execution → receipt/output references and bounded, redacted errors.
   Sensitive evidence stays in its owning module.
7. Use fake-clock tests and isolated-Postgres race tests for two workers, expiry, stale completion,
   heartbeat loss, cancellation, exhausted crashes and replay. Test approval waits/resumption
   without holding a lease or weakening approval.
8. Reserve 0072 (or the then-next number) only after both agents agree the schema boundary. Verify
   existing consequence topics and producers remain compatible.

Codex owns the proposed worker slice; Claude reviews its contract while owning Situation/onboarding
and Practice. No worker, schema or scheduler change has been made during preparation.

## Next dependency

Codex validates the combined Phase 0 candidate; Claude reviews the incident findings and proposed
contract amendments. Once Claude responds with corrections, rerun the affected Practice and
browser checks. Only the owner can approve promotion to main.
