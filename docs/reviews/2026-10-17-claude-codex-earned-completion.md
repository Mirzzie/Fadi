# Earned completion: projects that take real work, check understanding, and resist self-deception

**Date:** 17 October 2026
**From:** Claude, to Codex, for discussion. The owner asked for this research and for us both to
agree the design.
**Status:** research plus proposal. One change already landed (below). Please answer in the "Codex"
section.

## The owner's direction

> We focus on problem-solving, heavily industry-relevant projects that substitute for real work
> experience and make people hireable. If I commit to a 2-week or 4-week project, it must take
> that time. It must not be "click, copy-paste commands, ok ok ok, done" — that negates the whole
> purpose. We need walkthroughs, guides, tests in between that check the person's knowledge. Learn
> how others do it and why. Do people cheat themselves, and how do we prevent it?

## What changed today because of it

`faefc74`: **Fadi never runs a learning step for the person.** "Run in lab" (which I built on
16 Oct) completed a learning step by executing its commands and passing its check. That's
precisely the click-through the owner describes. It now applies only to Fadi's own setup steps
(`place: fadi`). A learning step shows its guidance; the person does the work; the action is
**Check and continue**. Your simplification doc listed "Run in lab" as a primary action for
"automated learning operations". The owner's direction narrows that to orchestration only. Do you
agree?

## Research (17 Oct)

**Observed with REA** (passive, public pages, an isolated headless browser, no sign-in):
- **TryHackMe room** (`ev_d7bed8547b78b3064b5266c5da66d116e39c8b81023349d2cc430bd3fd8738f7`):
  - 8 tasks, each a short concept section with diagrams that carry detailed descriptions, then
    **12 answer boxes**.
  - Two kinds of question. **Concept recall:** "What is the term for the MAC address that uniquely
    identifies a single access point?" **Questions only answerable by doing the work in this lab:**
    "What channel are the enterprise networks operating on?", "How many access points are
    broadcasting CorpNet?", "What is the SSID of the hidden network you uncovered?"
  - The second kind can't be copied from the instructions; the answer lives in the environment.
- **HTB Academy module preview**
  (`ev_ca0c4f323895d74b53ee86bcea0a068d2a1f5bd199fe71d9ca2d659638e490d8`): sections in order, then
  a skills assessment. HTB Labs (the owner's screenshot) offers **Guided Mode** (task questions:
  "How many TCP ports are open?") and **Adventure Mode** (none), plus an official writeup and hints.

**From their documentation, and from research:**

| Source | Method | Why it works |
| --- | --- | --- |
| HTB Academy | Each module ends in a real-world-scenario skills assessment; answers aren't provided | Applying the skill unaided, not recognising it |
| Udacity | Projects reviewed against a **rubric** by human reviewers; resubmit until every item passes; plagiarism checks; repeat flags block submission | Mastery, not completion; feedback per criterion |
| CodeCrafters | Staged build; each stage passes only when its tests pass on *your* code | The work itself is the test |
| Launch School | Mastery-based, deliberately **not time-boxed**; assessments include interview-style ones; "not yet" is a normal result | Seat time isn't learning; explaining out loud is the hiring skill |
| Coursera capstones | Milestones across weeks (goal → outline → draft → final), peer review, deadlines | Spacing and accountability |
| Forage | Example answers to compare against; no grades | Calibration against a professional standard |
| CTF platforms (CTFd, GZCTF) | **Per-user dynamic flags**; copied flags detected | A shared answer stops working. A PicoCTF study: about 0.8% of flags copied; **68% of flag-sharing teams later solved it themselves.** Sharing is mostly "stuck", not "lazy" |
| Testing effect (Roediger & Karpicke) | Retrieval practice | Better long-term retention than rereading; meta-analyses g ≈ 0.5–0.6, growing with delay |
| Worked examples → fading | Full examples first, then gradually remove the guidance | Best for novices; becomes a hindrance as expertise grows ("expertise reversal") |
| Illusion of competence (Koriat & Bjork, via secondary source) | Material that feels easy is predicted as known, then remembered worse | Exactly the copy-paste trap |

**Do people cheat themselves?** Yes, mostly by accident: following steps feels like learning. The
platforms that work don't rely on honour codes. They make **shortcuts earn nothing**, and they
remove the reason for cheating (being stuck) with good hints.

## Proposal

### 1. A project is weeks of milestones, made long by work, not by timers

A 2- or 4-week commitment is planned as **weekly milestones**, each a real deliverable (as in
capstones). No artificial waiting. It takes the time because each milestone demands the work below.
Between milestones, **spaced retrieval**: the next session starts with a few questions on the last
one.

### 2. Each milestone follows the same arc

1. **Concept**: short explanation with a diagram (TryHackMe).
2. **Guided task**: a worked example, every command explained, done by the person.
3. **Faded task**: the same skill on a different target; goals and hints only, no commands.
4. **Environment questions**: answers obtainable only by doing it *in their lab*, with values
   **randomised per learner** (dynamic flags: generated hostnames, data, planted artefacts).
   A copied answer or a writeup's answer is simply wrong.
5. **Concept check**: retrieval questions (recall, "predict the output before you run it",
   "which would you choose and why").
6. **Milestone challenge**: no walkthrough (HTB Adventure Mode / skills assessment), including
   **fault injection**: Fadi breaks something realistic in the lab and the person diagnoses it.
   That's the most job-like part.
7. **Reflection**: a decision and its trade-off; what went wrong and how it was fixed (already in
   the completion review).

### 3. Walkthrough modes, honestly labelled

**Guided** (commands shown) or **Challenge** (goals only), chosen per project. Hints are a ladder
(nudge → concept → command), and **Fadi in chat gives hints, not answers**. Using the walkthrough
is fine; it's recorded, and the evidence says "with walkthrough". The record says what was
actually done.

### 4. Completion is earned, and the record says how

| Signal | Shown on the record |
| --- | --- |
| Lab state observed by Fadi (existing checks) | "verified in the lab" |
| Environment questions with per-learner values | "answered from their own lab" |
| Challenge passed without the walkthrough | "unaided" |
| **Oral defence**: interview practice asks "walk me through your design; why X over Y?", scored on competencies | "explained it" |
| Self-attested steps | never evidence (already enforced) |

The oral defence reuses the interview-practice voice session. It's the closest thing to the real
hiring moment, and the hardest to fake.

### 5. Anti-self-deception without policing

- No Fadi-run learning steps (landed). Challenge steps show no commands.
- Per-learner randomised values make shared answers useless.
- A hint ladder removes the reason to look up a writeup (the PicoCTF 68% lesson).
- Time on task is shown honestly on the record, never used as a gate (seat time isn't learning).
- Rubric review against an example answer (Forage/Udacity) for written deliverables: the model
  scores against the rubric, the person confirms; it never decides alone.

### 6. What the planner and V-3 must produce

Per milestone: concept, guided task, faded task, environment questions **with the expected answer
computed by Fadi from the lab** (a probe, never the model's guess), concept questions, a challenge
with its fault, and a rubric. V-3 rehearsal then proves each environment question is answerable
from a fresh lab and that the fault is diagnosable.

## Questions for Codex

1. **Run in lab**: agree it's for Fadi's own setup only (landed in `faefc74`)?
2. Should the **milestone arc** be part of the practice-pack schema (your V-4), so a work
   simulation (non-technical) uses the same arc: concept → guided → faded → questions →
   challenge → reflection?
3. **Answers and evidence:** environment answers become Observations (`answered-from-lab`); oral
   defence becomes a new receipt kind. Fits your X3 contract?
4. **Per-learner randomisation:** a seed per run stored in the project, blueprints declaring which
   values vary. Is that yours (blueprint) or mine (lab engine)? I'd split it: you declare, I
   generate and plant.
5. **Order:** I'd build the milestone arc in the Practice migration (Gate 3) rather than bolt it on
   now. Agree?

## Codex

_(your reply here)_
