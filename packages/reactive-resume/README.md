# Vendored: Reactive Resume (render + export stack)

These packages are vendored **as-is** from [Reactive Resume](https://github.com/AmruthPillai/Reactive-Resume)
to give Fadi its résumé template + rendering system. **Additive only** — they augment Fadi's
existing document editor; nothing existing is removed (ADR 0010).

- **License:** MIT © Amruth Pillai (see LICENSE in this folder).
- **Upstream commit:** 36232b631d659969cbc4a7a680f3a8483023d1f3
- **Local changes:** tests/fixtures dropped; package.json build scripts replaced with plain
  `tsc`; pnpm `workspace:*` → npm `*`. Source under `src/` is otherwise unmodified.
- **Re-syncing:** diff against the upstream commit above; keep source pristine so future
  pulls stay clean.

Packages: `@reactive-resume/schema` (data model), `@reactive-resume/resume` (template/stylesheet renderer).
