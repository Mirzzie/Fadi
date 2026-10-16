# Codex to Claude: Fadi experience transformation after Paperclip and Pipecat study

**Date:** 16 October 2026
**Status:** Working handoff; decisions have been copied into canonical UI guidance and proposed ADR
0013. Delete this note when the assignments land.

## The decision

Do not make Fadi look like Paperclip or Pipecat. Use their deeper strengths:

- Paperclip: work is the navigation unit; activity and decisions live with the work; one attention
  queue; persistent status and trace.
- Pipecat: one realtime multimodal session; clear live states; natural turns and interruption; a
  separate UI worker with bounded screen context and typed commands.
- Fadi: keep Today, Opportunities, Practice and My career; keep career direction, canonical evidence
  and the teal identity.

The canonical rules are now in `docs/UI_UX_GUIDELINES.md`. The runtime boundary is proposed in
`docs/adr/0013-unified-work-surface-and-multimodal-agent-runtime.md`.

## Evidence and limits

### Observed through REA

- Paperclip live marketing page target:
  `ev_7c03f46f4a9ec743a785366797e6a74ae93cbc9b44f4e3086e7d4e568a6b977e`
- Paperclip page snapshot:
  `ev_f450e17e8c340bcd621dbef7bde5ef0e138e81a2639750df28381ce0cb8847f5`
- Paperclip screenshot:
  `ev_6d0821e8807545298bfeace4e46e052556999c79e562d3879da9a3461a70d7eb`
- Paperclip public `ui` static analysis root:
  `ev_7471d523f0fa89f0445800c28f0de6ac440b9ce5df1176035a79d2ee154855e4`
- Paperclip public `ui` static analysis detail:
  `ev_dfc3e991623e6eb308b24c0b6d9741eb0e84c287a6e384b3d050be3a6b587c33`
- Pipecat live page target:
  `ev_017301bab8a3d663829b750bfae736a77a77988be1ad8f3e31f7a13b4d6d152c`
- Pipecat page snapshot:
  `ev_fe6d8b9ca4ea3145ef1c1a2b750630ba5f7bf540a2e706cdae0bfd09a6f8eb36`
- Pipecat screenshot:
  `ev_9f89d618710b4fae677f2a59607e0763c2fd09f4a50ad012d42deee20430b125`

The Paperclip source pass was an inert static parse of a public checkout. It parsed 2,413 JavaScript
files without parse failures, but the semantic graph was partial because the result was truncated.
It proves visible modules and static structure, not runtime behaviour. The live browser checks were
passive observations; no account-only workflows were exercised.

### Inferred from official documentation

Paperclip's tasks, decisions, approvals and dashboard documentation support the work-centered and
attention-queue patterns. Pipecat's UI worker, turn detection, interruptions and agent handoff
documentation support the separated conversation/screen/task runtime. These are product patterns,
not copied implementation.

## What already moved in the right direction

Commit `0560b9c` replaced the lab's stacked readiness/settings/service experience with one Next card,
one action and one Environment disclosure. Keep that conductor. Do not add a second readiness panel,
troubleshooting panel, activity panel or voice panel beside it.

## Ownership from here

### Claude owns: finish the project/lab journey on the shared work-surface contract

1. Keep the existing project conductor as the sole readiness and next-action owner.
2. Put observed activity, failures, recovery and receipts into one project work thread.
3. Treat the lab screen as the focal work surface; keep Environment as the optional inspector.
4. Make completion call the shared outcome service and show one completion package.
5. Delete superseded project controls in the same commits. Include a surface delta each time.
6. Do not create new shell navigation, approval stores, polling loops or Fadi presence state.

### Codex owns: system primitives and enforcement

1. Define the shared work-thread event and attention projection contracts.
2. Align the shell and tokens with the new hierarchy without copying Paperclip's dense dashboard.
3. Define the session envelope, Fadi semantic states and typed screen-command schema.
4. Add journey-level UX checks: one primary action, one state owner, no hidden approval, narrow layout,
   interruption and resume.
5. Migrate the application workspace after the primitives are stable, removing its parallel fit,
   scoring, red-pen and document action panels.

### Joint boundary: live voice

Do not build another interview-only or lab-only voice stack. Agree the envelope and event protocol
first. Then connect the existing interview work to the same presence/conversation worker, screen
context and executor.

## Stop rules

Stop a proposed UI change and redesign it when any is true:

- it adds a card without removing or demoting one;
- it asks the person to relay data Fadi can observe;
- it creates local polling for a state the shell or conductor already owns;
- it introduces a second approval, completion or activity record;
- it exposes model, provider, hypervisor or agent topology in the normal journey;
- it gives unbounded model output permission to click or mutate the UI;
- it cannot identify the one primary action after the change.

## Next integration point

Claude should finish the current lab journey against the canonical guideline. Codex will build the
shared work-thread/attention contracts and migrate one signed-in application workspace. Merge at
the contracts, not by adding one implementation beside the other.
