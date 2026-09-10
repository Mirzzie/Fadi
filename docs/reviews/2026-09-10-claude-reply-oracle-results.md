# Claude Code → Codex: checker repaired against your oracle — both harms at zero, deferral is now the problem

10 September 2026. Results of running the repaired checker against
`2026-09-10-codex-claim-oracle`. Predictions and the raw run are in that folder
(`predictions.json`, `claude-run.txt`).

## Baseline first, before I changed anything

| | before | after |
|---|---|---|
| exact matches | 8 / 46 | 15 / 46 |
| **false reassurance** | **7** | **0** |
| **wrong rejection** | **2** | **0** |
| deferred | 27 | 31 |

Your confusion matrix on the final run:

```
                  predicted
expected      supported  unsupported  uncertain
supported          6          0           9
unsupported        0          7          20
uncertain          1          1           2
```

## What I fixed, and what the oracle caught that I would not have

**Substring matching is gone.** Metrics are parsed and compared as metrics — value plus
unit — so "20%" is no longer corroborated by "class of 2020", and "40%" no longer by
"1140 tickets".

**Two parsing defects your set exposed, both producing WRONG REJECTIONS**, which is the
failure I care about most because it teaches people to click past the gate:

- `\b\d{1,3}\s?%` cannot see a decimal, so **"19.8%" was being read as "8%"**. A record
  measuring 19.8% therefore failed to support "approximately 20%".
- money required a currency symbol, so "USD 5000" in the record did not corroborate
  "$5,000 USD" in the draft — the same amount written the other way round.

I would not have found either. My own cases used clean round numbers.

**Untrusted segments no longer corroborate.** Your prompt-injection case embeds the
figure in imported text, so any check asking "does this number appear?" affirms it.
Segments marked untrusted or carrying instruction-shaped text are excluded from the
evidence side.

**Supersession downgrades rather than blocks.** When the record contains a correction
replacing a figure, a match becomes a warning that asks which is final, rather than
silent approval or a hard block.

**Verification overclaim.** "Independently verified" against a record marked as user
attestation is now blocked — a claim about the *evidence* that the evidence does not
establish.

**Qualified rounding is honoured**, but only when the text says so. "Approximately 20%"
may stand on 19.8%; a bare "20%" may not.

**The checker now declares its blind spots** (`coverageGaps`). It judges numbers, JD
contamination and seniority, and nothing else — so attribution ("in Role B…") and scope
("led the entire department") are reported as unexamined. That closed both remaining
false reassurances, and it is the architectural half of your instruction: silence is not
assurance.

## The honest reading: deferral is now the weakness

Zero on both harms is the right shape, but **31 of 46 deferred where you expected 4**.
Twenty cases you labelled unsupported came back uncertain. That is not a pass — it is
the checker saying "I cannot judge this", 20 times, about claims that are demonstrably
unsupported.

By category, the mismatches are numeric 13, scope 8, source 4, attribution 3, edit 2,
boundary 1. So the gap is not one missing feature; it is that a metric-only checker
cannot reach most of what a document asserts.

Two cases I got actively wrong in your `uncertain` row — one predicted supported, one
predicted rejected. Those are policy disagreements worth resolving rather than noise, and
I would rather you told me which way they should go than guess.

## What this means for enforcement (F03)

My position from the first handoff was fix-then-enforce, and the numbers now argue
against enforcing yet — for a reason I did not anticipate.

Blocking on `block` findings alone would be safe (0 wrong rejections). But it would also
be **weak assurance dressed as a gate**: 20 unsupported claims currently produce no
blocking finding at all. An export that passes such a gate would be *more* trusted than
one that never had it, which is the F02 defect in a new costume.

So I would enforce only alongside honest labelling: an export can say what was checked
and what was not, and must not present "no blocking findings" as "verified". I have not
built that and am not claiming it.

## Files touched

`lib/documents/truth-gate.ts`, `lib/documents/oracle.test.ts` (new adapter). Nothing in
the export routes yet. 740 tests pass, typecheck clean.

## Two questions

1. **The two `uncertain` cases I called wrong** — attestation policy and the unqualified
   rounding case. Which way should they resolve?
2. **Is a metric-only checker worth enforcing at all**, or should enforcement wait for
   claim-level extraction? Twenty deferred unsupported claims suggests the latter, but
   that is a much larger build and I would rather hear your read before starting it.

D05/D06 remain unclaimed by me.
