# Interview-practice (voice companion) — Fadi side landed

**Date:** 11 October 2026 · **From:** Buddy's Claude (working in Fadi's tree).

Build #1 of the competitor-study program: Buddy as Fadi's live voice interview companion. The
Fadi side (F1 + F2) landed today; the Buddy side (voice loop) is pending. Full plan lives in the
Buddy repo at `docs/reviews/2026-10-11-interview-companion-plan.md`.

## What changed

New (mine):
- `apps/web/src/lib/interview/practice-session.ts` — a KV-keyed `(userId, contextId)` spoken
  mock-interview session (`start`/`answer`/`end`/`get` + `describeCoaching`). Composes
  `generateMockQuestions` + `scoreInterviewAnswer`. Coaching is descriptive, never a numeric
  grade. Privacy: the spoken answer is scored transiently and never persisted (session stores
  only question + coaching summary + filler count).
- `apps/web/src/lib/interview/practice-session.test.ts` (6 tests).
- `apps/web/src/lib/ai/tools/registry.interview-practice.test.ts` (5 tests).

Changed (shared with Codex — all additive, flagged here per the co-work rule):
- `apps/web/src/lib/ai/tools/types.ts` — added optional `contextId?: string | null` to
  `FadiToolContext` (backward-compatible; unset for existing callers).
- `apps/web/src/lib/agent/voice-turn.ts` — one line: pass `contextId` into the tool context.
- `apps/web/src/lib/ai/tools/registry.ts` — new read tool `interview_practice`
  (start/answer/end; returns `data.interview = {state, index, total}`), registered in TOOLS.
- `apps/web/src/lib/ai/tools/routing.ts` — routing cues so "practice interview / interview me /
  next question / my answer" reach the tool.

## Verified
`tsc --noEmit` clean for all touched files; `vitest` 11 new tests pass (plus routing/mock suites
green). Not committed; not run live against a provider.

## Update 12 Oct — A2A hop landed (Claude)
Wired the marker out to Buddy (all additive, in Codex's core — flagged here):
- `lib/agent/voice-turn.ts`: `VoiceTurn` now carries an `interview` marker captured from the
  tool's `data.interview`.
- `app/api/a2a/route.ts`: `converse` passes `interview` through.
- `lib/a2a/server.ts`: `A2AMessage` gains an optional `metadata`; new export
  `INTERVIEW_METADATA = "fadi.interview"`; the converse Message carries
  `{version:1, state, index, total}` when a session is mid-flow.
Verified: `tsc --noEmit` clean; a2a + voice-turn + interview vitest suites pass (27). Buddy's
side (reads `fadi.interview`, runs the spoken answer loop) also landed and is tested in the Buddy
repo. Not committed. One known limitation: on an answer turn Fadi's model must route the answer
to `interview_practice` (the tool infers it when a session is live); reliable on Groq, possibly
flaky on the local 3B — a deterministic path is a noted follow-up.

## Update 12 Oct — two gaps from Codex integration closed (Claude)
`lib/agent/voice-turn.ts` `interviewTurn` only (plus its tests):
1. **No word cut on an interview reply.** The 200-word `toSpeech` backstop is gone: the reply
   is formatted with no word limit (generic 60-word `toSpeech` default unchanged for every other
   turn). New `INTERVIEW_SPOKEN_MAX_CHARS = 6000` (Buddy plays up to that in sentence chunks);
   over it, Fadi says plainly that the feedback and question were held back (and "say stop to
   end") instead of cutting — the marker still reports the real, advanced index since the answer
   was scored.
2. **A failed answer keeps the question.** If the tool returns no marker (e.g. scorer
   unavailable) or throws, the reason is spoken and, while the session is still live, the turn
   returns the `sameQuestion` marker (`awaiting_answer`, unchanged index) — no fake advance, no
   dropped session. An explicit end only reports `done` when the tool actually returned `done`;
   otherwise same-question if the session survives, else `null`.

Regressions added (`voice-turn.interview.test.ts`): >200-word valid question spoken with its tail
and `index: 1` marker; >6000-char reply held back out loud with advanced marker; score
`ok:false` → same question, index 0, retry scored against question 1; scorer throws → same.

Verified: `npx vitest run` voice-turn.interview + practice-session + registry.interview-practice +
a2a/server → 4 files, 65 tests pass. `tsc --noEmit`: only the pre-existing, out-of-scope
`components/settings/connected-accounts.tsx` error. Not committed; no provider calls.
