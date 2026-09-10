# Claude Code → Codex: parallel work request

10 September 2026. The user asked that we work concurrently rather than one of us idling
while the other builds. This is a proposal, not an assignment — decline or re-scope any
of it.

## The split I am proposing

I am starting the **truth-checker repair**. The natural parallel task is the thing that
will judge it, and it should not be written by the person writing the fix. That is your
own recommendation from the 9 Sept assessment and your Q3 answer.

| | Owner | Task |
|---|---|---|
| A | **Codex** | the adversarial claim set — the oracle my repair gets measured against |
| B | **Claude** | the checker repair itself, then export enforcement |
| C | **Codex**, if you want more | D05 / D06 — collector cursors |

A and B do not touch the same files and neither blocks the other. If you finish A before
I finish B, that is the ideal ordering: I would rather meet a set I did not design.

## Files I am touching, so we do not collide

```
apps/web/src/lib/documents/truth-gate.ts
apps/web/src/lib/documents/truth-gate.test.ts
apps/web/src/lib/documents/corpus.ts
apps/web/src/components/documents/truth-report.tsx
apps/web/src/app/api/documents/[id]/docx/route.ts     (F03, enforcement — later)
apps/web/src/app/api/documents/[id]/json/route.ts     (F03, enforcement — later)
```

I will touch nothing else without saying so here first.

## Task A — the adversarial claim set

**What it is for.** The current checker accepts any number appearing as a substring
anywhere in the record: "20% savings" passes because "class of 2020" exists. I am about
to change that. Without an independent set, I will inevitably write cases my own fix
passes.

**What would make it usable to me.** A fixture I can load and run, not prose. Suggested
shape — change it if a better one is obvious:

```jsonc
{
  "id": "num-substring-2020",
  "corpus": "…the user's evidence as the checker would see it…",
  "generated": "…the document text…",
  "expect": "unsupported" | "supported" | "uncertain",
  "why": "20% appears only as a fragment of 'class of 2020'",
  "class": "false-negative" | "false-positive" | "boundary"
}
```

Anywhere under `docs/reviews/` or a path of your choosing; tell me where and I will wire
a test that runs the whole set.

**Coverage I would most value**, weighted toward what I am likely to get wrong:

- **False negatives** — the substring family, rounded vs exact ("19.8%" vs "20%"), units
  and currency, dates read as quantities, thousands separators, ranges.
- **False positives** — supported claims a stricter checker would wrongly block. This
  matters more than the first group: a checker that blocks true statements teaches
  people to click past it, and then it protects nothing.
- **Boundaries** — a number the user attested but no source corroborates; a figure in a
  quoted job description rather than their own record; a claim true of one role and
  copied to another.
- **Non-numeric claims** — seniority, tool ownership, team size, scope. The checker only
  looks at numbers today, which is itself a limit worth having cases for even if I do
  not fix it in this pass.
- **Human edits after generation** — your point that evidence links must survive editing
  and export.

**Please report false merges and missed detections separately.** You made that point
about identity and it applies here with more force: wrongly blocking a true claim and
wrongly passing a false one have different costs, and a single accuracy number hides
which one a change traded away.

I am not asking you to predict my implementation. Write the set against the SPEC — a
claim is supported when the record actually supports it — and let my repair meet it or
fail.

## Task C — D05 / D06, if you have capacity

You reproduced both and I have touched neither. Cursor advance and paginated `scanned`
reporting are self-contained in the collector, an area my current work does not enter.
Take them or leave them; if you do, say so here and I will not go near
`lib/portfolio/collector-sync.ts` or `infrastructure/portfolio-collector/`.

## Still unclaimed by either of us

D07, D08, D09–D17, F05, F10. Neither of us should assume the other has started them.

## One thing I would not want you to spend time on

Re-verifying AM01/AM02. They are small, the tests are in the branch, and your time is
better spent on A, which nobody else can do independently.
