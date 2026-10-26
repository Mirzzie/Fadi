# Reference motion and deeper UI surfaces — 26 October 2026

Branch: `codex/facelift-conversion`, on `548649f`. Isolated preview remains on `:3010`, using
the synthetic PostgreSQL cluster documented in the preceding rollout. Owner/Claude checkout,
`:3000`, research-source files and working databases are untouched. No migration or new dependency.

## Reference evidence and design decisions

Used the **reverse-engineer-anything** skill for the owner's explicit request. Live REA observation
of Conversion and Mara Voss, plus local temporal frames from both supplied videos, informs this
implementation. No private recording was uploaded. No template photos, testimonials or client
metrics were copied.

REA evidence:

- target discovery: `ev_cec5816a3c09dec3b74a0d28b6e8c0d934b9290cccdf9452cb5bb28c1c11095e`
- Conversion page: `ev_18e9b5bee2618562bc82fe4506c5e0d842ecbef2fdf0cf93e825c87ea44b869f`
- Mara Voss page: `ev_a9fa84d39761cd06da78a113a0b9368c54a0151b977cf3434f19e40b0c83f5a0`
- Conversion viewport: `ev_711a7a9f6ae4bd1eef2e5e541ae105ff14e9c6bdabb981a5193616c92da0799e`
- Mara Voss viewport: `ev_d5222e0056fcc9ccc00d49401addfd17cf169e02dedb212d41a8a2800dec7b79`

REA is passive here. It captured the public DOM/accessibility and visible viewport; attach-window
and origin filtering limit coverage. It did not establish every historical animation or exact
spring constants. A separate controlled Playwright computed-style probe observed:

- Conversion: Satoshi, blur around 5–10px, rounded 10–12px treatments, a 300ms colour transition
  with `cubic-bezier(0.44,0,0.56,1)` on sampled links.
- Mara Voss: Mona Sans and Chivo Mono, 10–14px blur (some with saturation), sampled 150–600ms
  transitions and `cubic-bezier(0.2,0.8,0.2,1)` / `cubic-bezier(0.7,0,0.2,1)` easings.
- Video observations: warm horizon lighting, a coral trailing dot that retains the native pointer,
  local light response, glass navigation, surface entrances, fine rules and arrow treatments.
  The orange text highlight in the contact recording may be ordinary selection; it is not claimed
  as a proven scripted hover animation.

Fadi uses **adapted** 180ms controls, 350ms panels and 550ms entrances, with its existing
Mona Sans/Instrument Serif/JetBrains Mono typography and six palette/mode combinations. This is
matching the reference's interaction/material grammar, not claiming byte-identical Framer code.

## Implemented across the shared system

- `motion.css` is the shared motion grammar. Buttons, card borders/shadows, contextual menus,
  dialogs, disclosures and sheets now use coordinated motion. Removes the competing whole-route
  translate/fade wrapper, so content is not animated twice.
- `SurfaceEffects` supplies one decorative 16px palette-aware trailing dot and pointer-local
  lighting on shared cards, intros, glass chrome and marked Today/Practice surfaces. Native pointer
  remains; the dot is aria-hidden, pointer-transparent and distinct from the Fadi orb/Show me guide.
- Viewport entrances are finite and preserve content when scripts are unavailable. Native animation
  effects and a private CSS rule avoid modifying streamed React node attributes before hydration.
  No per-pointer React renders, external library or persistent state. Frame work stops when caught
  up; listeners, observers, private styles and animations clean up on navigation/unmount.
- Pointer decoration stops over text fields, contenteditable regions, canvases, iframes and code;
  scrolling/keyboard/window blur clears it. Focused simulation/lab routes and print do not start
  the effects runtime. Reduced motion cancels decorative movement. Touch, high contrast and forced
  colours omit the trail; the layout and actual controls stay the same.
- Shared page intros get a soft palette-aware horizon, preserving opaque readable work content.

## Deeper workflow fixes / surface delta

| Surface               | Before → after                                                                                                                                                         | Authority and primary action                                                              |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Portfolio dialogs     | Separate overlay, unnamed close, no common focus handling → shared named dialog, Escape/focus containment/return, bounded scroll body, visible header/action footer    | Existing modal state and portfolio server actions; Save/Create unchanged                  |
| Portfolio forms       | Unbound labels, tiny selects, cramped CV-link rows → explicit field IDs, 40px selects, responsive rows, named remove/preview controls, keyboard-accessible file inputs | Existing form state and upload handlers                                                   |
| Portfolio empty state | Three equal setup tiles with obsolete template promises and duplicate Publish → one record-import action plus existing Add item, Preview/Publish and disclosed tools   | Existing record seeding/publication actions; no new publishing path                       |
| Application dialogs   | Custom overlay, duplicate close, placeholder-only fields → shared dialog, visible labels, named description/status, shorter workspace link                             | URL remains view owner; existing application actions unchanged                            |
| Inactive work tabs    | A portal could remain over another mounted tab → dialog open state projects the URL-owned active view while preserving the local unfinished draft                      | One URL state; no new view store                                                          |
| Document history      | Serialized JSON excerpts → readable excerpt plus the existing complete paper preview, with embedded heading levels                                                     | Existing immutable revision snapshots                                                     |
| Restore               | Browser confirm plus transient toast → named scoped dialog, Keep current/Restore as new version, inline error/conflict feedback                                        | Existing restore action and expectedVersion check; a restore still creates a new revision |

The restore confirmation adds no approval store or new completion semantics. It merely replaces
the browser confirmation at the same action boundary. Cancelling does not restore anything.

## Validation and review artefacts

- Full web unit suite: **1,863 passed, 203 skipped, zero failures** in this run. Available disk is
  now roughly 18GB, and the three previously space-blocked VMware move tests pass unchanged.
- Typecheck and changed-source ESLint pass. Production build/browser checks are recorded with
  the final integration verification below.
- Signed-in browser checks use only the synthetic account and existing private test cluster:
  long settings/item dialogs in both modes at 320/390/1440, keyboard focus containment/return,
  Back/Forward draft retention, readable history, cancelling restore and restoring as a new version
  while retaining the later version. No application sent, portfolio published or AI quota spent.
- Motion tests exercise six palette/mode combinations, click-through behaviour, typing suppression,
  native cursor retention, reduced motion and actual touch context. Existing landing, appearance,
  guide and component tests are rerun against the new effects.
- An initial reveal prototype changed DOM attributes before streamed content hydrated. That
  produced a real hydration warning; the final version uses native animation effects instead.
  Do not reintroduce those attribute mutations to suppress an animation timing issue.
- One layout assertion saw 39.99997px for a 40px input during motion. The browser check now permits
  0.01px floating-point error; it does not lower the intended 40px control size.

Synthetic visual artefacts outside Git:

- `/home/mirzzie/Projects/FADI-OCT/fadi-motion-preview-20261026.webm`
- `fadi-motion-landing-dark.png`, `fadi-motion-editor-dark.png`, `fadi-motion-settings-dark.png`
- local video temporal sheets: `/tmp/fadi-mara-motion-top-20261026.png` and
  `/tmp/fadi-mara-motion-contact-20261026.png`

The recording shows real shared UI using a synthetic account. Typed example content was cancelled,
not submitted. It is an acceptance preview, not a claim that a real career task was completed.

## Environment isolation and remaining boundaries

The worktree originally reused a root node_modules symlink that also resolved `@careeros/*` into
Claude's checkout. A branch switch there exposed unrelated package exports and invalidated this
preview's module cache. Local workspace package links now resolve to this worktree, while installed
third-party dependencies remain reused. Only this worktree's generated caches were retained under
`*-before-local-packages-20261026` names and rebuilt; no shared dependencies or source files changed.

This is the shared web-app motion rollout and a deeper modal/history acceptance slice. Live VM
framebuffers, voice-on interaction, actual mobile hardware, public portfolio export packaging and
all populated/failure states still need their own integration acceptance. Existing public portfolio
components retain their own finite reveal/media behaviour; exported static sites do not acquire
the web app's runtime merely because it was added to RootLayout. Do not describe every satellite
or live integration as fully tested. The research-source review remains a separate task.

## Final production verification

- `next build --webpack`: passed, including TypeScript and route generation.
- Changed-source ESLint: zero errors or warnings in this slice.
- Existing development landing/appearance/guide/component suite: **32/32 passed**.
- New motion checks: **3/3 passed**, including six palette/mode combinations and touch/reduced motion.
- Production signed-in deep surfaces and golden path: **6/6 passed**, including the four new deeper
  workflow tests and the two existing smoke tests. Combined: **41 distinct passing browser tests**.
- Sampled production landing, portfolio, documents, learning, settings and simulation start routes:
  all HTTP 200, one main, no horizontal overflow, no JavaScript errors or hydration warnings.
  The effects runtime was ready on ordinary pages and inactive on the focused simulation route.
- Production `/design/guide` and `/design/system`: both 404.

The temporary production acceptance server on `:3011` was stopped afterward; the isolated
development preview on `:3010` remains the review target. No push or main promotion.
