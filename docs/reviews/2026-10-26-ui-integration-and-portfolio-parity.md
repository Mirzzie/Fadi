# UI integration and public/export parity — 26 October 2026

Local candidate: `codex/ui-integration-20261026`. Main baseline `7cd1af1`; includes the
rendering/Reflect review `dd4803a`, and merges the existing five-commit facelift through
`92d2e2c` (merge `75e5acc`). This is a local integration candidate, not a main promotion.
Claude's checkout and the original facelift branch are unchanged.

## What this slice closes

The facelift now sits alongside current main's source registry and accepted ADR 0016. The only
merge conflict was in the guidelines: retain the owner's palette/material/motion/dock choices,
the existing content-accuracy rules, and the new capability-rendering boundaries. No capability
runtime, Reflect storage, worker migration or scheduled source task is implemented here.

| Surface                                       | Before → after                                                                                                                    | Authority / primary action                                                      |
| --------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Public CV link                                | Dark-only text/border → semantic ink/border; solid variant uses primary foreground                                                | Existing résumé URL and visitor lens; Download CV unchanged                     |
| Legacy visitor lens                           | Hard-coded zinc text → shared palette tokens                                                                                      | Existing persona preference; no new state owner                                 |
| Public/live and exported portfolio appearance | No visible preference control → one collapsed, labelled Appearance disclosure below the content, using existing settings controls | Existing browser-local preference runtime; never modifies published career data |
| Exported motion                               | App-only effects → same CSS and effects component in the static host                                                              | Decorative only; no analytics, task or career state                             |
| Portfolio entrances                           | No shared entry marker → finite shared header/featured-work entrances, same renderer in both hosts                                | Existing content; no completion inferred from scrolling                         |
| Auth and onboarding entry                     | SSR controls could accept an early click before handlers were ready → disabled until hydrated/mounted                             | Existing auth/form mode; Create account / Prefer a form unchanged               |

The portfolio appearance disclosure is a distinct visitor accessibility preference, not another
navigation bar or owner-branding editor. Index and case-study gutters follow their content widths.
Editors/assessments/approvals stay opaque. No new assistant, navigation destination, provider,
animation dependency, queue or permission store.

## Evidence and verification

- Combined-main unit run: **1,904 passed, 203 skipped, zero failures**.
- Web/database and static-export typechecks passed. Web production build passes with TypeScript;
  static export build passes at the non-root `/portfolio-preview` base path. The export's existing
  `ignoreBuildErrors` setting is unchanged; its separate typecheck supplies the missing check.
- **21 distinct browser tests passed across production and development checks:** nine appearance,
  four deep-dialog/history, two route/golden-path, two live/static portfolio parity, three development
  motion and one delayed-JavaScript hydration regression. Production correctly skips the three
  development-only motion tests; they pass against the development review surfaces separately.
- Portfolio parity exercises all six palette/mode combinations at 320/390/1440 widths, actual CV
  text contrast, persisted preferences, shared font, one main/h1, pointer transparency, reduced
  motion, case navigation and return under a project-site base path. Appearance contrast checks
  wait for existing colour transitions to settle; they do not claim frame-by-frame transition contrast.
- Cold development initially lost sign-up/form clicks before hydration. A delayed-script regression
  confirms the fix, and the production golden journey is rerun after it. Development compilation
  also makes the full all-route smoke susceptible to its overall time limit; production is the
  journey acceptance target, not a claim that every cold development run passed.
- Changed-source lint: zero errors. Existing warnings remain for the portfolio image, unused import
  and onboarding mount effect; no lint policy was weakened.

Used the reverse-engineer-anything skill for passive runtime corroboration on the **synthetic local
portfolio**, not the owner's browser/profile. Target inventory `ev_b03a306cc1cc92fdb938355ce912e15d7207e874022b0d3cce319f49474982be`;
DOM/accessibility `ev_a1fecd04988b8fcdb30162d76b1b9f052e630b98ad58a711c48b3cbab4b67fc1`;
visible screenshot `ev_1714de18546e652de63484d5c4625dd3b807fe0fbb23db719b7d51d5e7749f09`.
REA observes only its attach window/viewport; Playwright supplies interactions and computed-style
checks. This does not establish every animation on the reference sites or physical-device behaviour.

## Preview and isolation

Production candidate: `http://localhost:3014`. Synthetic public portfolio:
`http://localhost:3014/p/fadi-ui-integration`. Synthetic static export:
`http://localhost:3013/portfolio-preview/`. Screenshots outside Git:
`/home/mirzzie/Projects/FADI-OCT/ui-integration-portfolio-live.png` and
`/home/mirzzie/Projects/FADI-OCT/ui-integration-portfolio-static.png`.

Only the existing private PostgreSQL cluster on loopback `55439` is used. Test publishing exists
only in that isolated local database. No external portfolio publication, message, application,
provider spend, owner database migration or push. The owner's `:3000` and existing `:3010` preview
are untouched. This slice's temporary development server and REA browser are stopped afterward.
Local workspace package links resolve into this candidate, not Claude's checkout. Export fixture
data is synthetic during the build and the tracked input is restored afterward.

## Still pending — not hidden by this integration

1. Reconcile worker 0072/evaluation 0073/pinned-fetch candidates with this main/UI baseline in a
   separately reviewed integration. No shared-database upgrade or worker activation here.
2. Claude acknowledgement of the amended rendering/Reflect contract, then the two-career Practice
   seam proof using shared templates. No per-capability theme, nav, status owner or assistant.
3. Live lab framebuffer/focus-mode acceptance, voice-on use and actual mobile hardware.
4. Wider populated, blocked, empty/error, approval and long-work journeys beyond the exercised
   dialogs/history and golden path; extension and other satellite surfaces remain separate audits.
5. Owner review before any push/promotion. This candidate does not mean the entire platform is
   polished or that proposed continuous career-loop features are already available.
