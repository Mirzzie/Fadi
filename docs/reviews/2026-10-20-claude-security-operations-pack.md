# Claude → Codex: Security Operations pack (suspicious sign-ins), and one request

**Date:** 20 Oct 2026
**Branch:** `claude/practice-incidents`, cut from `integration/2026-10-20`
**Scope:** Practice only, on the existing engine. No shared contract, schema, migration or
ADR 0015 code. This is the "alongside" item in the roadmap: the owner's own proof, now.

## What it is

`fadi.security-operations` / `suspicious-sign-ins`, experimental. Each person gets their own seeded
sign-in log for a made-up company:
- **attack:** a password spray or a brute force;
- **way past MFA:** legacy auth with no MFA, or MFA fatigue;
- **false alarm:** a locked-out user or a traveller;
- **addresses:** only from the RFC 5737 documentation ranges.

Three steps that add up to an incident write-up:
1. **Triage:** four picks, checked exactly (attack type, source address, account taken over,
   innocent activity). The note must cite the exact address and the time the account fell
   (checked exactly); the model judges only the explanation.
2. **First hour:** must name the account and address (exact). The model judges containment
   order, scoping and closing the way in.
3. **Incident report:** the timeline must use the log's own times (exact). The model judges the
   summary and impact, the root cause, and actions versus prevention.

Hints don't name accounts or addresses (tested). Feedback never gives an answer away (tested).

## Browser check (gemma3:4b, throwaway account)

**Results:**
- a correct triage **passed 6/6**, and the model's comment quoted the person's own words;
- "Start the project over" gave a new case;
- 0 console errors.

**Defects found and fixed:**
- **`CaseTable` keyed rows by their first cell,** so React warned about duplicate keys on log
  rows sharing a time, which can drop or duplicate rows. Rows are now keyed by position.
- **The log wrapped every cell onto 2–4 lines.** Long tables (more than 12 rows) now render one
  line per entry, monospaced, scrolling sideways inside their box. Columns are ordered evidence
  first (time, user, result, detail, IP), with shorter wording. Short tables, like churn, keep
  wrapping.
- **The decoy contradicted itself:** a normal sign-in while locked out, or from home while
  abroad. Fixed, with a test.
- **Four pickers now lay out two by two.**

**Marking:** the step's marker must still pass the churn-review marking check (rubric-eval v2). A
security-specific evaluation set is the follow-up (ADR 0015, contract 8).

## Request (your file, so I didn't change it)

`components/learning/learning-shell.tsx` has one "Work simulation · experimental" card, hard-wired
to churn review. Please make that **one** card show the simulation matching the person's active
track, rather than adding a second card. A security, IT or infrastructure track gets
`/dashboard/learning/practice/fadi.security-operations/suspicious-sign-ins`; everything else
keeps churn review.

The two activities are the `installedActivities()` entries in `lib/practice/packs/index.ts`;
their `pack.domain.id` is `customer-success` or `security-operations`.

**Surface delta:** none added. The card's target varies; primary actions stay at 1.

## Verified

- Practice tests 85 (16 new), with 40 seeds checked for internal consistency.
- **Full web suite: 1,801 passed, 0 failed.**
- Typecheck 0; lint 0; diff check clean.
