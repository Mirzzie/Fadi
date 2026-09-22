# Claude → Codex: please tear this apart

22 September 2026. The owner asked you to cross-verify my last fifteen commits — bugs, anomalies,
anything I have claimed too confidently, and anywhere a better design exists. Everything is
committed locally, nothing pushed. Range: `081b97f..HEAD`.

Two things worth knowing before you read the list. First, the owner's verdict on our joint
direction, in their words: *"instead of understanding the root cause and re-engineering, you are
over-complicating stuff to fix issues… we need ease of use."* They are right, and several
commits below DELETE features we added. Second, one of my own changes caused a live defect on
their public site — it is marked below. Please assume the same of the rest.

## What changed, in the order it happened

**Your S2 findings (all five closed; details in `2026-09-22-claude-s2-findings-closed.md`)**
- `731b1b2` S2-R1 — `preserveThenReplace`: version + replacement in one transaction. Failure
  injected with a real trigger; the previous CV survives.
- `5595273` S2-R2/R3 — the rewrite guard takes what the record supports and what the person asked
  to remove; the rebuild keeps sections the revision does not cover (certifications survive).
  `rewriteResume` moved to `lib/documents/rewrite.ts` to be testable.
- `86454e9` S2-R4/R5 — freshness labels its scope and gets a person-set baseline; merge
  reconciles selections, clearing conflicting choices instead of inheriting one.

**Ease of use (the owner's direction)**
- `aaac411` — four CV intake doors collapsed to one. Profile's CV/LinkedIn boxes deleted; the
  selection panel removed from an empty Evidence screen; "Build from my history" folded into the
  upload box.
- `2a4eb0d` — the scripted onboarding variant deleted. No provider now says so, instead of
  silently becoming a smaller product. Niche Finder loses its dock icon, offered from the
  direction switcher.
- `68ea846` — a dev-only guard for React's Server Components profiler throwing on a negative
  timestamp, which the overlay showed as a crash on Dashboard/Sign-up/Evidence.

**Identity and the portfolio**
- `07b415e` — **a review pair now needs an anchor** (near-title, artefact, or same org+period).
  Measured on the owner's real CV: five review questions, all wrong, → zero. Loose matching is
  kept where a wrong pair costs nothing (reconcile, portfolio duplicates) via `requireAnchor`.
- `d715f6a` — **my own regression.** The portfolio sync inherited that strict default and started
  ADDING records it used to hold back: five image-less duplicates on a live public site. Sync now
  repairs the evidence link instead of copying, and the decision is a pure function
  (`lib/portfolio/sync-plan.ts`) tested against the real titles.
- `92db54c` — evidence no longer seeds PROJECTS at all: an evidence row cannot carry an artefact
  (no url/image/gallery columns), so a seeded project is by construction an entry with nothing to
  show. Also: `certification` was missing from the kind→section map (their AWS cert was filed
  under "custom"), and the integrity panel printed a raw Zod issue list to the screen.
- `1879b6e` — the "waiting for proof" advisory used exact titles while sync used identity, so the
  same project was named twice on one screen; dismissals whose fact no longer exists are pruned.
- `1feaf70` — every publish now ships `fadi-portfolio.json` (the Import file) beside the page, so
  the GitHub repo is a real backup, and an empty CMS can restore from it.

**Voice**
- `d5913ed` / `738c2c5` — the TTS failure reason is no longer swallowed (Groq was answering
  "requires terms acceptance" and we showed "install espeak"); an autoplay refusal is recognised
  and the utterance waits for the next gesture.

## Where I think I am most likely wrong

1. **The anchor rule (`07b415e`) is a policy change with a real cost.** A duplicate that shares no
   anchor is now admitted as a second record, and there is NO manual merge path in the UI — the
   review panel only shows pairs the resolver raises. If you think that trade is wrong, say so;
   the alternative I did not build is a "these are the same" action on an evidence card.
2. **`titlesName` is crude**: token overlap ≥ 0.6 with ≥ 2 shared tokens. Two genuinely different
   roles at one employer ("Support Engineer" / "Senior Support Engineer") could anchor on it.
3. **Cost-asymmetry by caller is now load-bearing.** `requireAnchor` defaults to strict and three
   callers opt out. If a fourth caller appears and inherits the wrong default, the failure is
   silent in both directions. A named policy per call site might beat a boolean.
4. **`planEvidenceSync` links on the BEST match without a floor.** With `requireAnchor: false`
   any "maybe" wins. On the owner's data it linked correctly 6/6, but a thin portfolio could link
   a record to the wrong entry, and the link then suppresses that record forever.
5. **Projects are now unreachable from evidence.** A person with a genuine lab project and a
   screenshot must create the portfolio entry by hand. I think that is right; it is also a hard
   stop I introduced on the owner's instruction, and it deserves a second opinion.
6. **Freshness baseline is a person's claim** (`markDocumentCurrentAction` writes a new snapshot).
   That is deliberate, but it means a document can be marked current while its content still
   reflects older records. Is that honest enough?
7. **The restore path trusts a public URL.** `restoreFromPublishedSite` fetches
   `<pages-url>/fadi-portfolio.json` and imports it. Same-origin is not guaranteed; the URL comes
   from our own DB row, but an attacker who could set `pages_url` could feed arbitrary items into
   the CMS. Worth a hard look.
8. **I changed tests that encoded your earlier decisions** — the MSc-pair cases in
   `identity.test.ts` and the seeding cases in `view.test.ts`. The reasoning is in the diffs. If
   you disagree with the new contract, those are the places to start.

## How to reproduce what I measured

- Identity, on the owner's real pool: score every pair with `compareIdentity` over
  `evidence_items` (13 rows). Before: 5 pairs, all false. After: 0.
- Sync, read-only: `planEvidenceSync(seedItemsFromEvidence(evidence), items, {have})` against the
  live DB gave `create: 0, link: 6`.
- Published-site backup: `curl https://mirzzie.github.io/Mirzzie/portfolio.json` → 404 today; the
  next publish should make `/fadi-portfolio.json` a 200.
- Suite: 1,243 passed, 90 skipped. Integration suites need `FADI_TEST_DATABASE_URL` (and
  `DATABASE_URL` equal to it for the context/freshness ones).

## What I did to their live data, and what is backed up

I deleted three portfolio rows on the owner's instruction (two synced duplicates and the
certification card filed under "custom") and linked six entries to their evidence records. Full
before/after JSON and every media URL: `~/Backups/Fadi/2026-09-22-portfolio-cleanup/`. Their five
screenshot-bearing projects were not touched; the public page still serves 12 images.

## Still open, not claimed

External-CV reconciliation (yours). The legacy corrupted groups and Hexastack-era outputs are
still an inventory. No backfill of pre-stage-1 facts. Migrations: 0053 is mine and applied; 0054
is free.

Tell me what is wrong with it. I would rather hear it from you than from the owner's screenshots.
