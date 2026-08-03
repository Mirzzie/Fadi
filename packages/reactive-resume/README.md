# Vendored: Reactive Resume (render + export stack)

These packages are vendored **as-is** from [Reactive Resume](https://github.com/AmruthPillai/Reactive-Resume)
to give Fadi its résumé template + rendering system. **Additive only** — they augment Fadi's
existing document editor; nothing existing is removed (ADR 0010).

- **License:** MIT © Amruth Pillai (see LICENSE in this folder).
- **Upstream commit:** 36232b631d659969cbc4a7a680f3a8483023d1f3
- **Local changes (kept minimal for clean re-syncs):**
  - tests/fixtures dropped; `package.json` TS7-native build scripts replaced with plain `tsc`;
    pnpm `workspace:*` → npm `*`; tsconfigs target ES2023 (for `Array.findLast`).
  - `resume/src/stylesheet/values.ts` — one `as const` → `as [string, string]` cast (TS5 strict).
  - `pdf` — the `#react-pdf-renderer` subpath-`imports` alias (an unconditional 1:1 map to
    `@react-pdf/renderer`) is substituted directly in source, because Next/Turbopack does not
    honor a transpiled workspace package's `imports` field. The `imports` field was removed.
  - `pdf/src/semantic/test/` (rasterize helper pulling `@napi-rs/canvas`/`pdfjs`) dropped.
  - Source under `src/` is otherwise unmodified.
- **Re-syncing:** diff against the upstream commit above; keep source pristine so future
  pulls stay clean.

Packages: `@reactive-resume/schema` (data model), `@reactive-resume/resume` (template/stylesheet
renderer), `@reactive-resume/utils`, `@reactive-resume/fonts`, `@reactive-resume/pdf`
(client-side `@react-pdf/renderer` export).
