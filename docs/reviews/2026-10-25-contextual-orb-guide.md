# Contextual orb guide and composition handoff — 25 October 2026

Branch: codex/facelift-conversion, isolated from the existing app/Claude checkout.

## Running app

Actual Next development server: `http://localhost:3010`.
Interactive guide: `http://localhost:3010/design/guide`.
This is not the earlier static source-render harness. It deliberately uses an unreachable database
URL and a local development-only auth secret: public pages and the demo work; signed-in account
journeys are not connected. Existing `:3000` remains untouched. No migrations, quota spending or
database writes are part of this slice.

The guide route is development-only and calls `notFound()` outside development. Its sample controls
change local state only. The same FadiOrb is used, with preview mode hiding conversation and making
the orb's button request guidance instead of starting a microphone. No automatic request to an AI
provider is made. The guide is also wired to Today's real next-action link for later integration.

## Surface delta and authority

- Adds Show me beside the existing orb only when targets are registered; this explains an existing
  control rather than introducing a competing task action. Read/Show me are hidden during travel;
  the existing orb and microphone button remain the same instance. Stop is in the adjacent callout.
- FadiPresenceProvider owns ephemeral guide state and app-owned target registrations. Today still
  reads the existing Today projection. No work, approval, completion, polling or evidence authority
  changes. A highlight never invokes an action or marks work complete. No arbitrary selectors or
  guide commands were added to the AI/runtime schema. Cross-route automatic guidance is not built.
- Target registration is constrained by the GuideTargetId union, element reference and current
  pathname. Unregistered, disconnected, hidden, disabled and off-screen targets fail closed. The
  demo's guide controls stay disabled until registration to avoid an observed hydration race.
- Scroll/resize, target mutations and unmounts update/cancel guidance; observers/listeners clean up.
  Placement prefers beside/above/below without covering the target. If no safe callout fits, stop.
  Escape/Stop return keyboard focus to the requesting control when it still exists. Reduced motion
  makes positioning immediate and retains the native cursor. No new package was installed.

Composition work resumed from the interrupted earlier turn:

- Shared heading/body: Mona Sans, with Instrument Serif editorial accents. Export uses the same
  faces. Existing CSS variable names are compatibility aliases, not claims that Mona Sans is Inter.
- Landing: original career-path card/line illustration, finite entrance transitions, warmer horizon,
  split-arrow CTA, three illustrated chapters and balanced split FAQ. No borrowed photos/testimonials.
- Today: bounded goal/current-work split, compact focus control, readable receipt timestamps and
  smaller section labels; existing decision links and actions retained.
- Practice: dominant Continue region and quieter simulation discovery, compact direction context,
  preserved flagship and optional detail flows. No learning/marking logic changes.
- SVG sizing is scoped to control icons so it cannot shrink the decorative path graphic/logo.

Reference evidence and open-source comparison remain in the local report
`/home/mirzzie/Projects/FADI-OCT/2026-10-25-video-pointer-and-guidance-review.md`.
This implementation reuses the installed framer-motion core. It does not use paid Motion+ Cursor,
install GSAP or add a third-party tour's completion state.

## Verification and limits

- Guide geometry/runtime tests: 22 passed (12 new placement/viewport tests plus runtime contract).
- Guide browser checks passed repeatedly at 390 and 1440px; three tests repeated three times = 9
  passes. They cover one orb, no automatic control activation/network mutation, keyboard focus,
  Escape/Stop, disabled and subsequently hidden targets, reduced motion and horizontal overflow.
- Combined real-Next browser run: all 22 landing, appearance and guide tests passed. The public
  production landing returned 200 and development-only guide returned 404 on an ephemeral production
  server, which was then stopped; development server remains running on 3010.
- Web production webpack build and TypeScript passed with an unreachable database URL.
- Changed web source ESLint: no errors.
- Full web suite: 1,857 passed, 203 skipped, 3 failures in unchanged vmware-move.test.ts. The observed
  error is "needs 11 GB free"; `/home` has about 6.1 GB available. vmware.ts and the test are unchanged
  against HEAD. Do not report the full suite as green or delete user files to make it pass.

Signed-in Today/Practice flow checks remain pending integration: this server does not share the
working database. Real mobile keyboard/zoom, nested scroll containers, voice-on coexistence and
broader target coverage need further acceptance. The pilot does not narrate automatically or advance
through a whole journey; it points only after a person asks. Keep the existing approvals and actual
domain completion signals authoritative when extending it. Nothing is pushed/promoted to main.
