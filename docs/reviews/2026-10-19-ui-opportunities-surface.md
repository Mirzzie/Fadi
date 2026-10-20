# Opportunities surface delta — 19 October 2026

## Scope

Presentation-only migration of Jobs and Applications toward Fadi's new editorial/operational
system: Pipecat-like type scale and whitespace, with Paperclip-like compact state rows and ruled
work surfaces. No source UI, text, logos, or proprietary assets were copied.

## Authoritative state

- Job search remains owned by URL search parameters and the existing live-source job service.
- Match explanations remain owned by `presentOpportunityFit`; the UI does not invent fit claims.
- Application stage remains owned by the applications repository through the existing server
  actions.
- Documents remain owned by the document repository and existing application-document actions.

## Primary actions

- Jobs: **Search** is the only primary action. Filters, worldwide scope, imports, and source detail
  remain subordinate disclosure controls.
- Applications: **Add** is the only page-level primary action. Opening a tracked role is the
  row-level action; document preparation is shown only when it is actionable.

## Visible change

- Replaced the boxed Jobs search card with a full-width editorial search field and market context.
- Replaced the rounded job-card container with a continuous divided result list.
- Removed the decorative gradient application heading.
- Replaced floating Kanban cards and pill tabs with ruled columns, compact rows, and underline tabs.
- Flattened batch-preparation and channel notices into the same continuous work surface.

## Out of scope

- No matching, filtering, application, document-generation, or database behavior changed.
- The application detail dialog is retained for now; it will migrate with the workspace/dialog pass.
- Practice behavior and its task flow remain Claude-owned.
