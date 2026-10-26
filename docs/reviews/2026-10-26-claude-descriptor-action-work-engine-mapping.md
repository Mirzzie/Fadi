# Descriptor action → Practice work-engine / evidence mapping

**Date:** 26 October 2026. **From:** Claude. **For:** Codex's server-action adapter (ADR 0016 §9.3
transport). **Status:** the pure resolver is built + tested (`apps/web/src/lib/capabilities/`); this
doc is the dispatch table the adapter follows. No runtime wiring here — that is the adapter's job,
after Phase 0.

## The two halves of the seam

1. **Static** — `validateEvent(descriptor, event)` (generic): the event names a **declared** action
   and its `expected*Revision`s still match the descriptor. NOT authorization, NOT replay dedupe,
   NOT approval.
2. **Dynamic** — `resolvePracticeAction(instance, descriptor, event)` → a typed `WorkEngineIntent`.
   Pure: no I/O, grants nothing, executes nothing. The adapter dispatches the intent to the existing
   path below, **re-resolving against the authenticated tenant, installed definition, current
   instance/work revision and permissions**, deduping by `(tenant, eventId)`, before any write.

## Dispatch table

| Descriptor action | Intent | Existing path the adapter dispatches to | Result states |
|---|---|---|---|
| `submit_attempt` (fill, primary) | `write_attempt{ activityRef, stepId, inputSchemaRef, payload }` | Practice step-attempt write — the work run-plan step + `rubric.composeAnswer` store the text attempt; a `practice_receipt` is admitted through the **evidence gate** (`lib/evidence`). Not consequential-external → no kernel approval needed. | `completed` · `validation_error` (payload fails `fadi.rubric.answer@1`) · `conflict` (stale revision) |
| `request_marking_check` (record) | `request_marking_check{ activityRef, personStarted:true, providerMetered:true }` | **Person-started, metered** marking — today `practice/grader-check.ts` `checkGrader(userId, ref)`; after Phase 0 the resumable `MARKING_TASK` (`lib/evaluation/marking-task.ts` `requestMarkingCheck`). Reuses the existing work-execution/progress path with cancellation + durable refs. **Never scheduled; no silent AI spend** (`maxAiCallsPerRun: 0` on the refresh/render path). | `accepted-long-work` (execution ref) · `needs-approval` only if a provider-budget confirm applies · `conflict` |
| `open_step` (open) | `navigate{ target: step }` | Read-only navigation to a step (stable deep link). No write. | `completed` (view) |
| `open_resource` (open) | `navigate{ target: resource }` | Read-only navigation to an optional resource (soc only). No completion inferred from viewing. | `completed` (view) |
| any undeclared / unmapped | — | **Refused** by `validateEvent` / resolver; the adapter returns a typed `unavailable`/`conflict` projection and a fresh descriptor. | `conflict` / `unavailable` |

## Invariants the adapter must keep (from Codex `dd4803a`)

- **Kernel-owned approval:** `requiresApproval:false` on `submit_attempt` cannot downgrade policy; any
  consequential step is re-checked at commit through the shared broker. `via:"voice"` is audit only.
- **Evidence integrity:** only the `write_attempt` path produces a career claim, admitted via the
  evidence gate — drafts/view state never become verified facts.
- **Same engine for both careers:** `resolvePracticeAction` has **no profession branch**; the SOC and
  CS instances resolve on the identical paths (tested). Grading/completion are the activity's existing
  rubric behaviour, untouched by presentation.
- **Replay/dedupe is server-side:** `(tenant, eventId)` replay of identical intent returns the
  existing result/execution; same id + changed payload conflicts; concurrent duplicates → one effect.

## What's built vs. what the adapter adds

- **Built (on main after PR #12 + this slice):** the descriptor builder, `validateEvent`,
  `resolvePracticeAction`, the `WorkEngineIntent` union, 27 passing tests.
- **Adapter adds (Codex, post-Phase-0):** the one typed Next server-action that re-resolves + dispatches
  each intent to the existing function, the `(tenant, eventId)` dedupe, permission re-resolution, the
  kernel approval recheck, and the typed result→descriptor projection. No second queue/poller/store.
