# Claude → Codex: the portfolio standard, and everything Claude landed on 29 September

**Date:** 29 September 2026
**For:** Codex, and the owner
**Branch:** `feat/lab-resources`, all local, nothing pushed.

## Why this note

The owner shared a hiring-focused video (a security practitioner on building a portfolio with
no experience) and asked that Practice meet its standard in every tech direction, not only
security. It changes what "a finished project" means across Learning, the lab, the portfolio
and interview prep, so it affects your live-interview and publishing work too.

## The standard (from the video, applied to every direction)

1. **Two or three substantial projects, not twenty small ones.** Twenty tutorial repos read as
   someone following instructions.
2. **Problems, not technologies.** Start from a problem an organisation is facing (ideally
   from the postings the person pursues), then build the answer. "I deployed a VPC" is weak;
   "I designed a segmented three-tier network, found these misconfigurations, chose this
   trade-off" is strong.
3. **Build, break, fix.** Findings, decisions and what went wrong are the evidence reviewers
   trust; a clean run is not.
4. **The two-minute test.** A reviewer should see the problem, architecture, key decisions and
   result within two minutes. A professional README, not a dump of lab files.
5. **A five-minute walkthrough video** (Loom, YouTube, phone). Few candidates do it.
6. **Distribute.** One project, several LinkedIn posts from different angles (problem, build,
   mistake, result). GitHub stores evidence; it does not distribute it.
7. **Phrase it as work done.** "I tested an over-broad trust policy", never "I'm learning IAM".
8. **Match a project to a job ad** and reach out to the hiring manager with it.
9. **Never lie.** Fadi's doctrine already; everything below is built only from the record.

The owner's own framing, for our understanding and **not** to be written into the portfolio:
the portfolio should read as someone worth talking to, who can take a business problem off an
organisation's hands. Business problems move, so what Fadi proposes must stay current.

## What Claude landed today (in order)

| Commit | What |
|---|---|
| `ffd82b9` | Learning home: Continue / Recommended / Browse (Claude item 1) |
| `81ee45b`, `2550a69` | One finish review for projects and courses; completion package (item 2) |
| `7a14d4d` | Home page and Jobs no longer wait on the live job pipeline |
| `e30165e` | Wide open panels instead of dropdowns (Learning, Interview, job workspace) |
| `f9343f8` | **Transactional outbox** (migration 0060, `lib/outbox`) + outcome learning (items 3, 4) |
| `e8df942`, `47db4dd`, `7253e28` | Voice: "navigate to …" works, `open_page` tool, audio priming, no colliding replies |
| `be03ee6` | **Local voice**: speaches (Whisper) :8000 and Kokoro :8880 in docker compose; Ollama `llama3.2` as chat fallback |
| `eafad0a` | Job duplicates: `stableExternalId()`; 208 duplicate rows merged (script in `packages/database/src/scripts`) |
| `a6680fa` | **Two-minute test**: scenario-based suggestions, build→break→fix plans, decision + mistake captured, README, walkthrough outline + link, post angles |
| `46e9808` | Windows lab sign-in: templates set `Docker`/`admin` explicitly, planner told, panel shows it |
| `407f243` | **Flagship projects**: 2–3 per direction from this month's cited problems (SearXNG), weekly refresh, migration 0061 |

## What this means for your items

- **Live interview (in progress on your side):** interview practice should draw on flagship
  projects. The best behavioural material a junior candidate has is "what went wrong and how I
  fixed it" — the finish review now records it as `What went wrong, and the fix:` in the
  evidence detail (`readReflection()` in `lib/learning/case-study.ts` parses it). Please also
  call `interviewSessions.recordReview` per answer so the outcome loop keeps working.
- **Voice must stay local-first.** The owner wants everything self-hosted and free; Groq's
  free tier rate-limited the orb mid-conversation. If the live interview needs a realtime
  transport, prefer a self-hosted path (LiveKit server is open source; the hosted cloud is
  not free beyond 1,000 agent minutes) over a paid realtime API, or make the paid one
  opt-in with the local stack as default.
- **Social publishing:** there are now up to four posts per project (angles in
  `ANGLE_BRIEF`). Deliver through the outbox (`enqueueOutbox`), and keep the walkthrough link
  and README link in the post payload.
- **Project-to-job matching (video point 8) is not built.** Natural home: the job workspace's
  lead-evidence choice — surface the best-matching finished flagship and draft outreach that
  cites it. Unowned; say if you want it, otherwise Claude will take it.

## An open lab problem for whoever owns the lab engine

Measured on the owner's machine: the `dockurr/windows` image (0.8 GB) is shared, but **every
project gets its own `fadi-<name>-storage` volume, re-downloads the 8.2 GB Windows ISO and
reinstalls Windows (~1 hour)**. Nothing removes a finished or abandoned lab: a two-week-old
exited lab still holds 10.5 GB. Proposed: keep one clean installed base disk per Windows
version and clone it for new projects (minutes, no download), and offer "remove this lab —
frees N GB, keeps the image" in the finish review and for labs idle 14 days, with approval.
Claude will build this unless you want it.

## Later on 29 September: what the owner hit in the Active Directory lab

Walking the "Build and Secure a Test Active Directory Forest" project in the Windows Server
2025 lab surfaced four defects. All fixed by Claude; worth knowing before you touch the planner
or the lab.

1. **Invented login.** Step 1 said "log in with the supplied Administrator credentials". dockur
   creates exactly one account, `Docker` / `admin`, and nothing said so. Now set explicitly in
   the Windows templates (`signIn`), told to the planner, shown in the lab panel (`46e9808`).
2. **Writing into a folder nothing created.** Step 2 ran `… | Out-File C:\LabSetup\02_ADDS_Install.log`
   on a fresh VM; PowerShell failed with "Could not find a part of the path". New:
   `missingFolders()` / `withFoldersCreated()` in `lib/lab/host-and-lab.ts` repair every plan
   (Windows `New-Item -ItemType Directory -Force`, Linux `mkdir -p`) at the first step that
   writes into a missing folder; the prompt asks for it too. The owner's saved plan was
   repaired in place.
3. **Re-plan thrown away for one long step.** A step's instruction reached 1,201 characters and
   the 1,200 schema ceiling rejected the whole plan ("Fadi couldn't produce a usable plan").
   Ceilings raised (instruction 4,000, verify 1,500); the prompt asks for brevity instead.
4. **Flagship research ran out of tokens** on Groq `gpt-oss-120b` (reasoning spends budget):
   `DocGenerate.structured()` now takes `{ maxTokens }`; flagships ask for 8,000.

Open, not yet built (see "An open lab problem" above): every Windows project re-downloads the
8.2 GB ISO and reinstalls; finished labs are never cleaned up.
