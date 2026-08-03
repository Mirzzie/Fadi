# 0010 — Adopt Reactive Resume's editor stack for the document workspace

- **Status:** **ACCEPTED — 2026-08-03.** Phase 1a shipped on branch
  `feat/reactive-resume-editor`.
- **Related:** builds on the document workspace (`lib/documents/*`, the `resumes`/`documents`
  tables) and the JSON-Resume bridge (`lib/documents/json-resume.ts`).

## Context

We want Fadi's document editor to have **Reactive Resume's UI/UX, templates, ease of use,
and data flow** — its polished multi-template résumé builder and real (client-side) PDF
export. Reactive Resume (rxresu.me) is **MIT-licensed** and, as of v5, runs almost Fadi's
exact stack: React 19, PostgreSQL + **Drizzle**, **Better Auth**, Tailwind, zod ^4 — and
its packages export **TypeScript source** with no build step, the same way Fadi consumes
`@careeros/database`.

## The hard constraint: additive only

**This is a facelift + improvements, not a replacement.** Nothing existing is removed.
Every current capability stays and keeps working:

- per-career-track tailored résumés (`resumes` table), the `documents` workspace
  (résumés, cover letters, emails, value props),
- the AI advisor / humanize / generate / cv-review pipeline,
- DOCX export, dictation, the JSON-Resume import/export bridge.

rxresume's editor is layered **on top** as an upgraded surface; Fadi stays the shell (it is
far more than a résumé tool — job discovery, mentor, market intel, portfolio).

## The doctrine reconciliation (non-negotiable)

Reactive Resume is a *blank-canvas* editor. Fadi's spine is **"the user's real history is
the source of truth"** and **"Never invent. Always claim."** We keep the UX but **seed the
editor's store from the user's verified career history** (history → `ResumeData`), so the
builder is a *tailoring surface over truth*, never a place to type fiction. We do not expose
an empty "invent anything" start.

## Decision

1. **Vendor rxresume's self-contained render + export packages** into
   `packages/reactive-resume/*` (MIT, consumed as source, transpiled by Next). No server /
   auth / API coupling in these.
2. **Port the builder feature** (`apps/web/src/features/resume/builder`) into a Next.js
   client route, rewiring only its three coupled edges: routing (TanStack Router → Next),
   data (its oRPC → Fadi **server actions** persisting to the existing tables), and auth
   (its Better Auth → **Fadi's** Better Auth — same library).
3. **Bridge to Fadi's engine:** history → `ResumeData` translation layer; wire Fadi's AI
   (advisor/humanize) into the editor; keep DOCX.
4. **Map the schemas:** Fadi `ResumeData` / JSON Resume ↔ rxresume schema (incremental — the
   JSON-Resume bridge already exists).

## Phased plan

- **1a — render foundation (DONE).** Vendored `@reactive-resume/schema` (data model) and
  `@reactive-resume/resume` (template/stylesheet renderer). Wired into workspaces +
  `transpilePackages`; both typecheck clean inside Fadi; web/database typecheck unchanged.
- **1b — export.** Vendor `utils` + `fonts` + `pdf` (`@react-pdf/renderer`) → real
  client-side PDF. Prove it by rendering one existing Fadi résumé through a rxresume
  template + exporting a PDF (proof of concept, no UI change yet).
- **2 — editor UI.** Port the builder feature into a Next.js route as a new tab in the
  document workspace, alongside (not replacing) the current editor.
- **3 — engine bridge + migration.** Seed from verified history, wire AI, map/persist to the
  existing `resumes`/`documents` tables so the two editors share data.

## Consequences

**Positive**
- Fadi gains rxresume's template library + real PDF export, in its own stack, natively.
- Additive: zero feature loss; the current editor keeps working throughout the migration.
- Shared stack (React/Drizzle/Better Auth/zod/Tailwind) makes the port tractable.

**Negative / accepted**
- **Upstream drift:** vendored packages fork from upstream — we trade easy updates for
  control. Mitigation: source kept pristine, upstream commit + local changes recorded in
  `packages/reactive-resume/README.md` (upstream `36232b6`).
- **Two schemas** to map (rxresume ≠ JSON Resume ≠ Fadi `ResumeData`) — incremental.
- One TS-strict compat fix was needed (`values.ts`, a `readonly`-tuple cast) because
  upstream builds with the TS7-native compiler; documented in the vendored README.

## Alternatives considered

- **Replace Fadi's editor entirely.** Rejected — violates the additive constraint and the
  doctrine (blank-canvas), and throws away working per-track/AI/DOCX features.
- **Run rxresume self-hosted alongside + iframe/SSO.** Rejected as the primary path — a
  permanent two-app tax, data-sync burden, and a data model that knows nothing about tracks
  or verified history.
- **Fork rxresume and port Fadi into it.** Rejected — inverts the product around one
  workspace; Fadi is much larger than a résumé editor.
