# Codex to Claude: stop adding interaction; replace the old lab journey

**Date:** 16 October 2026  
**Owner direction:** This applies across Fadi, starting with Practice and the lab workspace.

Claude: the owner has made the product rule explicit. Do not respond to a missing capability by
adding another visible panel, button, field or manual step. First find the existing journey that
serves the same intent, then replace or collapse it. This is now recorded in
`docs/UI_UX_GUIDELINES.md` as the interaction budget and replacement rule.

This does not mean hiding required safety decisions. A destructive or consequential action still
gets one informed, scoped approval. It means Fadi must do the observation, orchestration,
execution, verification and bookkeeping that it already has authority and channels to do. Manual
interaction remains only when it is the learning objective, the target is external, or an
authority boundary such as `sudo` requires the person.

## What the latest screen proves

The Step 4 screen asks the person to coordinate all of these at once:

- three PowerShell blocks, each with **Type into lab** and **Copy**;
- an optional result field;
- **Done, next step**, **Check it for me**, and **Stuck?**;
- machine, check-channel, service and credential controls;
- a remote desktop;
- the old step list, floating navigation and assistant overlays.

The multiline PowerShell operation was split into separate manual transfers. The learner then
encountered parser and missing-argument errors. That is not useful practice of file-integrity
monitoring; it is practice debugging Fadi's transport UI. A logically atomic script must be one
reviewed blueprint operation, run through the approved lab channel and verified with a fixed
predicate. Someone who intentionally wants to practise the commands can choose **Do it manually**
from Details.

The G-1 conductor is directionally correct, but it currently sits above the old readiness,
machine, checks, services, approval, command, result and help surfaces. That is additive layering.
The conductor must replace those surfaces as the normal journey.

## Overlap to remove

| Current overlap | Required single design |
| --- | --- |
| `ProjectNext` and `ProjectReadiness` both explain readiness | `ProjectNext` is authoritative. Remove `ProjectReadiness` from the default workspace. |
| Conductor, checks setup, services and machine panels each expose state and refresh behavior | The conductor owns ordering and observation. Show one **Environment: ready / needs attention** line; put the projections in one Details drawer. |
| Inline pending action, messages sending the user to approvals, and the global approval inbox | Render the same broker approval inline inside Next. Keep the global inbox only as an aggregate projection. |
| Per-command **Type** and **Copy** actions | One step action: **Run in lab** or **Approve and run**. Put the reviewed script and manual mode under Details. |
| Result field, Done, Check and Continue without verification | Automatic observation creates the receipt. Use one stateful action: Run, Check and continue, or Fix issue. Manual attestation is an explicit fallback under More. |
| `Stuck?`, failure text and conductor remedies | One evidence-based recovery state in Next. Put **Need help?** after the diagnosis, not beside the success action. |
| Always-visible settings, credentials and service controls | One compact environment line. Reveal settings, credentials and service administration only in Environment details. |
| Step list plus setup tasks presented as learning | Show the active learner step and compact progress. Infrastructure setup is conductor work, not curriculum. Replan or migrate old runs that still contain setup steps. |
| Floating bottom navigation and assistant controls over the remote desktop | Enter lab focus mode. Collapse navigation and place assistant state outside the interactive viewport. |

The likely overlap lives in `apps/web/src/components/learning/project-workspace.tsx`, alongside
`project-next.tsx`, the readiness/checks/service components and their independent refresh paths.
Consolidation is not complete while those components still make the person reconcile their states.

## Target workspace

The default desktop layout should contain only:

1. **Project · progress** in one compact header;
2. **Next** with what, why, observed state and one action;
3. the remote lab surface using the remaining space;
4. one collapsed **Environment and details** drawer.

The action changes with state rather than accumulating buttons:

| State | Primary action |
| --- | --- |
| Approval required | Approve and run |
| Ready for an automated learning operation | Run in lab |
| Person must perform the learning task | Check and continue |
| Known failure | Fix issue |
| Unknown failure | Show what Fadi checked |
| Complete | Review what I learned |

Voice and chat invoke the same action contract. “Fadi, do the next step” opens the same scoped
approval and creates the same receipt as the button; it does not create a parallel agent journey.

## Research basis

- [W3C step-by-step instructions](https://www.w3.org/WAI/WCAG2/supplemental/patterns/o4p07-step-instructions/)
  recommends concise instructions beside the activity and notes that automatic error correction
  reduces the amount of instruction people need.
- [W3C accessibility principles](https://www.w3.org/WAI/fundamentals/accessibility-principles/)
  require predictable interaction and consistent identification, especially for people with
  cognitive disabilities.
- [GOV.UK question pages](https://design-system.service.gov.uk/patterns/question-pages/) say to
  ask for information once and reuse what the service already has.
- [GOV.UK complete multiple tasks](https://design-system.service.gov.uk/patterns/complete-multiple-tasks/)
  says to simplify the transaction before introducing a task-list journey.
- [GOV.UK details](https://design-system.service.gov.uk/components/details/) recommends disclosure
  for secondary information, while warning against hiding information most users need.

The practical consequence is not “put everything in accordions.” First delete duplicate decisions
and automate relay work. Then disclose genuine secondary detail.

## Required follow-up for G-1

Claude owns the UI consolidation already admitted in the G-1 handoff:

1. make the conductor the sole owner of readiness and polling;
2. remove the redundant default panels and per-panel refresh behavior;
3. render broker approval inline in Next;
4. collapse machine/check/service state into one Environment detail view;
5. replace the command-button matrix with one blueprint operation action;
6. add lab focus behavior so overlays never cover the target;
7. report a surface delta before calling the work complete.

Codex owns the minimal blueprint-operation contract and adversarial cases. The contract should
reference a reviewed operation ID, target place, required approval capability, bounded execution,
success predicate, rollback/cleanup reference and receipt schema. It must not add another visible
operation editor or another approval mechanism.

## Acceptance checks

- A normal lab step has one primary action and no manual result field.
- A learner never copies or pastes a command merely to move it between two Fadi-controlled places.
- The same readiness fact cannot disagree across two visible components.
- One refresh owner observes each fact.
- A required approval appears where the action was requested.
- Advanced controls are reachable, but they do not consume the default workspace.
- Keyboard, voice and pointer paths invoke the same command and state transition.
- Each UI change states which old control or component it removed or merged.

Do not add the next G-2 or G-3 card to the current stack. Replace the stack first.
