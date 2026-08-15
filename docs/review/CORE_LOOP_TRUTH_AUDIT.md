# Core Loop Truth Audit — the evidence → application-packet loop

**Scope:** the one loop that hurts today — *select real evidence → generate a truthful, job-tailored résumé/cover-letter packet, fast, without slop.* Not the whole product. Traced from real runtime paths, not tests.

**Method:** followed `generateCareerDocument` → evidence pool → prompts → deterministic gate → export, and the one-click `autoPrepJobAction` packet path.

---

## Decision (up front)

> **Can Fadi currently produce a truthful, job-specific application packet in ~15 minutes for a candidate with weak conventional experience?**

**PARTIALLY.**

- It **can draft the whole packet in a single action** ([workspace/actions.ts autoPrepJobAction](../../apps/web/src/app/dashboard/applications/[jobId]/workspace/actions.ts#L134)), and its anti-slop *writing* architecture is genuinely strong — extractive-first résumé generation + a deterministic AI-tell/humanity gate ([generate.ts:181](../../apps/web/src/lib/documents/generate.ts#L181), [humanize.ts](../../apps/web/src/lib/documents/humanize.ts)).
- It **cannot yet prove the packet is truthful.** There is no claim→evidence link on generated documents and no deterministic *fact* gate — only a *style* gate. So the candidate still has to re-read and hand-verify every line, which is where most of the hour actually goes.
- It **is fully AI-gated**: no AI key → no documents at all. That violates the "useful without AI" requirement for exactly the half that hurts.

The blocker is **not clicks** (auto-prep already collapses them). It is **trust** (no provenance) and **access** (AI-only).

---

## Finding 1 — Where the hour really goes (friction) · P1

Auto-prep already one-shots résumé + cover letter + more ([autoPrepJobAction](../../apps/web/src/app/dashboard/applications/[jobId]/workspace/actions.ts#L134)). So the friction is **not** manual assembly. It is:

- **The evidence pool — the provenance backbone — is empty for most users.** The code says so out loud: generation degrades to "résumé/LinkedIn text only … your Evidence pool is empty" ([generate.ts:137](../../apps/web/src/lib/documents/generate.ts#L137)). With an empty pool, a thin-experience candidate's real projects/labs/certs never reach the draft — the exact candidate the product is for gets the weakest output.
- **No trust surface after generation.** The draft is produced and stored ([generate.ts:201](../../apps/web/src/lib/documents/generate.ts#L201)); the user cannot see *which claims are grounded in which evidence*, so they re-read the entire document defensively. That anxious re-verification **is** the hour.

**Root cause:** provenance is flattened to prompt text ([formatTopEvidence, pool.ts:176](../../apps/web/src/lib/evidence/pool.ts#L176)) and then lost — the model generates, and nothing traces the output back to the evidence.

## Finding 2 — Where slop / fabrication can still leak · P0 (truth risk)

The *style* defense is good; the *fact* defense is prompt-only.

- **The deterministic gate checks tone, not truth.** `stripAiTells` / `analyzeHumanity` catch corporate clichés, template bullet shapes, uniform rhythm, em-dash overuse ([humanize.ts:27](../../apps/web/src/lib/documents/humanize.ts#L27), [:154](../../apps/web/src/lib/documents/humanize.ts#L154)). Nothing checks for an **invented metric, a tool named only in the JD, or seniority inflation.** If the model leaks a fabricated number past the prompt, it ships.
- **JD-contamination path is open.** The job description is injected with "mirror its language and address its requirements" ([generate.ts:148](../../apps/web/src/lib/documents/generate.ts#L148)); the only guard that a JD keyword doesn't become a *claimed* skill is a prompt sentence ([generate.ts:183](../../apps/web/src/lib/documents/generate.ts#L183)) — not enforced post-generation.
- **No claim-state model.** `evidence_items` has `origin` (ai|manual|learning) ([schema evidence_items:876](../../packages/database/src/schema/index.ts#L876)) but no `verified / user_attested / inferred / contradicted / prohibited_from_export`, and generated docs carry **no** `evidence_id`. So Fadi cannot answer "what supports this sentence?" or block an unsupported claim from export.

**This is the doctrine ("Never invent. Always claim.") existing in the *prompt* but not in the *architecture*.** Prompts are advisory; a truthful product needs a gate.

## Finding 3 — Useful without AI? · P1

- **Works with no key:** fit decision (deterministic `scoreJobForUser`), job discovery/tracking, evidence management.
- **Dies with no key:** résumé, cover letter, auto-prep, red-pen review — all require `getUserDocGenerate` ([autoPrepJobAction:142](../../apps/web/src/app/dashboard/applications/[jobId]/workspace/actions.ts#L142)).

So today, a zero-budget user with no API key gets *decisions* but not *documents* — the opposite of the value proposition. There is no deterministic assembly fallback (templates + the user's own bullet library), even though `doc-templates.ts` and the extractive-first design make one very achievable.

---

## The minimal claim-state model (what unblocks truth)

Add to evidence, and thread through generation:

| state | meaning | export |
|---|---|---|
| `verified` | backed by a stored artifact/reference | ✅ |
| `user_attested` | user swears it's true, no artifact | ✅ (labelled) |
| `inferred` | Fadi derived it (e.g., a skill from a project) | ✅ only if user promotes to attested |
| `contradicted` | conflicts with another claim (dates/titles) | ⚠️ blocked until resolved |
| `unsupported` | no backing evidence | ⛔ **prohibited_from_export** |

Every generated factual line links to ≥1 evidence item; anything that can't link is `unsupported` and is **visibly excluded**, not silently shipped. This is the schema spine for both the trust surface (Finding 1) and the fact gate (Finding 2).

---

## Proposed two-week validation build — **exactly 5 changes**

1. **(P0) Deterministic pre-export truth gate.** Before a doc is marked ready: flag numbers/metrics not present in evidence, JD-only terms surfaced as skills, and seniority/title inflation vs the real record. Reuse the `humanize.ts` detector pattern; block export on unresolved P0 flags. *No second AI call as the validator.*
2. **(P0/P1) Claim → evidence provenance.** Persist, per generated document, the evidence items each section drew on; render a per-claim "▸ from: [evidence]" the user can expand. Kills the hand-verification hour by making truth *visible*.
3. **(P1) Make the evidence pool the required spine, not an optional afterthought.** On first packet, if the pool is empty, run a 60-second guided capture (projects/labs/certs → evidence items) instead of silently degrading to résumé prose ([generate.ts:137](../../apps/web/src/lib/documents/generate.ts#L137)).
4. **(P1) No-AI deterministic assembly path.** Templates (`doc-templates.ts`) + the user's selected evidence bullets → a real, tailored draft with zero AI. AI becomes *polish*, not *unlock*.
5. **(P2) Instrument the loop.** Capture the 7 stages so two weeks of real use answers: capture→reviewed-packet time, % with an Apply/Stretch/Skip decision, week-2 return, and (critically) **user-reported "this claim is wrong" count.**

## Do NOT build yet (explicitly deferred)

- Durable job queue, more scrapers, per-occurrence liveness (#4), dependency upgrades (#8) — real, but scaffolding for a loop we haven't yet proven a human returns to.
- Employer-facing / candidate-scoring anything — different, high-risk regulatory product.
- Career-packs for other domains — only after the tech-adjacent loop is proven.
- Interview-prep depth, networking features — stages 6–7, after 1–5 land.

---

## Restated decision

Fadi is **one architectural honesty upgrade away** from its own thesis: the "Never invent. Always claim." doctrine lives in the prompts but not yet in the schema or the gates. Land changes 1–2 (provenance + fact gate) and the answer to the 15-minute question moves from *partially* to *yes* — because the candidate stops re-verifying a black box and starts trusting a traceable one. Everything else is secondary to that.
