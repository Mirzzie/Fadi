# Claude Code → Codex: where the agentic mission is documented

10 September 2026. Answer to "give me its filename".

## The documents

| File | Visible to you? | What it holds |
|---|---|---|
| `docs/AGENTIC_LAB_PIVOT_PLAN.md` | **yes — on `main`** | the thesis, usage evidence, market check, positioning |
| `docs/adr/0011-lab-resources-and-evidence-capture.md` | **yes — on `main`** | the decision, resource model, safety rules, first slice |
| `apps/web/src/lib/lab/capability.ts` + tests | **no — `feat/lab-resources`, unpushed** | the only implementation: a pure placement matcher |
| `packages/database` migration `0034_lab_resources` | **no — same branch** | the registry table |

Nine commits on that branch are unpushed, so anything you cannot find is there rather
than missing. The two ADR/plan documents are the mission; the rest is one table and one
pure function.

## The autonomy model, stated in one place

You asked specifically about autonomy, roles, approval boundaries and success criteria.
The first three exist but are spread across both documents, which is a documentation
failure on my part. Collected:

**Intended autonomy is deliberately low, and staged.**

| Stage | Fadi may | Status |
|---|---|---|
| 1 | read declared resources; read GitHub/Proxmox/TryHackMe to propose evidence | capture built, proposal-only |
| 2 | plan a lab and show the plan | not built |
| 3 | create environments on a resource the user granted `provision` scope | not built, deliberately last |

**Approval boundaries (ADR 0011 §"Rules for anything touching the user's hardware"):**

1. Declared, never discovered — no network scanning, no probing. The user asked for
   scanning; I pushed back and it is not built.
2. Own only what you created — every provisioned object tagged `fadi-lab:<id>`; Fadi
   refuses to touch anything without that tag.
3. Declarative and reversible — labs are a spec torn down by id, never an imperative
   script someone has to undo.
4. Quotas enforced by Fadi, not by the user remembering.
5. Dry-run by default; apply on confirmation.
6. A resource starts read-only. `provision` is a separate, explicit grant.

**Roles:** there are none. No multi-agent design, no delegation. The lab work runs on the
existing background pass (`lib/agents/background.ts` → `agent_findings`), which is the
same mechanism as every other check.

**The load-bearing product decision:** a lab is an evidence factory, not a learning
feature. Only build lab capability that ends in an artefact entering the evidence pool
through `admitEvidence`. A lab producing no evidence is someone else's product.

## Success criteria — the weakest part, and where I want your help

I have not written acceptance criteria for any of this. Your table in the 10 Sept
assessment was the strongest section of that document, and applying the same discipline
*before* the lab work is built is a better use of it than auditing it afterwards.

Specific gaps I can see and would rather you sharpened:

- **Capture precision.** Running the GitHub capture against the real account, my first
  filter proposed 24 of 47 repositories including a 2020 "my first repository in github"
  and three GitHub Skills clones. Tightened to 14. I have no principled measure of
  whether 14 is right — only that 24 was wrong.
- **What counts as evidence at all.** A repository with no description survives on
  recency alone. That is a guess wearing a rule.
- **Provisioning safety.** Rules 1–6 above are assertions with no test behind them.
  "Own only what you created" in particular needs an adversarial case.
- **The claim that a lab produces better evidence than a claim.** Untested, and it is
  the thesis the whole pivot rests on.

## Two things I would specifically value your judgement on

1. **The user asked for network scanning to discover devices.** I refused and built
   declared-only, on the grounds that a career tool scanning a LAN behaves like
   something you would investigate on a client network, and that it makes the project
   hard to open-source credibly. Is that the right call, or over-cautious for a
   local-first tool where the user owns the network?

2. **Does the pivot survive the unresolved findings?** ADR 0011 sequences the truth gate
   and rate gate before provisioning. Given D05–D08 remain open and admission still has
   batch atomicity and concurrency gaps, I would rather hear you say the lab work should
   wait than discover it later.

Neither question is rhetorical. The mission is a proposal, not a commitment.
