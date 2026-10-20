# Fadi — session handoff

*Written 2026-08-18 so work continues seamlessly on a new machine / new session. Pair this with
the memory folder (`~/.claude/projects/.../memory/`) and the two review docs in `docs/review/`.*

## Where things stand

- **Branch:** `feat/reactive-resume-editor` (this is effectively trunk — all recent work lives here).
- **Green:** 529 unit tests pass; both packages typecheck; app runs (`npm run dev`, :3000).
- **Working tree:** clean, everything committed. Remote: `github.com/Mirzzie/Fadi`.

## What Fadi is (the spine — don't drift from this)

A **private, evidence-based career system** for under-signalled candidates (graduates, immigrants,
career-switchers). Doctrine: **"Never invent. Always claim."** — read aggressively: *claim every
true thing at maximum legitimate strength, and build more real evidence* so honesty isn't a
handicap. **Career-agnostic is mandatory** — every feature must work for a nurse, electrician or
teacher, not just tech (the tech-specific matching vocab is *gated* to infra profiles only).

Two full audits (both converged): the platform is real, not a gimmick, and needs **one structural
correction** — it's an *output generator on a hollow record* (every capture table has 0 rows).
The fix: make the **evidence record the provenance-carrying spine** every output derives from and
links back to. See `docs/review/PLATFORM_STATUS.md` and `docs/review/CORE_LOOP_TRUTH_AUDIT.md`.

## Built this session (newest first)

- **Apply / Prepare modes** — one product, two phases (never two forks). Toggle lives in the menu
  bar beside the direction switcher; seeded from a `fadi_mode` **cookie** (server-read in
  `AppShell`) so no hydration mismatch. The **dock reshapes by mode** (`dock.tsx`): Apply hides the
  build tools (Niche/Interview/Learning); Prepare hides the pipeline (Jobs/Applications/Network).
  Prepare mode leads the dashboard with `PrepareFocus` — the career report's gaps become concrete
  "build real proof" actions. Files: `app/dashboard/mode.ts` (const/type), `mode-actions.ts`
  (`setCareerModeAction`, sets DB + cookie), `components/os/career-mode.tsx` (context),
  `components/dashboard/prepare-focus.tsx`.
- **Deterministic truth gate** (`lib/documents/truth-gate.ts`) — flags invented metrics (block),
  JD-only skill terms + seniority inflation (warn) against the candidate's real corpus. No AI. Runs
  on every generated doc; surfaced by `components/documents/truth-report.tsx` on the review page
  (`checkDocumentTruth` in `lib/documents/corpus.ts`). Doctrine made architectural, not just prompt.
- **Jobs identity + occurrences** — owner-scoped private captures vs public catalog; `job_occurrences`
  provenance with active-if-any aggregation + atomic transactional upsert; canonical vacancy identity
  (content key + URL canonicalization + 128-bit fallback). **Squashed, self-contained, idempotent
  migration `0030`** from 0029 (occurrences-before-consolidation, per-user clone/quarantine, in-SQL
  `canonical_job_key` validated 1754/1754) with a **fixture test** at
  `packages/database/test/migration-0030.fixture.sh` (needs a superuser Postgres — use the disposable
  Docker one on :5433).
- **Cross-provider ingestion fix** — `dedupeWithinSource` preserves each provider's posting so it
  becomes its own occurrence (the earlier cross-source dedupe was discarding them).
- **Security** — SSRF guard on `surfCareerPage`; provider-key-leak-on-switch fix; portfolio link XSS
  (write + render); auth-before-AI in `resolveSearch`; atomic KV `setNx` lock.

## Next step (the retention hook — build this next)

**The outcome loop**, wiring existing modules into a cycle:
`record an application outcome (rejection / no-response) → auto-run the autopsy (lib/resilience,
already built) → surface the pattern → prescribe ONE real thing to build → it flows into Prepare
mode → new evidence strengthens the next application.` This is what makes the two modes a
self-improving system and gives a reason to return weekly (the metric the product has never proven).

## Also open (from the audits, deferred deliberately)

- ⌘K command bar + cross-links should respect the current mode (consistency pass).
- Provenance link per claim ("▸ from: [evidence]") + evidence-capture-first onboarding.
- No-AI template assembly path (documents that work with zero AI key).
- Codex audit backlog: per-occurrence liveness (#4), dependency upgrades — Next ≥16.2.11 / Better
  Auth ≥1.6.22 (#8), remaining SSRF redirect-hop hardening, durable Postgres run queue.
- **Dev DB caveat:** it went through old migrations + a manual #5 fix, so it lacks
  `job_migration_quarantine` and isn't proof of the checked-in chain. The **fixture test is the
  proof.** For a clean deploy: fresh DB from the migration chain, move data deliberately.

## Running it

```bash
# from repo root
npm install
cd apps/web && npm run dev           # :3000  (needs apps/web/.env.local)
npx vitest run                       # unit tests
# migrations (from packages/database, DATABASE_URL set)
npm run db:migrate
# migration fixture test (needs a superuser PG; docker one works):
docker compose -f infrastructure/docker/docker-compose.yml up -d postgres
bash packages/database/test/migration-0030.fixture.sh
```

**Gotchas:** the two server AI keys (Groq + OpenAI) in `.env.local` are expired — deterministic
paths (fit, truth gate, tracking) work without AI; document generation needs a valid provider key.
Postgres reports a collation 2.43→2.44 mismatch (non-fatal; reindex when convenient).
