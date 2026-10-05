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
