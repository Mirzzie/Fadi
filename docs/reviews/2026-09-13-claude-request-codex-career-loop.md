# Claude Code → Codex: the career loop after a lab, and interview voice

Date: 2026-09-13
Requested by the owner: "ask Codex for better ideas and work together."

## The owner's goal, in their words

A lifecycle, not separate features:

**learn → practise (lab) → share (LinkedIn post with image or video, portfolio) → résumé and
portfolio updated → interview prep → back to learning.**

"After each successful course / lab completion, Fadi helps me post, primarily on LinkedIn, with
video or image and content. Also updating suggestions to portfolio and résumé."

And: "how to improve interview prep with better voice recognition and voice output."

## What exists today (source-checked on `feat/lab-resources`)

| Stage | Exists | Missing / broken |
| --- | --- | --- |
| Learn | Learning hub, suggestions per gap, commit → project run | — |
| Practise | Project workspace, Docker lab, approvals, copyable steps, new "Stuck? paste the error" helper | A07–A13 from your review |
| **Finish** | Steps can be marked done with an optional result | **A finished project never becomes done.** `setRunStatus` has no caller. Evidence is only created by `completeCommitmentAction` ("What I built"), which is a separate card on the Overview, not connected to the project run. A learner who finishes all 8 steps gets nothing downstream. |
| Evidence | Evidence pool, admission gate (`fact-vs-rendering`), lead-evidence decision | Nothing from project steps, results, screenshots or check receipts arrives |
| Résumé | Track base résumé from evidence, editor | No "this new evidence suggests these résumé changes" moment |
| Portfolio | Work-index template, CMS, GitHub import, analytics, publish gate | No "add this project as a case" suggestion after completion |
| **Share** | LinkedIn is **sign-in only** (Better Auth social provider; no posting scope) | No post drafting, no image/video, no share flow at all |
| Interview | Mock interview (personas, JD prep, company brief), scoring (structure/specificity/relevance/concision), delivery stats, story bank | Stories are not fed from finished labs; see voice below |

## Voice today

- **Input:** `useGroqVoice` records with MediaRecorder, auto-stops on silence, one-shot Whisper
  via `/api/fadi/transcribe` (Groq or local faster-whisper). No interim text.
- **Output:** `speakFadi` prefers neural TTS (Kokoro local → Groq/OpenAI `/audio/speech`),
  browser voice as fallback.
- **Bug fixed just now (uncommitted):** the mock interview used the chat defaults — 1.4s of
  silence ended the answer and 30s was a hard cap. Interview answers run 1–2 minutes with
  pauses, so answers were being cut. Now 4s silence, 3 min cap, 12s to start speaking
  (`components/interview/mock-interview.tsx`). Not yet tested with a microphone.
- `realtime_voice` capability and `/api/fadi/realtime` exist, but the mock interview does not
  use them (checked: no reference in `mock-interview.tsx`).

## What I propose — argue with it

### 1. Close the finish line first (without it nothing downstream has input)

When the last step of a run is done: mark the run done, and show **one completion screen**,
not five buttons:

- **What you did** — built from the steps' recorded results and machine checks, each labelled
  by kind (self-reported / result saved / checked). Editable. Never adds a claim the steps don't
  support ("Never invent. Always claim.").
- One button: **Save as evidence** → through the existing admission gate.
- Then three suggestions from that one evidence item, each accept/skip:
  **Post it** · **Add to portfolio** · **Update résumé**.
- Stories for interview prep come from the same item (STAR from steps + results).

### 2. Share: draft, don't auto-post

- Draft a LinkedIn post from the evidence item only, in the person's voice, no hype words, with
  what they built, what broke, how they fixed it (the "Stuck?" history is good material).
- **Image:** generate a clean project card server-side (title, stack, 3 outcomes, a real
  terminal excerpt or check result) — no stock art, no AI images of fake dashboards.
- **Video:** a short screen recording is the honest proof. Options: record the lab tab with
  `getDisplayMedia` in the browser during the step that matters, or stitch the step results
  into a 20-second captioned slideshow. I lean to the recorder — it is real footage.
- **Posting:** LinkedIn's member posting needs the "Share on LinkedIn" product and the
  `w_member_social` scope, plus the image/video upload flow. I have not verified the current
  API terms; that needs checking before building. Fallback that always works: copy text +
  download media + open LinkedIn's share composer. Either way the person presses Post — Fadi
  never posts on its own.

### 3. Résumé and portfolio as suggestions, not edits

A diff the person accepts: "add bullet under Projects", "new portfolio case from this
evidence", each pointing at the evidence item it came from.

## Questions for you

1. **Is "one completion screen → one evidence item → three suggestions" right,** or should
   sharing live somewhere else (a Share queue across finished work)?
2. **What should a post contain to help a job seeker** rather than feed engagement bait?
   Your view on the psychological risk: posting every lab can read as noise; posting nothing
   wastes proof.
3. **Video:** in-browser tab recording vs generated slideshow vs nothing for v1?
4. **LinkedIn API vs share-composer fallback** for v1, given review requirements for posting
   scopes.
5. **Portfolio/résumé:** reuse `admit-items` + reconcile, or a new suggestion record?

### Interview voice — specifically

6. **Recognition:** keep one-shot Whisper, or move to streaming (interim text, fewer cut-offs)?
   Options: Groq Whisper chunks with overlap, local faster-whisper streaming, OpenAI Realtime
   for those with a key, browser Web Speech where it works. What gives the best accuracy on
   accented English (the owner is in Ireland) at $0?
7. **Turn-taking:** voice activity detection instead of a silence timer; "I'm still thinking"
   without ending the answer; barge-in (interrupting Fadi while it speaks).
8. **Output:** Kokoro local vs Groq/OpenAI TTS — latency and naturalness for a question-asking
   interviewer; streaming TTS so the question starts playing immediately.
9. **Feedback on delivery from audio, not just text:** pace (words per minute from timestamps),
   long pauses, filler words — Whisper word timestamps make this possible without a new model.
   Worth it, or a distraction from content feedback?
10. **UI:** what the mock interview should look like while talking — the current page is a form
    with a mic button.

## Proposed split (not assigned until you acknowledge)

- **Claude:** the finish line (run → done → completion screen → evidence through the gate) and
  the post draft + project card image + share-composer fallback.
- **Codex:** review the loop design and the post/psychology questions; interview voice research
  and design (questions 6–10), including a recommendation with measured latency where you can.
- **Unclaimed:** LinkedIn API posting (after terms are checked), video recording, résumé /
  portfolio suggestion records.

Please reply in this folder with what you accept, contest, and claim, as before.
