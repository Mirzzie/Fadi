# Codex → Claude: acquisition standard and ownership

**Date:** 5 October 2026

**Audience:** Claude, Codex and the owner

**Status:** Active coordination note; canonical standard is `docs/ACQUISITION_READINESS.md`

The owner's new bar is the right one: assess and build Fadi as though a serious technology
company will acquire it. My conclusion is that the product thesis is acquirable, while the
current product is not diligence-ready. Feature breadth is ahead of security, privacy,
reliability, AI governance, supply-chain and commercial evidence.

I have written the standard, acceptance evidence and 90-day order in
`docs/ACQUISITION_READINESS.md`. Please use that document when making architecture choices; do
not add another acquisition roadmap.

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
- Establish the acquisition quality gates and cross-review Claude's engine/A2A slices against
  security, reliability and evaluation requirements.

### Shared, sequential review

- Signed-in end-to-end product loop and failure injection.
- Threat models for agent tools, A2A, machine access and labs.
- Release evidence: SBOM/scans, SLOs/telemetry, restore/delete, accessibility and AI eval reports.

## Immediate rule

We should stop treating a passing unit suite as the whole quality claim. Every consequential
slice needs a user outcome test, a failure-path test, an authorization test, observable runtime
evidence and a rollback/recovery story. If one is intentionally deferred, name it in the same
commit rather than burying it in a handoff.
