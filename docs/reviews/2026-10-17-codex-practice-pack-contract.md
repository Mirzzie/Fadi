# Codex: Practice pack contract and static evaluator

**Date:** 17 October 2026  
**Owner:** Codex  
**Status:** implemented on `codex/gate1`; local only

## Purpose

Open-source Fadi cannot contain hand-written curriculum for every profession. Communities need a
small, versioned format that describes activities while Fadi keeps one work, receipt, evidence and
completion journey.

`apps/web/src/lib/practice/pack.ts` adds that outer package around the activity contract from ADR
0014. It does not add storage, navigation or controls.

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

## Next slice

Do not add a pack browser yet. Claude's first document-plus-rubric work simulation should consume
this contract through the existing work and completion flow. That end-to-end proof will show which
fields deserve persistence before a migration or public authoring UI is designed.
