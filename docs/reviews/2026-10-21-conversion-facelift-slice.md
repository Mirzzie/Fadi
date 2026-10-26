# Conversion reference → Fadi landing slice

Owner request: the platform feels dull; inspect https://conversion.framer.media/?via=hxmzaehsan#faq with REA and adapt its UI/UX.

Isolated branch: `codex/facelift-conversion`, from owner-approved Phase0 `400dbec`. No changes to Claude's running checkout, application server, database, worker, providers or authenticated shell. No main promotion/push.

## Observed reference

- Hero: focused centred composition, coral `#ff4533` CTA, Satoshi500 heading at80px / -3.2px tracking, Instrument Serif italic emphasis.
- Dark canvas stayed black when emulating a light preference; this is not evidence of a complete two-theme reference.
- FAQ: compact rounded disclosure rows with a plus, keeping answers out of the scanning path.
- Hero light treatment is made from blurred/conic colour fields. It is decorative, not a work-status indicator.
- REA also exposed multiple h1s and h6 CTA labels. Copy appearance, not those semantics or template claims.

Evidence:

- Hero screenshot `ev_f7f5017b39f43b844dbcbeba7d0deaf5e0a0a9060bb59c8cfe752e846641d65f`.
- DOM/accessibility `ev_43c0e494f1d053cb571758ad3b3be1cdd7a23177abba16881656d942bb281ca1`.
- FAQ screenshot `ev_0dfa1311607daa8c100f631811b60e4211dad2a8be0b85a373dba688efacc70c`.
- Fadi adaptation dark desktop `ev_4282e496844fe51270b2445379c8b5668dd73404f56296729d602e69f1c91382`.
- Fadi adaptation light mobile `ev_5d65d50e7813c7eda3c3ecf90a189f5c876a57c65cf9dd52e6ea2a5078ced39c`.

REA captures were passive; separate Playwright operations navigated/scrolled and measured computed styles. They did not submit external forms, book calls or play media.

## Implemented scope

Public landing only: `apps/web/src/app/page.tsx` and scoped `home.module.css`.

- Editorial centred hero, restrained coral, static warm horizon, light and dark palettes.
- Existing Inter/Inter Tight plus system-serif emphasis: **not an exact Satoshi/Instrument Serif font clone**. No reference artwork, logos, client counts, testimonials or font files copied.
- One account-creation action and secondary explanation link. No extra registration control in the public nav.
- One bounded workflow illustration, explicitly labelled as example data, rather than invented readiness scores or simulated account state.
- Sequential explanation replaces repeated feature/flow grids. Compact FAQ uses native details/summary, no new state store or client JavaScript requirement.
- One main/h1, skip link, visible keyboard focus and reduced-motion rules.
- No global style/token or dashboard navigation change. The owner-requested bottom dock is preserved; no authenticated top tabs added. The broader consistency audit remains outstanding work, not claimed fixed by this slice.

Authoritative state remains existing auth/onboarding routes; this public page has no account/work/approval state. FAQ state is native local disclosure only. Primary before: registration repeated in nav/hero/end; after: Create your account in hero/end, Sign in in navigation. Removed feature-grid duplication, truth-strip repetition and independently capped/uncapped landing wrappers.

The owner-requested reference exception is recorded in `docs/UI_UX_GUIDELINES.md`; Pipecat/Paperclip remain the working-product references. Brand moments may have warmth; labs/editors must retain space and concentration.

## Validation and preview boundary

Typecheck and changed-page ESLint pass against the locally available dependency installation. Ten browser tests cover320/390/768/1440/1920px × light/dark: no horizontal overflow, one main/h1, explicit example label, account href, skip link and keyboard FAQ open/close. Tested on a static render of the actual page component/CSS, **not a new Next server or signed-in integration**. `e2e/landing.spec.ts` is included for later real-app validation.

Calculated token pairs: dark text on coral5.38:1; light-mode signal5.68:1; light muted body6.01:1; dark muted text on raised surface7.63:1. Actual composed/hover/zoom states still merit wider visual acceptance; these figures are not whole-page WCAG certification.

Local visual-review harness lives outside the repo at `/home/mirzzie/Projects/FADI-OCT/preview-facelift.cjs`, serving `http://localhost:3012`. It imports only the landing component, builds in memory and never boots the application, database or worker. Auth links lead to the unchanged app on3000. It is a static source-render preview, not an integrated deployment. Existing app fonts are reused when available; system-serif emphasis is intentional.

Pending before release: real Next production build/CSS ordering, public auth navigation smoke, signed-in regression checks, owner design approval and integration. Do not infer that3000 or the rest of Fadi has already changed.
