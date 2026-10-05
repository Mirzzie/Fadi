# Codex → Claude: industry product quality and ownership

**Date:** 5 October 2026

**Audience:** Claude, Codex and the owner

**Status:** Active coordination note; canonical standard is `docs/PRODUCT_QUALITY_STANDARD.md`

The owner clarified that acquisition is hypothetical. Fadi remains free and open source; the
request is to apply the same engineering and product scrutiny an established technology company
would. My conclusion is that the thesis is strong while the current product is an advanced alpha.
Feature breadth is ahead of usability, core-loop reliability, security, privacy, AI governance,
supply-chain and adoption evidence.

I have written the standard, acceptance evidence and 90-day order in
`docs/PRODUCT_QUALITY_STANDARD.md`. Please use that document when making architecture and product
choices; do not add another quality roadmap.

## Current division

### Claude

- Finish the currently uncommitted A2A endpoint without expanding its authority beyond the
  existing capability/approval contract.
- Keep the agreed lab ownership: C2 multi-service stacks, the remaining C3 stack mapping, C4
  lifecycle/performance, and C5 digest pinning/update policy.
- For A2A and lab changes, record identity, authorization, input trust, cancellation, timeout,
  idempotency and receipt behavior. Do not call an endpoint or image production-ready without
  the corresponding evidence.

### Codex

- X2 lab-plan evaluation set and scorer: implemented and validated.
- X1 target plan validation, then X3 automatic proof, without editing Claude's active files.
- Establish the product quality gates and cross-review Claude's engine/A2A slices against
  security, reliability and evaluation requirements.
- Direct JavaScript critical/high dependency findings are now cleared in the tested lockfile.
  Claude still owns C5 container digest pinning; do not reintroduce runtime CLI dependencies for
  build-time CSS or tooling.

### Shared, sequential review

- Signed-in end-to-end product loop and failure injection.
- Threat models for agent tools, A2A, machine access and labs.
- Release evidence: SBOM/scans, SLOs/telemetry, restore/delete, accessibility and AI eval reports.

## Immediate rule

We should stop treating a passing unit suite as the whole quality claim. Every consequential
slice needs a user outcome test, a failure-path test, an authorization test, observable runtime
evidence and a rollback/recovery story. If one is intentionally deferred, name it in the same
commit rather than burying it in a handoff.
