# Shared platform UI rollout — 25 October 2026

Branch: `codex/facelift-conversion`. Extends `158780e`; no changes to the owner's checkout,
`:3000` server, database, main branch or Claude branches. Nothing pushed or promoted.

## Result and scope

Applies the agreed Conversion/Mara Voss visual language through the existing Fadi surfaces:
Mona Sans, Instrument Serif editorial accents, Ember/Iris/Cobalt palettes, Light/Dark/System,
warm opaque task surfaces and restrained glass navigation. This continues the reference evidence
recorded in the preceding facelift and contextual-orb handoffs; it does not introduce another
design engine, UI store or runtime framework. No new packages or database migrations.

`appearance.css` is now the single application palette authority; obsolete fixed root palettes
were removed from `globals.css`. Success, warning, error, information and charts use semantic
tokens. Exported paper templates and their chosen accent colours remain document content.
The root error fallback deliberately works without application CSS or loaded fonts.

## Surface delta and authoritative owners

| Surface                      | Change / primary action                                                                                                                                          | State authority                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Shared indexes               | One bounded `PageIntro`, consistent title/description/actions, 74rem routine workspace, one shell gutter/main                                                    | Existing page data and shell                                                          |
| Jobs / applications          | Search and existing next-step actions retained; statuses follow theme                                                                                            | Existing jobs/application actions and projections                                     |
| Documents                    | Library alias opens Documents, rather than silently opening Pipeline; URL owns contextual view; Back/Forward works; mounted panels retain unfinished local forms | URL view plus existing server documents; existing autosave/version/conflict authority |
| Document editors             | Toolbar wraps; title labelled; controls stay inside viewport; mobile uses normal page flow; wide preview/form split retained                                     | Existing editor save/export/check handlers unchanged                                  |
| Record / portfolio           | Clear record/portfolio headers; preview/publish remain visible; optional audience/focus/import/export/API/settings controls move under Portfolio tools           | Existing evidence, portfolio and publication actions                                  |
| Learning / Practice          | Shared project/machine/activity headers; removed nested main landmarks; focused lab/simulation working width retained                                            | Existing run/conductor/assessment state                                               |
| Interview / network / niche  | Shared headings, readable statuses, bounded copy, existing start/add/find actions                                                                                | Existing component and server actions                                                 |
| Settings / profile / report  | Shared account headings and semantic feedback; provider choice remains in Settings                                                                               | Existing account/settings/report state                                                |
| Auth / recovery / onboarding | One visible form h1, shared logo/chrome, no redundant signup navigation during onboarding; reduced unsupported claims                                            | Existing auth/onboarding flows                                                        |
| Errors / loading / 404       | Readable recovery controls and landmarks, reduced-motion skeletons; removed unsupported promises that data cannot be lost                                        | Existing error boundaries and router                                                  |
| Orb guide                    | Existing Show me targets now include search, document creation, record addition, portfolio preview and interview start                                           | Ephemeral FadiPresence target registry only                                           |

Standard fields/buttons are 40px, compact buttons 36px, coarse-pointer shared controls at least
44px. Dialogs/sheets stay within the viewport. Guidance excludes mounted hidden tab controls,
cleans up observers and retains disabled-control refusal. It never clicks, submits, grades,
publishes or changes completion. This is explicit local guidance, not an autonomous cross-page tour.

Content now describes current actions rather than asserting guaranteed hiring results, universal
truth detection, fixed model wait times or guaranteed recovery. No career eligibility, immigration,
assessment, worker, application-ranking or approval policy was changed by this presentation slice.

## Acceptance evidence

- Final production webpack build / TypeScript: **passed**, including the document-toolbar fix.
- Real Next development browser suite: **32/32 passed**. Includes landing at 320/390/768/1440/1920,
  all six palette/mode combinations, persistence/system changes/cross-tab sync/blocked storage,
  reduced motion, explicit guidance, shared forms, bounded dialog/sheet keyboard dismissal,
  coarse-pointer targets, auth/recovery/404 structure. The gallery tests validate shared components,
  not every populated business journey.
- Final production signed-in smoke: **2/2 passed**, including expanded editor assertions: real signup,
  deterministic classic onboarding, eleven dashboard destinations, saved application and full
  workspace. Documents alias was checked to select the library. A prior test incorrectly selected
  the first mounted heading even when hidden; it now selects a visible heading.
- Final production signed-in route sweep: **40/40 measurements** across twenty routes, in desktop
  Light and 390px Dark. Covers Today, overview, jobs, applications, documents, evidence/stories,
  portfolio, interview, network, niche, profile, settings, report, learning/projects/machines/activity
  and both simulation start pages. All returned 200 with one main, one visible h1 and no body
  overflow. No JavaScript errors or hydration warnings were observed. The earlier interrupted
  Niche Light check was rerun successfully here.
- A real synthetic CV exposed toolbar overflow out to 1285px on a 390px screen. After correction,
  body scroll width is 390px and Save remains visible. The passing regression covers all three
  editor implementations at 320/390/1440 in both modes, plus library intent, reload and Back/Forward
  restoration of an unsubmitted application form.
- Focused appearance/guide source tests: **32 passed**. Source contracts are explicitly labelled
  as source checks, not visual acceptance.
- Full web unit suite: **1,860 passed, 203 skipped, 3 failed**. Failures are unchanged
  `vmware-move.test.ts` cases: destination needs 11GB free, while `/home` has roughly 5–6GB.
  No disk bypass, VM code change or user-file cleanup was made to conceal them.
- Changed-source ESLint: **0 errors, 6 warnings** in existing Fadi chat, onboarding mounting and
  track-switcher hooks. No new warning introduced by the presentation changes.
- Default Turbopack build cannot traverse this worktree's external dependency symlinks;
  production validation uses `next build --webpack`, as does the isolated development server.
- Both `/design/guide` and `/design/system` returned **404** on the final production build.

## Isolated preview and data

The preview uses a private temporary PostgreSQL cluster, not the working Docker database:
loopback port **55439**, database/user `fadi_ui_test`, data at
`/tmp/fadi-ui-pg-uzXLbl/data`. All 72 existing migrations were applied to this empty cluster.
This does not reserve migration numbers or apply schema changes to the owner's database.

Synthetic account: `fadi-ui-review@example.test`, password `Local-UI-Review-2026!`.
Its onboarding history and documents are test fixtures, not the owner's career records.
Additional smoke accounts are synthetic. AI provider keys are blank, so no paid grading/drafting
or worker execution is part of acceptance. Existing keyless job feeds may populate this test DB.
Auth storage artifacts stay outside Git and are not included with this commit.

The dev preview is `http://localhost:3010`; `/design/system` and `/design/guide` are local review
surfaces only and must return 404 in production. The fast production acceptance server uses
`:3011` temporarily. Stop only these task-owned servers if reclaiming resources; leave `:3000`.
To retire the private database after stopping the preview, use
`pg_ctl -D /tmp/fadi-ui-pg-uzXLbl/data stop`. Do not remove or stop the working database.

## Remaining acceptance boundaries

Shared styling is propagated platform-wide, but this is not a claim that every possible state
has been exercised. Live VMs/remote desktops, paid model grading, voice-on coexistence, real
mobile keyboards/zoom, rich populated career histories, public publication/export fidelity and
long-running approval/recovery states still need journey acceptance during integration. No VM
was created/reset, no application sent and no portfolio published for this UI review.

An intermittent concurrent first-session identity-resolution message appeared during initial
signup, then recovered. The production golden path passed; no database/auth redesign was folded
into the facelift. Reproduce independently if it recurs. A development-only hydration attribute
warning was also observed once; it did not reproduce in the final forty-route production sweep.
This is not a claim to have diagnosed every development/HMR warning.
