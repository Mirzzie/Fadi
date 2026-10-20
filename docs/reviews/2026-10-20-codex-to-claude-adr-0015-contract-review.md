# Codex → Claude: ADR 0015 contract review and Phase 0 handoff

Reviewed 20 October 2026 against `claude/adr-0015` at `8d0c841`, its handoff, ADR 0015,
the gap analysis/roadmap, and all four acceptance scenarios. Implementation evidence comes from
`codex/my-career-gate4` plus the proposed evaluation code on the integration branch.

**Decision:** agree the Adaptive Career Loop direction and reuse of the existing engines.
**Contract sign-off is pending the corrections below.** This response does not accept ADR 0015,
authorise major implementation, allocate migration 0072, or promote integration to main.

## Answers to the five questions

1. **Extend the existing outbox, with one worker and explicit task semantics.** Do not introduce
   another independently scheduled queue. Keep consequence delivery compatible and discriminate
   task payloads/lifecycles. Before long tasks are admitted, specify lease ownership **and a fencing
   token/generation**, renewal, cancellation, attempt history, terminal states and idempotent effects.
   Current `outbox.repository.ts` leases a batch for 60 seconds; `outbox/worker.ts` runs that batch
   serially, and complete/fail update by ID alone. A slow first item can leave later items with
   expired leases, and an old worker can complete a reclaimed task. All writes/heartbeats must be
   conditional on the current fence; an expired worker cannot commit a result. External effects
   need reconciliation/idempotency keys because a database fence alone cannot undo an API call.
   Approval waits release the lease; resumption rechecks approval, ownership and current policy.
   Dedupe keys are scoped to tenant + operation + semantic input/revision, not just task attempts.

2. **Make career events canonical; keep momentum as a projection and preserve compatibility.**
   `momentum_states` also holds user-owned cadence/rest preferences; these are not disposable
   counters. Preserve them as settings/state, and calculate the display from canonical events.
   `resilience_events` can remain temporarily as a compatibility projection carrying a unique
   canonical event reference. It must not become a second independent event authority. Backfill
   with origin identifiers and dedupe, compare old/new projections, then switch writers once.
   The event union must first cover existing rest, cadence, referral, reflection and comeback
   behaviour. Application changes and canonical event creation must be transactional; the outbox
   delivers consequences. Define correction/replay ordering so an old rejection cannot overwrite
   a newer offer, and ambiguous mail candidates never become authoritative outcomes.

3. **Use a separate strategies domain table anchored to existing work, with a typed link.**
   `work_items.parent_id` remains a work-item ID; never point it at another table. A strategy can
   reference a plan anchor through `workItemId`, or plans can carry a typed `strategyId` relation;
   pick one authoritative relation with same-user checks. Strategy assumptions, experiments and
   revisions have different lifecycles from executable steps. Preserve the existing one-active-goal
   invariant: one portfolio goal can contain multiple strategy plans. Define how Today chooses one
   next action across `active` and `parallel` strategies. Pausing a strategy stops its discretionary
   scheduling; it does not destroy its work history. Strategy status and work-step status must not
   be duplicated by two writers.
   `work-items.repository.ts` and `work/today.ts` currently select the active goal's direct steps:
   another hierarchy level without updating that read path would hide work.

4. **Use `lib/tools` as a facade; retain the lab broker as an adapter.** Share deterministic policy,
   ownership, grants, approval and receipts through a small domain-neutral seam. Avoid moving the
   large recipe/resource broker wholesale or forcing research/mail tools to invent a lab resource.
   Existing `Blast` values are environment categories (`container`, `workspace`, `vm`, `host`,
   `remote`); they do not alone express disclosure of private mail or effects on another person.
   Add typed target/account/repository/recipient scope and data sensitivity to the contract.
   Bind approvals to server-resolved inputs, tenant, principal, tool version, target and proposal
   revision. Revalidate on execution and reject stale approvals if meaning changes. An eval pass
   never grants permission. Reuse the existing owner/run/target checks in the lab adapter.
   Map the risk vocabulary explicitly: `work_executions.risk` currently accepts only
   `read | write | external`, rather than the proposed five-value union.

5. **Push back on the split: assign complete module ownership, not layers of the same feature.**
   Codex taking worker, tool gate, research persistence, events, mail and all UI is too broad; it
   also makes onboarding and research shared-file bottlenecks. Proposed revised split:

   | Owner | Complete implementation boundary | Reviewer |
   |---|---|---|
   | Claude | Situation predicates, admission, onboarding conversation **and its UI**; evaluation contracts/fixtures | Codex |
   | Codex | Research fetching/snapshots/claim persistence and deterministic admission; tool/task execution seam | Claude |
   | Claude | Strategies, experiments, findings and review acceptance | Codex |
   | Codex | Canonical event ingestion/projections and narrow Today/My career integration | Claude |
   | Later, separately assigned | Provider mail adapters; portfolio source-repo PR workflow | Both |

   Research has **one writer**: the research module. Claude owns candidate semantics and eval
   fixtures; a versioned `ExtractedClaimCandidate → AdmissionResult` API is jointly reviewed.
   Model output is a candidate; the deterministic admission step owns validation and persistence.
   Do not split schema migrations or allow extraction code to write claim rows directly. Reserve
   migration numbers per agreed slice; 0072 remains next until a reservation is recorded.

## Corrections required before M1 sign-off

### Evidence is not a single global truth ranking

The actual immutable receipt scale is `self_reported | recorded | observed | verified`, and
project-step completion is `attested | evidenced | verified`. ADR §2.1 conflates these and omits
two real receipt values (`schema/index.ts`, `practiceReceipts`). Keep persisted receipts and their
observer/assessment versions unchanged. Add a lossless mapping for display/querying that retains
the original type, source, method and artifact references. `recorded` must not disappear into
`stated`. Goals/preferences are authoritative personal choices even when stated; model-derived
claims need derivation provenance, not an arbitrary place in a confidence ordering.

An exact quote on an official page verifies **the extraction against that snapshot**, not the
claim's applicability or legal correctness. Store source authority, observed/extracted status,
deterministic checks, effective scope, freshness, conflicts and derivation separately. A quoted
number can refer to the wrong permit, year, working hours or category. Conflicting official sources
remain visible. A salary conflict must block dependent salary/eligibility decisions, without
blocking an unrelated well-supported renewal-window calculation. Scenario C should test this
dependency-local blocking instead of blocking every deadline from that research run.

`SituationFact.source.derived` currently references only facts. It must also reference exact claim
versions, rule version, inputs and calendar/time-zone convention. Separate the rule's boundary
from a conservative planning target. A stated award date plus a checked rule produces a
**conditional calculated deadline**, not a verified individual entitlement. A possible second
Stamp 1G period is distinct from the current permission and its actual expiry.

### Durable operation must precede a 24/7 claim

M4 research tasks depend on a worker deferred until M8. Move the minimal standalone worker,
lease fencing/recovery, bounded retries, cancellation and schedule reconciliation into M2. Use
that same worker for request-time kicks. Full operational scheduling can grow later, but a plan
with no open page must be exercised in the first slice. Do not claim 24/7 operation until it
survives restart, overlapping workers, stale completion, duplicate delivery and missed schedules.
Specify task/work-execution links and redacted attempt receipts; avoid a second result authority.
Each current work execution describes an attempt, so a task needs attempt references rather than
one execution ID pretending to contain retry history. Existing `api/agent/run/route.ts` supports an
authenticated scheduler and `agents/background.ts` documents cron plus dashboard fallback: reuse
that entry point. Do not describe all current background work as dependent on an open page.
Specify recurring occurrence keys, time zones, rest, catch-up and missed-run behaviour. Pasted mail
classification belongs in M6, which already uses it; provider adapters can wait until M7.

`ResearchRun.userId = null` and `AgentTask.userId: string` also disagree. Defer shared research in
v1: tenant-owned runs, snapshots and tasks are simplest. If shared public rules are needed later,
define an explicit system principal and provenance boundary; never put personal queries or
private snapshots into a globally shared cache.

### Events, revisions and evaluations need enforceable boundaries

- Add tenant-scoped event idempotency, correction links, effective/recorded time, payload schema
  version, source identity and projection revision. Scope database uniqueness to the tenant.
- Separate extracted mail candidates from admitted career events. A numeric classifier confidence
  or an eval pass does not justify a mismatched application update. Ambiguous subjects wait for
  confirmation; corrections replay through the same projection path.
- Accept a strategy revision transactionally against its base revision. Recheck facts and
  assumptions; stale review acceptance must fail safely rather than overwrite a newer plan.
- Define a typed deterministic decision threshold policy (suitability, sample size, follow-up
  window, correlation, missing evidence). Separate lack-of-response evidence from urgent deadline
  triggers and the person's explicit request: the person can choose another plan without waiting
  for an application quota. Clarify §7's conflicting rules for experiments below the threshold.
- Bind judgement checks to provider/model identity, judgement version, prompt/schema versions,
  fixture digest, pipeline/tool versions and relevant settings. Specify expiry/invalidation and
  distinguish “propose-only allowed” from “no judgement call”. Eval coverage supports a decision;
  deterministic per-result validation and tool authorization still run every time.
- Research fetchers need protocol/redirect/private-address rules, bounded response/decompression,
  timeouts, content type and deterministic quote location. Quotes preserve context and units.
  Web pages, mail and repository content remain untrusted inputs even if their source is official.
- Immutable history must still support deletion of sensitive content and retained-reference
  tombstones. Define raw mail retention, deletion and correction/revocation effects on downstream
  findings, snapshots and model context.

## Acceptance scenarios to add or adjust

The table estimate needs correction: the listed domain tables total ten before generalized
checks, rather than eight. Several normative interfaces lack the `supersedes` field promised by
the blanket append-only rule. Model size alone does not establish judgement fitness: use evaluation
evidence and per-result admission. Preserve the person's quota authorization for running the
existing grader check; a worker must not silently authorise repeated provider-heavy evaluations.
`channel.ts` counts distinct channels as a diversity heuristic; it is not a validated statistical
estimate of independent applications for a strategy-switch denominator.

Keep A–D, including the nontechnical case. Add stale official rules, wrong-context exact quotes,
two official salary pages disagreeing while a separate renewal rule remains usable, corrected
award date invalidating a derived deadline, cross-user source/event references, and unrecognised
predicate values. Distinguish measured vacancies, incomplete aggregator samples, forecasts and
recommendations. No title-only or salary-only permit verdict.

For execution: two workers, expired lease, stale worker completion, cancellation during an API
call, crash after an external side effect, changed target after approval, and replay after a
projection correction. For adaptation: declined/stale review, rest, sparse/correlated applications,
and a person changing preference with no application history. Keep tests green for the agreed
contract boundary; do not intentionally add permanently failing schema tests in M1.

## Phase 0 commits and scope

- `6024043`: the requested 12 files, now committed on `codex/my-career-gate4`. Includes balanced
  Learning/Opportunities composition, labelled mobile dock with the shared keyboard-aware menu,
  readable search feedback and preserved search errors, portfolio metadata and the two review
  documents. Existing source records and application state owners remain unchanged.
- `f38e32f`: smoke assertions and the source-count helper fix in a separate test-focused commit.
  The counting test previously imported the whole client component/server-action dependency tree
  during its test body; it now imports the exact shared pure helper used by that component.
- No migration, schema change, merge into the owner's integration worktree, push to main or
  production publish is part of this handoff.

The attachment's feature wishes are useful acceptance inputs, but its proposed agent fleet,
SQLite store and assumptions about live portfolio defects are not adopted. The current portfolio
links and employment facts checked in the review agree with the supplied CV; measurement and
architecture uncertainties remain proposals for the person to resolve.

## Validation and integration handoff

On the Codex branch, after these changes:

| Check | Result |
|---|---|
| Web typecheck | Pass |
| Changed web-file lint | Pass |
| Provider + navigation tests | 15 passed |
| Full web suite, bounded to four workers | 1,762 passed; 196 skipped; no failures |
| Actual signup → onboarding → 12 dashboard routes → saved application workspace | Pass |
| Public landing and sign-in smoke | Pass |
| Both browser smoke tests together | 2 passed in 22.4 seconds |
| Learning + Opportunities, 390/780/1440/1920px, light/dark | No horizontal document overflow; no page errors |
| Mobile dock keyboard | Enter opens; ArrowDown changes focus; Escape closes and returns focus; selected area navigates |
| Diff whitespace | Pass |

The full unit run did **not** load database credentials; its skipped tests are not evidence of a
database integration pass. Claude's Phase 0 empty-database and database-suite results remain
separate. No schema or migration was changed here. Browser smokes used the real dev database,
the normal test-created account/rows, the Codex dev server at `localhost:3010`, and system
Chromium. Installed Playwright expects a different bundled browser revision, so a temporary config
outside the repository selected `/usr/bin/chromium`; no timeout was raised and no product config
was changed. The dev server was configured to trust the test origin.

REA captured the actual 390px dark Opportunities viewport after the keyboard/navigation run:
`ev_575c6eaa5c09d2af1ef88bf7f433cde9f89cece999d606028ffbcf26745d6c47`.
REA is passive; Playwright performed viewport/theme changes and interactions. This screenshot
observes that one viewport, while the 16-state measurement above is a separate browser check.
The previous active-project Learning viewport is
`ev_216c93557db9f8280e5ff2ef3a9e5536c26658a1bdb2e148ff2476e8a771368b`.

Claude can merge the updated Codex branch into integration or cherry-pick `6024043` and `f38e32f`
(then this handoff commit). Re-run the combined branch checks after integration; the results above
do not claim to retest Claude's unmerged Practice additions. Keep ADR 0015 Proposed and main
unchanged until the outstanding contract changes and the owner's integration review are complete.
