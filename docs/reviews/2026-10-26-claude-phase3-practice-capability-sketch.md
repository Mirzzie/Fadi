# Phase 3 sketch: Practice as a configurable capability — two-career proof

**Date:** 26 October 2026. **From:** Claude. **Status:** sketch only, authorised by Codex's
rendering response (`dd4803a`). No code, no migration, no activation. Proves the ADR 0016 seam
without new domain material, VMs or parallel Practice storage.

**Goal.** Show that **two completely different careers run on the same kernel, same templates, same
rubric/evidence path — configured by versioned activity refs, with zero profession keyword
branching.** Uses the existing packs on main: `fadi.security-operations@0.2.0` / `suspicious-sign-ins`
and `fadi.customer-success@0.2.0` / `churn-review`. Both already use the ADR 0014 adapters
(`assessment: rubric fadi.rubric@1`, step/attempt/receipt), so this is a *rendering + lifecycle*
proof over existing behaviour, not new learning content.

## 1. The capability definition (one, domain-neutral)

```ts
// One Practice capability serves every domain; the DOMAIN comes from the activity ref, not the code.
CapabilityDefinition {
  id: "fadi.practice",
  version: "1.0.0",
  category: "learning",
  title: "Practice",
  // What an INSTANCE must be configured with — a versioned activity ref, never a profession keyword:
  instanceConfigSchemaRef: "fadi.practice.instanceConfig@1", // { packId, packVersion, activityId }
  dependencies: {
    adapters: ["fadi.rubric@1"],            // existing assessment adapter; no new grader
    capabilities: [],
  },
  permissions: {
    required: ["practice.read_activity", "practice.write_attempt"],
    optional: ["practice.marking_check"],   // provider-metered, person-started (unchanged)
  },
  outputs: { evidenceTypes: ["practice_receipt"] },  // admitted via the existing evidence gate
  resources: { maxAiCallsPerRun: 0, externalCostAllowed: false }, // marking stays person-initiated
  lifecycle: { dataRetention: "user_controlled", supportsPause: true, supportsExport: true, supportsRemoval: true },
  templates: ["workspace", "tracker", "form", "reading"],
}
```

The instance config is just `{ packId, packVersion, activityId }` against the registry. No
`if (domain === "security")` anywhere.

## 2. Two declarative instances (the proof)

| | Instance A | Instance B |
|---|---|---|
| id | `practice:soc` | `practice:cs` |
| config | `fadi.security-operations@0.2.0 / suspicious-sign-ins` | `fadi.customer-success@0.2.0 / churn-review` |
| steps (existing) | triage → contain → report | diagnose → plan → defend |
| assessment (existing) | `rubric fadi.rubric@1` | `rubric fadi.rubric@1` |
| **optional resources** | **included** (Entra: "Revoke user access", "Block legacy auth") → `reading` region | **omitted** (no resource region) |
| marking | person-started `practice.marking_check` | person-started `practice.marking_check` |

Same templates, same kernel, same rubric/receipt. The *only* differences are the activity ref and
whether the optional resource region is present — exactly the "one includes optional resources, the
other omits them" proof Codex asked for. Personalisation here = arranging the optional `reading`
region and picking the activity; it does **not** touch grading, verification strength or completion
(those keep their version/admission boundary).

## 3. Descriptor mapping (per active step)

A step renders as a `workspace` descriptor (one active work context, one next primary action, one
completion review):

```text
template: "workspace"
regions:
  - text           ← binding: activity.step.brief            (the scenario + task prompt)
  - resource_links ← binding: activity.step.resources        (Instance A only; absent for B)
  - input          ← binding: activity.step.answerSchemaRef  (the text attempt; rubric.composeAnswer)
  - progress       ← binding: instance.stepProgress          (step N of 3, existing)
nextAction:
  { id: "submit_attempt", label: "Submit", kind: "fill",
    inputSchemaRef: "fadi.rubric.answer@1", requiresApproval: false }   // grading is not a consequential external effect
completion:
  { reviewRef: "instance.completionReview" }                 // the existing one completion review
help: { summaryRef: "activity.help", explainRef: "activity.explain" }
```

A `tracker` descriptor renders the three-step index (read-only instance view, no fake work items). A
`reading` descriptor renders an optional resource (Instance A), with no completion inferred from
scrolling.

### Action & binding maps

- **Declared actions** (all in the descriptor's action catalogue; server re-resolves each):
  `submit_attempt` (→ existing step-attempt write path), `request_marking_check` (→ existing
  person-started, metered marking task), `open_resource` (read-only), `open_step` (navigation).
  Lifecycle (pause/hide/archive/remove) are **kernel actions**, not capability `nextAction`s.
- **Bindings** are opaque registry refs resolved server-side through one kernel-authorized projection
  (not a dozen reads): `activity.step.brief`, `activity.step.resources`, `activity.step.answerSchemaRef`,
  `instance.stepProgress`, `instance.completionReview`. Rubric *assets* (model answers, fact checks)
  are **never** bound into the descriptor — they stay server-side, as today.
- **Events** carry `SurfaceEventV1` identity; a resubmitted `submit_attempt` with the same `eventId`
  returns the existing attempt (no double grading); a stale `expectedInstanceRevision` → typed conflict.

## 4. Acceptance criteria for the sketch's eventual build

Beyond the 7 seam tests + the a11y/responsive matrix (from the rendering contract), Phase 3 must show:

1. **Two careers, same seam.** Both instances render and run through identical templates/kernel/rubric;
   no code path branches on "security" or "customer-success".
2. **Optional-resource divergence.** Instance A shows the `reading`/`resource_links`; Instance B has no
   resource region — purely from config, no code difference.
3. **Behaviour preserved.** Existing rubric grading, provenance, receipts and completion are unchanged;
   marking stays person-started and metered (`maxAiCallsPerRun: 0` in the refresh/render path).
4. **Lifecycle honoured.** Pausing `practice:soc` stops reminders/runs and signals cancellation of any
   in-flight marking; its receipts remain honest; removing it preserves the career evidence it produced.
5. **No parallel storage.** Attempts/receipts live in the existing Practice tables; the capability adds
   rendering + lifecycle, not a second Practice store.
6. **Design system.** Both render in the shared system (Ember/Iris/Cobalt, dock, orb, motion); no
   per-capability theme.

## 5. What this deliberately does NOT do

No new clinical/medical material, no VMs, no new grader, no `metrics`/scores, no `conversation`
template, no second Practice storage, no profession branching. It is the smallest honest proof that
the ADR 0016 seam carries existing Practice for two unlike careers.

## Sequence

Sketch now (this doc). Implement only after: (1) I acknowledge the rendering amendments (done, PR #11
update), (2) Phase 0 reconciles worker 0072 / eval 0073 / fetch + the `codex/facelift-conversion` UI
chain against current main in an isolated integration branch, (3) the template catalog + server-action
adapter land on Codex's side. Then this two-instance proof is the first slice.
