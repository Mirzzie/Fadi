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

## Gates before this can be called released

### P0 — Preserve assessment sources

`practice_submissions` currently cascade-delete with a project run or step, while receipts refer to
them through `practice_submission:<id>`. Deleting a project can therefore erase the source text and
leave a dangling receipt reference. Before these receipts feed public credentials or portable
records, keep the submitted work and assessment snapshot for the retention period, or make deletion
explicitly withdraw the resulting evidence and preserve a tombstoned audit record.

### P0 — Adversarial rubric evaluation

Fact grading is code-owned, but writing-quality grading is still model-owned and the submission is
untrusted text inside its prompt. Run an adversarial evaluation set for prompt injection, fake
quotes, rubric gaming, irrelevant fluent prose and conflicting instructions. Until it passes, keep
the activity experimental and keep model-reviewed claims at `observed`.

### P1 — Retry the same interrupted assessment

The submission row is written before the model call. If the provider fails, the person's work is
preserved, which is correct, but the next click creates another attempt rather than resuming review
of the unreviewed submission. Add an explicit `pending_review` state and retry the same immutable
attempt idempotently. The interface should say that the answer was saved and the review can be
retried.

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
- Pure practice tests: 37 passed across five focused files.
- Real PostgreSQL integration: 11 passed, including simultaneous start, revision, ownership and
  closed-step enforcement.
- Full web suite: 1,759 passed, 193 skipped.
- `git diff --check`: clean.

The signed-in browser journey remains the last integration check after migration 0069 is applied to
the shared development database. Verify Start, failed review, retained draft, revised pass, example
unlock, finish review and career-evidence confirmation before exposing the activity in a catalogue.

