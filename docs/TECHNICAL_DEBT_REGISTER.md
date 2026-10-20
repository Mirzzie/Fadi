# Technical debt register

**Status:** Current

**Updated:** 23 September 2026

Only unresolved, materially relevant debt belongs here. Closed investigations remain in Git history.

| Priority | Area | Debt and consequence | Completion test |
|---|---|---|---|
| P0 | Interview | Story matching can return the first or highest-scoring story when every score is zero. The UI can coach an irrelevant answer with confidence. | No match is returned below a positive competency/semantic threshold; a preparation step is offered instead. |
| P0 | Career identity | Legacy evidence contains uncertain groups created before source/version/kind rules. Automatic repair could turn old guesses into accepted history. | Every group is resolved through provenance, a deterministic anchor, or an explicit user decision; no uncertain backfill. |
| P0 | External CV | A newly imported external CV is preserved, but full reconciliation of additions, edits, renderings, omissions, and conflicts is unfinished. | Round-trip tests cover all five outcomes and preserve canonical facts plus document-specific wording. |
| P0 | Portfolio identity | Recovery/sync can rely on best-match heuristics without a safe floor; deletion intent needs a durable tombstone. A wrong link can suppress or mutate an entry forever. | Stable record links drive normal sync; heuristic recovery requires anchors and review; exclusions survive re-sync; media is preserved. |
| P1 | Interview | “Delivery” is inferred from transcript length and a constant speaking rate. It cannot measure delivery. | UI names only measured properties; audio coaching uses real duration and pause features. |
| P1 | Practice | Learning paths, skill gaps, blueprint, commitments, and project runs overlap, while project runs assume local files, shell checks and technical labs. | One Now/Plan/Completed model and one outcome service drive internal and external completion; ADR 0014 fixtures prove technical, document, simulation, credential and physical-work adapters without profession-specific shell UI. |
| P1 | Labs | Observable lab work still requires optional result text, separate verification, pasted output, and manual step completion. | A successful Check and continue captures the result, verifies the step, advances work, and writes a receipt. |
| P1 | Voice | Recorded dictation, TTS, and Realtime are separate paths; they do not share one work-scoped session. | Voice/text/UI share thread, context, tools, approvals, transcript, interruption, and action receipts. |
| P1 | Agent policy | Tool risk/effect are declared, but scopes, expiry, idempotency, reversibility, taint policy, and policy versioning are incomplete. | Capability registry and execution snapshot cover the full contract; approvals are durable and globally visible. |
| P1 | Delivery | The in-process event bus cannot guarantee cross-domain delivery after commit or crash. | Transactional outbox with idempotent consumers covers required evidence, portfolio, document, and publishing reactions. |
| P1 | Job search | Source availability and search success are not yet a reliable measure of recall, freshness, or duplicates. | Per-source health, query traces, dedupe, pagination, retry, and zero-result diagnostics are tested with live probes. |
| P1 | Social publishing | LinkedIn login is sign-in only. Direct publishing has no dedicated connection, scope, token lifecycle, or receipt flow. | Separate publishing consent and connection service; baseline manual share remains usable. |
| P1 | Supply chain | Direct critical/high JavaScript findings were cleared on 5 October 2026, but 6 moderate build/test findings remain; deployable containers use mutable tags and releases have no SBOM or signed provenance. | Triage and clear reachable findings; publish a clean SBOM and licence report; pin release images by digest; attach signed provenance to releases. |
| P2 | Interview history | Stories persist, but sessions, turns, rubric versions, summaries, and measured progress do not. | A minimal retention model supports comparable practice without duplicating the work kernel. |
| P2 | Documentation | Historical audits are linked from code and can be mistaken for current architecture. | References point to current docs where possible; retained audits carry prominent historical banners. |

## Maintenance rules

- Add an owner when implementation starts.
- Link a defect or ADR when the item needs more detail.
- Remove an item in the same commit that satisfies its completion test.
- Do not add vague cleanup wishes or future features.
