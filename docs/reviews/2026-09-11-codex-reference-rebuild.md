# Codex → Claude: reference-led Learning Hub rebuild

Date: 2026-09-11

The owner supplied TryHackMe and Hack The Box project-room references and asked for the Learning Hub, its sections, projects, projections, and engine design to be rebuilt around them.

## What I took from the references

I used their information hierarchy rather than their branding:

- the learning project is the destination;
- title, environment, progress, and next action are visible before secondary analytics;
- the machine control sits beside the task it enables;
- tasks form one guided sequence;
- machine startup has an observable state rather than an inert button;
- the learner can distinguish project progress from platform statistics.

I did not copy points, leaderboards, competitive difficulty, or “green means proven.” Those mechanics conflict with Fadi's evidence semantics and would make a machine observation look like an assessment of the learner.

## UI rebuilt

- Overview now reads **continue → route → prove → plan**.
- Its hero names the career direction and labels its three numbers as a plan snapshot: skills to prove, route stages, and active commitments.
- The existing score remains explicitly **Career report score**, never learning progress.
- Project cards now behave like rooms: status, steps, artifact count, assigned machine, a real progress bar, next task, and one primary continuation action.
- The project workspace now has a room-style hero, progress strip, Guided build and Evidence tabs, a lab-state banner, a sequential task panel, and a larger machine surface.
- The current task expands in place with its instruction, success condition, artifact field, and an action whose wording changes when the completion would be self-reported.
- The machine surface remains closed while runtime truth is absent. It does not infer a session from placement.
- Machines now explains the five engine stages in user language: match, review, prepare, observe, retain.

## Engine work included

`apps/web/src/lib/lab/runtime-contract.ts` now defines the intended runtime lifecycle, endpoints, observed progress, readiness checks, legal transitions, and UI projection helpers.

The tests prove:

1. a setup viewer may be reachable during installation without making the lab ready;
2. `ready` without at least one required passed check is not readiness;
3. progress appears only from observed completed/total values;
4. lifecycle transitions cannot jump from queued directly to ready.

The full storage, worker, gateway, retry, proof-receipt, and UI-projection design is in `docs/architecture/learning-lab-engine.md`.

## Security change

`renderTemplate` now publishes every template endpoint as `127.0.0.1:host:container`. A regression test covers Windows viewer/RDP, nginx, and PostgreSQL. This prevents newly created labs from exposing those ports directly to the LAN.

This does not repair the already-running `fadi-dc02`; Docker's existing binding does not change when source code changes. Do not destroy or recreate that lab casually while installation or user work may still be present.

Dynamic broker-assigned ports and the authenticated endpoint gateway remain required. Loopback binding closes the immediate LAN exposure for new runs but does not solve concurrency or authenticated browser access by itself.

## Verification

- Web TypeScript: pass
- Focused ESLint: 0 errors, 0 warnings
- Runtime, template, preflight, and broker suites: 36 tests pass
