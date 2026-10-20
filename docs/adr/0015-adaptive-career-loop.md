# ADR 0015: The Adaptive Career Loop

**Status:** Proposed, revision 2. Revision 1 (8d0c841) was reviewed by Codex on 20 Oct 2026
(`docs/reviews/2026-10-20-codex-to-claude-adr-0015-contract-review.md`). This revision takes in
every correction; Claude's point-by-point response is
`docs/reviews/2026-10-20-claude-to-codex-adr-0015-revision-2.md`. Claude accepts the four boundaries
in that handoff; Codex's sign-off and clarifications are in §7. Owner product approval is still
separate. No major implementation has started and no migration number is reserved.
**Date:** 2026-10-20
**Deciders:** the owner (product), Claude and Codex (contracts)
**Related:**
- ADRs 0006 (event bus), 0007 (retention and erasure), 0011 (lab resources and evidence),
  0012 (permission broker), 0013 (work surface), 0014 (practice runtime);
- `docs/architecture/2026-10-20-gap-analysis-and-roadmap.md`;
- `docs/architecture/2026-10-20-acceptance-scenarios.md`.

## Revision 2 changes (from Codex's review)

| Area | Revision 1 | Revision 2 |
|---|---|---|
| Evidence | One global `verified/observed/stated/inferred` ranking | Native scales kept as they are. A lossless `EvidenceRef` for reading across them. Personal authority kept separate from evidence (§2.1). |
| Research claims | An official source plus a found quote made a claim `verified` | Extraction check, applicability, authority, freshness and conflicts are separate fields. Conflicts block only the decisions that depend on them (§5.2). |
| Derived deadlines | `derived` referenced facts only | References exact claim versions, rule version, inputs and time zone. The result is a *conditional calculated deadline* (a boundary plus a planning target), never a verified entitlement (§5.1). |
| Worker | Worker process at M8; tasks referred to one execution | Minimal standalone worker in M2, with fencing tokens, attempt history, cancellation and recurring-occurrence keys. Reuses `/api/agent/run` (§5.3). |
| Research ownership | Shared rule research with `userId: null` | Tenant-owned in v1. One writer: the research module. Model output is a candidate; deterministic admission persists (§5.2). |
| Tools | Lab `Blast` reused; five-value risk union | A facade with the lab broker as an adapter. Typed target scope and data sensitivity. Explicit mapping onto `work_executions.risk` (§5.4). |
| Strategies | A `kind` inside `work_items` or a parent-id link | A separate domain with one authoritative typed link. The one-active-goal invariant is kept. Today's selection rule is defined (§5.5). |
| Events | One ledger, loosely specified | Tenant idempotency, correction links, effective and recorded time, payload versions, ordering rules. Mail *candidates* stay separate from admitted events. Momentum preferences preserved (§5.6). |
| Reviews | Threshold in prose; experiments unclear | A typed `DecisionPolicy`. The person can change plan at any time. Experiments need no threshold. Acceptance is checked against a base revision (§5.7). |
| Judgement checks | Bound to provider and model | Bound to judgement and suite version, prompt and schema versions, fixture digest, pipeline version and settings, with expiry. Never grants permission. Already done per activity in Practice (§5.8). |
| Split | Layers of features split across agents | Complete module ownership (§6), as Codex proposed. |
| Table count | "About eight" | Ten domain tables plus two support tables, listed in §6. |

## Context

On 20 Oct 2026 the owner, Fadi's first real user, worked out a career and permit strategy with
general assistants. Those conversations started from the CV, asked only the deciding questions,
checked current rules against official sources, and turned constraints into dated plans. Fadi
cannot do this: onboarding collects five fields; web research serves job discovery and lab
planning; nothing models visa, deadlines, time, money or preferences; and no plan adapts to
outcomes.

The owner set the direction:
- the **Adaptive Career Loop** (Understand → Research → Plan → Act → Observe → Learn → Adapt);
- several plans, including the person's own, and bounded experiments;
- feedback, including from mail, that changes *strategy*, not just the next task;
- no overreaction to rejection counts;
- continuity without pressure.

Most of the machinery exists in narrow forms (gap analysis, §1): the outbox worker, lab policy
and broker, MCP annotations, Practice receipts, versioned career facts, work items, outcome
learning, and rubric evaluation.

## 1. The loop

| Stage | Owning module | Writes |
|---|---|---|
| Understand | Situation (new) and Career record (exists) | `situation_facts` |
| Research | Research (extends `lib/research`) | `research_runs`, `research_sources`, `research_claims` |
| Plan | Strategy (new) linked to Work (exists) | `strategies`, `strategy_assumptions`, `experiments`, `strategy_revisions` |
| Act | Existing engines | Their own records, plus canonical events through the event module |
| Observe | Career events (new); mail candidates (new, later) | `career_events`, `mail_candidates` |
| Learn | Feedback (new; absorbs `work/outcome-learning.ts`) | `feedback_findings` |
| Adapt | Feedback, as reviews | `strategy_reviews`; a revision only when the person accepts |

The person owns the destination; Fadi helps navigate the changing routes. A failed plan is
information, not a failed person.

## 2. Rules every contract obeys

### 2.1 Evidence keeps its native meaning

There is no single global truth ranking. Persisted scales stay exactly as they are:

- `practice_receipts.strength`: `self_reported | recorded | observed | verified`, with observer
  and assessment versions.
- `project_steps.completion`: `attested | evidenced | verified`.

For reading across them, one lossless reference:

```ts
interface EvidenceRef {
  scale: "practice_receipt" | "step_completion" | "situation" | "research" | "career_event";
  value: string;                 // the native value, never rewritten (e.g. "recorded")
  method: string;                // how it was established: "rubric_review", "lab_probe", "person_said", "quote_extracted", …
  source: { table: string; id: string; version?: number };
  artifacts: string[];           // output references, unchanged
}
```

- **Personal authority is separate.** A person's goals, preferences and choices are authoritative
  for planning *as choices*. They are not a strength on an evidence scale.
- **Model-derived claims carry provenance.** They record what they were derived from, by which
  model and prompt version, rather than taking a place in a confidence order.

### 2.2 Checking an extraction is not checking the claim

An exact quote found on an official page shows that **the extraction matches that snapshot**. It
doesn't show that the claim applies to this person's route, year, category or working hours, or
that it's legally correct. These are separate fields (contract 2).

### 2.3 Append-only, with deletion

- Every record has `supersedes`. Corrections append.
- Sensitive content can still be deleted: the row becomes a tombstone that keeps its identity and
  references, and drops the content (ADR 0007).
- Deleting or correcting a fact marks the findings, snapshots, derived facts and stored model
  context that depended on it as stale.

### 2.4 Candidates and admission

- **A model proposes, deterministic admission decides.** Anything a model produces (an extracted
  claim, a mail classification, a strategy review) is a *candidate*. A deterministic admission
  step validates it and decides whether a consequential record changes.
- **An evaluation pass is not permission.** It allows a judgement call to be made; per-result
  validation and tool authorisation still run on every result.
- **Ambiguous subjects wait for the person.**

### 2.5 Untrusted content is data

Web pages, mail and repository content stay untrusted even from official sources. They are
wrapped and labelled for models, they can't call tools, and the injection guard applies.

### 2.6 Replace, don't add

The loop surfaces through Today, My Career and existing threads; there's no parallel dashboard.

### 2.7 Reuse before inventing

Every new table extends an existing one or says here why it can't.

## 3. No overreaction, as a typed policy

```ts
interface DecisionPolicy {
  version: string;
  /** Only applications meeting these count towards a strategy-level conclusion. */
  suitability: { maxSeniorityGap: number; requiresSponsorshipFit: boolean; minTailoring: number };
  minSuitableApplications: number;      // per segment
  followUpWindowDays: number;           // silence shorter than this is "no reply yet"
  correlation: "channel_diversity_heuristic";   // channel.ts: a diversity hint, not an independence estimate
  missingEvidence: "ask_person";        // unknowns are surfaced, never assumed
}
```

**What it governs:**
- **Fadi's own `activate_fallback` proposals.** Below the policy's thresholds, Fadi proposes
  only `continue`, `adjust_tactics`, `run_experiment` or `ask_person`.
- **Silence:** it is never a rejection.
- **Urgency:** urgent deadlines trigger records and next actions, not strategy switches.

**What it never limits:**
- **The person.** They can change, pause or activate a plan at any time, with no application
  quota. Fadi shows the switching cost and records the change.
- **Experiments.** They need no threshold. They are bounded tests, whether the person proposes
  them or Fadi does.

## 4. Continuity without pressure

- `momentum_states` holds user-owned cadence and rest preferences. Those are kept as settings;
  only the momentum *display* is recalculated from canonical events.
- `resting_until` is honoured by every proactive surface and every scheduled task.
- There are no streaks or penalties. A paused or retired strategy keeps its history.

## 5. Contracts

TypeScript shapes are normative; table names are proposals. Every interface below carries `id`,
`userId`, `createdAt` and `supersedes?`, which are omitted to save space. Uniqueness is always
scoped to the tenant.

### Contract 1: Situation fact

```ts
interface SituationFact {
  domain: "right_to_work" | "qualification" | "experience" | "location" | "time" | "finance" | "preference" | "aspiration";
  predicate: string;              // registry: lib/situation/predicates.ts; unknown predicates rejected at admission
  predicateVersion: number;
  value: unknown;                 // validated by the predicate's schema
  authority: "person_choice" | "person_statement" | "document" | "derived";
  evidence?: EvidenceRef;         // for statements backed by a document or a check
  derivation?: {                  // required when authority = "derived"
    rule: { id: string; version: string };
    inputs: { factId: string; factVersion: number }[];
    claims: { claimId: string; claimVersion: number }[];
    timeZone: string;             // e.g. "Europe/Dublin"
    convention: string;           // e.g. "calendar months, end inclusive"
  };
  validFrom?: string; validUntil?: string;
  observedAt: string;
  sensitive: boolean;
  status: "active" | "superseded" | "withdrawn" | "tombstoned";
}

/** A calculated deadline is conditional: it states the rule's boundary and a safer target. */
interface CalculatedDeadline {
  boundary: string;               // what the rule gives (e.g. award date + 12 months)
  planningTarget: string;         // the conservative date the plan works to
  conditional: true;              // never a verified individual entitlement
  dependsOn: SituationFact["derivation"];
}
```

- A **possible** second Stamp 1G period is a separate fact from the current permission and its
  actual expiry.
- **Owner:** `lib/situation` (Claude), including the onboarding conversation and its UI.

### Contract 2: Research evidence (tenant-owned in v1)

```ts
interface ResearchRun { userId: string; question: string; plan: string[]; status: "running" | "done" | "partial" | "failed"; taskId: string }

interface ResearchSource {
  userId: string;                 // no globally shared cache in v1
  canonicalUrl: string; publisher: string;
  authority: "official" | "primary_data" | "reputable_secondary" | "other";
  retrievedAt: string;            // when fetched; never confused with:
  publishedAt?: string; effectiveFrom?: string; effectiveUntil?: string;
  contentHash: string; snapshotRef: string; contentType: string;
}

/** What a model may hand to admission. It writes nothing. */
interface ExtractedClaimCandidate {
  runId: string; sourceId: string;
  predicate: string; value: unknown;
  quote: string;                  // with enough context to keep its units and qualifiers
  scope: { route?: string; year?: string; category?: string; hours?: string };
  extractor: { model: string; promptVersion: string };
}

interface AdmissionResult {       // deterministic; the research module is the only writer
  admitted: boolean;
  claimId?: string;
  checks: { quoteLocated: { offset: number } | null; unitsPreserved: boolean; scopeStated: boolean; predicateKnown: boolean };
  reasons: string[];
}

interface ResearchClaim {
  runId: string; sourceId: string; predicate: string; value: unknown; quote: string; quoteOffset: number;
  extraction: "quote_located";    // what was checked: the snapshot says this
  applicability: { scope: ExtractedClaimCandidate["scope"]; status: "matches_person" | "unclear" | "does_not_match" };
  freshness: { checkedAt: string; freshForDays: number };
  conflictsWith: string[];        // kept visible; never resolved by picking one
  blocks: string[];               // the decision kinds a conflict blocks (e.g. "salary_eligibility"); others proceed
}
```

**Fetching rules:**
- http(s) only;
- no private, link-local or loopback addresses, checked after every redirect;
- bounded redirects, response size and decompression;
- timeouts;
- an allow-list of content types;
- snapshots stored as fetched.

**Owner:** `lib/research`. Codex owns fetching, snapshots, persistence and deterministic
admission. Claude owns the candidate semantics, predicates and evaluation fixtures. The
`ExtractedClaimCandidate → AdmissionResult` API is jointly reviewed and versioned.

### Contract 3: Durable task (extends the outbox)

```ts
// outbox_events gains: kind ("consequence" | "task"), fence (integer generation), leaseOwner,
// heartbeatAt, maxAttempts, cancelRequestedAt, terminal result. Consequences keep working unchanged.
interface TaskAttempt {           // new: task_attempts. One row per attempt, never overwritten.
  taskId: string; attempt: number; fence: number;
  startedAt: string; endedAt?: string;
  outcome?: "done" | "failed" | "cancelled" | "lease_lost";
  workExecutionId?: string;       // the receipt the person sees (one per attempt)
  externalEffects: { key: string; target: string; status: "intended" | "confirmed" | "reconciled" }[];
  error?: string;                 // redacted
}
type TaskStatus = "pending" | "running" | "needs_approval" | "done" | "failed" | "cancelled" | "expired";
```

**Rules:**
- **Fencing:** a claim increments `fence`. Every heartbeat, result and completion is conditional
  on `(id, fence)`. A worker whose lease lapsed can't commit.
- **Leases:** they are per item and renewed by heartbeat, replacing today's 60-second batch
  lease, in which a slow first item leaves later items expired.
- **External effects** carry an idempotency key, are recorded as `intended` before the call, and
  are reconciled after a crash. The fence can't undo an API call.
- **Approval:** waiting for approval releases the lease. Resuming rechecks the approval, the
  owner and the current policy.
- **Dedupe keys** are `tenant + operation + semantic input/revision`.
- **Recurring tasks:**
  - each has an occurrence key (`userId:taskKind:2026-10-27` in the person's time zone);
  - missed occurrences catch up once, not once per missed slot;
  - `resting_until` suppresses discretionary occurrences.
- **Entry points:** the standalone worker (`scripts/worker.ts`), `/api/agent/run` (an existing
  authenticated scheduler) and request-time kicks all run the *same* loop.
- **Quota-heavy tasks:** a worker never authorises provider-heavy evaluations by itself.
  Marking checks stay person-initiated.

**Owner:** `lib/outbox` (Codex).

### Contract 4: Tool and approval (a facade)

```ts
interface ToolSpec<I, O> {
  name: string; version: string;
  input: ZodSchema<I>; output: ZodSchema<O>;
  annotations: McpToolAnnotations;
  target: { kind: "self" | "account" | "repository" | "recipient" | "environment"; resolver: string };
  dataSensitivity: "none" | "personal" | "private_mail" | "credentials";
  effect: "read" | "draft" | "write" | "external" | "irreversible";
  approval: "none" | "standing_grant" | "each_time";
  limits: { perHour?: number; timeoutMs: number };
}
// Mapped onto work_executions.risk (read | write | external):
//   read→read, draft→write, write→write, external→external, irreversible→external,
// with dataSensitivity and the irreversible flag kept on the receipt. No new risk values are
// written until that column is migrated deliberately.
interface ApprovalBinding {
  userId: string; principal: string; tool: string; toolVersion: string;
  target: string; inputsHash: string;   // server-resolved inputs, not client-supplied
  proposalRevision: number; expiresAt: string;
}
```

**Rules:**
- **Revalidation:** on execution, the inputs are re-resolved and re-hashed. If the meaning
  changed, the approval is stale and is refused.
- **Lab adapter:** the lab broker keeps its recipe and resource model as an adapter behind the
  facade, reusing its owner, run and target checks. Research and mail tools don't invent lab
  resources.

**Owner:** `lib/tools` (Codex).

### Contract 5: Strategy portfolio

```ts
interface Strategy {
  label: string; origin: "fadi" | "person";
  status: "active" | "parallel" | "prepared" | "paused" | "retired";
  revision: number;
  planWorkItemId: string;         // THE authoritative link: a work_items row of kind "plan", same user (checked)
  careerProfileId?: string;
  aspirationFactIds: string[];
  activation: Condition[];
  checkpoints: { at: string; question: string }[];
}
interface StrategyAssumption { strategyId: string; text: string; basis: EvidenceRef[]; status: "holding" | "weakened" | "broken" | "untested" }
interface Experiment { strategyId: string; hypothesis: string; origin: "fadi" | "person"; evidenceToCollect: string[]; budget: { weeks: number; applications?: number; hoursPerWeek?: number }; stopWhen: string[]; reviewOn: string; outcome?: "supported" | "not_supported" | "inconclusive" | "stopped_by_person" }
interface StrategyRevision { strategyId: string; baseRevision: number; change: string; before: unknown; after: unknown; reviewId?: string; decidedBy: "person" | "person_accepted_fadi" }
type Condition = { kind: "date_reached"; date: string } | { kind: "fact_changes"; predicate: string } | { kind: "finding"; findingKind: string } | { kind: "person_asks" };
```

**Rules:**
- **Hierarchy:**
  - `work_items.parent_id` stays a work-item id;
  - the one-active-goal invariant is kept, and the active goal contains one plan per
    non-retired strategy;
  - `work-items.repository.ts` and `work/today.ts` are updated *in the same slice*, so plans
    under the goal stay visible.
- **Today's next action:**
  - the earliest-due open step of an `active` strategy;
  - else of a `parallel` one;
  - ties broken by the person's priority;
  - `paused` and `prepared` strategies schedule nothing discretionary.
- **One writer per status:**
  - the strategy module writes strategy status;
  - the work module writes step status.
- **Revisions** are accepted transactionally against `baseRevision`. A stale acceptance (facts,
  assumptions or the revision changed) fails safely and asks again.

**Owner:** `lib/strategy` (Claude).

### Contract 6: Career events (canonical) and mail candidates

```ts
interface CareerEvent {
  type: CareerEventType;          // covers today's rest, cadence, referral, reflection and comeback behaviour first
  payloadVersion: number; payload: unknown;   // schema per type and version; never raw mail
  effectiveAt: string;            // when it happened
  recordedAt: string;             // when Fadi learned it
  idempotencyKey: string;         // unique per (userId, idempotencyKey)
  source: { kind: "person" | "system" | "mail_candidate" | "research"; ref: string };
  evidence?: EvidenceRef;
  corrects?: string;              // a correction is a new event linked to the one it corrects
  subject?: { applicationId?: string; strategyIds?: string[] };
}
interface MailCandidate {         // separate; never authoritative
  messageRef: string; provider: "pasted" | "forwarded" | "gmail" | "graph";
  proposedType: CareerEventType | "other"; proposedSubject?: string;
  classifier: { judgement: string; version: string };
  status: "pending_confirmation" | "admitted" | "rejected"; admittedEventId?: string;
  rawExpiresAt: string;           // raw text kept briefly, then deleted
}
```

**Rules:**
- **Transactional:** an application change and its canonical event are written in one
  transaction; the outbox delivers the consequences.
- **Projections:**
  - application status is projected from events ordered by `effectiveAt`, then `recordedAt`,
    so an old rejection recorded late can't overwrite a newer offer;
  - corrections replay through the same projection path;
  - every projection keeps a revision number.
- **Migration from `resilience_events`:** it stays temporarily as a compatibility projection with
  a unique canonical-event reference. It is never a second authority. Backfill with origin ids
  and dedupe, compare old and new projections, then switch writers once.

**Owner:** `lib/career-events` (Codex). Mail candidates and classification are in M6 (pasted);
provider adapters come later, separately assigned.

### Contract 7: Findings and reviews

The `FeedbackFinding` and `StrategyReview` shapes and trigger rules from revision 1
(`8d0c841`, contract 7) remain the baseline, with these replacements taking precedence.
The obsolete global `Strength` field and its ranking are removed, not inherited:
- `FeedbackFinding.evidence` is `EvidenceRef[]`;
- `StrategyReview` records the `DecisionPolicy` version it applied, and the `baseRevision` of
  each strategy it proposes to change;
- a review proposal is a candidate (§2.4);
- the person's response is admitted transactionally (contract 5).

**Owner:** `lib/feedback` (Claude).

### Contract 8: AI-judgement checks

```ts
interface JudgementCheck {
  userId: string; provider: string; model: string;
  judgement: string; judgementVersion: string;     // e.g. "rubric.mark:suspicious-sign-ins", "1"
  promptVersion: string; schemaVersion: string;
  fixtureDigest: string;                           // hash of the evaluation set actually run
  pipelineVersion: string;                         // code path: guard, quote matching, admission
  settings: { temperature: number; maxTokens: number };
  passed: boolean; report: unknown; checkedAt: string; expiresAt: string;
}
```

**Rules:**
- **Invalidation:** a change to any bound field invalidates the check.
- **No call versus propose-only:** with no passing check, there is *no judgement call* for
  consequential paths (as Practice does today). A judgement may be marked `propose_only` instead,
  in which case its output can only be offered to the person.
- **Evaluation coverage supports a decision; it never replaces** per-result admission or tool
  authorisation.
- **Status in Practice:** it already binds checks per activity, as of `1b2aad5`
  (`churn-review@3`, `suspicious-sign-ins@1`). It doesn't yet bind fixture digest, prompt or
  pipeline versions; that is part of generalising it into `lib/evaluation`.

**Owner:** `lib/evaluation` (Claude).

## 6. Ownership and tables

| Owner | Complete boundary | Reviewer |
|---|---|---|
| Claude | Situation predicates, admission, onboarding conversation **and its UI**; evaluation contracts and fixtures | Codex |
| Codex | Research fetching, snapshots, claim persistence and deterministic admission; tool and task seam | Claude |
| Claude | Strategies, assumptions, experiments, findings, reviews and their acceptance | Codex |
| Codex | Canonical events, projections, mail candidates (pasted) and the narrow Today / My Career integration | Claude |
| Later, separately assigned | Provider mail adapters; portfolio source-repo PR workflow | Both |

**New tables:**
- **Ten domain tables:** `situation_facts`, `research_runs`, `research_sources`,
  `research_claims`, `strategies`, `strategy_assumptions`, `experiments`, `strategy_revisions`,
  `career_events`, `feedback_findings`.
- **Two support tables:** `task_attempts`, `mail_candidates`.
- **Also:** `strategy_reviews` and a generalised `judgement_checks` (extending
  `practice_grader_checks`).

Migration numbers are reserved per agreed slice. 0072 is next, and is unreserved until then.

## 7. To agree before sign-off (both)

1. **Evidence admission:** `ExtractedClaimCandidate → AdmissionResult` (contract 2) and the
   general candidate rule (§2.4).
2. **Task recovery:** fencing, attempts, external-effect reconciliation, occurrence keys
   (contract 3).
3. **Event ownership:** canonical events, mail candidates, projection order and the
   `resilience_events` migration path (contract 6).
4. **Strategy-to-work:** `planWorkItemId` as the one link, the goal invariant, and Today's
   selection rule (contract 5).

### Codex sign-off — 20 October 2026

Reviewed Claude's revision 2 at `37f342a` and handoff/review at `6ecd30e`.
Codex signs all four agreements above:

1. **Agreed:** tenant-owned, versioned candidate → deterministic admission; locating a quote
   never proves applicability. Scenario C is corrected in this review to obey that boundary.
2. **Agreed:** per-item leases, fenced attempts, external-effect reconciliation and occurrence
   dedupe through one dispatcher. Conditional writes must also reject an expired lease even
   before another worker reclaims it; fence equality alone is insufficient.
3. **Agreed:** one canonical event writer; separate mail candidates; deterministic projection
   replay and a deduplicated compatibility migration, preserving rest and cadence settings.
4. **Agreed:** one same-tenant `planWorkItemId`, the existing active-goal invariant and the
   stated Today selection, updated together. Prepared/paused plans cannot leak discretionary
   work through the fallback selector.

The ownership split in §6 is accepted. This is contract-direction approval, not permission to
promote to main or a claim of implementation. The implementation PRs must provide runtime
schemas (including tenant/version checks and typed predicate values), explicit transition
tables, deterministic event tie-breaks and testable invalidation rules before schema reservation.
Migration 0072 remains unreserved. Contract 7's retained shapes are pinned above so the removed
global strength scale cannot return through an ambiguous reference. Claude's explicit acceptance
is recorded in the revision-2 handoff; Codex does not sign on Claude's behalf. Owner product
approval and promotion remain separate.

## Consequences, risks and alternatives

**Consequences:**
- One loop, extended from working parts.
- Recommendations traceable to dated, scoped claims.
- Durable work from the first slice.

**Costs:**
- The tables above.
- A worker process to operate.
- Evaluation fixtures to maintain per judgement.

**Risks:**
- Model quality. A 4B local model failed the marking check; Groq `gpt-oss-120b` passed it after
  the quote-matching fix.
- Mail-provider policies.
- Scope before the owner's 30 Nov milestone.

**Rejected alternatives:**
- an agent-runtime rewrite;
- vector memory as the source of truth;
- microservices;
- hosted research APIs;
- a shared global research cache in v1.
