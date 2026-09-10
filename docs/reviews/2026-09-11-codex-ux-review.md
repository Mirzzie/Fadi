# Codex UX review — machine access and project workspace

11 September 2026. Independent review of the current components and Claude's brief. No UI source changed in this review.

## Straight answer

The interface is thoughtfully worded but poorly composed as a workflow. Individual controls are mostly understandable; the page makes the user assemble the system model themselves. Machine inventory, permissions, pending approvals, security incidents, action history and project progress are distinct jobs presented in one long Learning-page stack. That is why three failures surfaced as “I cannot do the obvious thing”: important actions depended on hidden state or conditional controls rather than the user's current goal.

The pattern is **control availability follows implementation state instead of user intent**. Done was always available despite absent evidence; stop did not exist; adding hardware disappeared after the first resource. Each local rule was defensible in code and surprising in use.

## Recommended information architecture

Use three surfaces with one source of truth:

1. **Project workspace:** the active step, target machine, expected effect, evidence and the next decision. Put contextual permission and approval prompts here when a project triggers them.
2. **Global action centre:** a persistent indicator and drawer available from every authenticated page. Pending approvals, blocked attempts and cleanup failures live here. Approval must not expire merely because the user navigated away. Expire the preflight snapshot and require refresh, while preserving the proposal until dismissed or superseded.
3. **Machine access settings:** registered machines, workspace boundary, standing read grants, revocation and detailed history. This belongs under Settings/Security or Connections, linked from Learning. It should not consume equal visual weight in the everyday learning workflow.

The dominant element on Learning should be “continue this project.” Within the global action centre the order should be waiting decisions, failures requiring recovery, unexpected denials, active grants, then history. The current semantic ordering is close, but borders and rows give everything similar weight.

## Approval delivery

Polling only inside `MachineAccess` means approvals exist only where the user happens to look. Mount a single authenticated-shell provider that owns the queue count and notification state. A project can render the same request inline, but approval state must be server-owned and visible globally. Notifications should identify the requesting project, target, effect and expiry/preflight freshness. Avoid duplicate prompts from the global and contextual surfaces by sharing one request ID.

Do not use a 3–10 minute disappearing approval as the main lifecycle. A request may remain pending while its preflight becomes stale. On approval, refresh preflight and show material changes before executing. This keeps decisions available without authorizing an obsolete effect.

## Audit history

The collapsed command list is complete at the wrong level. Group history by **user intent/request**, producing a timeline such as: proposed → preflighted → approved/denied → executed → verified → cleaned up. One “Inspect containers” activity can contain its three low-level commands instead of three repeated top-level rows.

Each summary row should show time, actor, project, machine, requested effect and outcome. Expand it for exact argv, stdout/error, approval identity, policy decision and cleanup linkage. Provide filters for changes, reads, blocked, failures and machine/project. Highlight unresolved cleanup or unexplained denials; successful repetitive inspections can collapse into “3 checks.” This satisfies visibility without asking the user to interpret a debug log.

## The three reported usability failures

- Evidence capture should be a choice before completion: “Record result” and “Mark done on my word,” with the consequence attached to the second action. A text field plus generic Done makes the evidence decision look ancillary.
- Stop belongs in the project overflow/header at all times, with pause/drop/delete meanings. The current repair is directionally correct; keep the default reversible.
- Hardware is a managed list, never a one-time empty-state wizard. “Change machine” belongs beside the current host on each project; “Manage machines” opens the registry.

Also avoid rendering one independent `LabFit` controller per suggestion as the long-term state model. Shared resource state and project-specific placement should be separate, otherwise refresh events and duplicated controls become the UI's synchronization protocol.

## Project chat

The idea works if chat is a project-scoped interaction mode, not the product's state container. The project workspace should remain the canonical view: plan, current step, machine, outputs, approvals and recovery. Chat can explain, ask questions and propose typed actions that render as structured cards.

Claude's three conditions are right. Add these constraints:

- Web content, model text and captured artefacts are untrusted inputs. They cannot directly become host/MCP instructions.
- Every action references a fixed capability, project, resource, concrete preflight and request ID. The model supplies intent; deterministic code builds the executable request.
- Machine verification records an observation and its limits. It does not prove learning, authorship or independent completion.
- The transcript is not evidence and is not the audit log. Link messages to durable actions rather than deriving actions later from prose.
- Approval applies to the exact effect shown. Material preflight changes create a new approval revision.
- Provide pause, cancel, retry and cleanup outside chat so the user is never trapped in conversational navigation.

Build read-only project chat and structured proposals now if useful. Gate host-changing chat actions on preflight, scoped approval, idempotent execution and recovery/undo. Real undo does not exist for every action, so label compensating cleanup honestly rather than promising reversibility.

## Suggested implementation order

1. Global pending-action provider and action-centre entry point.
2. Project workspace with a persistent host selector, explicit completion choices and stop controls.
3. Grouped intent-level activity timeline.
4. Read-only project chat producing structured proposals.
5. Host-changing actions after preflight freshness and recovery behavior are enforced.

This sequencing preserves Claude's preflight work and fixes the approval visibility hole before chat creates more requests. It also lets the mission progress without waiting for a complete settings redesign.
