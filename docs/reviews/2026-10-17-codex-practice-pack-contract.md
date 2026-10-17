# Codex: Practice pack contract and static evaluator

**Date:** 17 October 2026  
**Owner:** Codex  
**Status:** implemented on `codex/gate1`; local only

## Purpose

Open-source Fadi cannot contain hand-written curriculum for every profession. Communities need a
small, versioned format that describes activities while Fadi keeps one work, receipt, evidence and
completion journey.

`apps/web/src/lib/practice/pack.ts` adds that outer package around the activity contract from ADR 0014. It does not add storage, navigation or controls.

## Decisions encoded

- A pack has an id, version, domain, license and sources.
- Trust is explicit: `experimental` or `reviewed`.
- A reviewed pack must name who reviewed that exact version and when.
- Activity ids and step ids are unique within their respective scope.
- Machine, simulation and external-tool environments need a versioned implementation adapter.
- Machine predicates, rubrics, scenario outcomes and external credentials need a versioned
  assessment adapter.
- A credential assessment must yield a credential output. A link alone is not a credential.
- Experimental packs can be inspected and deliberately tried, but are not normally recommended.
- Static validity does not mean an adapter works. End-to-end rehearsal remains a separate gate.

Reviewed solution scripts and model answers are intentionally absent from the common
learner-visible step. A solution is an execution-adapter asset; a model answer is a rubric-adapter
asset withheld until submission. Both are referenced by adapter id/version so the evaluator and a
future signature can bind the reviewed implementation.

## Verification

- Focused contract/evaluator/review tests: 24 passed.
- Typecheck: passed.
- ESLint on all changed TypeScript: passed with no output.
- Complete web suite final run: **182 files passed, 37 skipped; 1,679 tests passed, 182 skipped**.
- The first complete run had one 5-second cold-import timeout in
  `data-sources/providers.test.ts`. That test passed alone (9/9), and the immediate complete rerun
  passed. No Practice code is imported by that test; this remains an existing suite-performance
  flake rather than a claimed fix.

## X3: automatic proof receipts

The next Codex-owned slice is now implemented without adding a page, panel or learner control.

- Migration `0068` adds immutable `practice_receipts`. A receipt identifies the exact versioned
  assessment, its result and strength, the source execution, the observer and a bounded account of
  what was actually seen. Run and step labels survive deletion of a temporary project.
- The existing `lab.check` path is the first producer. Finishing its action request, recording the
  receipt, completing a passing step and settling the run happen in one database transaction.
- A failed check produces a verified **failure receipt** and leaves the learner's step open. A
  verified failure is evidence that the check failed; it is never presented as verified completion.
- Retrying the same source action returns the same receipt. Another user cannot attach the action to
  their work. There is intentionally no generic repository method that lets a caller insert a
  `verified` receipt.
- Machine output is reduced and scrubbed for common tokens, passwords, connection credentials and
  private keys before it becomes durable proof. The live response can still show the learner the
  command result that just ran.
- The existing finish review reads receipts and cites the receipt id. A person still decides whether
  the finished work becomes career evidence; automatic checking does not auto-publish a claim.

Five integration cases pass against PostgreSQL, including atomic rejection and receipt survival
after deleting a run. Focused behavior tests pass (62/62), both packages typecheck, changed-file
lint is clean, and the full web suite passes with bounded concurrency: **183 files passed, 38
skipped; 1,682 tests passed, 187 skipped**. The default high-concurrency run still starves the known
five-second cold import in `data-sources/providers.test.ts`; that file passes alone.

## Next slice

Do not add a pack browser yet. Claude's first document-plus-rubric work simulation should consume
this contract and receipt vocabulary through the existing work and completion flow. That
end-to-end proof will show which fields deserve broader persistence before a public authoring UI or
signed achievement export is designed.
