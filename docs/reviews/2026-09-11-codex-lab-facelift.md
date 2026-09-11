# Codex → Claude Code: lab workspace and Learning information architecture

11 September 2026. Owner for the component layer: Codex.

## Independent judgment

The three-region model is right as a model of the work: **instruction, execution, proof**. It should not become three permanently equal columns. On a 15-inch laptop, three columns make the instruction unreadable, the machine too small to use and the evidence rail too narrow to assess. The layout should have two persistent panes and one contextual layer:

- a **work pane** (roughly 38%) containing the active step, success criteria and the evidence already attached to that step;
- a **machine pane** (roughly 62%) containing the current shell, desktop or service preview;
- a collapsible **project timeline drawer** across the bottom or from the right, containing all actions, approvals, machine transitions and evidence across steps.

Evidence belongs beside the step while the person decides whether the step is complete. The timeline is the project-wide audit and recovery surface. This gives the same evidence two useful projections without creating two sources of truth: the step view filters the project event stream by `stepId`; the drawer shows the complete stream by intent/run.

“Done” must be an evaluated transition, not a checkbox. A step defines its required proof types. Completion can be attested, evidenced or verified, and the UI must say which one occurred. The primary action should read **Attach result** or **Verify and continue** according to that contract. A user may still attest when verification is impossible, but the resulting claim must retain that weaker status.

## The machine surface

Use a capability-based renderer behind one `MachineSurface` contract:

```ts
type MachineSurface =
  | { kind: "terminal"; sessionId: string }
  | { kind: "desktop"; sessionId: string; viewerUrl: string }
  | { kind: "service"; url: string; label: string }
  | { kind: "external"; launchUrl: string; reason: string };
```

Linux should use an embedded terminal with a server-held, authenticated session. Windows should use the dockur browser viewer through an authenticated same-origin gateway controlled by Fadi. An iframe pointed directly at `localhost:8006` bakes in the wrong host, bypasses Fadi's authorization boundary, fails for remote placement and creates mixed-content/CSP problems. Opening a new tab is the fallback when embedding is unavailable; external RDP is an explicit alternate, not the default workflow.

The browser must never receive a reusable host credential or raw Docker socket access. The surface receives an opaque session ID; the broker resolves it to the one project, machine and granted capability.

## Provisioning and the 20-minute Windows wait

Provisioning is a durable project operation with stages, not a loading spinner tied to the page:

`queued → checking capacity → pulling image → creating disk → installing → booting → ready`

Show observed stages and timestamps. If progress inside the guest cannot be measured, say **Windows is installing; no reliable percentage is available** and give a time range based on prior local runs only when such history exists. Do not manufacture a percentage.

The user can leave immediately. The project card remains in a `Preparing machine` state, the global action/activity centre reports failures, and returning resumes the same operation. While installation runs, the work pane may offer project work that does not pretend the machine is ready: read the scenario, inspect the network plan, define the success check, or review the commands Fadi expects to propose. Send an in-product notification when ready; browser notification is optional and separately consented.

Cancellation is stage-aware. Queue, pull and create may be cancellable; a stage that cannot safely stop says **Finish this stage, then stop** and records the request. A cancel control that silently disappears repeats the current design defect.

## Learning becomes a section

One page no longer matches the domain. Use these routes under a Learning section:

| Route                                  | User question              | Contents                                                          |
| -------------------------------------- | -------------------------- | ----------------------------------------------------------------- |
| `/dashboard/learning`                  | What should I learn next?  | recommendations, commitments and current project continuation     |
| `/dashboard/learning/projects`         | What am I building?        | project cards, state, evidence strength and resume action         |
| `/dashboard/learning/projects/[runId]` | What do I do now?          | the two-pane project workspace and project timeline               |
| `/dashboard/learning/machines`         | What compute can Fadi use? | laptop and peers, health, capacity, active assignments and grants |
| `/dashboard/learning/activity`         | What happened and why?     | intent-grouped operations, approvals, results and evidence        |

Machine access credentials, discovery controls and policy defaults belong in Settings. A usable machine is a resource in Learning/Machines. This removes the current settings-page-inside-a-dashboard confusion without hiding administration.

The global pending-action queue stays in the OS shell. The project workspace may show the pending action associated with its run, but it consumes the same durable request record; it does not create a second approval system.

## Placement

Placement is decided when a project provisions or starts a machine. The launch review shows:

- **Recommended: This laptop** — enough memory, KVM available, lowest latency;
- the workload estimate and capacity left after placement;
- alternatives such as the Proxmox peer, with concrete disqualifiers or tradeoffs;
- the exact grant needed on the chosen resource.

The ordinary path accepts the recommendation. **Change host** opens the alternatives. The machine inventory is where a person manages peers; the project launch is where they decide where this workload runs. A frozen host picker embedded in general settings confuses those two decisions.

Placement must bind to a resource ID and a capability snapshot, not an IP address. IP is mutable connection data. If health or capacity changes before execution, preflight invalidates the placement and asks again rather than quietly choosing another host.

## Component boundary I will own

I will take the component layer for the project workspace and intent-level activity:

- restructure `machine-access.tsx`, `project-run.tsx` and `lab-fit.tsx` around the routes above;
- add the two-pane workspace, evidence attachment surface and project timeline presentation;
- project the global action records into the workspace without duplicating their state;
- define responsive behavior: tabs for **Step / Machine / Evidence** below desktop width, while keeping machine session state alive when changing tabs.

Backend contracts needed from Claude:

1. a durable provisioning operation with stage, timestamps, cancellability, failure and resource ID;
2. an opaque machine-session descriptor matching the `MachineSurface` union above;
3. evidence/activity events keyed by `runId`, `stepId`, `actionRequestId` and optional artifact ID;
4. placement candidates with reason, capacity estimate and required grant;
5. completion requirements per step, including which proof types Fadi can verify.

Until those exist, I will not fake machine readiness, progress, cancellation or verification in local component state. Existing capabilities can be reorganized now; controls that require a durable contract should render their actual unavailable/preparing state.
