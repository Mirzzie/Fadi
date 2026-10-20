# FadiOS — Complete Feature Tree (Box-in-Box Decomposition)

Every feature, broken down into its parts, and their parts, and so on. **Read the nesting as containment: each indented item is a "box" inside the box above it.** Numbers are only for navigation (1 → 1.1 → 1.1.1 → 1.1.1.1 …). This is behavior and concept only — no code, no visual design.

```
FadiOS  ─ the whole system (the outermost box)
│
├── everything below is a box contained inside FadiOS
```

---

## 1. Fadi — the AI core (the mentor that runs the whole system)

- **1.1 Presence**
  - 1.1.1 Always available across the whole product (not a popup you open)
  - 1.1.2 One shared identity everywhere — same Fadi on every screen
  - 1.1.3 Personality: honest, calm, mentor-not-cheerleader, a little contrarian
- **1.2 Ways to interact**
  - 1.2.1 Text chat
  - 1.2.2 Voice
    - 1.2.2.1 Fadi speaks answers aloud
    - 1.2.2.2 Fadi listens and transcribes the user's speech
    - 1.2.2.3 Mute / unmute control
  - 1.2.3 Live state the user can sense (idle, listening, thinking, working, speaking)
- **1.3 Agent actions (things Fadi can actually DO, not just advise)**
  - 1.3.1 Start or switch a career direction
  - 1.3.2 Search for jobs
  - 1.3.3 Pull a specific company's open roles
  - 1.3.4 Run a fit check on a job
  - 1.3.5 Draft a referral outreach message
  - 1.3.6 Answer a behavioral question from the user's own stories
  - 1.3.7 Prepare the user for a specific interview from a job description
  - 1.3.8 Read the user's honest momentum / "how am I really doing"
  - 1.3.9 Surface rejection patterns
  - 1.3.10 Give the career-weather read
  - 1.3.11 Each action returns a spoken/narratable result AND the supporting detail
- **1.4 Proactivity**
  - 1.4.1 Short honest briefing of what matters today
  - 1.4.2 "While you were away" — surfaces real findings it discovered in the background
  - 1.4.3 Gated: only speaks up on real events, never filler or spam
- **1.5 Bring-your-own intelligence**
  - 1.5.1 User connects their own AI provider/key
  - 1.5.2 Product is provider-agnostic
  - 1.5.3 Graceful behavior when no provider is connected (honest "connect a provider" instead of failing)
- **1.6 Honesty rules Fadi always obeys**
  - 1.6.1 Only claims what is actually true
  - 1.6.2 Says "I don't have that data yet" instead of guessing
  - 1.6.3 Never invents the user's experience or any external fact

---

## 2. Onboarding (first-use setup)

- **2.1 Conversational, not form-filling**
- **2.2 Collects what Fadi needs to personalize**
  - 2.2.1 The user's career background / history
  - 2.2.2 Their profile basics
  - 2.2.3 Their first target career direction
- **2.3 Outcome: the product is personalized from this point on**

---

## 3. Career Directions (Tracks)

- **3.1 What a direction holds**
  - 3.1.1 Short name
  - 3.1.2 Target role
  - 3.1.3 Field / industry
  - 3.1.4 Goal / "why"
  - 3.1.5 Location (optional)
  - 3.1.6 Experience level
  - 3.1.7 Intent: committed change · exploration · trial · part-time/gig
- **3.2 Multiple parallel directions**
  - 3.2.1 A user can keep several directions
  - 3.2.2 Exactly one is "active" at a time
  - 3.2.3 Switching is clean and explicit
- **3.3 The active direction drives the WHOLE product**
  - 3.3.1 Jobs follow the active direction
  - 3.3.2 Documents tailor to it
  - 3.3.3 Interview prep targets it
  - 3.3.4 Career Weather is ranked to it
  - 3.3.5 On create/switch, everything updates immediately — never shows the previous direction
- **3.4 Creating a direction by conversation**
  - 3.4.1 Fadi asks only for the few things it needs
  - 3.4.2 Won't create a half-defined direction (needs at least name, role, goal)
- **3.5 Niche Finder (sub-feature)**
  - 3.5.1 For users unsure where to aim
  - 3.5.2 Grounded in their real background + real market data
  - 3.5.3 Honest diagnostic, not a guess

---

## 4. Career History — the Source of Truth

- **4.1 The user provides their full history**
  - 4.1.1 e.g. pasted LinkedIn profile text
  - 4.1.2 e.g. uploaded resume
- **4.2 Authority rules**
  - 4.2.1 The fuller record (LinkedIn) is authoritative
  - 4.2.2 A tailored resume is a partial, role-specific excerpt
  - 4.2.3 Never infer gaps/weaknesses from what a tailored resume leaves out
- **4.3 This grounds every other feature**
  - 4.3.1 Documents draw on it
  - 4.3.2 Fit checks reason from it
  - 4.3.3 Interview prep is built from it
  - 4.3.4 Rejection autopsies reference it
- **4.4 Honest limitations**
  - 4.4.1 The product cannot secretly fetch the user's LinkedIn posts/content
  - 4.4.2 It only knows what the user gives it
  - 4.4.3 It invites the user to add more (achievements, projects, posts) to get better help

---

## 5. Jobs — finding the right roles

- **5.1 Live discovery**
  - 5.1.1 Pulls real, current postings from multiple sources
  - 5.1.2 Matched against the active direction (role, field, location, experience)
- **5.2 Domain-agnostic matching**
  - 5.2.1 Understands role title variants (e.g. "Registered Nurse" = "Staff Nurse" = "RN") for ANY field
  - 5.2.2 As good for non-tech fields as for tech
- **5.3 Honest source coverage**
  - 5.3.1 Knows which sources are broad vs. tech-only
  - 5.3.2 For a non-tech user, drops tech-only sources
  - 5.3.3 If the user's field isn't covered, says so plainly and tells them how to widen it
  - 5.3.4 Never silently shows irrelevant roles or an unexplained blank screen
- **5.4 Relevance gating**
  - 5.4.1 Prefers fewer on-target roles over padding with off-target ones
  - 5.4.2 Honest empty state when nothing fits
- **5.5 Direct-from-employer pull**
  - 5.5.1 For a specific named company, pull its currently-open roles straight from its own hiring system
  - 5.5.2 Fresher and less ghost-prone than aggregators
  - 5.5.3 Honest empty result if the company's board can't be found (never fabricated listings)
- **5.6 Original posting link**
  - 5.6.1 Every job links to the original posting on the source/company site
  - 5.6.2 User can verify the role and apply directly at the source
- **5.7 Freshness / ghost-job protection**
  - 5.7.1 Stale or closed-looking postings are aged out or flagged
  - 5.7.2 Liveness check before the user invests time
- **5.8 Match transparency**
  - 5.8.1 Each job shows a match indication
  - 5.8.2 And the honest reasons behind the match
- **5.9 Location / type / mode filters**
  - 5.9.1 Search any country/city
  - 5.9.2 Filter by work mode and employment type
  - 5.9.3 Hard filters are strict (a city search shows only that city)

---

## 6. The Fit Gate — "is this job worth your time?"

- **6.1 Purpose: decide BEFORE applying (anti-spray)**
- **6.2 Inputs**
  - 6.2.1 The job description
  - 6.2.2 The user's real history
- **6.3 Scored dimensions (weighted)**
  - 6.3.1 Role match (skills/experience vs. must-haves) — highest weight
  - 6.3.2 Seniority fit
  - 6.3.3 Field/industry transfer
  - 6.3.4 Whether it advances the user's stated goal
  - 6.3.5 Logistics (location / remote / visa / comp realism)
  - 6.3.6 Posting legitimacy (scam / ghost-job / vague-listing signals)
- **6.4 Output**
  - 6.4.1 A single 0–5 score
  - 6.4.2 A verdict
    - 6.4.2.1 Apply — strong fit, worth a tailored application
    - 6.4.2.2 Stretch — only worth it if gaps closed, or with a referral
    - 6.4.2.3 Skip — below the bar; aim energy elsewhere
  - 6.4.3 The reasons "why"
  - 6.4.4 The gaps to close
  - 6.4.5 Any red flags
- **6.5 Calibration & tone**
  - 6.5.1 Not inflated — most roles land mid-range; high scores must mean genuine fit
  - 6.5.2 A "skip" is framed as time saved, not failure
  - 6.5.3 A "skip" suggests a closer role or a referral instead
- **6.6 Distinct from document quality**
  - 6.6.1 Fit gate decides WHETHER to apply
  - 6.6.2 Document quality (later) judges HOW GOOD the application is

---

## 7. Documents — resume, cover letter, cold email

- **7.1 Tailored drafting**
  - 7.1.1 Per specific job, grounded in the user's real history + the JD
  - 7.1.2 Resume
  - 7.1.3 Cover letter
  - 7.1.4 Cold outreach email
- **7.2 The Humanizer (applies to every document)**
  - 7.2.1 Removes "AI tells"
    - 7.2.1.1 Stock clichés and empty corporate phrases
    - 7.2.1.2 Template sentence shapes
    - 7.2.1.3 Robotic, uniform rhythm
    - 7.2.1.4 Over-polish that reads machine-made
    - 7.2.1.5 Over-used punctuation habits
  - 7.2.2 Aims for genuine human voice
    - 7.2.2.1 Specific real details over generic adjectives
    - 7.2.2.2 Varied, natural sentence rhythm
    - 7.2.2.3 The candidate's actual voice
  - 7.2.3 Honesty stance
    - 7.2.3.1 Does NOT claim to evade AI detectors (none are reliable)
    - 7.2.3.2 Mirrors the job's terminology only where the user genuinely has that experience
    - 7.2.3.3 Never claims a skill the user doesn't have
- **7.3 Parse-safe / clean formatting** (so applicant systems read it correctly)
- **7.4 Review & approval**
  - 7.4.1 Everything is a draft the user reviews
  - 7.4.2 Nothing is sent automatically
- **7.5 Organization**
  - 7.5.1 Documents grouped per job/application

---

## 8. Applications & Outcome Tracking

- **8.1 A single honest record per application**
- **8.2 Marking "sent"**
  - 8.2.1 Records the fact the application went out
  - 8.2.2 Is NOT rewarded (clicking a button isn't forward motion)
  - 8.2.3 Is the precondition for honestly logging a later rejection
- **8.3 Status stages**
  - 8.3.1 Saved → Applied → Interviewing → Offer / Rejected / Withdrawn
- **8.4 Per-application workspace (the hub for one role)**
  - 8.4.1 The original posting link
  - 8.4.2 The fit check ("should you apply?")
  - 8.4.3 JD-tailored interview prep
  - 8.4.4 The tailored documents
  - 8.4.5 The outcome + rejection autopsy
  - 8.4.6 A liveness warning if the posting looks closed

---

## 9. Referrals & Networking

- **9.1 Referral targets list**
  - 9.1.1 A company being pursued
  - 9.1.2 Optionally a specific person
  - 9.1.3 The relationship type
    - 9.1.3.1 School alum
    - 9.1.3.2 Former colleague
    - 9.1.3.3 Mutual connection
    - 9.1.3.4 Friend / personal
    - 9.1.3.5 Recruiter
    - 9.1.3.6 No connection yet
- **9.2 The funnel**
  - 9.2.1 Identified → Asked → Responded → Referred (or Declined)
- **9.3 Fadi drafts the outreach message**
  - 9.3.1 Short, warm, specific, low-pressure
  - 9.3.2 Tuned to the relationship type
  - 9.3.3 Never fabricates a shared history
- **9.4 "How to find a path in" (honest, since it can't read the user's network)**
  - 9.4.1 Find alumni / former colleagues now at the company
  - 9.4.2 Ask a mutual connection for an intro
  - 9.4.3 Engage with the team's work first, then ask
  - 9.4.4 Message a recruiter directly
  - 9.4.5 Ask the user's own circle
- **9.5 Reward rules**
  - 9.5.1 The reward lands on the controllable act — reaching out
  - 9.5.2 Counted once (can't be farmed)
  - 9.5.3 Getting the referral isn't required to earn credit; asking is
- **9.6 Why it's first-class: one referral ≈ forty cold applications**

---

## 10. Interview Preparation

- **10.1 Story Bank (reusable stories)**
  - 10.1.1 Built from the user's real career history
  - 10.1.2 Structure per story
    - 10.1.2.1 Situation
    - 10.1.2.2 Task
    - 10.1.2.3 Action
    - 10.1.2.4 Result
    - 10.1.2.5 Reflection (what they learned)
  - 10.1.3 Tagged by competency (leadership, conflict, failure, ownership, …)
  - 10.1.4 The user can add or edit stories by hand
  - 10.1.5 Practice tool
    - 10.1.5.1 User types a behavioral question
    - 10.1.5.2 Instantly returns their best-matching real story
  - 10.1.6 Honesty: only from real experience; never invented; says so if history is thin
- **10.2 JD-tailored STAR prep ("prep me for this job")**
  - 10.2.1 Input: a specific job description
  - 10.2.2 Infers the behavioral questions this role is likely to ask
  - 10.2.3 Drafts a STAR answer for each, from the user's real history + existing stories
  - 10.2.4 Reuses a saved story when it fits (shows which one)
  - 10.2.5 Honesty
    - 10.2.5.1 Never invents an achievement
    - 10.2.5.2 If real history doesn't cover a likely question, still lists it and says "prepare a real example"
- **10.3 Loop back: strong tailored answers can be saved into the Story Bank**

---

## 11. Resilience & Momentum Engine (the anti-give-up core)

- **11.1 Momentum (a single process-health number)**
  - 11.1.1 Rises only on controllable actions
    - 11.1.1.1 Sending a quality application
    - 11.1.1.2 Learning from a rejection (an autopsy)
    - 11.1.1.3 Closing a skill gap
    - 11.1.1.4 Activating a referral
    - 11.1.1.5 Taking deliberate rest
  - 11.1.2 Never awarded for outcomes
  - 11.1.3 No shame
    - 11.1.3.1 Decays gently when idle
    - 11.1.3.2 Never collapses to zero
    - 11.1.3.3 Missing days is not punished
  - 11.1.4 Comebacks are rewarded (returning after a break)
  - 11.1.5 Shown as a band/label, never an alarming red "failure" state
- **11.2 Rest (protected)**
  - 11.2.1 User starts a deliberate rest window
  - 11.2.2 Momentum is paused and preserved
  - 11.2.3 Treated as discipline, not a lapse
- **11.3 Commitment cadence (the user's own terms)**
  - 11.3.1 User sets a sustainable target they choose
  - 11.3.2 Never an imposed quota
  - 11.3.3 Feedback always against their own commitment (ahead / on track / behind / resting / unset)
- **11.4 You vs. your past self**
  - 11.4.1 Compares this week only to the user's own past weeks
  - 11.4.2 Never to other people; no leaderboard
  - 11.4.3 Honest about thin data (needs enough history before claiming a standing)
  - 11.4.4 Frames a quiet week as information, not a verdict
- **11.5 Honest morale read**
  - 11.5.1 Detects a hard or quiet stretch (e.g. unprocessed rejections, a long gap)
  - 11.5.2 Validates the difficulty truthfully
  - 11.5.3 Never shames
  - 11.5.4 Always offers ONE small controllable next step
- **11.6 Un-fakeable by design** (rewards attach only to real, controllable, verifiable actions; no external prize to win)

---

## 12. Rejection Autopsy

- **12.1 Logging a rejection**
  - 12.1.1 Must be against a real, already-sent application (provenance gate)
  - 12.1.2 The courage to log earns a tiny reward; the real reward is the reflection
- **12.2 The user's brief reflection**
  - 12.2.1 How far it got
  - 12.2.2 Any feedback received
  - 12.2.3 Anything they'd do differently
  - 12.2.4 What it points to next
  - 12.2.5 "Nothing — it was a long shot" is a valid answer
- **12.3 Fadi's analysis (across the user's rejections)**
  - 12.3.1 A named cross-rejection pattern
    - 12.3.1.1 Only when ≥2 rejections genuinely support it
    - 12.3.1.2 Honestly says "not enough data yet" otherwise — never invents one
  - 12.3.2 A sharper next application (2–4 controllable steps, tuned to where the user is losing)
  - 12.3.3 An honest reframe (acknowledges difficulty, points forward — not toxic positivity)
- **12.4 Anomaly check**
  - 12.4.1 If logged rejections wildly exceed sent applications, gently invites adding the real applications
  - 12.4.2 Explains the numbers exist only to help; nobody else sees them; inflating them only worsens the advice
- **12.5 Feeds the Momentum engine (the autopsy is the rewarded forward motion)**

---

## 13. Career Weather — the "window of wisdom"

- **13.1 Three fused layers, ranked to the user's direction**
  - 13.1.1 Structural forces (durable shifts reshaping careers)
    - 13.1.1.1 Automation & skill change
    - 13.1.1.2 Demographic / healthcare demand
    - 13.1.1.3 The green transition
    - 13.1.1.4 Recurring economic shocks
    - 13.1.1.5 Geopolitics
    - 13.1.1.6 Each tagged: pressures this field / tailwind for this field / general force
  - 13.1.2 The live economy
    - 13.1.2.1 Inflation
    - 13.1.2.2 Interest rates
    - 13.1.2.3 Unemployment
    - 13.1.2.4 In plain language
  - 13.1.3 Current affairs (live news relevant to the field)
- **13.2 The guardrail (what makes it wisdom, not anxiety)**
  - 13.2.1 EVERY item ends in a controllable next move
    - 13.2.1.1 High inflation → re-benchmark pay, negotiate
    - 13.2.1.2 Slack labor market → lean on referrals, protect momentum, longer searches are normal
    - 13.2.1.3 A scary headline → context for targeting, not a trigger to react to
  - 13.2.2 Positioning information, never doom
- **13.3 Honest about gaps**
  - 13.3.1 If a data source isn't connected, says so (and how to connect it)
  - 13.3.2 If nothing relevant is live, says so — never manufactures content

---

## 14. Cross-cutting principles (boxes that wrap around everything)

- **14.1 Honesty guardrails (apply to every feature)**
  - 14.1.1 Never invent the user's experience, skills, or achievements
  - 14.1.2 Never fabricate a job, company, statistic, or signal
  - 14.1.3 Never claim to have done something it didn't, or to have data it doesn't
  - 14.1.4 Never reward or score an outcome — only controllable process
  - 14.1.5 Never shame the user
  - 14.1.6 Never compare the user to other people — only their past self
  - 14.1.7 Never assume the user works in technology
  - 14.1.8 Never claim to evade AI-writing detectors
  - 14.1.9 Never auto-submit an application
  - 14.1.10 Never present the world as hopeless — always end on a controllable next step
- **14.2 The psychological lens (applied to every decision)**
  - 14.2.1 Protect the user's morale
  - 14.2.2 Protect their locus of control (their actions matter)
  - 14.2.3 Reward effort the user controls; never inflate hope or deny difficulty
- **14.3 The through-line of the whole product**
  - 14.3.1 Signal → what it means for YOU → the one thing YOU control
  - 14.3.2 Every feature must end there

---

## How to read this tree

- The outermost box is **FadiOS**.
- Sections 1–13 are the major boxes inside it (the features).
- Section 14 is the set of principle-boxes that wrap around and constrain all the others.
- Inside each feature box are its sub-features; inside those, their components; inside those, the specific behaviors and rules.
- If you build each innermost box correctly and respect the principle-boxes in section 14, you have rebuilt FadiOS.
