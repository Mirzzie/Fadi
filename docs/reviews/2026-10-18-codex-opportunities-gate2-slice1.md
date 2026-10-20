# Codex: Opportunities Gate 2, slice 1

**Date:** 18 October 2026  
**Branch:** `codex/opportunities-gate2`  
**Baseline:** verified integration commit `a0ac41e`

## What October left behind

October's useful project result is one clean integration commit: `a0ac41e`, combining Codex Gate 1
practice contracts with Claude's VM-safety fixes. Its paid coordination runtime is not required by
the code. Global October hooks and MCP entries were disabled for Codex and Claude with timestamped
backups; the application itself was left installed.

## Problem

Opportunity discovery exposed implementation detail and competing actions. A role card showed a
percentage, full description, matched keywords, five controls and a status selector. The workspace
then opened fit, documents, outcome, quality scoring, red-pen review, interview preparation and
company research as peers in a two-column tool wall. A later change (`e30165e`) explicitly replaced
one disclosure with this always-open layout.

The person had to decide which Fadi subsystem to run. The score also looked more precise than the
ranking model can justify.

## State ownership

- Discovery ordering remains owned by the existing job matcher.
- Application stage remains owned by the application record and is changed in the application
  journey, not independently on every discovery row.
- The role workspace derives its one visible next action from that application stage.
- Source health remains owned by the source service and is projected under **Search details**.

## Surface delta

### Discovery

- Removed: decorative hero, visible 0–100 match percentage, full descriptions on every row,
  permanent matched-keyword chips, `Apply with Fadi`, duplicate `Open workspace`, and the status
  selector.
- Added: no new capability or permanent control.
- Moved: description, metadata and matched terms under one **Role details** disclosure; provider
  state and background-search settings under one page-level **Search details** disclosure.
- Primary action before: Save job, Apply with Fadi, Open workspace and View original competed.
- Primary action after: one stage-aware action (`Review role`, `Continue application`, `Prepare for
  interview`, or `Review outcome`). Save and original posting remain secondary.
- Presentation: the internal score now orders roles but renders as a qualitative, explainable band:
  **Strong evidence**, **Possible fit**, **Needs review**, **Experience gap**, or **Outside direction**.

### Role workspace

- Removed: the 96rem two-column tool wall, a second pre-application interview-prep panel, and the
  overlapping numeric application-quality panel.
- Added: no new capability or permanent control.
- Moved: saved documents, red-pen review, company research and non-current-stage controls under one
  **Role details and tools** inspector.
- Primary action before: several open panels each had a primary-looking action.
- Primary action after: fit decision before applying, interview preparation after applying, or
  outcome handling after the journey ends.

## Validation

- Focused job tests: 35 passed; one database integration test skipped without its opt-in database.
- Changed-file ESLint: zero errors and zero warnings.
- Web TypeScript check: clean after making the isolated worktree resolve its own merged workspace
  packages rather than the main branch's older database package.

The next slice should connect the fit decision to a durable stage transition, then make the
application package one reviewable output rather than separate document generators.
