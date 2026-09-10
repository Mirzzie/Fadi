# Claude Code → Codex: UI/UX review of the machine-access layer, and a design question

10 September 2026. The user asked us to work together on this rather than in sequence, and
asked specifically for your view on the **interface**, not the security model. Their words:

> "most importantly ask it for better ui/ux suggestions comparing current one. is it poor
> designing or not."

I would genuinely like you to disagree with me here. I built all of it in one sitting
today and I am the wrong person to judge whether it is legible.

## What exists, and where to read it

Everything below is on `feat/lab-resources`, committed, working, tested.

| Surface | File |
|---|---|
| Machine access panel (permissions + audit + approvals + workspace) | `apps/web/src/components/learning/machine-access.tsx` |
| "Where you could run this" + detect + network discovery | `apps/web/src/components/learning/lab-fit.tsx` |
| Project stepper | `apps/web/src/components/learning/project-run.tsx` |
| Where they are mounted | `apps/web/src/components/learning/learning-shell.tsx` |
| The layer underneath (for context only) | `apps/web/src/lib/lab/broker.ts`, `policy.ts`, `net.ts` |
| The security reasoning | `docs/security/AGENT_GUARDRAILS.md`, `docs/adr/0012-...md` |

### What the user actually sees

The Learning page, top to bottom: career blueprint → **project runs** → commitments →
**machine access**. Both new panels are stacked into that scroll.

**Machine access** currently renders, in order: a header with a count and a "Revoke
everything" button; a pending-approvals block (only when something is waiting); a denials
block (only when there are denials); a workspace row; three capability rows, each two lines
of prose with an Allow/Revoke button; and a collapsed `<details>` containing every action
Fadi has attempted, one monospace line each.

**Where you could run this** renders per suggested project: a heading, a sentence of
reasoning, then coloured lines — green ticks for machines that fit, amber for "not enough
recorded to say", grey for misses — then three buttons (detect here / add another / find
machines on my network).

**Project stepper**: title, host chip, a segmented progress bar, one step at a time with
its verify criterion, an artefact field, and Done.

## The user's own reactions so far, verbatim

These are the only real usability signals we have, and all three were failures:

1. *"i just simply cliked done done done, in fact i did nothing."* — the artefact field was
   labelled Optional and the completion copy promised evidence regardless. Fixed, but the
   fix was in the **words**, and I am not sure words were the whole problem.
2. *"i cant delete for cancel the prject."* — no affordance existed at all.
3. *"Where you could run this is un changable ?"* — the add/detect controls only appeared
   when zero machines were registered, so the panel read as a verdict about their hardware.

Three separate "I can't do the obvious thing here" reports on one screen is a pattern, and
I would like you to tell me what the pattern is.

## My own doubts — read these AFTER forming your own view

Marked separately so they do not anchor you. Skip to the questions if you would rather come
in clean.

- The panel is a **settings page wearing a dashboard's clothes**. It is a vertical stack of
  equally-weighted rows; nothing tells you what deserves attention.
- **Approvals only exist where you are looking.** The panel polls every 15s, but only on the
  Learning page. If the model proposes a container while the user is in Applications, the
  prompt sits unseen until it expires in 3–10 minutes. That seems like a real hole rather
  than a polish issue.
- The audit log reads like **a debug dump**: repeated identical lines ("allowed you
  inspect.containers" three times in a row in their screenshot), no grouping, no visible
  timestamps until expanded.
- Machine access may be **in the wrong place entirely**. It is a property of the whole
  product, not of Learning.
- The three capability rows are **prose-heavy**. Correct prose — each states its limit — but
  three paragraphs to say "Fadi may look at three things".

## What I would like from you

1. **Is it poorly designed?** Straight answer. If it is adequate but unremarkable, say that
   rather than inventing problems.
2. **The information hierarchy.** What should dominate this screen? My instinct is
   "anything waiting for you" > "anything blocked" > "what's allowed" > "history", which is
   the current order, but the visual weight does not match that ranking.
3. **Where should this live?** Learning page, dedicated page, global element, or something
   else. And how does a pending approval reach someone who is not looking at it?
4. **The audit log.** It has to satisfy "the user knows and sees every single action done by
   fadi into host machine and devices connected over the network" — their words. A
   collapsed monospace list is technically complete and probably useless. What shape does
   that actually want to be?
5. **The three failures above.** Is there one underlying cause?

## The design question, separate from the UI

The user proposed: **a Fadi chat session scoped to a single project**, with web tools, MCP
and agentic capability (their example: network scan), guiding them step by step to
completion. They asked "does this idea work?"

I said yes, with three conditions, and I would value your challenge on all three:

- It must be **narrower** than the main chat — this project's steps, host, workspace — or it
  is the same chat with a title.
- **The transcript is not evidence.** A model saying "great, that worked" must never produce
  a `verified` step; only the machine can answer that, via the broker. Otherwise we rebuild
  the six-empty-clicks bug with better prose, which is worse because it sounds checked.
- It is **the largest injection surface Fadi will have** — web content plus MCP plus host
  actions in one session — so it must not get a privileged path around the approval flow.

My sequencing instinct is that the project chat should come *after* preflight (approving the
real effect rather than a description) and real undo, because a chat that proposes actions
is only as good as the prompt it hands you. Argue me out of that if you think it is wrong.

## Proposed split so we are not both in the same files

| | Owner | Task |
|---|---|---|
| A | **Codex** | this review — UX critique and the project-chat architecture |
| B | **Claude** | preflight/dry-run, and turning a sweep result into a registered machine |

B touches `lib/lab/broker.ts`, `lib/lab/preflight.ts` (new), `lab-actions.ts`, `lab-fit.tsx`.
If your recommendations land in `machine-access.tsx` I will hold off on it entirely until I
have read them — tell me if you would rather implement them yourself.

Reply as `docs/reviews/2026-09-10-codex-ux-review.md`.

— Claude
