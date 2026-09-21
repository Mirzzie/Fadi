# Claude Code → Codex: finish line, H01–H03, A12, A07, Docker A11

Date: 2026-09-13. All uncommitted. Web + database typecheck clean; normal suite
**1,099 passed, 45 skipped**. "Live" below means real Docker on the owner's laptop and/or the
owner's configured provider against a throwaway database created and dropped for the run.

## Finish line (accepted design)

- **Run completion is central.** `setStepStatus` locks the run row (`FOR UPDATE`) and settles
  status in the same transaction: done only when every step is done from a nonempty set;
  skipped ≠ met; reopening reopens. `settle()` repairs runs finished before this existed.
- **Migration 0048** `project_runs.evidence_item_id` (FK set null, unique). Generated with
  drizzle-kit, run on a throwaway DB, then applied.
- **Save once.** `saveEvidenceOnce` locks the run; an existing link returns it and never calls
  create. Evidence goes through `admitEvidence` — extended with an optional `{ db }` so the
  gate runs inside the caller's transaction (its own transaction becomes a savepoint) and now
  returns `insertedId`. No gate allow-list change; `gate.test.ts` passes.
- **Review** is deterministic (`lib/learning/project-review.ts`): "checked" / "result
  recorded" / "self-reported"; self-reported steps never become outcomes; no "attached" wording.
- **UI:** one primary Save as evidence, secondary Finish without evidence; afterwards Open
  evidence, Practise telling it, and **Draft a LinkedIn post** on request.
- **Post draft:** from saved evidence + recorded results only; `truthCheck` + `findAiTells`,
  one repair, remaining findings shown. Deterministic canvas card. Copy text / Download image /
  Open LinkedIn as separate actions, with "paste it" wording.

Evidence: integration tests (real Postgres) — completion/reopen, skipped, settle, not-finished
refusal, **two concurrent saves → one evidence row**. Live drive: save refused before steps,
review labels correct, two concurrent `saveProjectEvidenceAction` → one item, same id returned.
Live post draft with the owner's Groq model: no truth-gate findings; limitation stated.

## H01–H03

- **H01:** Docker `State.Error` checked first → failed with that text; OOM → failed; 0 →
  stopped; 143/137 → "stopped by a signal (exit N)", no cause claimed. Tests added.
- **H02:** leftovers report `keptData` from a named `fadi-<name>-storage` volume **or any
  attached volume** (the owner's `fadi-dc02` used an anonymous volume from older code). The
  action reads "Remove container · keep data"; a volume without its container stays listed.
  No data-removal action and no prune.
- **H03:** project association from durable `lab.start` requests of current runs, not observer
  success; removal revalidates the leftover list server-side before proposing. Not done: container
  labels / identity beyond name — still name-based, as the broker's `ownWorkOnly` is.
- **H04** untouched (after your observer work).

## A12 — replan keeps history

`replaceSteps` keeps done steps (results, completion kind untouched), deletes only unfinished
ones, numbers new steps after the kept ones, **no longer changes placement**, settles the run.
The planner receives the completed steps and plans only the remainder (schema min 1).
Integration test on real Postgres.

## A07 — explicit target

`lib/lab/target.ts`: resolved from stored `resourceId` + endpoint only —
`local-docker` (no placement, or `local://docker`), `vmware` (`vmware://local…`), else
`unconnected` (including a removed resource). Used by prepare / stop / resume, the AI tool path
for `lab.start`/`lab.build`/`lab.buildFile` on a project, and planning (only connected resources
are placement candidates). Unconnected refuses with no fallback; moving to this computer is an
explicit `runOnThisComputerAction` (audited), not a replan side effect. `RunView.target` drives
the lab pane label.

Live drive: project placed on an endpoint-less "Proxmox" resource → prepare/stop/resume all
refused, **zero `lab_action_requests` rows**.

## Docker A11 — one guest action + named check, continued by the broker

- New recipe **`lab.check`**: `docker exec fadi-<name> sh|bash -c "<command>\necho
  __FADI_CHECK_EXIT=$?"`; ownWorkOnly; 600-char command, marker forgery refused; 30s, 256KB,
  last 8KB kept. Blast container / disruptive → click confirm. Summary shows the command and the
  expected text. Catalogue safety test extended to cover it.
- **Continuation lives in `approveAndRun`:** after a `lab.check` runs, `checkVerdict` decides; a
  pass marks the request's `stepId` done with completion `verified` and the output excerpt. So
  approval from the global queue, another tab or after reload continues the same step.
- `proposeStepCheckAction`: target must be local-docker, lab running, non-Windows; the model
  writes `{command, expect, why}` from the step + success condition + lab facts; actor recorded
  as `model`.

Live drive (real container, owner's provider): lab.start approved → container running → check
proposed (`nginx -t 2>&1 | sed …`, expect "syntax is ok") → approved → **step 1 verified with
output**, step 2 untouched → approving the same request again refused. Container removed after.

**Not established:** a durable runner — a process crash between execution and `finish` leaves
the request `approved` (your A08); a failing check live (unit-tested only); Windows/VMware
checks; model-written check quality beyond this one case. "verified" means the named output
appeared — not that the person did the work unaided (your A13 distinction still applies).

## Also changed

- "Stuck? Show Fadi the error" (paste terminal output → diagnosis + commands; revise only an
  unfinished step). Commands are structured fields so they render as blocks.
- Container facts: no service manager, no firewall permission, nginx already running, nginx logs
  are stdout/stderr symlinks — in the briefing; `rc-service`/`systemctl`/`service x start` flagged.
- Machines page lists each project's lab and leftovers; simplified project workspace and
  Machines page per the owner's "too much to see" feedback.

## Addendum — driven in the real UI (Brave headless, owner account, temporary test project)

Start lab → approve → lab ready → Check it for me → approve → step checked → Done → review →
Save as evidence → Draft a LinkedIn post → Pause → approve. No console errors. Test project,
its evidence item and container were deleted afterwards; audit rows were kept.

Fixed from what the screens showed: raw container id/name after approval → "Done."; `lab.check`
labelled "interrupts something" → reversible; internal origin names on the approval card →
words; review summary repeating Fadi's check command → shows what the check found; **post draft
invented a "challenge" and attributed Fadi's check command to the person** → prompt forbids an
unrecorded difficulty and states that "checked in the lab" lines are Fadi's confirmation (re-draft
verified live); completed projects no longer offer Stop.

**Owner report: projects not scoped to career direction.** Migration **0049**
`project_runs.career_profile_id` (FK set null, index). New runs record the active direction;
Learning hub, Projects page and the `project_status` AI tool show only the active direction's
runs (Machines still lists every lab, since they are on the laptop). The two existing runs were
assigned to SOC Analyst from timestamps: both created 11–12 Sep while SOC Analyst was active; SOC
Analyst and IT System Administrator profiles were both updated within 4 ms at 23:50 on 12 Sep
(the switch). Suite: 1,101 passed.
