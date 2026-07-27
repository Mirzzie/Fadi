# 0009 — Portfolio hosting: full-fidelity static export + multi-platform targets

- **Status:** **PROPOSED — 2026-07-25.** Written before the big build, per the ADR-0007/0008
  precedent. This is a substantial project; this ADR scopes it honestly so we don't
  half-build it.
- **Supersedes in spirit:** the "lite SDK snapshot" deploy from ADR 0008, which turned out
  to be a stripped-down approximation — no hero, no framer-motion animations, no
  case-study pages, no nav. Users noticed immediately that GitHub Pages ≠ localhost.

## The problem, stated precisely

The REAL portfolio (`app/p/[handle]/page.tsx`) is a **force-dynamic Next.js app**:
- Server component that reads the DB, with `export const dynamic = "force-dynamic"`.
- Client components with **framer-motion** animations (`Reveal`), an animated background,
  cursor, marquee, a gallery **lightbox**, a **welcome gate**, "tune the story".
- Separate **case-study routes** at `app/p/[handle]/[id]/page.tsx`.
- Styled with Tailwind (`globals.css`) + CSS variables.

The ADR-0008 deploy pushed only `portfolio.js` — a tiny standalone renderer that
reproduces basic cards and nothing else. That is why the GitHub site is a plain,
animation-less, single-page version and case-study links 404.

**GitHub Pages serves static files only; it cannot run this Next.js app.** So there are
exactly two honest ways to get full fidelity:

1. **Statically export** the portfolio (HTML + the `_next` JS/CSS bundles + case-study
   pages + images) and host the `out/` folder. Works on ANY static host — GitHub Pages,
   Netlify, S3, Cloudflare Pages.
2. **Run the real app** on a Next.js host (Vercel/Netlify functions). No export needed;
   localhost === live.

## Decision

Build a **portable static export of the portfolio** as the core capability, then expose
**multiple publish targets** on top of it. One artifact, many hosts.

### Core: a dedicated static-export build of the portfolio

The whole app cannot `output: "export"` (auth, server actions, API, dynamic dashboard).
So the portfolio export is a **separate, export-only build** that reuses the existing
portfolio components:

- Its routes: `/[handle]` and `/[handle]/[id]` — the SAME components as `app/p/*`, so the
  template, framer-motion animations and case studies are byte-for-byte the real ones.
- `output: "export"` + `generateStaticParams()` fed the user's handle + item ids.
- Data baked at build time from a JSON the publisher provides (the Content-API shape),
  NOT a live DB call — so the build is hermetic and hostable anywhere.
- `basePath`/`assetPrefix` set per target (GitHub project sites need `/<repo>`; Vercel/
  Netlify/apex domains need none).
- Output: a real `out/` directory (dozens of files) that hydrates and animates exactly
  like localhost.

### On top: publish targets (the multi-platform vision)

A `PublishTarget` abstraction so an IT-savvy user picks their host:

| target | how | fidelity |
|---|---|---|
| **GitHub Pages** | push the whole `out/` tree (not one file) via the git-data API | full |
| **Netlify / Cloudflare Pages** | same `out/`, their deploy API or a drag-drop ZIP | full |
| **Vercel** | deploy the real dynamic app (or the `out/`) | full |
| **Generic / any host** | **download the `out/` as a ZIP** — drop on any static host | full |

The generic ZIP export is the escape hatch the user asked for: "if they use something
else, let them export a compatible bundle." The static `out/` is that universal artifact.

## Phased plan (so it's buildable, not a big-bang)

1. **Spike (de-risk first):** prove a Next.js static export of ONE portfolio page keeps the
   framer-motion animations + Tailwind + lightbox after hydration. If this fails, the whole
   approach changes — so it goes first. *(No user-facing change.)*
2. **Static-export build:** the export-only portfolio app; `out/` generated from a data
   JSON, base-path aware. Verified to render === localhost via a headless browser.
3. **GitHub Pages target:** push the whole `out/` tree (git-data API, one commit), replacing
   the lite single-file push. The existing deploy.yml still deploys it.
4. **ZIP export target:** "Download my site" → the `out/` as a ZIP. Instant multi-platform.
5. **Vercel / Netlify targets:** guided deploy (their APIs or one-click), for full-app hosting.

## Implementation status (2026-07-25)

Phases 1–3 shipped and verified live:

- **Shared templates** (`components/portfolio/portfolio-template.tsx`, `case-study-template.tsx`)
  — extracted from the live routes with an `itemHref`/`backHref` seam; the live `/p/[handle]`
  pages were verified byte-identical after the refactor.
- **`apps/portfolio-export`** — a real Next.js `output: "export"` build. Home + one static page
  per item (`generateStaticParams`), data baked from a JSON, base-path aware. Verified to render
  IDENTICAL to localhost offline (welcome-gate, marquee, framer-motion reveals hydrate; case
  studies navigate). Two fidelity fixes found by rendering, not by reading: (1) `next/font` had to
  be loaded (else serif fallback); (2) the backdrop must be on `<html>`, not `<body>` — an opaque
  body background paints OVER the `-z-10` blob field and hides the animated orbs.
- **Full-tree push** — `replaceAllFiles` extended to handle BINARY files (self-hosted `.woff2`
  fonts) as base64 blobs; pushing them as utf-8 silently corrupted the fonts. The whole `out/`
  (295–313 files) + `.nojekyll` (required for `_next/`) + the deploy workflow go up in one commit.
- **Wired into Publish** — `publishToGithub` now calls `buildPortfolioSite` (runs the static
  export as a child process with the user's data + repo base path) and pushes the full tree.
  Prefers the Actions deploy workflow; falls back to branch-serving when the token lacks the
  "Workflows" permission. The old single-file snapshot path is retired.

Live and verified: **https://mirzzie.github.io/Mirzzie/** renders the real template — hero,
animated orbs, correct fonts, and working case-study pages.

Remaining: the ZIP "download my site" export and the Vercel/Netlify targets.

## Alternatives considered

- **Enrich the lite SDK** to fake the hero/animations in one file. Rejected as the primary
  path — it can never be identical (no real case-study routes, re-implemented animations),
  and we'd be maintaining a second renderer that drifts from the real template. May still
  ship as a "no-build, single-file" fallback for non-technical users.
- **Headless-browser DOM snapshot** of the live page. Rejected — freezes framer-motion (a
  static DOM has no running animation) and breaks interactivity (lightbox, nav).
- **`output: export` on the whole app.** Impossible — auth/API/server-actions/dynamic
  dashboard are not static-exportable.

## Consequences

**Positive**
- GitHub Pages (and any static host) gets the REAL template — animations, case studies,
  theme — because it exports the actual components, not a reimplementation.
- One portable `out/` artifact powers every target, including "export a ZIP for any host."
- No second renderer to maintain long-term (the lite SDK can be retired or demoted).

**Negative / accepted trade-offs**
- Real effort: a separate build, base-path handling, a data-injection path, and a
  multi-file push (the git-data tree API, which we already have from Replace mode).
- The GitHub push goes from 1 file to a whole tree — bigger commits, but the same atomic
  tree mechanism `replaceAllFiles` already uses.
- Build time per publish (a Next.js export runs), vs. the instant single-file snapshot.

## Honest recommendation captured for the reader

For a user who just wants their real portfolio live *today*, **Vercel/Netlify (run the app)
is lower-effort and identical.** This ADR builds the static-export path because the user
explicitly wants GitHub Pages fidelity AND a host-anywhere export — and the static `out/`
is the artifact that makes "any platform" real. Both coexist as publish targets.
