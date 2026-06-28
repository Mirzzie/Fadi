# FadiOS — Hybrid Job Search (semantic + lexical) spec

Status: proposed · Author: Fadi (Claude) · Date: 2026-06-29

## Goal
Make job relevance work like the modern half of Indeed/LinkedIn — **semantic
retrieval + ranking** — without losing the honesty gates we just built
(word-boundary role match, seniority gating, field-related fallback, liveness).
Embeddings should **add recall and better ranking**, not replace the precision
rules.

## Verified constraints (these drive the design)
- **pgvector is NOT available** on the current Postgres (`extension "vector" is
  not available`) and can't be assumed on every deploy. → **Do not depend on it
  for v1.**
- **`OPENAI_API_KEY` is set** → `text-embedding-3-small` (1536-d, ~$0.02/1M
  tokens) is usable now. Groq has no embeddings; Gemini/Anthropic keys absent.
- The provider layer already lists an `"embeddings"` capability
  (`lib/ai/providers/types.ts`) but has no implementation.
- Scale today: **~500 active jobs**, candidate sets after location/role gating are
  in the tens–low-hundreds.

### Key decision: **app-side cosine first, pgvector later**
At this scale, computing cosine similarity in Node over the gated candidate set
(1536 dims × a few hundred jobs = trivial) is fast and needs **no extension**.
Store the vector in a normal column. pgvector + an HNSW index becomes a **drop-in
Phase 3 scale upgrade** using the *same* stored vectors, only once job volume
(>~50k) makes ANN worthwhile.

## Architecture (data flow)
```
sync → for each new job: embed(title + company + JD snippet) → jobs.embedding
query → embed(active track: role + goal + top evidence) → cache on the track
rank  → candidates = current gated set (location, onRole/fieldRelated, !overLevel,
        live)  ──►  fuse: finalScore = w_lex·lexNorm + w_sem·cosNorm
        ──►  optional "semantic rescue": a high-cosine job the lexical match
             missed enters a labelled tier (still seniority-gated, never off-field)
```
The existing pipeline stays as the **gate**; embeddings re-rank within it and can
*rescue* recall. No gate is removed, so the Professor/Sales/over-level exclusions
remain.

## Schema (migration 00XX) — no extension required
- `jobs.embedding jsonb` — `number[1536]` (or `real[]`); null until embedded.
- `jobs.embedding_model text` — provenance (e.g. `text-embedding-3-small`), so a
  model change can trigger re-embed.
- `career_profiles.embedding jsonb` + `embedding_model text` — the track vector,
  regenerated when role/goal/synonyms change.
- (Phase 3) swap `jsonb` → `vector(1536)` + `CREATE EXTENSION vector` + HNSW
  index. Same data, additive migration.

## Embedding layer — `lib/ai/embeddings.ts`
- `embedText(text: string): Promise<number[] | null>` — env OpenAI key →
  `text-embedding-3-small`; **returns null when no embeddings provider** so every
  caller degrades to today's lexical behavior. (Later: per-user BYO embedding key,
  Gemini `text-embedding-004` as a free option.)
- `cosine(a: number[], b: number[]): number` — pure, unit-tested.
- Batch helper for backfill (OpenAI accepts arrays; chunk to stay under limits).

## Retrieval + fusion — extend `lib/jobs/data.ts` + `job-matching.ts`
1. Resolve/refresh the **track embedding** (cache on `career_profiles`; regenerate
   if role/goal changed or model differs). One embed call per stale track, ~never
   per request.
2. Keep the current `scoreJobForUser` lexical pipeline → `lexScore` (0–98),
   `onRole`, `fieldRelated`, `overLevel`.
3. If both vectors exist: `cos = cosine(track, job)` → `cosNorm = (cos+1)/2`.
   `finalScore = round(100 · (0.55·lexNorm + 0.45·cosNorm))` (weights tunable).
4. **Gates unchanged**: `overLevel` cap, off-field exclusion, liveness all still
   apply. Embeddings only reorder + optionally rescue.
5. **Semantic-rescue tier**: when the on-role tier is thin, a job with `cos ≥ τ`
   (e.g. 0.45) that's in-field and not over-level joins a labelled
   "Close match (semantic)" group — recovers "Threat Detection Analyst" for a SOC
   seeker even with no synonym, without reopening noise.

## Backfill + ongoing
- One-off script: embed the ~500 active jobs in batches (~$0.001 total).
- Sync path: embed each newly-upserted job (skip if unchanged). Best-effort; a
  failed embed leaves `embedding = null` and the job still ranks lexically.
- Re-embed when `embedding_model` differs from the current model constant.

## Degrade-gracefully + honesty
- No embeddings provider, or a null vector → **identical to today** (pure lexical).
  No hard dependency, no blank board.
- Semantic matches are **labelled** (“semantic match”) and still pass seniority +
  field gates — we never silently surface something we can’t justify.
- Counts in the source-health panel stay pre-filter; the match reason still
  explains *why* a job is shown.

## Phases / files
- **P1 — embeddings + app-side hybrid (buildable now):**
  `lib/ai/embeddings.ts` (+test), migration (jobs/profile vector cols), backfill
  script, embed-on-sync in `lib/jobs/sync.ts`, fusion in `lib/jobs/data.ts` +
  `scoreJobForUser`, weights/threshold consts, tests for cosine + fusion +
  rescue. Feature-flagged on “embeddings provider present”.
- **P2 — personalization:** nudge ranking from the user’s own saved/applied/
  outcome history (we already store it) — “more like what you saved”.
- **P3 — pgvector scale:** enable extension, `vector(1536)` + HNSW, push cosine
  into SQL ORDER BY for ANN retrieval at large volume.

## Cost (P1)
- Backfill: ~500 jobs × ~300 tokens ≈ 150k tokens ≈ **$0.003 once**.
- Ongoing: new jobs per sync (tens) — fractions of a cent/day.
- Query: 1 track embed per role change (cached) — effectively free.

## Risks / mitigations
- *Embedding cost/latency on sync* → batch + best-effort + cache; never blocks the
  board.
- *Model drift* → `embedding_model` provenance + re-embed on change.
- *Over-trusting semantics* → embeddings never bypass seniority/field gates; rescue
  tier is thresholded + labelled.
- *Provider absence* → null-safe; lexical path unchanged.
```
