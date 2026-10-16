# Fadi instructions for Claude

Read `AGENTS.md` and `docs/UI_UX_GUIDELINES.md` before changing user-facing UI. For voice, screen
context, work threads or agent execution, also read proposed ADR
`docs/adr/0013-unified-work-surface-and-multimodal-agent-runtime.md`.

The current coordination note is
`docs/reviews/2026-10-16-codex-to-claude-unimad-review-and-sequencing.md`, which extends
the Paperclip/Pipecat handoff with the migration order and Opportunities reference. Claude owns finishing
the project/lab journey on its existing single conductor. Codex owns the shared work-thread,
attention, shell and screen-command primitives. Agree shared contracts before changing the same
files.

A feature change must replace, merge or demote an existing surface in the same change. Include the
surface delta and final primary-action count in the handoff or commit description.
