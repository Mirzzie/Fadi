# Fadi through Buddy: full voice control — what exists, what it takes

**Date:** 5 October 2026
**For:** the owner, Fadi's Claude and Codex, and the Claude/Codex sessions in `~/Projects/buddy`
**Goal (owner):** control Fadi through Buddy in every aspect. "Look for jobs with these details"
gets an accurate spoken answer; Buddy can trigger actions and make changes.

## The architecture we should build towards

```text
 You ──voice──▶ Buddy (ESP32 + hub)                      Fadi (Next.js)
               ears: wake word, Whisper STT               brain: your record, direction,
               mouth: Piper/Kokoro TTS, OLED                    saved roles, history, tools,
               local policy: who may ask, grants,              provider chain, receipts
               spoken read-back, panel
                     │                                              ▲
                     ├── A2A SendMessage "Fadi, …" ────────────────▶ voice turn (Fadi's agent)
                     │      ◀── Message (spoken answer) ────────────  read tools run
                     │      ◀── Task INPUT_REQUIRED (held change) ── changes are HELD
                     │── "confirm" / "cancel" on that task ─────────▶ runs once / drops
                     │── A2A plans: "apply to the Deerfoot role" ───▶ work-kernel plans
                     │── MCP tools/call (fast, offline-tolerant) ───▶ direct read tools
                     ◀── (next) notifications: new matches, plan waiting, interview soon
```

**The principle:** Buddy owns hearing, speaking, its device and its own grants. **Fadi owns
understanding and authority over Fadi's data.** Understanding moved to Fadi because Buddy's
local router (llama3.2 3B, no knowledge of the person) is where accuracy was lost — Buddy's own
evidence: a project step completed with an invented id, requests routed to the wrong tool.
Authority sits in Fadi because a client-side confirmation is one bug away from not existing.

## What exists now (all local, committed in FADI)

| Piece | Commit | What it does |
|---|---|---|
| A2A endpoint | `5c220ee` | `POST /api/a2a`, agent card; plans as tasks; idempotent approve, per-plan claim, messageId dedupe, rate limit |
| **Voice turn** | `1da18ff` | Any non-plan line → Fadi's own agent; read tools run; **changes held** as `INPUT_REQUIRED` tasks with an exact read-back; `confirm` runs once; `cancel`; GetTask shows the outcome; history per `contextId`; speech grounded in Fadi's tool summaries |
| Job search filters | `1da18ff` | `search_jobs` now applies keywords, remote/hybrid/onsite, contract type, visa sponsorship (keywords were silently ignored before) |
| Write routing cues | `1da18ff` | "log that I applied…", "draft a cover letter…", "new direction…" now reach their tools (they never did) |
| Local voice stack | `be03ee6` | Speaches (Whisper) + Kokoro + Ollama fallback |

Live evidence (throwaway user, deleted): a filtered job search answered from Fadi's data; a
status question; "log that I applied to Stripe for a Junior Security Engineer role" → held,
0 rows → confirm → exactly one application, repeated confirm did nothing, receipt `surface: agent`.

## Coverage: what you can do by voice today vs. what is missing

| Area | By voice now | Missing (to reach "every aspect") |
|---|---|---|
| Jobs | search with location/keywords/remote/type/visa; fit check; is a posting still open | **save / dismiss a role**; "the second one" needs result references kept in the conversation |
| Applications | log one (held → confirm) | **change status** (applied / interviewing / offer / rejected); "what's next on my applications" summary |
| Plans (apply-to-role) | start, approve, continue, done, stop | prepare-for-interview and follow-up templates (Fadi design doc lists them as next) |
| Documents | generate (held → confirm) | **list / summarise** a document; "send me the link" (to the panel/phone) |
| Career record | read evidence | **add an experience or achievement by voice** (held → confirm, through the evidence gate) |
| Learning | project status | **flagships: list, take one on**; "what's my next step"; mark a step done with what it produced |
| Interview practice | questions, prep, STAR answers | a **practice session over Buddy** (Codex's live-voice work is the engine for this) |
| Today | momentum, updates | **"what should I do today"** brief: next action, decisions waiting, hand-offs failing |
| Portfolio, settings, labs | — | portfolio publish and lab/machine actions stay **screen-only by design** (typed confirmation, approvals); voice can *report* them |

## Capabilities needed, in order

**1. Buddy routes "Fadi, …" to the voice turn** *(Buddy sessions)*
Send the utterance as `a2a.SendMessage` (no taskId); speak the returned `Message` text; on a
`TASK_STATE_INPUT_REQUIRED` task, read the status text back and send the person's "confirm" /
"cancel" with that `taskId`. Pass `contextId` on follow-ups so "the second one" works. Keep the
MCP router only as an offline fallback for read tools. `a2a_client.py` already persists and polls
tasks and does spoken read-back — this is mostly routing.

**2. Voice-complete Fadi tools** *(Fadi Claude)* — the "Missing" column above, each with a risk
class, held when it writes: `save_job`, `set_application_status`, `today_brief`,
`list_documents`, `add_evidence`, `list_flagships` / `take_on_flagship`, `project_next_step`.

**3. Spoken summaries** *(Fadi Claude)* — tool summaries were written for the screen
("Momentum 0 (peak 0), band "dormant""). Add a `spoken` field per tool so voice hears natural
sentences that still come only from the data.

**4. Scoped, device-bound tokens** *(Fadi Claude, Codex review)* — today an MCP token can reach
every tool. Add scopes (read / act / plan) and a token named per device, shown in Settings with
last use and one-click revoke; Today shows "Buddy did …" from the `agent` receipts.

**5. Proactive updates** *(both)* — Fadi already proposes work and finds new roles. Expose them to
Buddy: A2A push notifications to a hub webhook, or a briefing Buddy polls; Buddy decides when to
speak (quiet hours, focus mode).

**6. Language** *(both)* — Buddy transcribes Malayalam and Hindi; pass the language with the
message and let Fadi answer in it.

**7. Later** — streaming for long tasks; MCP elicitation for typed follow-up questions; joining
Buddy's durable job queue with Fadi plans.

**Never by voice:** machine/lab actions, irreversible approvals, publishing. Voice can report
them and point to the screen.

## Measured limits to plan around

- **Latency:** 8–14 s per voice turn on this laptop with the local 3B model (context build +
  Ollama), 39 s on a cold first call. Groq is faster and much better at choosing tools but
  rate-limited; recommended: Groq primary, local fallback (already the owner's setting), and cache
  the built context per conversation.
- **Small-model quality:** the 3B model chose a fit check for "log that I applied" before routing
  cues existed, and did not pass the "applied" status. Grounded speech prevents invented facts;
  tool choice and arguments still need the stronger model.

## Security record (per `docs/PRODUCT_QUALITY_STANDARD.md`)

Identity: per-user MCP token (SHA-256 at rest) or the self-host token. Authorisation: no broader
than MCP today; scopes are capability 4. Input trust: one text line ≤ 500 chars, used as an intent
or a command, never a tool argument by itself; tool arguments come from Fadi's own model.
Confirmation: enforced by Fadi — a write cannot run without a confirm on its held task, which
expires after five minutes. Idempotency: messageId dedupe, per-task claim, pending record deleted
before execution. Receipts: `surface: "agent"`. Logs: method and tool names only, never words.
Deferred: scopes; per-process KV locally (multi-instance needs Redis/Upstash).

## Division of work

- **Fadi's Claude:** capabilities 2, 3, 4 and Fadi's side of 5 and 6.
- **Buddy's sessions:** capability 1, Buddy's side of 5 and 6, hardware confirmation UX.
- **Fadi's Codex:** review each slice against the quality gates; live voice engine for practice
  interviews over Buddy.

Each side appends a dated status section here when a slice lands.

## Status — 5 October 2026 (Fadi's Claude): capability 2 landed

Nine tools, each calling the same code as the app's own button
(`apps/web/src/lib/ai/tools/career-actions.ts`), so a change made by voice is scored, synced to the
plan and receipted exactly as on screen. They are ordinary Fadi tools, so chat and MCP get them too.

| Tool | Risk | Says / does |
|---|---|---|
| `today_brief` | read | goal, plan in flight and its next step, decisions waiting (same narration as the dashboard's voice) |
| `save_job` / `unsave_job` | write | save or drop a role named by title/company; save is scored and guarded like the Save button |
| `set_application_status` | write | applied / interviewing / offer / rejected / withdrawn; "I got an interview with Stripe" works |
| `list_documents` / `read_document` | read | documents in the current direction; the opening words of one, markup stripped |
| `add_experience` | write | through the evidence gate, so saying it twice is absorbed or held for review, never duplicated |
| `list_flagships` / `take_on_flagship` | write (take on) | the researched flagships; taking one on creates the commitment and plans it, refused if already taken |

**Read-back names the record, and confirm is pinned to it.** Write tools may now declare
`prepare` (`types.ts`): it resolves the spoken name to one record *before* anything is held, the
read-back uses that record's full name ("I can mark Junior Security Engineer at Stripe as
interviewing. Shall I?"), and the held args carry its id — so "confirm" acts on what was read
back. A name that matches nothing, or two things equally (exact ties included), is a question and
nothing is held. Shared matcher: `clearWinner` / `closest` in `lib/voice/targets.ts`.

Routing cues added for every phrasing above, and "what's my next step" now reaches
`project_status` / `today_brief`. `commitToProject(userId, …)` moved out of the server-action file
into `lib/learning/commit.ts` (a "use server" export taking a userId would be callable from any
browser).

**Evidence.** Live through `/api/a2a` on the dev server (throwaway user + token, deleted):
status change held → `applied` unchanged → confirm → `interviewing`, one receipt
(`surface: agent`), repeated confirm changed nothing; "save the Quillfjord role" → "I couldn't
find a role called…", nothing held; a real role saved with its match score; Security+ added, said
again → held for review, not duplicated; flagship listed, taken on (commitment + project), asked
again → "You've already taken on…". Tests: 246 pass, including an integration file with the
outcome, failure (no match, two matches, missing status) and authorisation cases (another user's
application id → `needs_input`, record unchanged).

Also fixed: `targets.integration.test.ts` left its seeded jobs in the public catalogue (six fake
roles in the owner's Opportunities, now deleted) and depended on what real roles exist.

**Not done / known limits.** A flagship planned on local llama3.2 got one step — the planner's
quality on the 3B model, same as the button. The 3B model sometimes drops details (a period) —
the read-back says exactly what will be stored. "The second one" still relies on the model
reading conversation history; keeping result references per `contextId` is next with
capability 3. Next for Fadi's Claude: 3 (spoken summaries), then 4 (scoped device tokens).

## Buddy Codex: capability 1 hooked up — 5 October 2026

Read the committed A2A/voice-turn implementation and Claude's direct Buddy handoff note. Added optional --fadi-voice-turn in Buddy and enabled it in the laptop service. “Fadi, …” now goes to Fadi's own agent; plain-message context IDs survive follow-ups, held changes use exact task/context-bound confirmation, cancellation uses CancelTask, local confirmation expires after 90 seconds, and unverified write/cancel outcomes are never retried automatically. This new path leaves non-held plans for screen control. Explicit hand-off routing remains separate. Read-only MCP fallback cannot offer or execute writes, including after final transport catalog refresh.

Buddy's current A2A connector policy is checked at send/cancel. Durable shared-store enforcement remains the owner's explicit panel switch (currently legacy mode); no grants silently created. Fadi's configured provider chain is unchanged and may be cloud-backed. No authenticated live voice request, application/project mutation or provider invocation was used as a test.

Verification: Fadi's focused A2A/speech/routing suite passed 43 tests at review time; Buddy final gate ran 313 tests, OK with 12 optional skips, build/browser passed. Live public card and unauthenticated A2A 401 checked; restarted idle Buddy and authenticated panel confirms feature enabled. Physical voice/latency remains pending. Fadi's active learning/career source edits were untouched.

Follow-up for Fadi Claude: stable machine-readable voice/held-task capability marker (current compatibility marker is “What Fadi will do” artifact); update card voice capabilities; device-scoped tokens; avoid uncontrolled raw provider-error content in voice.turn_provider_failed logs. Reviewed details in Buddy docs/reviews/2026-10-05-fadi-voice-hookup-review.md. New career prepare hooks were observed in progress, not represented as independently validated complete functionality.

## Status — 5 October 2026 (Fadi's Claude): capability 3 landed, and Buddy Codex's follow-ups

**Spoken answers.** A tool result may carry `spoken` beside `summary` (`types.ts`): the same data,
written to be heard — the answer first, whole sentences, "3 roles" not "role(s)", "3.5 out of 5"
not "3.5/5", one item where the screen shows a list. The voice turn says `spoken` when present;
chat and MCP are unchanged. Written for search_jobs, get_performance, get_career_updates,
get_rejection_patterns, answer_behavioral_question, scan_company_jobs, evaluate_fit,
project_status, prep_interview, mock_interview_questions (one question at a time),
score_interview_answer, get_relevant_evidence, company_interview_brief. Helpers `spokenList`,
`count`, `outOf`, `firstSentence` in `lib/agent/speech.ts`.

**"Save the second one."** The last list read out (roles, documents, flagships, projects) is kept
per `contextId` (`lib/agent/voice-refs.ts`, KV `voice:refs:…`, 30 min). A tool declares which
argument names a record (`target`); when the person's OWN words contain a position ("the second
one", "number 2", "the last role"), that argument is filled from the list — not from the model,
which live passed a guessed name instead. A real name ("the second Stripe role") and ordinary
words ("a second interview") are never treated as positions.

**Buddy Codex's follow-ups.**
- Machine-readable marker: every held-change task now carries
  `metadata["fadi.heldChange"] = { version: 1, state, tool, readBack, replies }` (`replies` is
  `["confirm","cancel"]` while waiting, `[]` after). The "What Fadi will do" artifact stays.
- Agent card: a `voice-turn` skill describing held changes, the marker, `contextId` and what is
  not available by voice.
- `voice.turn_provider_failed` now logs the error class only, never the provider's message.
- Device-scoped tokens: capability 4, next.

**Evidence.** Live through `/api/a2a` (throwaway user + token, deleted): "find security jobs in
Dublin" → "I found 6 roles for Dublin, Ireland. The best are …"; "save the second one" in the
same context → held as the second role named, confirmed, saved. "How am I doing" → three short
sentences (was a paragraph with "0 quality applications"). "Stripe rejected me" → held task with
the marker above. Tests: 264 pass (new: positions, spoken helpers, marker).

### Buddy Codex S7 — contextual service routing / browser transport
Owner now requests unaddressed career requests and hands-free foreground Fadi UI navigation/click/selection. Buddy implements an optional capability router, preserving Fadi A2A held-change policies, plus an owner-paired local-origin browser extension/bridge for actual UI transport. FADI source remains untouched. The bridge sends no cookies/passwords/input values/screenshots, and clicks/selections get exact readback/confirmation. Browser action receipts describe interaction, not peer database effects. The existing `NOT_BY_VOICE open_page` remains appropriate until a versioned UI delivery/result contract exists. Future Fadi handoff: stable route/capability metadata, a typed page/selection context contract and UI navigation receipts would avoid coupling to DOM layout. Do not interpret Buddy DOM control numbers as Fadi voice-result reference numbers. See Buddy docs/BROWSER_CONTROL.md and its shared plan for validation/install limits.
