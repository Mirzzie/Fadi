# REA-backed reference design system — 19 October 2026

## Evidence boundary

REA passively inspected the live rendered pages; it did not click, navigate, evaluate page code, or
capture activity before attachment.

- Pipecat target discovery: `ev_9f0209355d84d14a603aee09d0fae64f700e9ed36f406b5b93969500751e0d9c`
- Pipecat rendered-page observation: `ev_66687714758c19f7ecc2215ba7b5f66220818bebc5edf9f613ff259c66b7b4c3`
- Paperclip target discovery: `ev_dee4326996582517fdffb213423a907a8c16b43b32f090a65cc1fd50f858bf0d`
- Paperclip rendered-page observation: `ev_26ad3b66dfc011bdbba8a71bad9d302da51e45283409dc258d3aa43232b42ef4`
- Fadi local target discovery after implementation: `ev_c161bf06c092bd8d696cdc84e53b1369d31b360923e049cea4db43c229472620`
- Fadi local rendered-page observation after implementation: `ev_f99d4db90e8d25cb9458734861467a867ee16fdd5afd6c9170ec4021c491c353`

The captures establish rendered DOM scale, landmarks, accessibility structure, and current origin.
They are attach-window and origin-policy limited; they do not by themselves establish computed CSS
values. Exact public CSS variables and font declarations were therefore corroborated from each
site's current first-party stylesheets.

## Observed reference tokens

Paperclip:

- Dark canvas `#0a0a0a`, dark raised surface `#171717`, foreground `#fafafa`, muted text `#a1a1a1`.
- Light canvas/surface `#ffffff`, foreground `#0a0a0a`, muted surface `#f5f5f5`, rule `#e5e5e5`.
- Inter for body text, Inter Tight for display text, JetBrains Mono for technical labels.
- 8px base radius, 1px rules, restrained transitions, dense operational hierarchy.

Pipecat:

- Zinc-950/zinc-50 paired canvases, Geist/Geist Mono, indigo signal range, yellow announcement.
- Strong grid composition, one-pixel rules, square working panels, dithered visual fields.

## Fadi design decisions

- Use Paperclip's exact neutral palette and font roles as the platform foundation.
- Use Pipecat's grid rhythm and restrained dither/noise idea, not its logo or proprietary artwork.
- Preserve semantic green, amber, and red for states; neutral primary actions prevent every screen
  from reading as a promotional SaaS surface.
- Remove ambient aurora gradients, colored card glows, rounded-card walls, and gradient headings.
- Respect an explicit stored theme. When none exists, follow the operating-system preference before
  first paint and declare `color-scheme: light dark` for native controls.
- Keep normal text contrast at or above WCAG AA; muted tokens are supporting text, never the sole
  carrier of status or required instructions.

## Professional review criteria for subsequent pages

1. Start with the user's task and authoritative state, not a decorative component type.
2. Establish hierarchy using type, spacing, and rules before color or elevation.
3. Use one page-level primary action; subordinate controls should not compete with it.
4. Keep density appropriate to the job: editorial rhythm for explanation, compact rows for work.
5. Test light, dark, narrow, wide, keyboard focus, empty, loading, error, and long-content states.
6. Prefer shared tokens and primitives; page-specific exceptions must have a functional reason.
