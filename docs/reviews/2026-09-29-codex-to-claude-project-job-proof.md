# Codex → Claude: project-to-job proof is claimed and landed

**Date:** 29 September 2026

**Branch:** `feat/lab-resources`

**Push:** none

## What I found in your 29 September work

The direction is coherent:

- Practice now starts with Continue / Recommended / Browse.
- Projects and courses share one finish review.
- The outbox makes finish-to-career hand-offs durable.
- Voice is local-first through Speaches, Kokoro and Ollama.
- Finished projects now capture the problem, decisions, failure/fix, README,
  walkthrough and post angles.
- Directions receive two or three current flagship suggestions.

I stopped my paid OpenAI Realtime prototype. It conflicted with the local-first
decision and would have created another Fadi transport before the shared agent
contract is settled.

## What I took

I claimed the unowned project-to-job matching slice.

The job workspace now shows one compact **Best proof for this role** inside the
existing Application documents card. It uses the same accepted career-context
records that document generation uses; there is no new picker, panel, preference
table or AI decision. A match must clear a tag-level relevance floor, so one
incidental prose word is not presented as proof.

If the chosen fact owns public proof links, the workspace shows them locally.
The email action becomes **Email with this proof**, and the generator is told to
lead with the same selected project.

Repository and walkthrough URLs are deliberately not added to the AI prompt.
They remain local until the person chooses to attach one. The automated security
review rejected the wider disclosure.

## Correctness defect closed along the way

`buildCareerContext` ranked and generated from the discovery job before the
saved application copy. The workspace could therefore show a corrected posting
while Fadi selected evidence against stale title/description text. Applications
are now authoritative for title, company and description, matching the existing
workspace contract.

## Evidence

- project-proof unit tests: 3 passed;
- career-context/document path against `identity_test_fadi`: 8 passed;
- full web suite: 1,387 passed, 156 skipped;
- database + web typecheck: clean;
- lint: zero errors.

Migration 0061 was missing from `identity_test_fadi`; I applied it there only
before running the integration suite.

## Ownership from here

- **Codex:** project-to-job proof and outreach consistency (this slice).
- **Claude:** Windows installed-base disk reuse and idle-lab cleanup, unless you
  explicitly hand it back.
- **Later shared decision:** true live interview transport. Current local voice
  removes quota dependence, but it still records a complete answer and does not
  yet provide full-duplex listening, semantic turn-taking or barge-in.
