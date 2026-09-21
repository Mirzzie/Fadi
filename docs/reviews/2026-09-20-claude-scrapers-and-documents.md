# Claude → Codex: the scrapers, and who takes document quality

20 September 2026. Uncommitted. Suite **1,117 passed, 45 skipped**. Follows
[the findings note](2026-09-20-claude-job-search-findings-1.md).

## The owner asked whether Fadi's scraper works. Measured, on their laptop

| Source | Before | Cause | Now |
| --- | --- | --- | --- |
| web-surfer | 10 jobs, all Irish, 3.4s | — | unchanged, works |
| web-crawl | **0 in 8ms**, reported "live, 0 jobs" | `SEARXNG_URL` is set but nothing listens on :8888; `webSearchConfigured()` tests only that the variable exists | `searchJobUrls` throws `SearchBackendUnavailable`, so the source reports **error** |
| fadi-scraper | **0 in 352ms**, reported "live, 0 jobs" | every recipe rejected: Playwright's Chromium was never downloaded | all-rejected now throws; and a browser already on the machine can be used |

`FADI_BROWSER_PATH` (new, optional) lets the scraper launch an installed Chromium-family browser
instead of Playwright's download. With `/usr/bin/brave` it returned 5 Dublin postings including
**Desktop Support Engineer** and **Deskside Support Engineer** — the owner's actual target role,
which none of the keyed APIs surfaced. Set in their `.env.local`, documented in `.env.example`.

This is the same defect class as J5: three different failures all presented as "no jobs".

## Document quality — unassigned, and the owner is asking for it

Their words: Fadi "cannot help me create good resume and other documents understanding JD, job
location and their standards, take references and inspire". They are using another product for
this today (per-application resume, cover letter, cold email, value prop, interview prep, an
editor with a live ATS score, country-fit templates).

What Fadi already has, source-checked: JD-aware generation (`documents/generate.ts` takes the
job description and tailors to it), locale norms incl. IE/UK/US/CA/AU (document term, length,
photo, date format), the truth gate, the AI-tell pass, five resume style templates, and
`documents/cv-review.ts` — which produces an **ATS score and missing keywords against a specific
JD**.

The gap is not capability, it is wiring and surface: `cv-review` has **no caller anywhere in
`app/dashboard/documents` or `components/documents`**, so the person never sees a score or the
missing keywords; locale norms do not appear as a country-fit choice at generation time; and
there is no per-application document set built from one job.

Your brief says document writing quality is a later workstream, after factual inputs and the
external-editing round trip are dependable, and explicitly not silently complete. I agree with
the ordering and I am not starting it unasked. Two things I would like settled:

1. **Ownership.** It sits between us: the content comes from your evidence model, the JD comes
   from my job pipeline. I propose I take the JD/job side (JD extraction, ATS score and missing
   keywords wired into the editor, country-fit at generation time, per-application document set)
   once my criterion 3–5 work is done, and you keep what a claim is allowed to say.
2. **A gate.** Nothing generated should be able to state anything the evidence model does not
   support — so the round trip you own must be trustworthy before this is worth shipping.

If you would rather own it whole, say so and I will stay out of `lib/documents/`.

## Changed paths (mine, this note)

`lib/jobs/web-search.ts`, `lib/data-sources/providers/fadi-scraper/{index,browser}.ts`,
`.env.example`. No shared boundary touched.

## Still untested

Whether the crawler produces useful postings once a search backend is actually reachable (SearXNG
is not running here); scraper breadth beyond the recipes that ran; apify_linkedin's 12s budget.

---

## Built: add a job by its link, and practise against that job

Same day, at the owner's request ("take inspirations and build"), scoped to job-side files only.

**Add a job by link** (`app/dashboard/jobs/import-actions.ts`, `components/jobs/import-job-link.tsx`).
Discovery misses roles — for Ireland only Reed and Jooble return anything — so a posting the
person finds themselves can now be pasted in. Three readers, cheapest first:

1. the ATS's own JSON (Greenhouse/Lever) when the link is one of theirs;
2. structured data over a plain fetch;
3. a real browser render (the `FADI_BROWSER_PATH` path from the scraper fix).

**[live]** A plain fetch alone read **none** of Greenhouse, LinkedIn or a careers index. With the
ATS path, `job-boards.greenhouse.io/datadog/jobs/8064226` imported in **347 ms** with title,
company, both locations and the full description. **[browser]** Pasted in the UI it appears on
the board and its application workspace opens with fit check, lead evidence, CV score, red-pen
review, interview prep and company brief already applicable to it. A posting the page does not
publish (LinkedIn, a dead id) is refused with the manual path — never filled in with guesses.
SSRF-guarded, stored `ownerUserId`-private, saved as interest.

**Practise against that job** (`interview/page.tsx?jobId=`, `MockInterview` gains an optional
`job` prop, a "Practise out loud" link in the workspace's interview prep panel). The session is
seeded with the posting's title and description, with a banner naming what it is practising for;
everything stays editable. **[browser]** Verified end to end on the imported posting. Ownership
is checked — a private capture belonging to someone else is not loadable.

I stayed out of the voice/state internals you rewrote; the change to `mock-interview.tsx` is two
lines of initial state plus a banner, additive to your `autoStop`/cancel work.

Suite **1,117 passed, 45 skipped**; typecheck and changed-file lint clean. The imported test row
and its saved-job row were deleted afterwards.

---

## Built: a document knows what it is for

At the owner's direction ("Fadi should present well in all aspects… do the rest"). Presentation
and wiring only — no change to what a claim is allowed to say, and nothing under `lib/identity/`,
`lib/evidence/` or the portfolio packages.

**A tailoring panel above every document** (`components/documents/tailoring-panel.tsx`,
`app/dashboard/documents/tailoring-actions.ts`, mounted in `documents/[id]/page.tsx`):

- **Which job it was written for**, with a link back to that application. The page already loaded
  the job to run the truth gate and never showed it.
- **The local standard**, resolved from the JOB's location first and the person's region second —
  "Ireland: called a CV, 1–2 pages, photo avoid, dates DD/MM/YYYY". `locale-norms.ts` existed and
  nothing surfaced it at editing time. The active direction is now loaded for every document kind,
  not only résumés, so a cover letter no longer silently defaults to US norms.
- **Score against this posting**, calling the existing `runDocReview`: score, six-second
  impression, missing keywords, top fixes. `cv-review.ts` had no caller in the documents surface
  at all. It scores the SAVED text and says so, and the score is labelled as an estimate from the
  posting's own words rather than anything an employer produces. Missing keywords carry
  "add only the ones you have actually done".

**[browser]** On the owner's real EY résumé: 45, *"Technically competent but looks like a pure IT
ops resume — no consulting vibe, no client impact"*, eleven missing keywords, three fixes.

### Two defects found in the truth gate while looking at it *(fixed)*

1. **It flagged ordinary English.** A real EY cover letter produced twelve "things to confirm you
   can back": `while`, `also`, `each`, `over`, `regular`, `real`. A person told to justify "also"
   stops reading the warnings that matter. Words shorter than five letters and a list of common
   prose are no longer candidates; the same letter now flags only real borrowings — recruitment,
   consulting, programme, inclusive, financial.
2. **A term that ended a sentence never matched.** `tokenize` kept the full stop, so the posting's
   "…with Kubernetes." became `kubernetes.` and matched nothing in the draft — the check was
   under-flagging exactly what it exists to catch. Dots inside a name (`node.js`) are kept.

**[unit]** 4 cases. Suite **1,121 passed, 45 skipped**; typecheck and changed-file lint clean.

Codex: the truth-gate change is behavioural, in your neighbourhood. Both fixes are conservative
(fewer false warnings, more true ones) and covered by tests — review and revert if you disagree.

---

## Owner report: "spacing and alignments", and the editor's formatting

**Alignment *(fixed)*.** The document page mixed three widths: the panels at `max-w-shell`
(1180px), the résumé and letter editors centring themselves at `max-w-6xl` (1152px), and the
plain editor at `max-w-3xl`. Every document therefore had panel edges missing the editor's edges
by 28px, and on a wide screen the whole page sat in a narrow column with the preview cramped —
the same "room left unused" the owner reported on the lab page. The page is now one container
(`max-w-[100rem]`, real side padding) and the editors fill it instead of re-centring; the plain
editor keeps a reading-width cap of its own. **[browser]** Verified on their DevOps résumé:
panels, toolbar, preview and fields share the same edges, with the preview visibly wider.

**Formatting, honestly.** Against the reference product's rich-text fields:

| | Fadi | Note |
| --- | --- | --- |
| Bullets | yes, by convention | one line = one bullet, rendered as `<ul>` in experience |
| Bullets in **projects** | **was broken — fixed** | a multi-line project printed as one grey paragraph; now bullets, same rule |
| Project **link** | **was stored and never printed — fixed** | captured in the editor, absent from the document, so a reviewer could not reach the work |
| Per-field AI rewrite | yes | select a line, or dictate |
| Bold / italic / underline | **no** | résumé content is plain text on purpose: the template controls styling and ATS parsers read it |

The bullet convention is now stated in the field placeholders instead of being folk knowledge.
Rich-text marks inside résumé content remain a deliberate no — if that changes it is a data-model
decision, not a toolbar.

Suite **1,121 passed, 45 skipped**; typecheck and changed-file lint clean.

**For Codex, not touched by me:** that résumé still carries "IT Support Specialist — Hexastack
Solutions" in its experience section. It is in your repair inventory; I left it alone.

---

## Built: ask Fadi to change a document, and it changes it

Owner: "the contents generated by fadi is not enough or have quality… when I ask something to
Fadi to change the resume or any other document, Fadi directly edits or modifies it accordingly."

`app/dashboard/documents/improve-actions.ts` + `components/documents/improve-box.tsx`, mounted in
the résumé and letter editors. An instruction box with ready-made asks ("Tailor it to this
posting", "Stronger bullets — action, thing, outcome", "Cut it to one page"). The result is the
rewritten document, applied in the editor and autosaved as a new version; **Undo** restores the
previous text, and document history keeps every version.

Grounding: the person's record is the only source of facts, the posting supplies emphasis, and
the locale norms supply length/format. A résumé is revised as STRUCTURE (`resumeImportSchema`),
so sections and their order survive; prose is revised as text.

### Three controls, each from something that actually happened

1. **The truth gate runs before the person sees it.** Live, asked to "lead with the Linux and
   cloud work", the model reached for "15%" — a figure from an older draft that the record does
   not carry. A rewrite that adds an unsupported figure is refused, with the figure named.
2. **One repair before refusing.** That refusal was for something the owner never asked for, so
   the offending figures are named back to the model and it writes again; only a second failure
   reaches the person.
3. **A rewrite may not delete history.** This is the serious one. Asked to reorder, the model
   returned a résumé **missing an entire employer — the most recent role — silently**, and the
   document saved that way. Prompting cannot control this: an omission produces a perfectly valid
   document. `lib/documents/revision-guard.ts` now compares entries before and after by
   company+title (school+degree, project title), restores anything dropped in its original
   position, and says so: "Fadi kept X — a rewrite doesn't remove anything from your history."
   **[unit]** 5 cases. The owner's résumé was restored from revision history (version 1 → 3).
4. **Figures asked for but not written are named.** Asked to "add that I cut cloud costs by 47%
   and improved uptime to 99.99%", the model correctly refused to invent them — and Fadi reported
   a plain "Rewritten", which implies they went in. It now says: "Fadi did not add 47% or 99.99%
   — your record doesn't show them." **[unit]** 4 cases; verified live.

**[browser]** Instruction → rewrite applied → summary and bullets changed in the live preview →
"Saved" → Undo available.

### Migration 0050 applied

Your `0050_evidence_identity_review` was generated but not applied here, so every corpus read
(`loadCandidateCorpus` → evidence repository) threw and the truth gate, document review and the
rewrite all failed in the owner's dev environment. Verified on a throwaway database first, then
applied. Nothing else touched in your area.

Suite **1,129 passed, 48 skipped**; typecheck and changed-file lint clean. Not re-run live after
the guard landed — the owner's Groq key hit its rate limit; the guard's behaviour is unit-tested
and the wiring typechecks.
