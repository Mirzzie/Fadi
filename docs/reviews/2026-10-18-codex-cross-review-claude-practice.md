# Codex cross-review: Claude's first document work simulation

**Date:** 18 October 2026  
**Reviewed commit:** `126f487`  
**Integration branch:** `integration/gate2-gate3`

## Verdict

Accept the slice as an **experimental, URL-accessible simulation**. Its architecture follows the
direction we agreed: one Practice Pack contract, the existing learning commitment and project-run
kernel, deterministic case facts, immutable attempts, conservative evidence strength, and the
existing finish-to-career flow. It does not create another learning system.

Do not list or recommend this activity as released yet. The pack correctly reports itself as
experimental and not recommendable because it has not completed review and rehearsal.

## Correctness repair made during integration

`startPracticeActivity` previously used a read-before-write sequence and created the learning
commitment separately from the run. Two browser tabs could both see no running copy and create two
commitments and two runs. A run insert failure could also leave a commitment with nothing to run.

The start now:

1. opens one database transaction;
2. takes a transaction-scoped PostgreSQL advisory lock for the owner, pack and activity;
3. checks for an existing running copy while holding that lock;
4. inserts the commitment, run and steps in that transaction.

The project-run repository now exposes a transaction-aware insert helper so cross-domain workflows
can compose this write without nesting a second transaction. Its existing public method retains the
same behaviour.

The real-PostgreSQL journey now races two starts and asserts there is exactly one running run and
one committed learning commitment. This test fails against the reviewed implementation.

## What the design gets right

- Case truth is computed from a per-run seed in code. The model does not decide which accounts are
  risky, so a copied answer from another case fails the factual criteria.
- Model-scored writing quality needs a quote that actually appears in the person's submission.
  Unsupported praise is downgraded to `not yet`.
- Every attempt is retained, and a failed attempt leads to revision rather than false completion.
- AI review creates `observed` evidence. It never upgrades itself to `verified`.
- The worked example is withheld until the step passes.
- The UI keeps one primary action for each state and removes machine controls from document work.

## Follow-up hardening completed on 19 October

- Submission creation now requires an active run and the current earliest pending step. Direct
  repository calls can no longer submit future steps or add attempts to abandoned runs.
- A provider failure no longer consumes another attempt: an identical saved answer without a
  receipt is reviewed again under the same immutable submission id. An already-reviewed duplicate
  is refused.
- Common rubric-injection and planted-quote instructions fail closed before model scoring. The
  prompt also marks the learner response as untrusted data. This is a guardrail, not a substitute
  for the broader adversarial evaluation required for release.
- Runs with practice submissions cannot be hard-deleted. They may still be abandoned, preserving
  the receipt's source text and ownership boundary.
- The final passed review and worked example remain visible beside the finish action.
- Learning now links to the simulation in a clearly labelled experimental section, so it can be
  tested without pretending that it is released or practitioner-reviewed.

## Remaining release gates

### P0 — Broader adversarial rubric evaluation

The deterministic injection guard covers the known direct attacks, but it is intentionally narrow.
Run a versioned adversarial evaluation set for indirect prompt injection, obfuscation, fake quotes,
irrelevant fluent prose and conflicting instructions. Until it passes, keep the activity
experimental and keep model-reviewed claims at `observed`.

### P1 — Replace the decoy keyword heuristic

The seasonal false-alarm criterion can be satisfied through keywords without demonstrating the
reasoning. Make the account choice structured, then assess the explanation separately. This gives
the deterministic checker an exact answer while leaving communication quality to the rubric.

### P1 — Complete the learner controls

Add the progressive hint ladder and a deliberate restart flow that creates a new seeded attempt.
The oral-defence stage should use the shared live interview session once that session meets its
listening, interruption and provenance contract.

## Validation

- Changed-file ESLint: clean.
- Full monorepo typecheck: clean.
- Pure and real-PostgreSQL focused checks: 64 passed across seven files, including simultaneous
  start, revision, ownership, closed/out-of-order/abandoned-step enforcement, provider retry and
  provenance-preserving deletion refusal.
- Full web suite: 1,760 passed, 196 skipped.
- `git diff --check`: clean.

The signed-in browser journey remains the last integration check after migration 0069 is applied to
the shared development database. Verify Start, failed review, retained draft, revised pass, example
unlock, finish review and career-evidence confirmation before exposing the activity in a catalogue.

