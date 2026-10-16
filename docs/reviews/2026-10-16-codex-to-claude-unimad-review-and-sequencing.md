# Codex to Claude: UniMad review and the migration sequence

**Date:** 16 October 2026
**Status:** Working handoff. Canonical decisions are in `docs/UI_UX_GUIDELINES.md` and
`docs/ROADMAP.md`; delete this note when the assignments land.

## Visual priority correction

UniMad is not a primary style reference. Pipecat leads the visual and realtime experience;
Paperclip leads work structure. Current Fadi contributes its career language and proven contracts.
UniMad is used only to compare whether the career journey is complete and simple.

## Answer

Add UniMad to the reference set. Do not add UniBoard, another top-level route or another visible
agent family to Fadi.

Fadi already contains discovery, matching, saved roles, applications, documents, interview practice,
portfolio and personal-brand work. Rebuilding those features under a UniBoard label would duplicate
the architecture. The missing product is the connected journey and its reliable state.

## What was actually verified

The supplied `/uniboard/jobs` URL redirected an unauthenticated browser to sign-in. Therefore the
private jobs UI, interactions, ranking and data quality remain unverified.

REA evidence:

- authenticated-route redirect target:
  `ev_6b51657defa1472a20357628162f46e2444cd54da6cffde330adfe2500f0986c`
- sign-in page and accessibility structure:
  `ev_c8e42dd97bf6a5974f69083c376e6a059ced13b82ac2f0f11b9f59cc9afe7d9b`
- public Next.js/React bundle analysis, 22 of 22 observed scripts parsed:
  `ev_27474948870c7a8c093466897ec49b6c0332a13c77d6f512eb4665bb08c817bb`
- public homepage target:
  `ev_3dd8021f7af39f0453d32b0e4db3d9a549b37cd0885b3de6584e7bdd92333624`
- public homepage structure and accessibility:
  `ev_3acd40193e1c410d0abd44b00575452e5661d5164f93d955cb9b7a0fb7ff4af1`
- public homepage screenshot:
  `ev_21ffaaeeecee3652d28d056befa8729e86bd88feec5f517c5810a5e6d7186ce7`

Observed on the public surface: restrained navigation, generous whitespace, one dominant statement,
one primary and one secondary action, strong social proof, and a persistent assistant entry. The
bundle analysis proves framework and observed static structure, not authenticated behavior.

Public V2 descriptions say its modules use the same profile data and connect discovery, positioning,
networking and applying. That is a useful product direction. Claims about speed, interview volume,
ATS score or success rate are vendor claims and are not evidence that its matching or UI is better.

## What Fadi should borrow

1. One profile and direction grounding every step.
2. A low-clutter entry into job discovery.
3. One continuous path from discovery to application, interview and outcome.
4. Personal positioning before mass document generation.
5. Human language and emotional calm for a stressed job seeker.

## What Fadi should reject

1. Eight visible agents or modules. Fadi is one orchestrator; specialists are capabilities.
2. Another job-board destination. Jobs are the discovery stage of Opportunities.
3. An ATS or fit number presented as a fact.
4. Testimonials, coaching conversion and marketing proof inside the signed-in work surface.
5. Copying a private screen that has not been independently observed.

## Current Fadi Opportunities problem

The current Jobs page shows, in order, a search card, worldwide control, import link, filter toggle,
auto-search strip, source-health disclosure, search progress, a large hero, cache age, coverage
notice and tall result cards. Much of that information is honest and useful, but the hierarchy makes
source machinery compete with the role decision.

Keep the information and change its placement:

- one search/intention field;
- compact results list;
- selected-role detail;
- one stage-aware action;
- source health, cache explanation and provider failures under **Search details**;
- full description and matching explanation in the selected detail;
- application stage carried into the same workspace.

Do not delete source-health diagnostics. They are why Fadi can distinguish no jobs from a failed
search. They simply should not occupy the primary path.

## Sequence: neither big-bang facelift nor feature work as usual

A platform-wide facelift first would leave correctness defects behind a new skin, create a long-lived
branch and collide with active lab/interview work. Continuing feature work unchanged would add more
surfaces that must later be removed.

Use incremental journey replacement:

### Gate 0 — continue safety and correctness

- Claude finishes the current lab conductor's correctness, recoverability and completion handoff.
- Codex preserves and resolves the existing interview/A2A work; no new interview screen hierarchy
  lands before the shared session contract.
- Data identity, portfolio reconciliation and job-source truthfulness remain eligible work.

### Gate 1 — shared experience primitives

Codex owns the work-thread event contract, one attention projection, semantic Fadi states, session
envelope, typed screen commands and shell hierarchy. Claude reviews the contract against the lab
conductor before either implementation expands.

### Gate 2 — first vertical migration: Opportunities

Codex migrates discovery → role decision → preparation → application → interview handoff. Existing
routes may remain, but they project one journey. The old hero, repeated controls and parallel
analysis panels are removed as replacements land.

### Gate 3 — second vertical migration: Practice

Claude migrates recommendation → commitment → lab/interview work → verification → completion. The
existing project conductor is retained as the single owner.

### Gate 4 — My career and Today

Migrate intake/projection, then make Today the final cross-journey projection. This order prevents
Today from being redesigned against unstable downstream models.

## Ownership

### Claude

- finish lab correctness and completion on the existing conductor;
- inventory and remove overlapping Practice surfaces;
- do not add navigation, Fadi presence, attention or work-thread primitives;
- review Codex's shared contracts against machine and lab failure cases.

### Codex

- finish or safely reconcile the current interview/A2A working tree;
- build the shared experience contracts;
- redesign Opportunities as the first reference journey;
- keep job-source honesty while demoting source controls to diagnostics;
- add signed-in desktop and narrow-viewport journey checks.

### Both

Do not begin an all-pages visual restyle. Share tokens and primitives, then transform one end-to-end
journey at a time. Each handoff includes its surface delta and a list of deleted legacy components.
