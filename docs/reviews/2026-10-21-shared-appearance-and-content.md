# Shared appearance and content slice — 21 October 2026

Branch: `codex/facelift-conversion`, based on owner-approved Phase 0 `400dbec`.
Implementation is isolated from Claude's running checkout. No migrations, provider calls,
worker cutover, publishing or promotion to main are included.

## Surface delta and authority

- One `appearance.css` token source supplies Ember, Iris and Cobalt, each with Light/Dark/System.
  Settings and the public appearance disclosure use the same browser-local preference. Existing
  explicit `theme` choices survive. System follows OS changes live; storage denial leaves a usable
  session and says it is not saved. These are not account or portfolio-owner publishing settings.
- Shared shell, forms, status colours, logo/presence, menus and public portfolio/export aliases
  consume semantic tokens. Glass is limited to chrome; work surfaces stay opaque. Reduced motion,
  reduced transparency, higher contrast and forced-colour fallbacks are provided.
- The four-destination dock stays hideable, restores keyboard focus when toggled, and reserves
  bottom space. Top header remains utilities only; direction text is constrained on narrow screens.
- A missing `max-w-shell` token is supplied; routine background grid is removed. These improve
  bounds and density, but are not a claim that every route's content layout has been redesigned.
- Documents, learning and interview status treatments replace fixed palette colours. Résumé print
  template styling remains intentional. No grading, completion, approval or evidence state changes.
- Landing FAQ distinguishes present workspace capabilities from the developing Adaptive Career
  Loop. Authentication, onboarding, Today, Practice and networking copy lose unsupported automation,
  guarantee and AI-key-only claims. Completion prompts become domain-neutral. Extension pairing
  says connection code, not one-time code: its existing 90-day token behaviour is unchanged.
- Existing execution, career record, approvals and published data remain their respective owners.
  The theme is not a new workflow or a second data store.

## Reference findings — REA runtime evidence

The Conversion slice and its earlier evidence remain recorded in
`2026-10-21-conversion-facelift-slice.md`. Additional owner-selected reference:
<https://diligent-tetragon-837366.framer.app/> (Mara Voss portfolio).

Observed reference evidence:

- Target discovery: `ev_84ee36c584c759ef1ac4918f320271151fe4dceec0c69101eb5c5fff1cb7f2c2`.
- Desktop screenshot: `ev_f5ad39dfcbf8e62e7bf6af6e8d872a531d4a617dd2cd93ae513873599316412b`.
- DOM/accessibility: `ev_13205341d2accd657f548d99ac783532c13a5dc32435c58f3e0d23b321248978`.
- Ink mobile viewport: `ev_f514feeab2953b42ddc9c278f147b005277edff5c835a3d58718847c2c55de56`.

Observed: warm Bone, Tangerine and Ink backdrops, compact floating navigation with 14px blur,
short ~150ms transitions, Mona Sans, large portrait/editorial type and continuous decorative motion.
Design decision: adapt warmth, restrained surface depth and brief transitions; retain Fadi's
Inter/Inter Tight/JetBrains Mono rather than claim exact typography. Do not copy portrait assets,
testimonials, giant portfolio headings, cursor effects or infinite motion into task screens.
Reference backdrop switching is not evidence of OS-adaptive themes. Fadi's System behaviour is
implemented and tested separately. Browser inspection was passive except visual backdrop selection;
no bookings, forms or account operations were submitted.

## Validation

- Web unit suite: **1,848 passed, 203 skipped** (197 passing files, 39 skipped), two workers.
- Hydrated source-preview browser tests: **19 passed**, including all six palette/mode pairs,
  320/390/1440/1920 widths, text and input contrast, persistence, cross-tab changes, live System,
  blocked storage, keyboard FAQ and reduced motion. Existing landing tests also cover 768px.
- Web production webpack build and TypeScript: passed with validation-only auth secret and an
  unreachable database URL; no application database used.
- Export production webpack build: passed, 33 static pages; export TypeScript passed.
- Changed web source lint: zero errors; three existing setState-in-effect warnings. E2E files are
  outside the web ESLint configuration. Portfolio lint has one existing unused-template warning.
- Portfolio package standalone TypeScript still has baseline test-import/global errors in unchanged
  `identity.test.ts`; do not describe that package-level command as clean.
- `git diff --check`: clean.

## Preview and remaining acceptance

`http://localhost:3012/` is an isolated, hydrated rendering of the landing source.
`http://localhost:3012/theme-review` is a labelled illustrative fixture using actual appearance
controls, shared buttons/inputs and dock, not a signed-in dashboard. Harness query parameters
`?theme=dark&palette=ember` select previews only; they are not application API.

The owner's `:3000` app is unchanged. Full signed-in route coverage, long content, real lab/course
working density, contextual overlays and portfolio focus behaviour still need integration acceptance.
The custom portfolio welcome modal has not received a full accessibility rewrite. Other legacy
component-specific colours may remain outside this bounded cleanup. Research/strategy/thin-loop
functionality is not implemented by this appearance slice. Integrate through owner-approved release
workflow; do not advertise these previews as a production cutover.
