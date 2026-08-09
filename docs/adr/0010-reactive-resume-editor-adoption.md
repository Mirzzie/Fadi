# 0010 — Adopt Reactive Resume's editor stack for the document workspace

- **Status:** **SUPERSEDED — 2026-08-10.** The RR *rendering* path was adopted, then removed
  (its PDF-in-iframe never sat natively in Fadi). The lasting value — 12 any-career sections,
  photo, accent, a JSON-Resume-shaped model — was kept as **native Fadi** features. On
  2026-08-10 the now-dead RR stack (vendored `packages/reactive-resume/*`, `rr-bridge`, the
  orphan preview, ~143 MB + 78 deps) was deleted as redundant. This ADR is retained as the
  record of what was learned. Originally ACCEPTED 2026-08-03 on `feat/reactive-resume-editor`.
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
- **1b — export (DONE).** Vendored `utils` + `fonts` + `pdf` (`@react-pdf/renderer`). All five
  packages typecheck clean inside Fadi; web/database unchanged. **Proven:** a Pages-Router API
  route rendered `sampleResumeData` through the engine to a real **4-page PDF** in Fadi's
  runtime. The PoC route was then removed (see the render-host finding below); the engine and
  its packages remain.

  **Render-host finding (decides Phase 2/3 wiring):** `@react-pdf/renderer`'s components use
  `createContext`, which the App Router's `react-server` build **forbids in route handlers** —
  so PDF cannot render from an App Router `route.ts`. A **Pages-Router** API route works (full
  React, Node runtime) but has a cost: adding any `pages/` dir flips `useSearchParams()` /
  `usePathname()` to nullable **app-wide**, which broke unrelated type checks. Options for the
  production endpoint (Phase 2): (a) a **worker thread / child process** that renders off the
  request graph — pure App Router, isolates the heavy render; (b) accept Pages Router and add
  null-guards. Leaning (a).
- **2a — template preview (DONE).** A **Template Studio** route
  (`/dashboard/documents/studio`, a static sibling of the `[id]` editor) + a "Template Studio"
  button in the document workspace. A client component renders the sample résumé through all
  15 templates live via `createResumePdfBlob` → object-URL → iframe. Client-side render
  sidesteps the App Router `react-server` limit. Additive; web typecheck unchanged.
- **2b-i — editing loop (DONE).** A zustand store (`resume-store.ts`) seeded from the résumé;
  an editable **Basics** panel (name/headline/email/phone/location/summary) + template picker;
  the preview re-renders **debounced** from the store on every edit. This is the interactive
  data-flow loop, built on Fadi's stack + the vendored engine (zustand added to web).
- **2b-ii — full editor (in progress).** Generic section store ops + a shared
  `SortableSection` (add/remove/**dnd-kit reorder**) now drive **Experience, Education and
  Skills** editors. Remaining: projects/awards/… sections and tiptap rich text for
  descriptions (currently plain textareas), matching more of rxresume's UX.
- **3 — engine bridge + integration into the REAL editor (DONE).** After a course-correction
  (the standalone Studio was the wrong shape — the value belongs in the existing editor,
  which already has section editing, dictation and export), the integration went where users
  actually work:
  - `lib/documents/rr-bridge.ts` — `fadiToReactiveResume()`: the user's real résumé →
    `toJsonResume` → `parseJSONResume` → rxresume `ResumeData`. Two existing tested
    converters chained via JSON Resume; no hand-mapping, so nothing is invented.
    Runtime-tested (real details preserved; schema-valid output).
  - `resume-editor.tsx` — the 15 rxresume templates now sit in the existing template
    `<select>` under a "Reactive Resume" optgroup beside Fadi's "Classic". Selecting one
    swaps the live preview + PDF export to the rxresume engine (`ReactiveResumePreview`),
    fed the real data. Fadi's templates, DOCX/JSON and the rest are untouched. This reaches
    the per-job workspace + auto-prep for free (same editor). Full suite: 455 tests green.
- **Remaining:** persist which engine/template is chosen (already saved as the `template`
  string), wire Fadi's AI advisor into rxresume templates, and retire the now-redundant
  standalone Studio.

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
