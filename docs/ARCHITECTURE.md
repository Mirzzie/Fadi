# Fadi — System Architecture (as built)

> Reviewed 2026-07-04, from the code. Update this when a layer or the drift verdict changes.
> Positioning: **"Fadi — the honest career mentor. The mentor that tells you the truth."**
> ("Operating System" framing retired 2026-07.)

## The stack

**1 · Surfaces (client)** — one ambient shell (menu bar, direction switcher, dock, ⌘K,
Fadi orb+chat with voice). Screens: Home, Jobs board, Application tracker, Job workspace
(six progressively-disclosed tools: fit gate → quality score → red-pen review → interview
prep → company brief → outcome), Documents studio, Evidence, Interview, Learning, Network,
Niche finder, Career Weather, Profile, Settings. Route boundaries: loading / error / 404.

**2 · Actions & API** — server actions per screen (auth checked per action).
API: `/api/fadi/chat` (SSE + tool loop), `speak`, `transcribe`, `history`, `activity`;
`/api/documents/[id]` → DOCX/JSON (scoped by userId+id); `/api/agent/run` (cron);
`/api/mcp` — Fadi exposed as a tool to other agents (per-user SHA-256-hashed tokens).

**3 · Domain core (`lib/`)** — pure, tested cores; AI only where it earns it:
- `jobs/` — word-boundary scorer + seniority gate + field-related fallback; hybrid
  semantic ranking (jsonb embeddings, app-side cosine, background embed); liveness
  detection + sweep ("no longer accepting" → closed, survives re-sync); 7-source sync.
- `documents/` — pivot-aware generation, red-pen review (all 4 kinds, apply-fixes →
  redraft), humanizer/AI-tell rails, style + content templates, DOCX export.
- `guardian/` — per-action mentor verdicts (nudge; confirm only for irreversible) +
  drift patterns (off-track saves) via the agency.
- `career/` — shared evidence composition, pivot framing, auto track base-resume.
- `agents/` — background agency: ledgered runs → findings → digest/briefing/orb nudges.
- `interview/`, `intelligence/`, `resilience/`, `impact/`, `ai/` (BYOK chain
  primary→fallback, tools registry, embeddings), `security/` (AES-256-GCM secrets,
  rate limit, SSRF url-guard).

**4 · Data (PostgreSQL + Drizzle, 24 migrations)** — the ownership rule:
- **Shared truth, stored once:** `linkedin_profiles` (career history), `profiles`.
- **Per-direction:** `career_profiles` (directions + role synonyms + embeddings),
  `resumes` (per-direction base, shared fallback; auto-drafted on direction creation),
  `career_reports`, `documents`.
- **Shared pool:** `jobs` (+liveness, embeddings; pasted jobs get status `"manual"` so
  one user's paste never reaches another user's board). Plus `applications`,
  `saved_jobs`, `evidence_items`, `interview_stories`, `agent_*`, `mcp_tokens`.

**5 · External world (the trust boundary)** — user's AI provider (BYOK, encrypted at
rest), 7 job sources, GDELT/HN/BLS/FRED signals, TTS/STT, inbound MCP clients. Nothing
leaves without being consented, keyed, or keyless-public; SSRF guard on outbound fetches.

## The spine (what makes it Fadi)

`shared truth → direction framing → honest output → proof`
History is stored once; each direction re-frames it (pivot-aware: adjacent-field
experience adopted, transferable skills tied to evidence); every generated document
passes honesty rails (never invent; `[ADD REAL NUMBER]`; specific-or-suppress); the
guardian + impact card close the loop by telling the user the truth about their own
behaviour and what Fadi actually did.

## Ideology-drift audit (2026-07-04)

| Ideology | Verdict | Reality |
|---|---|---|
| Honest mentor, never fabricate | ✅ aligned | Rails in every prompt; strongest part of the codebase |
| Privacy / trust boundary | ✅ aligned | BYOK encrypted, locale-only geo, manual-job isolation. Nuance: embeddings use an operator key (disclosed) |
| Shared truth + per-direction everything | ✅ aligned | Completed 2026-07 (per-track resume/report/docs + pivot framing) |
| Anti-spray, process over outcome | ✅ aligned | No auto-apply (refused by design); momentum process-scored |
| "One AI core, all strings through it" | ⚠️ drifted | Fadi is **federated** (orb/tools/guardian/agency seams), not one core; pragmatic — decide deliberately, don't drift further by accretion |
| Jobs discovery as the center | ⚠️ shifted | Sources thin → center of gravity moved to the document workflow. **User-endorsed pivot**, not decay |
| Narrow surface | ⚠️ drifted | Workspace fixed (11→6 disclosed); dock still 13 destinations; Learning/Niche/Weather overlap the report |
| Production-grade reliability | ❌ gap | In-memory rate-limit/caches (break at 2+ instances), AI inline in requests, per-request source fan-out, no error tracking, CI lacks build/migration gates |

## Production-hardening order

1. **Redis/Upstash seam** for rate-limit + liveness cache + sync TTL (multi-instance correctness) — critical
2. **Queue long AI work** out of request handlers — critical
3. **Centralized scheduled source sync** (drop per-request fan-out) — high
4. **CI: build + migrations + smoke; Sentry** — high
5. **DB-side job filtering / pgvector** past ~50k jobs (hybrid-search P3) — later

**Verdict:** the ideology survives in the product logic; the infrastructure hasn't caught
up to it yet. Fadi is beta-grade infra under production-grade product thinking.
