# ADR 0015: The Adaptive Career Loop

**Status:** Proposed. Contracts must be reviewed by both Claude and Codex before major
implementation (owner's instruction, 20 Oct 2026).
**Date:** 2026-10-20
**Deciders:** the owner (product), Claude and Codex (contracts)
**Related:**
- ADR 0006 (event bus), ADR 0011 (lab resources and evidence), ADR 0012 (permission broker),
  ADR 0013 (unified work surface), ADR 0014 (practice runtime);
- `docs/architecture/2026-10-20-gap-analysis-and-roadmap.md`;
- `docs/architecture/2026-10-20-acceptance-scenarios.md`.

## Context

On 20 Oct 2026 the owner, Fadi's first real user, asked two general assistants for a career and
permit strategy and a portfolio audit. Those conversations did what Fadi cannot yet do:
- started from the CV;
- asked only the questions that changed the answer (award date or ceremony date; first or
  second Stamp 1G);
- checked current rules from official sources;
- turned constraints into dated deadlines (14 Feb 2027 graduate concession; ~5 Feb 2027 renewal
  window; 30 Apr 2027 permission expiry);
- recommended two career tracks rather than one.

The owner then set the product direction. Fadi must not stop at a plan made during onboarding.
The plan must be a loop:
- a person can hold several plans (A, B, C, and their own) and run small experiments;
- what happens to applications (accepted, rejected, silence, interview feedback) must change the
  *strategy*, not only the next task;
- a rejection must never be read as proof that a path has failed;
- the person's own intuition and changing goals are valid inputs.

Fadi already holds much of the machinery, in narrow forms built for one area each:

| Existing piece | Where | Today it serves |
|---|---|---|
| Outbox with leases, retries and idempotent handlers | `lib/outbox/*`, `outbox_events` | Learning completion, application changes, interview completion |
| Deterministic policy, grants that expire, audit of every attempt | `lib/lab/policy.ts`, `lib/lab/broker.ts`, `lab_grants`, `lab_actions` | The local lab |
| Tool annotations (read-only, external, write) | `lib/mcp/catalog.ts` | External MCP clients |
| Evidence strength, never upgraded by a model | `practice_receipts.strength`, `project_steps.completion` | Practice steps |
| Versioned facts and sources | `career_record_versions`, `career_source_versions` | CV and career record |
| Latest observation with freshness decided on read | `lab_observations` | Lab requirements |
| Work kernel: goal, plan, step; execution receipts with risk and approval | `work_items`, `work_executions`, `work_outputs` | Today, applying |
| An outcome proposes one practice task | `lib/work/outcome-learning.ts` | Rejections, interviews |
| Rejections are correlated, not independent | `lib/applications/channel.ts` | Application analytics |
| A tested AI judgement before trusting it | `rubric-eval`, `practice_grader_checks` | Marking written work |
| Momentum with a resting state | `momentum_states`, `resilience_events` | Application cadence |

What's missing:
- a model of the person's **situation** (constraints, with provenance);
- **research** that reads, dates and cites sources;
- a **strategy portfolio** (several plans with assumptions and triggers);
- a **career event ledger**;
- **feedback intelligence**: patterns, with evidence kept separate from hypotheses;
- an **adaptive decision** step;
- **mailbox ingestion**;
- a **worker process** that runs without a page being open.

## Decision

### 1. The Adaptive Career Loop is Fadi's operating principle

```
Understand → Research → Plan → Act → Observe → Learn → Adapt ─┐
     ▲                                                          │
     └──────────────────────────────────────────────────────────┘
```

| Stage | Owning module | Reads | Writes |
|---|---|---|---|
| Understand | Situation (new) and Career record (exists) | CV, conversation, corrections | `situation_facts` |
| Research | Research (new, on SearXNG, which exists) | Situation, questions | `research_runs`, `research_sources`, `research_claims` |
| Plan | Strategy portfolio (new, extends `work_items`) | Situation, verified claims, events | `strategies`, `strategy_revisions` |
| Act | Execution engines (exist: Opportunities, Documents, Practice, Portfolio, Interview, Network) | Active strategies | Their own records, plus `career_events` |
| Observe | Event ledger (new); mail ingestion (new, later) | Outbox topics, pasted or forwarded mail, the person | `career_events` |
| Learn | Feedback intelligence (new) | Events, applications, channel analysis | `feedback_findings` |
| Adapt | Adaptive decision (new) | Findings, strategies, situation | `strategy_reviews` (a proposal); a revision when the person accepts |

This follows the owner's reference diagrams:

| Diagram box | Lives in |
|---|---|
| The Person (history, aspirations, constraints, preferences, intuition) | Situation and Career record |
| Career Strategy Engine (Plan A/B/C, experiments, contingencies) | Strategy portfolio |
| Execution Engines (applications, networking, learning, practice, portfolio) | The existing engines |
| External signals (emails, recruiters, job market, regulations) | Event ledger and Research |
| Human feedback (interviews, reflections, new ideas, changing goals) | Event ledger |
| Feedback & Learning Engine | Feedback intelligence |
| Replanning & Decision Engine | Adaptive decision |
| Loop back to Career Strategy | A strategy revision |

The four parts of the "Career Feedback & Adaptation Engine" (event ledger, strategy portfolio,
feedback intelligence, adaptive decision engine) are the last four rows of the stage table.

**Principle (added to Fadi's philosophy):** the person owns the destination; Fadi helps navigate
the changing routes. A failed plan is information, not a failed person.

### 2. Seven rules every contract obeys

1. **One strength scale for every claim Fadi holds**, extended from the Practice model rather than
   invented:
   - `verified`: checked against the authoritative system or source (a lab probe, an official
     rule page read today);
   - `observed`: Fadi saw it directly but didn't verify it (an email, a model's rubric review, a
     job posting);
   - `stated`: the person said it;
   - `inferred`: Fadi derived or guessed it (a hypothesis, a computed estimate).

   A model never raises strength. Existing values map without migration: `attested` → `stated`;
   `evidenced` → `stated` plus an artifact; Practice `observed` and `verified` are unchanged.
2. **The person is the authority on themselves, not on the world.** Their goals, preferences and
   intuitions are `stated` and decisive for planning. Their account of a rule ("I think the
   threshold is €32k") is `stated` and is checked by research before a deadline or eligibility
   depends on it.
3. **Facts are appended, never overwritten.** Every contract carries `supersedes`. Corrections and
   expiry keep history, so Fadi can later explain why an old recommendation was made.
4. **Consequential records change only on sufficient evidence.** An `inferred` or low-confidence
   result can propose, never write: application outcomes, deadlines, strategy status, anything
   published or sent. The test is the AI-judgement gate (contract 8).
5. **Untrusted content is data, not instructions.** Web pages, job descriptions, emails and READMEs
   are wrapped and labelled when given to a model, as rubric review already does, and nothing in
   them can call a tool.
6. **Replace, don't add (UI).** The loop surfaces through Today, My Career and existing threads. It
   adds no parallel dashboard.
7. **Reuse before inventing.** Every new table either extends an existing one or explains in this ADR
   why it can't.

### 3. No overreaction, by construction

- **Reviews start from rules, not from a model's mood.** The triggers are in §5, contract 7.
- **There's an evidence threshold.** A strategy review that concludes "change direction" needs:
  - a minimum number of *suitable* applications, judged on seniority, sponsorship fit and how
    well each was tailored;
  - time for replies to arrive;
  - an allowance for correlated screening (`channel.ts`).

  Below the threshold, the only available decisions are `continue`, `adjust_tactics` or
  `ask_person`.
- **Silence is never a rejection.** `ghosted` is a time-derived status shown as "no reply yet";
  it never counts as an explicit rejection.
- **Every review shows its working:** evidence counts by strength, factors considered, what is
  unknown, and the cost of switching (how much completed work transfers to the alternative).

### 4. Continuity without pressure

- No streaks, guilt or penalties. `momentum_states` stays, but its decay must never be shown as
  failure, and `resting_until` must be honoured by every proactive surface.
- A strategy can be paused or retired. Retired strategies and finished experiments stay in history.
- An experiment ending early is a valid result, not a failure.
- When the best next step is rest, reflection, networking or asking a real professional, Fadi says
  so.

## 5. Contracts

TypeScript shapes are normative; table names are proposals. *Owner* is the module that writes the
record; everyone else reads through that module.

### Contract 1: Situation fact

```ts
type Strength = "verified" | "observed" | "stated" | "inferred";

type SituationDomain =
  | "right_to_work"     // citizenship, current permission, its expiry and conditions
  | "qualification"     // level, field, award date, awarding body
  | "experience"        // derived from the career record; never re-entered
  | "location"          // where they live, where they'd move, a driving licence
  | "time"              // hours a week, fixed commitments
  | "finance"           // runway in months; optional and sensitive
  | "preference"        // likes, dislikes, sectors to avoid
  | "aspiration";       // long-term goals in the person's own words

interface SituationFact {
  id: string;
  userId: string;
  domain: SituationDomain;
  predicate: string;          // namespaced: "permission.ie.stamp1g.expires_on"
  value: unknown;             // validated per predicate (registry in lib/situation/predicates.ts)
  strength: Strength;
  source:
    | { kind: "person"; utteranceRef?: string }
    | { kind: "document"; sourceVersionId: string }    // career_source_versions
    | { kind: "research"; claimId: string }             // contract 2
    | { kind: "derived"; fromFactIds: string[]; rule: string };
  validFrom?: string;         // when it became true
  validUntil?: string;        // when it stops being true (an expiry is a fact with an end)
  observedAt: string;         // when Fadi learned it; never confused with validFrom
  sensitive: boolean;         // finance, nationality: shown with why-asked, excluded from model context by default
  supersedes?: string;
  status: "active" | "superseded" | "withdrawn";
}
```

- **Owner:** `lib/situation` (new).
- **Reuse:** `career_record_versions` stays the authority for experience and education *items*.
  Situation facts about experience are `derived` references to those, never copies. The append
  pattern follows `career_record_versions`; freshness is decided on read, as `lab_observations`
  does.
- **Deletion:** the person can withdraw any fact. Sensitive facts are deleted, not just withdrawn,
  when asked (ADR 0007).

### Contract 2: Research evidence

```ts
interface ResearchRun {
  id: string; userId: string | null;      // null = shared rule research (not personal)
  question: string;                        // "Critical Skills salary threshold, recent graduate, 2026"
  plan: string[];                          // the sub-questions searched
  status: "running" | "done" | "partial" | "failed";
  startedAt: string; finishedAt?: string;
  taskId: string;                          // contract 3
}

interface ResearchSource {
  id: string;
  canonicalUrl: string;
  publisher: string;
  authority: "official" | "primary_data" | "reputable_secondary" | "other";
  retrievedAt: string;                     // when Fadi fetched it
  publishedAt?: string; effectiveFrom?: string; effectiveUntil?: string;   // from the page; never assumed
  contentHash: string;                     // same page, same hash: re-reads are comparable
  snapshotRef: string;                     // stored text; quotes must come from it
}

interface ResearchClaim {
  id: string; runId: string;
  subject: string; predicate: string; value: unknown;   // same predicate registry as contract 1
  quote: string;                           // exact text from the snapshot (as rubric quotes are checked)
  sourceId: string;
  strength: Strength;                      // official and quote-checked → "verified"; otherwise "observed"
  conflictsWith?: string[];                // disagreement is kept, never resolved silently
  freshForDays: number;                    // per predicate: permit rules 30, salaries 90, …
}
```

- **Owner:** `lib/research` (exists, with `recent.ts`; extended).
- **Reuse:** SearXNG search (`lib/jobs/web-search.ts`, `lib/research/recent.ts`); the link checks
  and official-site ranking in `lib/lab/plan-research.ts`; the quote check from `rubric.ts`.
- **Rule:** a claim becomes `verified` only when its source is `official` and its quote is found in
  the stored snapshot. A model's summary is never a claim.

### Contract 3: Agent task (durable execution)

The outbox is the queue. This contract **extends** `outbox_events` and `work_executions`; it does
not add a job framework.

```ts
// outbox_events gains: kind ("consequence" | "task"), leaseOwner, heartbeatAt, maxAttempts,
// result (jsonb), parentTaskId. Existing topics keep working unchanged.
type TaskTopic =
  | "research.run" | "strategy.review" | "feedback.analyse"
  | "mail.sync" | "practice.grader_check" | "situation.refresh";

interface AgentTask<T extends TaskTopic = TaskTopic> {
  id: string; userId: string; topic: T;
  dedupeKey: string;                 // names the fact, not the attempt (as today)
  status: "pending" | "running" | "needs_approval" | "done" | "failed" | "cancelled" | "expired";
  attempts: number; maxAttempts: number;
  availableAt: string; lockedUntil?: string; heartbeatAt?: string;
  result?: unknown; lastError?: string;
  executionId?: string;              // work_executions row: the receipt the person sees
}
```

- **Owner:** `lib/outbox` (exists).
- **New process:** `apps/web/scripts/worker.ts` runs the existing `worker.ts` loop on a timer,
  claiming with `FOR UPDATE SKIP LOCKED`; it can run on the Proxmox box. Request-time kicks stay as
  a fallback.
- **Rule:** handlers stay idempotent; any long work (research, marking checks, lab rehearsal) moves
  off web requests.

### Contract 4: Tool and approval

One registry, one gate, three entry points (web, worker, MCP/A2A/Buddy).

```ts
interface ToolSpec<I, O> {
  name: string;                      // "research.read_page", "strategy.propose_revision", "github.create_pr"
  input: ZodSchema<I>; output: ZodSchema<O>;
  annotations: McpToolAnnotations;   // reused from lib/mcp
  risk: "read" | "personal_read" | "draft" | "external_write" | "irreversible";
  blast: Blast; reversibility: Reversibility;    // reused from lib/lab/policy
  approval: "none" | "standing_grant" | "each_time";
  limits: { perHour?: number; timeoutMs: number };
}
// Every call goes through: policyFor({ blast, reversibility }) → grant check (lab_grants pattern,
// generalised from resources to capabilities) → execute → work_executions receipt (risk, approvalId).
```

- **Owner:** `lib/tools` (new, a thin registry) over `lib/lab/policy.ts` and `broker.ts` (extended).
- **Rule:** MCP exposes the registry externally but is not the security boundary; the gate runs
  for internal callers too. An approval is bound to the *exact* proposed action (its parameters'
  hash), as `lab_action_requests` already binds a recipe and its parameters.

### Contract 5: Strategy portfolio (Plan A/B/C, experiments)

Extends `work_items` (`kind: goal | plan | step`) with a strategy level, rather than creating a
separate planning product.

```ts
interface Strategy {
  id: string; userId: string;
  label: string;                         // "Plan A: Ireland, Cloud & Infrastructure"
  origin: "fadi" | "person";             // a person's plan is first-class
  status: "active" | "parallel" | "prepared" | "paused" | "retired";
  careerProfileId?: string;              // an existing track, where one fits
  aspirationFactIds: string[];           // the long-term goal it serves (contract 1)
  assumptions: Assumption[];
  activation?: Condition[];              // e.g. no Irish permit route by 2027-03-01 → activate Plan C
  checkpoints: { at: string; question: string }[];
  workItemId: string;                    // its plan and steps live in work_items
  supersedes?: string;
}

interface Assumption {
  id: string; text: string;              // "Junior cloud-support roles sponsor Critical Skills permits"
  basis: { factIds: string[]; claimIds: string[] };
  strength: Strength;
  status: "holding" | "weakened" | "broken" | "untested";
}

type Condition =
  | { kind: "date_reached"; date: string }
  | { kind: "fact_changes"; predicate: string }
  | { kind: "finding"; findingKind: string; minStrength: Strength }
  | { kind: "person_asks" };

interface Experiment {                    // a person's hunch, given limits
  id: string; strategyId: string;
  hypothesis: string;                    // "IAM roles respond better to my MSc than cloud roles"
  origin: "fadi" | "person";
  evidenceToCollect: string[];
  budget: { weeks: number; applications?: number; hoursPerWeek?: number };
  stopWhen: string[];
  reviewOn: string;
  outcome?: "supported" | "not_supported" | "inconclusive" | "stopped_by_person";
}

interface StrategyRevision {             // append-only history
  id: string; strategyId: string; at: string;
  change: "created" | "status" | "assumption" | "activation" | "experiment" | "retired";
  before: unknown; after: unknown;
  reviewId?: string;                     // contract 7
  decidedBy: "person" | "person_accepted_fadi";   // Fadi never revises a strategy alone
}
```

- **Owner:** `lib/strategy` (new) over `lib/work` (exists, extended). Existing `work/plans.ts`
  templates stay the shape of *steps*; strategies sit above them.

### Contract 6: Career event ledger

```ts
type CareerEventType =
  | "application.submitted" | "application.acknowledged" | "application.assessment_invited"
  | "application.screen_invited" | "application.interview_invited" | "application.rejected"
  | "application.offer" | "application.withdrawn"
  | "interview.feedback" | "recruiter.contact"
  | "skill.evidenced"                          // a practice receipt or evidence item
  | "situation.changed" | "strategy.preference_stated" | "experiment.result"
  | "market.signal_verified";

interface CareerEvent {
  id: string; userId: string;
  type: CareerEventType;
  occurredAt: string; recordedAt: string;
  source:
    | { kind: "person" }
    | { kind: "mail"; messageRef: string; provider: "gmail" | "graph" | "forwarded" | "pasted" }
    | { kind: "system"; table: string; id: string }   // e.g. applications, practice_receipts
    | { kind: "research"; claimId: string };
  strength: Strength;
  confidence?: number;                  // classifier confidence, bounded by contract 8
  subject?: { applicationId?: string; strategyIds?: string[] };
  payload: unknown;                     // schema per type; never raw mail bodies
  supersedes?: string;                  // a correction is a new event
}
```

- **Owner:** `lib/career-events` (new).
- **Reuse:**
  - application status remains on `applications`, but is now *derived* from events (it keeps
    `outcome` and `rejection_stage` as projections);
  - `resilience_events` is migrated into, or projected from, the ledger. One ledger, not two
    (open question 2);
  - the outbox topics `application.outcome` and `interview.completed` produce ledger events.

**Mail ingestion** (later milestone):

```
provider adapter (Gmail OAuth / Graph Mail.Read / forward / paste)
  → relevance and privacy filter
  → application event extractor
  → match to an application
  → ledger
```

- Opt-in, read-only, revocable.
- Raw bodies are kept briefly and only extracted events persist.
- Self-hosted instances use each person's own OAuth client. A central app would need provider
  verification.
- **Forwarding and pasting come first:** they give the whole loop with no integration.

### Contract 7: Feedback findings and strategy reviews

```ts
interface FeedbackFinding {             // what Fadi learned; aggregates, never verdicts
  id: string; userId: string;
  kind: "response_rate" | "stage_dropoff" | "reported_gap" | "assumption_tested" | "external_change";
  scope: { strategyId?: string; experimentId?: string; segment?: string };   // segment: "junior cloud support, Dublin"
  evidence: { eventIds: string[]; claimIds: string[]; counts: Record<string, number> };
  strength: Strength;                   // reported feedback is "stated"; counts are "observed"
  hypotheses: string[];                 // possible explanations, labelled as such
  unknowns: string[];
}

interface StrategyReview {
  id: string; userId: string;
  trigger:
    | { kind: "scheduled"; horizon: "weekly" | "milestone" }
    | { kind: "event"; eventId: string }          // interview, offer, urgent deadline, correction
    | { kind: "condition"; strategyId: string }   // an activation condition fired
    | { kind: "person" };
  findingIds: string[];
  decision: "continue" | "adjust_tactics" | "run_experiment" | "activate_fallback" | "pause" | "ask_person";
  rationale: string;                    // shows its working: factors, counts by strength, switching cost
  proposedRevisions: Omit<StrategyRevision, "id" | "decidedBy">[];
  personResponse?: "accepted" | "modified" | "declined";
  respondedAt?: string;
}
```

- **Owner:** `lib/feedback` (new; absorbs `work/outcome-learning.ts`, whose one-task proposal
  becomes one kind of `adjust_tactics`).
- **Triggers:**
  - *Immediate:* interview, offer, urgent deadline, correction. These update records and surface
    the next action; no strategy change.
  - *Weekly:* outcomes, finished practice, reflections. Tactics only.
  - *Milestone or monthly, or an activation condition:* Plan A/B/C may be re-weighed.
- **Rule:** `activate_fallback` requires the evidence threshold in §3. Below it, the decision is
  limited to `continue`, `adjust_tactics` or `ask_person`.

### Contract 8: AI-judgement gate (evaluation first)

Generalises `rubric-eval` and `practice_grader_checks` to every model judgement.

```ts
interface JudgementSpec {
  id: "mail.classify" | "mail.match_application" | "research.extract_claim"
    | "strategy.review" | "rubric.mark" | "action.autonomous";
  version: string;
  risk: "low" | "medium" | "high";
  evalSet: string;                       // fixture id: known-answer cases, including adversarial ones
  passRule: { maxFalseConsequential: 0; minAccuracy: number; repeats: number };
  belowConfidence: "propose_only";       // never writes a consequential record
}
// judgement_checks (generalised practice_grader_checks): userId, provider, model, judgementId,
// version, passed, report. A judgement runs on a model only if its latest check passed.
```

| Judgement | Risk | Pass bar (proposal) | When it fails |
|---|---|---|---|
| `mail.classify` (rejection, interview, offer, other) | high: changes outcomes | 0 false rejections or offers; ≥ 95% on the eval set; 3 runs | Event stored as `observed` and proposed to the person |
| `mail.match_application` | high | 0 wrong matches above threshold; unmatched is allowed | The person picks the application |
| `research.extract_claim` | high for deadlines and eligibility | quote found in the snapshot; 0 wrong dates on the eval set | Claim stays `observed`; no deadline computed |
| `strategy.review` | medium | Follows §3 on every threshold case; never `activate_fallback` below it | Review limited to `ask_person` |
| `rubric.mark` | medium | Existing rubric-eval rule | Exists |
| `action.autonomous` | per tool | Tool gate (contract 4) and its own eval | Approval each time |

- **Owner:** `lib/evaluation` (new), extracted from `lib/practice/rubric-eval.ts` and
  `grader-check.ts`.

## Data ownership

| Record | Owner module | Writes | Reads | Proposed implementer |
|---|---|---|---|---|
| `situation_facts` | `lib/situation` | Onboarding, conversation, research (derived) | Planner, research, context builder | Claude |
| `research_runs`, `research_sources`, `research_claims` | `lib/research` | Worker | Situation, strategy, Today | Codex (fetch and store); Claude (claim rules, eval) |
| `outbox_events` (extended) | `lib/outbox` | Every producer | Worker | Codex |
| Tool registry and gate | `lib/tools` over `lib/lab/policy` | n/a (code) | Every caller | Codex |
| `strategies`, `experiments`, `strategy_revisions` | `lib/strategy` | The person; review acceptance | Today, My Career, feedback | Claude |
| `career_events` | `lib/career-events` | Applications, Practice, Interview, mail, the person | Feedback, applications projection | Codex |
| `feedback_findings`, `strategy_reviews` | `lib/feedback` | Worker | Today, strategy | Claude |
| `judgement_checks` | `lib/evaluation` | The person's check; worker | Every judgement call | Claude |
| Onboarding UI, Today, My Career surfaces | `components/os`, `work` | n/a | n/a | Codex (shell); Claude (onboarding conversation logic) |

Nobody changes another module's tables without that module's owner agreeing (CLAUDE.md, AGENTS.md).

## Consequences

**Good:**
- One loop, extended from working parts.
- Every recommendation can be traced to dated facts and sources.
- Plans survive bad weeks without silently switching.
- The same contracts serve web, worker, Buddy and MCP.

**Costs:**
- About eight new tables (situation 1, research 3, strategy 3, events 1, findings 1, reviews 1,
  checks generalised).
- A worker process to operate.
- An evaluation fixture to maintain per judgement.

**Risks:**
- Model quality. A 4B local model can't mark fairly, so it can't run reviews or research
  extraction.
- Mail-provider policies.
- Scope creep before the owner's 30 Nov milestone. The roadmap limits the first slice
  accordingly.

## Alternatives considered

- **Agent-runtime rewrite (Option B).** Rejected for now. Contracts 3 and 4 are the seam that makes
  it possible later.
- **A vector store as memory.** Rejected as the source of truth. Retrieval can be added when measured
  quality justifies it.
- **Microservices or new workspaces per engine.** Rejected. Modules inside `apps/web/src/lib`, and
  extraction to `packages/` only when a boundary has stopped changing.
- **Hosted research APIs.** Rejected: against local-and-free, and they hide how a fact was found.

## Open questions for Codex

1. **Outbox as task queue:** extend `outbox_events` (proposed) or add a sibling `agent_tasks`
   table sharing the worker?
2. **`resilience_events` and `momentum_states`:** migrate into the event ledger, or keep them as a
   projection?
3. **Strategy above `work_items`:** a new `kind: "strategy"` row, or a separate table referenced by
   `work_items.parent_id`?
4. **Tool registry location:** `lib/tools` over the lab policy (proposed), or generalise
   `lib/lab/broker.ts` in place?
5. **Ownership:** does the proposed split above work, especially research fetching (Codex) and
   claim rules (Claude)?
