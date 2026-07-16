# 0006 — In-process domain event bus as the extension seam

- **Status:** Accepted
- **Date:** 2026-07-14
- **Supersedes:** nothing. Makes `EVENT_DRIVEN_ARCHITECTURE.md` real (it was aspirational — no bus existed).

## Context

FadiOS's thesis is that one career record drives every output (résumé, portfolio,
interview prep). Delivering that requires features to react to each other. Before
this ADR they did it by **importing each other**, which produced measurable rot:

- `lib/ai` imported **15 other domains** — the AI layer knew every feature. That
  inverts the dependency rule: high-level policy depended on low-level detail.
- A real **import cycle**: `lib/ai/tools/registry.ts → lib/evidence` while
  `lib/evidence/pool.ts → lib/ai`. Violates the Acyclic Dependency Principle.
- **21 `await import()`** calls across `lib/` — lazy imports used to break those
  cycles at runtime. Load-bearing duct tape, not a style choice.
- Consequence: every new capability was **shotgun surgery** across existing
  features, and each edit risked breaking an unrelated one.

## Decision

Introduce a typed, in-process domain event bus (`lib/events`).

- Publishers state **facts** (past tense: `evidence.changed`), never commands.
- Events carry **ids, not objects**, so subscribers re-read current state and
  cannot act on a stale snapshot.
- Publishers never import subscribers. Composition happens at the edge
  (`instrumentation.ts` → `lib/events/register.ts`).
- An addon = `lib/<feature>/subscribers.ts` + **one line** in `register.ts`.

### Why in-process (and awaited) rather than a queue

Next server actions are request-scoped: work started but not awaited can be
killed when the request ends. `publish` awaits subscribers so their effects
(revalidation, derived writes) land before the action returns. `publish` is also
the seam we would repoint at a real queue later — callers would not change.

### Why subscriber failures are isolated

A publisher reports something that **already happened**. A broken listener must
never fail the user's write. `publish` settles all handlers and logs failures
instead of throwing. Without this, adding an addon could break saving evidence —
precisely the coupling being removed.

## Consequences

**Positive**
- New features subscribe instead of being wired in; no core edits.
- Removes the reason for the ai↔evidence cycle and the dynamic-import workaround.
- The AIO seam is now **testable**: `lib/events/propagation.test.ts` fails CI if a
  refactor silently severs cross-feature propagation.

**Negative / accepted trade-offs**
- In-process only: no retries, no durability, no cross-instance delivery. Work
  that must survive a crash needs a queue behind the same `publish` API.
- Handlers run concurrently and must be order-independent. If two effects need
  ordering, that is one subscriber with two steps.
- `register.ts` is explicit, not auto-scanned. Deliberate: greppable wiring and
  obvious load order beat filesystem magic.

## Follow-ups (not in this ADR)

1. Migrate `lib/ai`'s inbound feature imports to registration, then delete the
   dynamic-import workarounds and assert acyclicity in CI.
2. Build the detect → **propose** → user-approves loop on this seam (see
   `AI_SAFETY_AND_APPROVAL_SYSTEM.md`). The bus only reports facts; it must never
   silently rewrite a user's résumé or public site.
3. Make the résumé projection read `evidence_items` so it subscribes here too —
   currently it is generated from raw text and does not share the source of truth.
