# Claude claims migration 0048

`0048_project_evidence` — adds `project_runs.evidence_item_id` (uuid, references
`evidence_items.id` on delete set null) with a unique index. It is the project's source key for
completion evidence: saving is serialized on the run row and a repeated save returns the item
already linked. Generated with drizzle-kit, verified on a throwaway database first.
