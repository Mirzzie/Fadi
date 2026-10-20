# Full-surface bug & security audit — 2026-07-17

Deep scan across auth/sessions, cross-user data leaks, the public + MCP surface,
caching/memory, and DB flow. Every finding was verified against the code before being
claimed; fixes were type-checked, tested, and the app re-booted (all nav routes 200,
325 tests / 46 files pass).

The honest headline: **the auth and data-scoping foundation is genuinely solid.** The
bugs that existed were all one shape — *unmetered / unbounded resource consumption* —
and they clustered exactly where my own earlier claim ("every AI call funnels through
one chokepoint") turned out to be false.

---

## FIXED 🔴 — AI spend bypassed the rate-limit chokepoint (3 endpoints)

Last session I added a rate limit inside `getUserDocGenerate` and claimed it covered
every AI call. It did not. AI is spent through **three** paths, and two bypassed it
entirely — the same over-claim, re-made:

| endpoint | spent per call | was limited? |
|---|---|---|
| dashboard doc actions (`getUserDocGenerate`) | 1 LLM call | ✅ (last session) |
| `POST /api/fadi/chat` | LLM stream + `buildFadiContext` (many DB reads + live-market) + tool calls | ❌ **now fixed** |
| `POST /api/agents/application` | LLM + `buildFadiContext` | ❌ **now fixed** |
| `POST /api/fadi/transcribe` | Whisper call + full upload in memory | ❌ **now fixed** |

Chat is the highest-frequency endpoint, so it was the worst exposure: a runaway client
or loop could drain the user's own API key (BYO-key) *and* hammer the database and
external market APIs, with no ceiling. Fixed with per-user gates at each request
boundary (chat 40/5min answered as SSE so it renders like a normal Fadi reply; agent
30/5min; transcribe 60/5min). Transcribe also now rejects uploads over 25 MB (Whisper's
own limit) before they're read into memory.

**Lesson, again:** a chokepoint only chokes the paths that actually pass through it.
"Everything goes through X" must be verified, not assumed.

## FIXED 🟠 — Two unbounded in-process cache leaks

Both `lib/data-sources/service.ts` (`marketCache`) and
`lib/data-sources/providers/gdelt.ts` (`cache`) were raw `Map`s whose TTL was checked
**only on read**. Stale entries were never removed, so the maps grew for the life of
the process — one entry per distinct (role, region, skills, thresholds) or query. On a
long-running self-host node (which the docs emphasise) that is a slow memory leak.

- Extracted a tested `BoundedTtlCache` (`lib/cache/bounded.ts`, 6 tests with an
  injectable clock): `get` never returns expired; `set` evicts expired-then-oldest so
  `size` can never exceed the cap. `marketCache` now uses it (cap 500).
- `gdelt`'s cache has deliberate two-tier semantics (fresh-15m skip-network /
  stale-1h serve-on-failure) that a single-TTL cache would break, so it's bounded in
  place (drop past-stale, then oldest-out; cap 300) with the read logic untouched.

## Verified SOLID (no change needed)

- **Resource ownership / IDOR.** Document artifact routes (`/print`, `/docx`, `/json`)
  all scope by `getForUser(user.id, id)`. The public portfolio route serves only
  `isPublished` sites+items and user-curated fields. `logRejection` verifies ownership
  (`getApplicationForUser`) before the unscoped `setApplicationOutcome`. Repo methods
  that take a bare `id` are all either the global `jobs` catalog or internal setters
  fed a user-scoped id.
- **Server-action auth.** Every mutating action resolves the user first
  (`getCurrentAuthUser` / `getSignedInUser`); the only exception is sign-out, correctly.
- **MCP tokens.** SHA-256 hashed at rest, raw shown once, constant-time env compare,
  lookup by hash, revoked tokens excluded (`isNull(revokedAt)`).
- **Auth config.** Production `BETTER_AUTH_SECRET` enforced fail-fast (≥32 chars);
  trusted origins configured; dev defaults gated to non-prod; `deleteUser` disabled;
  framework-default rate limiting on the auth endpoints.
- **No cross-user cache poisoning.** Pages are `force-dynamic`; there is no
  `unstable_cache`/shared render cache keyed without the user.
- **Hot path.** `buildFadiContext` does one read then a `Promise.all` of seven — no
  N+1. Account data-deletion cascades from the app `users` row and signs out.
- **Hygiene.** No `TODO`/`FIXME`, no empty `catch {}` blocks in `apps/web/src`.

## Low severity — noted, not fixed

- `/api/agent/run` compares the cron bearer with `!==` (non-constant-time). A network
  timing attack on a bearer token is impractical, but a `timingSafeEqual` would be
  tidier — matching `envTokenMatches`, which already does it right.
- `deleteAccountDataAction` wipes app data but leaves the better-auth identity, so the
  same credentials can start a fresh account. This is "delete my data", not "close my
  account" — intended, but worth a full-account-deletion path for a GDPR erasure story.

## Ideology alignment

Every fix serves the primary user directly. The rate limits protect **their own API
key** (BYO-key means an unmetered loop spends their money, not ours) — Principle 2's
"honest intelligence" extends to not letting the tool quietly bankrupt them. The
bounded caches keep a self-hostable, single-user-friendly footprint, consistent with
the Postgres-first, own-your-stack posture. Nothing here added surface; it removed ways
the platform could hurt the person it's for.
