# 0008 — Publish a portfolio to GitHub Pages

- **Status:** **PROPOSED — not decided. Written before code, per the ADR-0007 precedent.**
- **Date:** 2026-07-23
- **Decides:** how the portfolio section pushes a site to a user's GitHub repo and hosts
  it on GitHub Pages, and whether a GitHub Actions pipeline is part of that.

> This can be rejected. If you disagree with the auth model or the "no Actions in
> Phase 1" call, the outcome is that this file changes, not that the code quietly
> diverges from it.

## Context

Today the portfolio is a headless content source with two export paths (verified
present, `components/portfolio/portfolio-manager.tsx`):

- **Content API** — `/api/portfolio/[handle]` serves the published site as public,
  CORS-open JSON.
- **Static snapshot** — a downloadable, self-contained `index.html` (the `portfolio.js`
  SDK + the JSON data baked in). Works on any static host, offline, no server.

Everything after the download is **manual**: the user creates a repo, uploads the file,
enables Pages. There is no GitHub integration of any kind — no OAuth, no API push, no
Actions, no auto-hosting. The urgent need is to close that gap: edit in Fadi → live on
GitHub Pages, without leaving the app.

## The build-step insight (why Actions is not automatically the answer)

A GitHub Actions pipeline earns its place when a repo holds *source* that must be *built*
into a site. **Fadi already does the build** — the static snapshot IS the finished site.
So pushing it needs no CI: GitHub Pages serves static files natively. An Actions workflow
that merely copies one HTML file is ceremony, not value.

Actions becomes genuinely useful only for one thing here: **keeping the GitHub-hosted
copy in sync with later edits in Fadi without a manual re-publish.** That is a real
feature, but a separable one.

## Decision

Two phases, shipped in order.

### Phase A — Direct push (no Actions). The urgent need.

- **Auth: a user-supplied fine-grained GitHub Personal Access Token**, encrypted at rest
  with the existing `lib/security/crypto.ts` (AES-256-GCM), exactly as BYOK AI keys are
  stored. Rationale:
  - Mirrors the project's established BYO-key pattern (`user_ai_settings`).
  - No GitHub App/OAuth registration, no callback infrastructure, no third-party consent
    screen — appropriate for an experimental, self-hosted, single-operator project.
  - Sidesteps the OAuth-app "getting flagged" concern raised earlier in the project.
  - The token is the user's, scoped by them (`contents: write`, `pages: write`,
    `administration: write` on the target repo), revocable by them.
- **Flow:** user pastes a PAT + picks a repo name → "Publish to GitHub" →
  1. create the repo if it doesn't exist,
  2. commit `index.html` (the server-rendered snapshot) + `.nojekyll` (so Pages doesn't
     run Jekyll over it),
  3. enable Pages on the default branch,
  4. return the live `https://<user>.github.io/<repo>/` URL.
- **The snapshot is generated server-side** in the publish action, reusing the same
  Content-API view (`toPortfolioView`) the client snapshot already uses. One renderer,
  not two.
- **The GitHub client is plain `fetch`**, not Octokit — keeps the dependency surface
  flat and the request-building unit-testable without a network.

### Phase B — Actions refresh pipeline. The auto-sync the user asked for.

- On first publish, also commit `.github/workflows/refresh.yml`.
- The workflow re-fetches the Content API and rewrites `index.html`, triggered by:
  - `schedule:` (a daily cron — a cheap safety net), and
  - `repository_dispatch:` — **Fadi fires this on every portfolio edit** (via the same
    PAT), so an edit in the app propagates to the hosted site within one workflow run,
    with no manual re-publish.
- This is where Actions earns its place: the repo stays a live mirror of the Fadi
  portfolio, not a one-time snapshot.

## Alternatives considered

- **GitHub OAuth App / GitHub App.** Best UX at scale (no token handling by the user),
  but requires app registration, a stored client secret, an OAuth callback, and consent
  screens. That is hosted-product infrastructure; rejected for the current stage. The PAT
  path can be swapped for it later without changing the publish logic — only the
  token-acquisition step differs.
- **Actions-only (push data + build in CI, no direct push).** Rejected as the *first*
  cut: it makes the simplest case (get my site live now) depend on CI succeeding, and CI
  here has nothing to build. It returns in Phase B as the *refresh* mechanism, which is
  its real justification.
- **Octokit dependency.** Rejected — the four REST calls we need (get/create repo, put
  file, enable Pages, dispatch) are a thin, testable `fetch` wrapper; Octokit is weight
  we don't need.

## Consequences

**Positive**
- Edit → live-on-Pages, entirely inside Fadi. Closes the manual gap.
- Reuses crypto, the Content-API view, and the BYO-key mental model — little new surface.
- Phase B gives true auto-sync without the user re-exporting.

**Negative / accepted trade-offs**
- The user must create and paste a PAT (a real, if one-time, friction). Acceptable for a
  technical/self-host audience; revisit with a GitHub App if the audience broadens.
- Fadi stores a token that can write to the user's repos. Encrypted at rest, scoped by
  the user, deleted on account closure via the existing `users` cascade — but it is a
  higher-value secret than an AI key and must be treated as such (never logged, hint-only
  display).
- End-to-end publish cannot be verified without a real PAT + repo, which are the user's.
  The pure pieces (snapshot HTML, request construction, encryption round-trip) will be
  unit-tested; the live push is verified by the user on first use.

## Security notes (non-negotiable)

- Token: `apiKeyCiphertext`-style storage, `apiKeyHint` (last 4) for display only.
- Never log the token, the request headers, or the response bodies that echo it.
- Scope guidance shown in the UI: fine-grained PAT, only the target repo, minimal scopes.
- On account closure the connection row cascades from `users` (same as every other table).

## Publishing into a NON-EMPTY repo (decided 2026-07-24)

Real question from first use: what happens if the target repo already has a website?

**Behaviour: merge-overwrite, never delete.** Publish overwrites exactly the files Fadi
manages — `index.html`, `.nojekyll`, and (Phase B) the workflow — and touches nothing
else. Any pre-existing files (old `styles.css`, `about.html`, assets) stay in the repo
and stay served by Pages. Fadi does not delete a user's files.

- **Chosen because** the alternative — wiping the repo tree to force a clean replace — is
  destructive, and pointing Fadi at a repo with other content would then delete it. That
  is the exact data-loss shape already fixed once in the portfolio *import* (ADR-adjacent,
  `replaceItems`). Silent deletion is not an acceptable default.
- **Consequence, surfaced not hidden:** stale files from an old site remain live. So the
  panel now **preflights the repo** (`inspectGithubRepo` → `listRootFiles`) and warns,
  before publish, that it already has content, listing the foreign files that will stay
  live, and recommends a dedicated/empty repo for a clean result.
- **Recommended path:** publish into a dedicated repo. There, merge-overwrite *is* a clean
  replace with zero risk.

**A true "Replace" mode is now BUILT (2026-07-24) as an explicit, warned opt-in.**
- `replaceAllFiles` uses the Git Data API: GET ref → POST tree (NO base_tree, so the tree
  is the whole content) → POST commit (parent = HEAD, history preserved) → PATCH ref. The
  ref move is the LAST call, so a mid-flight failure leaves the old site exactly as it was
  — all-or-nothing, verified by a test that fails the tree step and asserts no PATCH ran.
- Gated in the UI: the destructive checkbox only appears when the repo already has content,
  is unchecked by default, resets on any repo change (never carries a destructive intent
  across repos), and flips the button to a red "Replace & Publish".
- The merge default is unchanged and remains the recommended path via a dedicated repo.

## Pages deployment mechanism (decided 2026-07-25)

Surfaced by real use: a user replaced an existing Jekyll site whose Pages **source was
"GitHub Actions"** (deployed by a `jekyll-gh-pages.yml` workflow). Replace deleted that
workflow, so the push landed but **never deployed** — "pushed but not deployed."

**Decision: a Fadi portfolio deploys via "Deploy from a branch", never a workflow.** The
snapshot is a self-contained `index.html` with no build step, so branch-serving is the
correct mechanism — GitHub serves the file directly, no CI to run or maintain.

- `ensureBranchPages` now reads the current Pages config (`getPagesConfig`) and, if Pages
  is off, on the Actions source, or pointed at a different branch/path, **reconfigures it
  to legacy branch-serving from the default branch root**. The old `enablePages`
  swallowed the "already enabled" 409 and never noticed a wrong source — that was the bug.
- When it switches a repo off an Actions build, the publish result says so, so the user
  understands their old workflow is now redundant (and that Replace deleting it was fine).
- **Not** auto-generating a deploy workflow: for a static site that is strictly worse —
  more moving parts, another file to keep, and a build that does nothing. Branch-serving
  is simpler and more robust. (An Actions deploy workflow would only be needed if an org
  *enforces* Actions-based Pages; deferred as a follow-up for that case.)

## The "Workflows" permission wall + graceful fallback (2026-07-25)

Committing a deploy workflow surfaced a real permission cliff: writing ANY file under
`.github/workflows/` needs the fine-grained token's separate **"Workflows"** permission —
Contents write is not enough (GitHub guards that path so a token can't inject CI). A user
who had granted Contents + Pages + Administration still got a 403 on the workflow write.

**Decision: prefer the Actions workflow, fall back to branch-serving.** Publish writes the
core files (`index.html`, `.nojekyll` — Contents only) first, then TRIES to commit the
deploy workflow. If that 403s (missing Workflows permission), it does not fail — it calls
`ensureBranchPages` and deploys the static site straight from the branch, which needs no
workflow file. Either way the site goes live; the user is never blocked on one more
permission, and the result message says which mechanism was used and how to switch.

This also settles the branch-vs-Actions tension honestly: both are supported, the token's
permissions decide which runs, and `ensureBranchPages` (built earlier) is the fallback,
not dead code.

## Follow-ups (not in this ADR)

1. Custom-domain (`CNAME`) support for the Pages site.
2. Generate an `actions/deploy-pages` static-deploy workflow ONLY for orgs that enforce
   Actions-based Pages deployment (personal repos use branch-serving, handled above).
3. Swap PAT → GitHub App if/when the product goes multi-user hosted.
4. Surface the workflow run status back in Fadi (read the Actions API).
5. ~~Optional explicit "Replace" mode~~ — DONE (see above).
6. ~~Detect a non-`main`/root Pages source config~~ — DONE via `ensureBranchPages`.
