# Claude acceptance preparation — Phase 0 integration review

**Date:** 27 October 2026. **From:** Claude. **Scope:** read-only acceptance prep, per Codex's split
(Codex owns the isolated Phase 0 integration branch, template catalog and authenticated server-action
adapter; Claude reviews + prepares acceptance, avoiding overlapping implementation files). No
migrations reserved, no shared-DB upgrade, no main promotion.

## 1. PR status, commits and dependencies (as of 27 Oct, main `fad149d`)

| PR | Branch | Head commit | State | Depends on |
|---|---|---|---|---|
| #12 | `claude/capability-contracts` | `92bb74e` | **MERGED** 26 Oct 20:43 | — (adds `apps/web/src/lib/capabilities/{manifest,practice-capability}.ts` + tests) |
| #13 | `claude/phase0-checklist` | `e172e19` | **OPEN** | docs only; no code dep |
| #14 | `claude/capability-action-intents` | `46ce740` | **OPEN** | **#12** (extends `manifest.ts` + `practice-capability.ts`); docs mapping |

Dependency notes:
- #14 edits the two files #12 added, so #14 must land **after** #12 (it already is on main's baseline).
- #13 and #14 touch **no** engine/worker/research/UI files — zero overlap with the integration
  branch's backend + facelift. They can merge independently of Phase 0.
- The capability module imports only `../practice/packs` (`activityRuntime`) — a read-only lookup
  already on main. It does **not** import the worker, evaluation, research-fetch or UI modules, so
  the integration cannot break it except through `practice/packs` itself.

## 2. Regression checklist (re-run on the integration branch)

**Evaluation / marking (Claude-owned):**
- [ ] `lib/evaluation/marking-task.integration.test.ts` — grades every answer once, checkpoints each,
      records a pass bound to inputs; resumes after a crash spending nothing twice; refuses on changed
      binding; stops at provider budget; `markingCallCap` arithmetic.
- [ ] `lib/practice/grader-check.ts` — per-(provider,model,activity) rate key + refund on unrecorded;
      `isFitToMark` gate still required before any marking.
- [ ] Marking stays **person-started + metered**; no scheduled AI spend introduced by the worker.

**Source refresh (Claude-owned):**
- [ ] `lib/sources/refresh.test.ts` (41) — content-fingerprint change detection, fail-closed payloads,
      catalog/stable-id freshness, verify-only skip, due selection.
- [ ] `lib/sources/browser-fetch.test.ts` — real status reported (403 stays 403).
- [ ] Live spot-check unchanged: Eurostat/CSO/DETE/Federal Register pull OK, stable on re-pull.
- [ ] The puller still delegates fetch through an injected `Fetcher`; after integration, an adapter to
      Codex's pinned `fetchResearchSource` replaces the prototype `boundedGet` (not wired here).

**Capability actions (Claude-owned):**
- [ ] `lib/capabilities/{manifest,practice-capability,action-intents}.test.ts` (27) — descriptor
      fail-closed, two-career proof, `validateEvent`/`resolvePracticeAction` intents + rejections.
- [ ] All three still green against the integrated `practice/packs` (pack versions unchanged: both
      `0.2.0`; activity ids `suspicious-sign-ins`, `churn-review`).

**Cross-cutting:**
- [ ] Migrations apply in sequence 0071→0072→0073; `_journal.json` consistent; worker protocol
      (`fadi_guard_outbox_v2`) intact.
- [ ] `tsc --noEmit` clean for the web app (pre-existing `connected-accounts.tsx` `providerId` error
      must not grow); eslint clean on changed dirs.

## 3. Two complete acceptance journeys

Both run the **same** templates / work engine / evidence flow; the only configured difference is the
activity ref and the optional resource region. Each journey includes the adversarial cases.

### Journey A — Security sign-ins (`fadi.security-operations@0.2.0` / `suspicious-sign-ins`)
Steps: triage → contain → report. Instance `practice:soc`, optional Entra resources shown.

1. **Happy path:** render step 1 (`workspace`), submit a triage note → `write_attempt` → attempt
   stored, step advances; repeat contain/report; the completed activity yields a receipt admitted via
   the evidence gate; `request_marking_check` (person-started) marks when the grader is fit.
2. **Stale revision:** submit with an `expectedDescriptorRevision`/`expectedInstanceRevision` that no
   longer matches → typed **conflict**, no write; the shell re-fetches.
3. **Duplicate submission:** two `submit_attempt` events with the **same `eventId`** → exactly **one**
   effect; same id + changed payload → conflict.
4. **Permission refusal:** an account without `write_attempt` (real permission name TBD, §4) → refused
   at the server re-resolve; no attempt stored; typed `unavailable`.
5. **Cancellation:** a `request_marking_check` long-run cancelled mid-flight → the existing work
   execution signals cancellation; honest receipt; no half-grade recorded.
6. **Checkpoint recovery:** marking crashes after N of M reviews → resumes at the next ungraded answer,
   spends nothing twice (`marking-task` checkpoints) → final pass bound to its inputs.
7. **Evidence provenance:** the produced evidence traces to the attempt + rubric version + grader
   identity; rubric assets (model answers/fact checks) never appear in the descriptor or screen context.

### Journey B — Customer Success churn (`fadi.customer-success@0.2.0` / `churn-review`)
Steps: diagnose → plan → defend. Instance `practice:cs`, **no** resource region. Same seven cases as
Journey A, asserting **identical** engine behaviour (no profession branch); `open_resource` is absent
and never required for completion.

**Shared assertions:** `submit_attempt`/`nextAction`/completion are identical across A and B;
`via:"voice"` resolves to the same action/effect as `direct`; a tampered descriptor (injected
script/HTML/URL ref) renders nothing executable.

## 4. Contract-to-code mismatches (concrete — coordinate before fixing)

These are in Claude's files but their **values** belong to the engine/permission catalog, so they need
Codex/owner confirmation before I change them.

| # | Mismatch | File(s) | Failure scenario | Proposed resolution |
|---|---|---|---|---|
| M1 | `permissions.required: ["practice.read_activity","practice.write_attempt"]` + optional `practice.marking_check` are **invented** — no such strings exist in the codebase (grep empty). | `capabilities/practice-capability.ts` (`PRACTICE_CAPABILITY`) vs the ADR 0012 permission catalog | Acceptance test 3-A4/B4 (permission refusal) can't bind to a real grant → false pass/fail. | Map to the real permission names Codex confirms; until then mark them `TODO:pending-permission-catalog`. |
| M2 | `outputs.evidenceTypes: ["practice_receipt"]` — **not** a real `EvidenceKind`. Actual enum is `experience\|project\|achievement\|certification\|skill\|education\|unclassified`; `machine_receipt` is a `PracticeOutputKind`, not an evidence kind. | `capabilities/practice-capability.ts` vs `lib/evidence/pool.ts` (`EvidenceKind`) + `lib/practice/contract.ts` (`practiceOutputKinds`) | Evidence-provenance test (3-A7) asserts a kind the gate rejects/normalises → mismatch. | Declare the real output/evidence kind the Practice→evidence path emits (confirm with the evidence gate). |
| M3 | `inputSchemaRef: "fadi.rubric.answer@1"` is a **placeholder**; the real rubric input is `Answer = { text: string; choices: Record<string,string> }`. | `capabilities/practice-capability.ts` (descriptor builder + resolver) vs `lib/practice/rubric.ts` (`Answer`, `composeAnswer`) | `submit_attempt` payload validation (3-A3 duplicate / happy path) can't validate against a registered schema. | Register the rubric `Answer` shape as the input schema and reference it; adapter maps payload→`composeAnswer`. |
| M4 | `request_marking_check` is described as "marking"; in code `checkGrader`/`isFitToMark` are the **grader-readiness (fit-to-mark)** gate tied to the person's provider+model identity — distinct from grading the submitted attempt (which runs in the step assessment via the rubric once fit). My intent carries no `identity`. | `capabilities/practice-capability.ts` (`WorkEngineIntent`) vs `lib/practice/grader-check.ts` (`checkGrader`, `isFitToMark(userId, identity, ref)`) | Journey step "mark when grader is fit" (3-A1) and cancellation (3-A5) could dispatch to the wrong call. | Clarify: `request_marking_check` → person-started fit-to-mark/marking readiness; attempt grading stays inside `submit_attempt` completion gated by `isFitToMark`; the adapter supplies `identity` from auth context. |

None of M1–M4 block the **seam** tests (they pass on fixtures); they block the **live journeys**, so
they are the first things to settle with Codex once the integration branch exists.

## 5. Protocol

Read-only until Codex delivers `integration/phase0`. Then: run §2 regressions + §3 journeys against
it, report blockers, and **coordinate ownership before touching any overlapping file** (M1–M3 edit
`practice-capability.ts`, which is Claude's, but the canonical values are the engine's/Codex's). No
migration reserved, no shared-DB upgrade, no main promotion.
