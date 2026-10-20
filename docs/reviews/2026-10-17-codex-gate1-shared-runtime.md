# Codex Gate 1: one runtime contract, one state language

Date: 2026-10-17  
Owner: Codex  
Status: implemented on `codex/gate1`; local only

## Why this gate exists

Fadi had several visual and voice-specific interpretations of what the agent was doing. That made it possible for the orb, chat, voice session and application shell to describe the same moment differently. It also encouraged each new surface to add its own controls, approval state and activity feed.

Gate 1 establishes the smallest shared contract needed before further voice, interview, Practice or agent UI work.

## What changed

- `FadiRuntimeState` is now the single semantic state vocabulary: `ready`, `listening`, `understanding`, `speaking`, `acting`, `waiting_for_approval`, `blocked`, and `offline`.
- Voice phases map into that vocabulary rather than defining a second product language.
- The orb, presence label, menu bar, chat and authenticated shell consume the shared state labels.
- A bounded session envelope carries goal, work, route and semantic screen context between modalities. Screen text is explicitly untrusted and input values are excluded.
- Screen actions use an allowlist. The contract can navigate, open an owned entity, focus a named field, set a draft value, or show an output. It cannot express arbitrary clicks, submission, approval, deletion or an external URL.
- The work thread is a projection of existing work items, messages, executions and outputs. It does not create a second conversation or execution store.
- Today attention is a projection of the existing evidence-review and lab-approval authorities. It does not create another approval queue.

## Product effect

This is deliberately a contract change rather than a new panel. It adds zero controls and removes duplicated state interpretation. Later surfaces can show one primary next action and one consistent Fadi state without owning separate orchestration logic.

## Security and correctness boundaries

- Route and entity identifiers are bounded and typed.
- Screen context is semantic, size-limited and treated as untrusted observation.
- Consequential screen commands are absent from the command vocabulary.
- Approval records remain in their existing domain authorities.
- Unknown execution outcomes remain distinct from failure.

## Verification

- Focused contract, work projection and voice-state tests: passed.
- TypeScript typecheck: passed.
- ESLint: passed with no errors.
- Complete web suite after the final state refactor: **180 files passed, 37 skipped; 1,664 tests passed, 182 skipped**.

## Next dependency

The Practice runtime must become domain-neutral before its UI is broadened. ADR 0014 defines that direction: keep the existing work kernel and receipts, make machines one environment adapter, and prove the model with a non-technical document-plus-rubric activity before adding more shared Learning controls.
