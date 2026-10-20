# Adaptive Career Loop: gap analysis and roadmap

**Date:** 20 Oct 2026
**Companion to:** ADR 0015 (contracts) and `2026-10-20-acceptance-scenarios.md` (tests)
**Status:** proposal. Nothing below starts until both Claude and Codex have reviewed ADR 0015.

## 1. Gap analysis

**Legend:**
- **Reused:** used as it is.
- **Extended:** the existing code grows; there's no parallel version.
- **New:** nothing comparable exists.

Every "new" row says why nothing existing fits.

### Understand

| Capability | Status | Existing basis | Change |
|---|---|---|---|
| Career history as the source of truth | Reused | `evidence_items`, `career_record_versions`, `career_source_versions`, `lib/career/*`, `lib/identity/admit.ts` | None. Situation facts *reference* it. |
| Onboarding conversation | Extended | `app/onboarding/chat-actions.ts` (5 fields), the scripted form | CV first, then only the deciding questions. It writes situation facts and replaces the five-field chat. |
| Situation facts (right to work, dates, education, time, money, preferences, aspirations) | **New** | None. `career_profiles` has role, location and level; `profiles.job_preferences` has search settings | `situation_facts` (contract 1), using the versioning pattern of `career_record_versions` and the read-time freshness of `lab_observations` |
| Context assembly for model calls | Extended | `lib/agent/runtime-contract.ts` (bounded envelope), `career_context_snapshots` | Adds situation facts, permission-filtered (sensitive ones excluded by default) |

### Research

| Capability | Status | Existing basis | Change |
|---|---|---|---|
| Web search | Reused | SearXNG via `lib/jobs/web-search.ts`, `lib/research/recent.ts` | None |
| Official-source ranking and link checks | Extended | `lib/lab/plan-research.ts` | Generalised beyond lab planning |
| Labour and world signals | Reused | `lib/labor-market/bls.ts` (US), GDELT, `lib/intelligence/world-shifts.ts` | Ireland and EU sources are added as `primary_data` |
| Page reading, snapshots, dates, quotes, conflicts | **New** | Nothing stores sources or claims | `research_runs`, `research_sources`, `research_claims` (contract 2). The quote check reuses the logic in `rubric.ts`. |

### Plan

| Capability | Status | Existing basis | Change |
|---|---|---|---|
| Goal, plan and step structure | Extended | `work_items` (`kind: goal \| plan \| step`), `lib/work/plans.ts` templates | Strategies sit above plans |
| Career tracks | Extended | `career_profiles` (several per person, one active) | A strategy can point at a track; tracks stop being the only notion of direction |
| Plan A/B/C, person-originated plans, experiments, assumptions, activation conditions, revisions | **New** | Nothing holds alternatives with conditions or history | `strategies`, `experiments`, `strategy_revisions` (contract 5) |
| Deadlines computed from facts | **New** | `applications.deadline_at` is per application only | A derived situation fact (`source.kind: "derived"`, with the rule) |
| Today shows the plan's next step | Extended | `lib/work/today.ts` (goal, next, what Fadi did, decisions) | "What am I trying to achieve" reads the active strategies |

### Act

| Capability | Status | Existing basis | Change |
|---|---|---|---|
| Opportunities, applications, documents, Practice, interview, network, portfolio | Reused | Their engines | Each also emits career events (through the outbox) |
| Tool registry | Extended | `lib/mcp/catalog.ts` annotations | Internal registry; MCP becomes one way to reach it (contract 4) |
| Permission gate, grants, audit | Extended | `lib/lab/policy.ts`, `lib/lab/broker.ts`, `lab_grants`, `lab_actions`, `lab_action_requests` | Generalised from lab resources to every tool capability |
| Execution receipts | Reused | `work_executions` (risk, approval, receipt) | Every tool call writes one |
| Portfolio changes as pull requests | **New** | `lib/portfolio/github.ts` publishes by replacing the whole repo | A `github.create_pr` tool against a source repo. Publishing stays behind `each_time` approval. |

### Observe

| Capability | Status | Existing basis | Change |
|---|---|---|---|
| Durable consequences | Extended | `outbox_events` and `lib/outbox/worker.ts` (lease, retry, idempotent) | Task kind, heartbeat, result, max attempts (contract 3) |
| Worker process | **New** | The worker runs only on request-time kicks and Today loads | `scripts/worker.ts` on a timer (Proxmox-capable). The kicks remain as a fallback. |
| Career event ledger | **New** | `resilience_events` (momentum deltas), application `outcome` fields, outbox topics | `career_events` (contract 6). Application status becomes a projection; `resilience_events` folds in (open question 2). |
| Mail: paste and forward | **New** | None | Paste or forward a message, classified by the judgement gate |
| Mail: Gmail and Outlook read-only | **New** | `lib/email/send.ts` only *sends* | Provider adapters, after paste and forward work (milestone M7) |

### Learn

| Capability | Status | Existing basis | Change |
|---|---|---|---|
| Outcome proposes practice | Extended | `lib/work/outcome-learning.ts` | Becomes one kind of `adjust_tactics` inside a strategy review |
| Correlated-rejection awareness | Reused | `lib/applications/channel.ts` | An input to feedback findings |
| Coherence (the data agrees with itself) | Reused | `lib/agents/coherence.ts` | Also checks situation facts against the career record |
| Findings separate from hypotheses, gaps people report | **New** | `agent_findings` holds market findings only | `feedback_findings` (contract 7) |

### Adapt

| Capability | Status | Existing basis | Change |
|---|---|---|---|
| Background pass | Extended | `lib/agents/background.ts` (findings, digest) | Schedules strategy reviews through the worker |
| Strategy review with thresholds and switching cost | **New** | Nothing reviews a direction | `strategy_reviews` (contract 7) |
| Continuity without pressure | Extended | `momentum_states.resting_until`, "score the process" principle | Every proactive surface honours resting; momentum decay is never shown as failure |
| Action guardian | Reused | `lib/guardian/*` | Also warns when an action contradicts the active strategy, gently |

### Cross-cutting

| Capability | Status | Existing basis | Change |
|---|---|---|---|
| One strength scale | Extended | Practice `observed`/`verified`; steps `attested`/`evidenced`/`verified` | `verified \| observed \| stated \| inferred` everywhere (ADR §2.1) |
| AI-judgement gate | Extended | `rubric-eval`, `practice_grader_checks` | `lib/evaluation` with `judgement_checks` (contract 8) |
| Untrusted content handling | Extended | The rubric's untrusted block, `containsRubricGaming` | Shared wrapper for pages, mail and READMEs |
| Provider routing | Extended | `lib/ai/registry.ts`, `DocGenerate.identity` | A judgement runs only on a model that passed its check |

**Count:**
- 9 capabilities reused;
- 21 extended;
- 13 new;
- about 8 new tables.

## 2. Roadmap

The order is set by dependency, not by size. The first complete slice is aimed at the owner's 30 Nov milestone, so it deliberately leaves out mail integration and the full worker.

```mermaid
flowchart LR
  M0["M0 Sync<br/>integration branch"] --> M1["M1 Contracts<br/>ADR 0015 agreed"]
  M1 --> M2["M2 Foundations<br/>strength scale · judgement gate · task kind"]
  M1 --> M3["M3 Situation<br/>facts + onboarding"]
  M2 --> M4["M4 Research v1<br/>sources · claims · quotes"]
  M3 --> M4
  M2 --> M5["M5 Ledger + strategies<br/>events · Plan A/B/C · experiments"]
  M3 --> M5
  M4 --> M6["M6 First slice<br/>feedback → review → revision"]
  M5 --> M6
  M6 --> M7["M7 Mail<br/>paste/forward → Gmail/Graph"]
  M6 --> M8["M8 Worker process<br/>scheduled reviews · research refresh"]
  M7 --> M9["M9 Close the loop<br/>CV · portfolio PRs · practice · targeting"]
  M8 --> M9
```

| Milestone | Depends on | Delivers | Exit criterion | Proposed owner |
|---|---|---|---|---|
| **M0 Sync** | n/a | `integration/2026-10-20` (facelift and Practice merged) | Suite, migrations from empty, and the browser golden path all pass. **Owner approves before it becomes main.** | Claude prepared; owner approves |
| **M1 Contracts** | M0 | ADR 0015 accepted, with open questions answered | Codex and Claude both sign the contracts; a schema test per contract exists (failing until built) | Both |
| **M2 Foundations** | M1 | Strength-scale mapping; `lib/evaluation` extracted from rubric-eval; outbox `kind: task` | Existing tests unchanged; rubric checks run through `lib/evaluation` | Claude (evaluation); Codex (outbox) |
| **M3 Situation** | M1 | `situation_facts`; predicate registry; onboarding that discovers constraints | Scenario A step 1: the owner's CV and answers give the expected facts and strengths; the five-field chat is gone | Claude (logic); Codex (onboarding UI) |
| **M4 Research v1** | M2, M3 | Fetch, snapshot, extract, quote-check, date, conflict, cite. Ireland permit routes first. | Scenario A step 2 and Scenario C pass the research judgement check; no deadline from an unverified claim | Codex (fetch and store); Claude (claim rules and eval set) |
| **M5 Ledger and strategies** | M2, M3 | `career_events` fed by applications, Practice and interviews; `strategies`, `experiments`, `strategy_revisions` | Scenario A step 3: Plans A, B, C and a person-originated plan stored with assumptions and conditions | Codex (ledger); Claude (strategies) |
| **M6 First slice** (target 30 Nov) | M4, M5 | Paste a rejection or feedback → classified → ledger → findings → strategy review → the person accepts or declines → revision → Today | Scenarios A (steps 4–6) and B pass end to end; the overreaction cases hold | Both; Claude leads review logic |
| **M7 Mail** | M6 | Paste and forward first, then Gmail (each person's own OAuth client) and Outlook (Graph `Mail.Read`) | Scenario D passes; the mail judgement checks pass; disconnect deletes the token and raw messages | Codex |
| **M8 Worker process** | M6 | `scripts/worker.ts`, lease, heartbeat, stale recovery; scheduled reviews and research refresh | A task survives a restart with no duplicate writes; reviews run with no page open | Codex |
| **M9 Close the loop** | M7, M8 | Outcomes feed CV changes (claim-evidence gate), portfolio pull requests, Practice packs and targeting | A rejection with feedback leads to a practice exercise, then new evidence, then a CV proposal, each step traceable | Both |

### What runs alongside (no dependency on the above)

- **Claude:** the three incident Practice packs (suspicious sign-ins, Linux outage, access
  failure). They produce the owner's proof now, and they become `skill.evidenced` events once
  M5 lands.
- **Codex:** finish the facelift and commit the 12 uncommitted files in `codex-my-career`
  before the next integration.
- **Owner:**
  - run the marking check on the Groq model (no model has passed it yet);
  - review this ADR.

### Deliberately postponed

- Specialist agent fleets.
- Microservices.
- A knowledge-graph database.
- Vector memory as a source of truth.
- Hosted research APIs.
- Autonomous submission of job applications. That stays `each_time` approval indefinitely.
