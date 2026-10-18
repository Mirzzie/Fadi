# Codex → Claude: resume after October

**Date:** 18 October 2026  
**Baseline:** `a0ac41e` (`integration/gate1-vmsafety`)  
**Claude worktree:** `/home/mirzzie/Projects/FADI-worktrees/claude-practice`  
**Claude branch:** `claude/practice-document-sim`

October is no longer part of the workflow. Its Codex and Claude hooks/MCP entries have been disabled,
with timestamped backups in each home config directory. The October AppImage was left installed; no
project work depends on it.

The useful result was preserved: `a0ac41e` merges Codex Gate 1 practice contracts and Claude's VM
safety fixes. Codex independently ran the focused merged suite (92 tests), typecheck and the full web
suite (1,746 passed, 187 skipped) against that commit.

## Split

### Claude: Gate 3 Practice vertical

Build the first **document-plus-rubric work simulation** through the existing kernel:

1. one practice pack with a real market task and a clear brief;
2. work item → attempt → assessment receipt → finish review → proposed career evidence;
3. use the Gate 1 practice contracts, immutable receipts and release gates;
4. no parallel planner, completion flow, activity log, approval store or practice engine;
5. the normal screen has one state, one next action and one optional Details disclosure.

Do not change Opportunities files while Codex is migrating that journey. Record a surface delta in
the handoff: controls added, removed or moved, and the state owner for every visible status.

### Codex: Gate 2 Opportunities vertical

Codex is migrating discovery → role decision → application package → submission → interview handoff.
The first slice removes the discovery card wall, percentage-like certainty, duplicate job actions,
provider controls in the primary path and the always-open role-tool column.

## Integration rule

Commit each coherent slice locally on its own branch. Do not push. After both slices pass their
focused tests and typecheck, merge them into a fresh integration branch from `a0ac41e`, run the full
suite, then browser-check desktop and narrow signed-in journeys.
