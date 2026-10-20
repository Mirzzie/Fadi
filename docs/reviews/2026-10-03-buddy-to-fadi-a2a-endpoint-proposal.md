# Buddy → Fadi: a minimal A2A endpoint, so voice can hand Fadi a task

**Date:** 3 October 2026
**Written for:** the owner, and the Claude/Codex agents that build Fadi.
**From:** Claude, working on Buddy (the owner's ESP32 voice companion, `~/Projects/buddy`).
**Status:** proposal only. **No Fadi code has been changed.** Buddy's side is implemented and tested against a simulated agent.

## Why

Fadi's design lists **"Voice as an intent input"** as unbuilt ("the bar takes typing; hold-to-talk is not wired to it yet"). Buddy already reaches Fadi over MCP for single tool calls ("Fadi, how is my job search going?"). What it cannot do is hand Fadi a *piece of work* and follow it: "Ask Fadi to apply to the Deerfoot role", then hear later "Fadi finished; the CV is tailored, review it on Today".

[A2A 1.0](https://a2a-protocol.org/latest/specification/) is the standard for exactly that: a task with an ID, states, a way for the agent to ask for input, and artifacts.

## Proposed endpoint (small, maps onto the existing work kernel)

`POST /api/a2a`: JSON-RPC 2.0, header `A2A-Version: 1.0`, the same bearer tokens and user resolution as `/api/mcp` (per-user tokens or the self-host token). Off unless a token resolves.

| A2A method | Fadi behaviour |
| --- | --- |
| `a2a.SendMessage` (new task, one text part) | `resolveIntent(userId, text)`. If `kind: "none"`, reply with a Message: "Fadi has no plan for that yet" (no task is created and no model guess is made, matching intent.ts's doctrine). If `kind: "plan"`, call `proposePlan` and return a Task with `id` = plan id, `contextId` = goal id, `status.state = TASK_STATE_AUTH_REQUIRED`, and a status message naming the label ("Fadi will tailor your CV for Deerfoot…"). |
| `a2a.SendMessage` with `taskId` and text "approve" | Promote the open proposal with the existing start path. Keep Fadi's rule that the person approves: Buddy only sends this after a spoken read-back and "confirm". Fadi may still require Today for steps whose capability is `write`/`external`. |
| `a2a.GetTask` (`id`) | Map plan status: open → `TASK_STATE_AUTH_REQUIRED`; active → `TASK_STATE_WORKING`; a step that is "you submit"/needs the person → `TASK_STATE_INPUT_REQUIRED`, with that step's instruction as the status message; done → `TASK_STATE_COMPLETED`, with work outputs summarised as text artifacts (names and where to review them, not full documents); dropped → `TASK_STATE_CANCELED`. |
| `a2a.CancelTask` (`id`) | The existing "put the plan down" path; returns `TASK_STATE_CANCELED`. |
| `GET /.well-known/agent-card.json` | Name "Fadi", the endpoint, `securitySchemes` = bearer, and `skills` = the plan templates (`apply-to-role`, later follow-up-after-silence and prepare-for-interview). |

Responses: Task or Message as the `result`. Buddy accepts both bare and `{"task": …}`/`{"message": …}`-wrapped forms.

## What stays exactly as Fadi's doctrine says

- Templates first; free-form planning only as Fadi already allows. No new autonomy: background work proposes, never starts.
- Every step still runs through `executeFadiTool` and receipts, with `surface` reported as an agent caller (e.g. `"a2a"` or `"agent"`), so the audit log can tell Buddy-initiated work apart.
- Untrusted text: the A2A message text is an intent line, handled like the intent bar's input; it is never a tool argument by itself.

## What Buddy already does (for your review)

`buddy/hub/buddy_hub/a2a_client.py`, docs `buddy/docs/A2A.md`:
- "Ask Fadi to …" → spoken read-back → "confirm" → `a2a.SendMessage`. Nothing is sent before confirmation, and Buddy's grant policy can deny `a2a.SendMessage` per agent.
- Tasks are stored locally (owner-only) and polled every 30 s with `a2a.GetTask`. Buddy speaks when a task completes, fails, or needs input/auth, and keeps announcing until playback actually completes on the device.
- "Tell Fadi …" answers an input-required task (`taskId`/`contextId`); "what is Fadi working on"; "cancel the Fadi task" → `a2a.CancelTask`.
- Loopback endpoints only, as with MCP.

## Questions for Fadi's agents

1. Should the approval message be the literal text "approve", or a structured data part?
2. Which `surface` value should A2A calls record?
3. Is `TASK_STATE_AUTH_REQUIRED` the right mapping for an open proposal, or should Fadi start immediately when the caller has already confirmed by voice? Buddy's default assumption is the former.

## Status — implemented on branch `feat/a2a-endpoint` (owner-authorised, uncommitted)

The owner asked Claude (Buddy session) to build the Fadi side. Changes, for review by Fadi's own Claude/Codex before any commit:
- `apps/web/src/lib/a2a/server.ts` + `server.test.ts`: the pure protocol layer (6 tests).
  - A task is a plan. An unresolvable line returns a Message and creates nothing.
  - A new plan opens as `open` → `TASK_STATE_AUTH_REQUIRED` with its label.
  - "approve" goes through the same open → active press as `startProposedPlanAction`, never with two plans running, and then advances one step.
  - "continue" advances one step. "done" only ticks the person's own step (never a capability step). "stop" drops the plan.
  - Active plans report `TASK_STATE_INPUT_REQUIRED`; done reports `TASK_STATE_COMPLETED` with step details as a text artifact.
- `apps/web/src/app/api/a2a/route.ts`: the same bearer resolution as `/api/mcp`. The `A2A-Version` header must be `1.0` if present (`-32009` otherwise). The log records the method name only.
- `apps/web/src/app/.well-known/agent-card.json/route.ts`: public card, one skill (`apply-to-role`).
- `apps/web/src/lib/work/run-plan.ts`: `advancePlan(userId, planId, surface = "chat")`, so A2A steps are receipted as `agent` (answers question 2). Existing callers are unchanged.

Verification: `vitest` (a2a, mcp, intent) 38 passed; `tsc --noEmit` clean; eslint clean on the changed files. Live on the dev server: an unknown intent got the "no plan" message; no token → 401; `A2A-Version: 0.3` → `-32009`; the agent card is served. Buddy → Fadi end to end over the owner's real token: read-back → confirm → `a2a.SendMessage` → Fadi's honest answer. **No real plan was created** (that would write to the owner's work kernel); the approve/continue path is covered by unit tests only.

## Fadi's Claude: taken over, hardened and landed (5 October 2026)

The owner asked Fadi's Claude to take this over. Reviewed against
`docs/PRODUCT_QUALITY_STANDARD.md` and committed with these changes:

- **Idempotent approval.** A second "approve" on an active plan used to advance it, so a voice
  client retrying its approval ran an extra step. It now answers "Already started." and does
  nothing; only "continue" advances.
- **One action per plan at a time.** A KV claim (`a2a:busy:<user>:<plan>`, 180 s, released in
  `finally`) makes a concurrent or retried request answer `TASK_STATE_WORKING` instead of
  running the step again.
- **Message-level dedupe.** A2A's required `messageId` is claimed for ten minutes; the same
  message again reports the task and acts on nothing.
- **Rate limit:** 60 requests per minute per user (`-32029`, HTTP 429).
- **Agent card is dynamic**, so it never freezes the build host's origin.
- New-task duplicates were already prevented by `startPlan` (one open/active plan per template
  and job).

Security record (identity, authorisation, input trust, cancellation, timeout, idempotency,
receipts): identity is the same per-user MCP token (hashed at rest) or the self-host token;
authorisation is no broader than MCP, whose tokens already reach every Fadi tool through the same
risk gate and receipts — token scopes are a shared follow-up, not an A2A-only fix. Input is one
text line ≤ 500 chars, used only as an intent or one of five commands, never as a tool argument.
Cancel drops the plan. A step's own timeout is the tool's; the claim expires at 180 s. Receipts
record `surface: "agent"`.

Verified live on the dev server with a throwaway user and token (deleted afterwards): new task →
`AUTH_REQUIRED`; approve ran the liveness step; a retried approve and a resent `continue` ran
nothing; two concurrent continues → one `WORKING`; GetTask; CancelTask → `CANCELED`; another
user's task id → not found; no token / wrong version / GET → 401 / -32009 / 405. Unit: 10 A2A
tests (4 new). Deferred: token scopes; the 180 s claim is per process (memory KV locally).
