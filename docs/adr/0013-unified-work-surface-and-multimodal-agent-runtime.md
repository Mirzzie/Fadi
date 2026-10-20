# ADR 0013: Unified work surface and multimodal agent runtime

**Status:** Proposed
**Date:** 2026-10-16

## Context

Fadi has a work kernel, tool routing, approvals, receipts, voice experiments, application
workspaces, interview practice and a lab engine. These capabilities have often arrived as separate
cards, pollers and assistant surfaces. The person must infer their order and relay state between
them. Voice also risks becoming a second agent path with different context, tools and safety rules.

Paperclip demonstrates the value of goal-aligned work, a single human-decision queue and activity
inside the task narrative. Pipecat demonstrates a useful separation between a conversational agent,
a UI worker that receives bounded screen context, and long-running work represented as progress.
Neither product's domain model or interface should be copied wholesale.

## Decision

Fadi will use one work-centered experience and one multimodal session contract.

The durable journey is:

```text
Goal → Plan → Step → Execution → Receipt → Output → Evidence → Projection → Outcome
```

Every substantial workspace projects that journey. Today and the global attention indicator are
additional views of the same work and decision records.

The runtime is divided by responsibility:

1. **Presence and conversation worker** — manages voice/text turn-taking, transcript and Fadi's
   visible state. It does not own work or mutate page state directly.
2. **Screen-context worker** — receives a bounded accessibility snapshot, current route and active
   work references. It returns typed commands from an allowlisted UI command schema. It never sends
   an unrestricted DOM dump to the conversation model.
3. **Task executor** — owns durable plans, tools, long-running operations, cancellation, retries,
   progress, outputs and receipts.
4. **Policy and approval broker** — applies capability risk, scope, target, expiry, reversibility and
   approval rules independently of the initiating modality.

All workers exchange a shared session envelope containing user, route, active goal, work item,
entity references, direction, policy version and correlation identifiers. Voice, text and direct UI
actions resolve to the same capability contracts.

UI mutations are typed and narrow, for example `open_entity`, `focus_field`, `set_draft_value`,
`show_output` and `navigate`. Consequential domain mutations remain executor capabilities and pass
through policy. The current screen is observed through accessibility semantics and server-owned
work context, not treated as the source of career truth.

Long-running operations render as cancellable progress within their work thread. Human decisions
render at the point that blocks work and in the shared attention queue.

## Alternatives considered

### Keep separate chat, voice and page assistants

Rejected because each path can diverge in context, approval and completion behaviour. It also makes
the person the integrator.

### Give one model the entire DOM and broad UI automation

Rejected because it is expensive, difficult to test, vulnerable to untrusted page content and too
permissive for consequential changes.

### Copy Paperclip's company and ticket model

Rejected because Fadi serves one person's career. Agent org charts, budgets and ticket
administration would expose implementation concepts and increase cognitive load.

### Rewrite the whole interface at once

Rejected because the current product contains working domain flows and ongoing changes. Migration
will replace one complete journey at a time using shared primitives, with old controls removed in
the same change.

## Consequences

- Fadi can appear continuously present while work remains durable and inspectable.
- Voice and screen interactions share safety, history and state.
- Accessibility semantics become part of both inclusive UI and agent context.
- The work thread becomes a reusable product primitive across applications, learning, interviews
  and publishing.
- A typed command protocol, shared session envelope and attention projection must be designed and
  versioned.
- Existing local pollers, assistant panels and duplicate status stores must be removed during
  migration.
- Models cannot improvise arbitrary screen mutations; adding a UI command requires an explicit
  contract and tests.

## Verification and review

Before acceptance:

- specify and test the session envelope and typed UI command schema;
- prove voice and buttons resume the same work item after reload;
- prove only the task executor can perform consequential domain mutations;
- prove an approval resolved in one view disappears from every projection;
- test interruption, cancellation, disconnect and stale-screen recovery;
- test accessibility snapshots for secret and untrusted-content redaction;
- run signed-in end-to-end journeys for application, interview and practical lab work;
- review audio retention and Realtime transport in a dedicated security decision.

Revisit this decision if browser accessibility snapshots cannot provide reliable context, or if
workloads require a separate service rather than the modular monolith.
