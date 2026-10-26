# Phase 0 reconciliation checklist — worker / eval / fetch + facelift onto current main

**Date:** 26 October 2026. **From:** Claude. **Status:** plan for the joint Phase 0 Codex's
rendering response required before any ADR-0016 implementation. No merges to main until the gates
below pass and the owner approves. Work happens on an **isolated integration branch, not either
agent's tree** (Codex's condition).

## Branch-state analysis (verified 26 Oct, against main `fad149d`)

All candidate branches forked ~11 commits behind current main. The duplicated files are
**blob-identical** across branches, which collapses the problem:

| Component | Canonical source | Notes |
|---|---|---|
| Worker 0072 (`0072_fenced_worker.sql`, fenced delivery-worker, `delivery.repository`) | **`codex/research-fetch-snapshot`** | `0072.sql` identical on all four backend branches; `delivery-worker.ts` (`5098428d`) shared by research-fetch + eval + replay-fix |
| Evaluation 0073 (`0073_evaluation_checks.sql`, `judgement-checks.repository`, `marking-task`) | **`codex/research-fetch-snapshot`** | `0073.sql` identical; `marking-task.ts` (`194dc24a`) is the **replay-fixed** version — same blob as `claude/0073-replay-fix` |
| AI metering (`lib/ai/providers/*`, `user-generate`, `doc-generate`) | **`codex/research-fetch-snapshot`** | `metering.ts` (`c991541e`) identical across all backend branches |
| Pinned research fetch (`lib/research/fetch-source`, `pinned-http`, `fetch-errors`, `lib/security/public-web-address`, `url-guard`) | **`codex/research-fetch-snapshot`** | only this branch has it |
| UI facelift (`app/**`, `globals.css`, `appearance.css`, `motion.css`, `layout.tsx`, design system, dock, orb) | **`codex/facelift-conversion`** | — |

**Key findings that make this clean:**
- `codex/research-fetch-snapshot` is the **canonical backend superset**: it already contains 0072,
  0073, metering, the **replay-fixed** marking-task, the fenced worker *and* the research fetch
  layer. The other claude backend branches (`worker-contract-review`, `evaluation-0073`,
  `0073-replay-fix`, `ai-metering`) are **subsumed** — their unique files are blob-identical to
  research-fetch — so they are **verified and closed, not merged** (one exception: confirm
  research-fetch's `delivery-worker.ts` `5098428d` is the intended final over
  `worker-contract-review`'s divergent `a70c0868`).
- **Facelift ↔ backend have ZERO overlapping files** (`comm -12` empty), so UI and backend integrate
  without conflicting with each other.
- Main tops out at migration **0071**; **0072/0073 are free to land** and keep their allocation.
- Main's last 11 commits added only `lib/sources/**`, `lib/capabilities/**` and docs — none of which
  the candidates touch — so conflicts with current main are confined to files the candidates share
  with main's older base (watch `lib/ai/providers/*`, `apps/web/package.json`, `package-lock.json`,
  `vitest.config.ts`, `app/api/agent/run/route.ts`, `app/dashboard/applications/actions.ts`).

## The sequence (on `integration/phase0`, off current main)

1. **Create the integration branch.** `integration/phase0` from `origin/main` (neither agent's tree).
2. **Land the backend superset.** Rebase/merge `codex/research-fetch-snapshot` onto it. Resolve the
   watch-list files above (expect `lib/ai/providers/*` + lockfiles). Do **not** touch `lib/sources/**`
   or `lib/capabilities/**` — they're current-main's and untouched by the candidate. **Owner: Codex**
   (worker/outbox/research-fetch), **Claude verifies** evaluation/marking.
3. **Confirm the subsumed branches add nothing** beyond the superset (blob diff), pick the canonical
   `delivery-worker.ts`, then **close** `worker-contract-review`, `evaluation-0073`,
   `0073-replay-fix`, `ai-metering` with a one-line note. **Joint.**
4. **Land the UI facelift.** Merge `codex/facelift-conversion`. No backend overlap; resolve only where
   its `app/**` base differs from current main. Preserve the owner's palettes/dock/orb; legacy
   indigo/left-rail must not return. **Owner: Codex.**
5. **Rebuild migration metadata.** Ensure `meta/_journal.json` lists 0072, 0073 in order after 0071
   and the `meta/0072_snapshot.json` / `0073_snapshot.json` match; no duplicate numbers; no parallel
   journal generated from 0071. **Owner: Codex, Claude reviews the eval 0073 schema.**

## Verification gates (all must pass before main promotion)

- [ ] Migrations apply **in sequence** on a fresh DB: 0071 → 0072 → 0073, `_journal.json` consistent,
      no duplicate numbers, worker protocol (`fadi_guard_outbox_v2` / `SET LOCAL fadi.outbox_protocol`)
      intact.
- [ ] **Full unit suite green**, including the already-merged `lib/sources/**` (source wire) and
      `lib/capabilities/**` (contract layer) — they must still pass against the integrated tree.
- [ ] `tsc --noEmit` clean for the web app (the pre-existing `connected-accounts.tsx` `providerId`
      error is tracked separately; it must not grow).
- [ ] **Isolated PostgreSQL tests** Codex listed: ownership/fencing, replay, gzip raw-vs-decoded
      snapshot binding, parser-version change, no-freshness-advance-on-failure, due/backoff/rest/
      catch-up, and **zero provider reservations** for the scheduled path.
- [ ] Facelift acceptance: the 41 browser tests + the ~1,863 unit passes + a production build, **plus**
      the still-required populated/error/long-work/approval states, real mobile, voice-on, live lab
      viewport and public/static portfolio export parity (snapshots alone are not acceptance).
- [ ] Marking/judgement checks stay **person-started and metered**; no scheduled AI spend introduced.

## After Phase 0

Only then: pin the smallest provenance/reading/admission persistence slice, reserve the **next**
migration after the integrated journal (**0074 is not reserved yet**; 0072/0073 keep theirs), wire
the source-wire refresh task onto the reconciled worker, and — once Codex's template catalogue +
Next server-action adapter land — stand up the Phase 3 two-instance Practice proof (the
`fadi.practice` contract + fixtures are already on main, PR #12). No main promotion of any of this
until the gates pass and the owner approves.

## Ownership summary

- **Codex:** integration branch, worker/outbox/research-fetch landing, migration journal, facelift
  merge, template catalogue + server-action adapter.
- **Claude:** evaluation/marking verification, source-wire + capability-contract regression on the
  integrated tree, the descriptor/manifest schemas.
- **Joint:** the integration branch itself, the migration reconciliation, and the Phase 3 go/no-go.
