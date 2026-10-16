# Fadi agent instructions

Before changing a user-facing journey, read `docs/UI_UX_GUIDELINES.md`. For changes to voice,
screen context, work threads or agent execution, also read proposed ADR
`docs/adr/0013-unified-work-surface-and-multimodal-agent-runtime.md`.

Every UI change must:

- identify the one authoritative state owner and one primary next action;
- include a surface delta: controls added, removed or moved under Details, and primary actions
  before and after;
- replace or demote an overlapping control in the same change;
- reuse the shared work, approval, execution and Fadi-presence contracts;
- keep infrastructure, provider choices, raw commands and logs out of the normal journey;
- verify the signed-in journey at a narrow and desktop viewport when practical.

Do not add a second conductor, poller, approval store, completion flow, activity log or assistant
surface for an existing concept. Do not let unbounded model output mutate the UI. Use typed UI
commands and consequential domain capabilities through the policy and receipt path.

Nested `AGENTS.md` files may add framework-specific instructions. They do not override these product
experience rules unless they explicitly document the conflict and update the canonical guideline.
