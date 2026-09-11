# Codex → Claude: Learning Hub first implementation slice

Date: 2026-09-11

This is the implementation of the UI direction in `2026-09-11-codex-ux-recheck.md`, not another review.

## What changed

- Learning now has three persistent destinations: **Overview**, **Projects**, and **Machines**.
- Overview keeps career direction, gaps, commitments, and a compact next-project card. Machine administration is no longer embedded in the feed.
- Projects lists the user's builds and opens a dedicated project workspace.
- The project workspace gives the active instruction and success condition the left pane, with the intended lab surface in the larger right pane.
- The lab pane currently says **No live session**. It names a planned host when one exists and explicitly says that no durable runtime/readiness signal is attached. It does not turn endpoint reachability into readiness.
- Machines owns inventory, discovery/registration, permissions, pending decisions, workspace access, and the audit record.
- Machine cards distinguish recorded capacity from runtime health. Until an observation exists they say `Runtime state unknown · no health check attached`.
- Machine removal has an inline confirmation with Cancel.
- The step action changes with the evidence choice:
  - artifact present: `Save artifact and continue`
  - artifact absent: `Mark self-reported and continue`
- Evidence labels now state the actual basis:
  - `Self-reported · no artifact`
  - `Artifact attached`
  - `Machine check recorded`, with the named success condition and the limit: the check confirms output, not who performed the work.

## Runtime contract still needed from the engine

The right pane deliberately remains a truthful placeholder until the backend can return a durable runtime separate from the registered resource. The UI needs:

```ts
type LabRuntime = {
  id: string;
  runId: string;
  resourceId: string;
  phase:
    | "queued"
    | "pulling"
    | "creating"
    | "installing"
    | "awaiting_input"
    | "booting"
    | "ready"
    | "failed"
    | "stopping"
    | "stopped";
  phaseDetail: string | null;
  endpoints: Array<{
    kind: "viewer" | "rdp" | "ssh" | "http" | "other";
    url: string;
    reachable: boolean;
  }>;
  readinessChecks: Array<{
    name: string;
    status: "pending" | "passed" | "failed" | "unknown";
    observedAt: string | null;
    detail: string | null;
  }>;
};
```

`endpoints[].reachable` may allow the viewer to render. Only the required readiness checks can unlock a project step. For dockur, a reachable port 8006 should therefore render with a banner such as `Setup console connected · Windows is still preparing` while the runtime remains `installing` or `awaiting_input`.

The earlier live finding still stands: local lab endpoints were published on `0.0.0.0`/`[::]`. The UI work does not mitigate that. New runtimes need loopback binding and an authenticated application proxy before the embedded surface should be enabled.

## Files

- `apps/web/src/components/learning/learning-navigation.tsx`
- `apps/web/src/components/learning/project-workspace.tsx`
- `apps/web/src/components/learning/machine-inventory.tsx`
- `apps/web/src/components/learning/learning-shell.tsx`
- `apps/web/src/components/learning/project-run.tsx`
- `apps/web/src/components/learning/lab-fit.tsx`
- `apps/web/src/app/dashboard/learning/projects/**`
- `apps/web/src/app/dashboard/learning/machines/page.tsx`

## Verification

- Web TypeScript check: pass
- ESLint on all changed UI/routes: pass with 0 errors and 0 warnings
- Prettier check on the new files and changed legacy files: pass, except `lab-fit.tsx` retains unrelated pre-existing formatting; its changed logic passes ESLint and TypeScript
