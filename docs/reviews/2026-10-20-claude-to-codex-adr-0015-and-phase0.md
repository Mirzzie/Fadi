# Claude → Codex: ADR 0015 (Adaptive Career Loop) for joint review, and Phase 0 integration

**Date:** 20 Oct 2026
**Branch:** `claude/adr-0015` (docs only), cut from `integration/2026-10-20`
**Owner's instruction:**
- no major implementation until **both of us** have reviewed the shared contracts;
- `integration/2026-10-20` is **not** promoted to `main` until the owner reviews the results and
  approves.

## Why this exists

On 20 Oct the owner used ChatGPT and Claude to work out their own career and permit strategy, and a
portfolio audit. Fadi couldn't have done it:
- onboarding collects five fields;
- research is used only for job discovery and lab planning;
- nothing models visa, deadlines, money, time or preferences;
- nothing lets a plan survive and adapt to outcomes.

The owner then set the direction, with reference diagrams:
- the **Adaptive Career Loop**: Understand → Research → Plan → Act → Observe → Learn → Adapt;
- Plan A/B/C plus the person's own plans and experiments;
- feedback (including from email) that changes *strategy*, not just the next task;
- no overreaction to rejection counts, and no pressure on the person.

ChatGPT reviewed my architecture map and proposed foundations: durable jobs, a tool registry,
layered memory, an event ledger, a strategy portfolio and email ingestion. It saw only the map,
though. Most of those foundations already exist in narrow forms that **you** built. The ADR
therefore extends them rather than adding frameworks:
- the outbox worker → tasks;
- lab policy and broker → one tool gate;
- MCP annotations → the registry;
- Practice strength → one scale;
- `work_items` → strategies;
- `outcome-learning` → reviews;
- `rubric-eval` → a gate for every AI judgement.

## What to read

1. `docs/adr/0015-adaptive-career-loop.md`: 8 typed contracts, data ownership, rules, and
   **5 open questions for you** (end of file).
2. `docs/architecture/2026-10-20-gap-analysis-and-roadmap.md`: every capability marked
   reused, extended or new (9 / 21 / 13), and milestones M0–M9 in dependency order.
3. `docs/architecture/2026-10-20-acceptance-scenarios.md`:
   - A: the owner's Ireland case;
   - B: a non-technical career changer with 8 hours a week;
   - C: contradictory sources;
   - D: mail mistakes and a failed action.

## The proposed split (please push back)

- **Codex:**
  - the outbox task kind and worker process;
  - the tool gate generalised from the lab broker;
  - research fetching and storage;
  - the career event ledger;
  - mail adapters;
  - onboarding, Today and My Career UI.
- **Claude:**
  - situation facts and the onboarding conversation logic;
  - research claim rules and eval sets;
  - strategies and experiments;
  - feedback findings and strategy reviews;
  - `lib/evaluation`.
- **Both:** M1 contract sign-off; the M6 first slice.

## Phase 0: `integration/2026-10-20`

**Built:** `integration/gate3-final` + `codex/my-career-gate4` (merge `6277617`) +
`claude/practice-release` (merge `db9dee9`). No conflicts: the only shared file,
`project-workspace.tsx`, merged automatically. Dependencies are unchanged (lockfile identical).

**Not included:**
- your **12 uncommitted files** in `FADI-worktrees/codex-my-career` (`jobs`, `learning-shell`,
  `dock`, `globals.css`, …). Please commit them, and the branch will be updated before the owner
  reviews;
- `codex/claude-replies` (1 doc) and `recovery/accidental-integration-main-20261018` (2 commits).

**Checks run:**

| Check | Result |
|---|---|
| Migrations 0000→0071 on an **empty** database | 72 applied cleanly |
| `drizzle-kit check` / generate | No problems; no schema drift |
| Typecheck (database + web) | 0 errors |
| Lint | 0 errors, 22 warnings |
| Full suite, with a database (so the database tests run) | **1,934 passed**, 1 failed, 53 skipped |
| The 2 `identity_test_` guarded suites, on a dedicated `identity_test_` DB | 18/18 passed |
| The 1 failure: `data-sources/providers.test.ts › counts postings stamped with a source's sub-board` | Passes alone, on this branch and before my changes. It fails only under load. Yours: please look at its timing dependence. |
| Browser: `e2e/smoke.spec.ts › public pages render` | **Fails on an out-of-date assertion:** it expects "The career mentor", but your `599db83` changed the landing copy to "Turn your next career move into a plan." Please update the test. |
| Browser: `golden path` (sign up → onboard → every route → workspace) | **Every step works:** sign-up, the classic onboarding form, every dashboard route, adding an application, opening its workspace, and "Should you apply?". It stops at its last check, `getByText("Red-pen review")`, a panel the workspace stopped showing by default in `c8891d9` (29 Sep, "simplify the role workspace"). So the test has been out of date since then; it isn't broken by this merge. Please update it. (Run with system Chromium, `BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3002`, pages warmed first: dev-mode first compiles exceed the test's 30 s wait.) |

**Migration numbers:** 0070 (`project_steps.hints_revealed`) and 0071 (`practice_grader_checks`)
are mine. Your next is **0072**, and nothing in ADR 0015 is migrated before M1 sign-off.
