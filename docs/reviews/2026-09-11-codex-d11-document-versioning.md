# D11 repair — document conflicts and recovery

11 September 2026. Owner: Codex. Migration: `0043`.

## Defect reproduced

All three document editors loaded only title/content/template and issued unconditional updates. Two tabs that loaded the same document could save in either order; the later request silently replaced the first request, and no prior content survived. A failed autosave also returned the editor to its ordinary idle label and cleared its dirty flag, which made an unsaved failure look harmless.

## Result

- `documents.version` is incremented inside every accepted save.
- Editors send the version they loaded. The repository locks the owned row, compares that version and returns a typed conflict without writing when the editor is stale.
- Accepted states are stored in `document_revisions` in the same transaction as the head update. Revision `(document_id, version)` is unique and rows cascade only when the document is deliberately deleted.
- New documents store version 1 at creation. For documents that predate migration 0043, the first versioned save snapshots the existing version 1 before changing it.
- The three autosave editors serialize their own requests and track edit generations, so an older response cannot label newer local text as saved. Provider/action failures remain visibly retryable.
- A conflict leaves the local edits in place and offers **open latest** in another tab for comparison.
- Every editor links to a user-scoped History page. Restoring an older snapshot creates a new version through the same compare-and-save contract; it never rewrites or deletes history.

## Evidence

`apps/web/src/lib/documents/versioning.integration.test.ts` runs the actual repository against a newly created database with the complete migration journal. It loads two stale views of version 1, accepts tab A as version 2, rejects tab B, proves tab A remains the head, then restores version 1 as version 3 and verifies the immutable sequence `3, 2, 1`. The database was dropped after the passing run.

Database and web TypeScript checks pass with incremental output disabled for the web workspace. Focused document lint passes with zero errors, and the existing document suite passes 91 tests across nine files. Migration `0043_keen_kat_farrell.sql` and its snapshot were produced by `drizzle-kit generate`, not written manually.

## Limit

This is compare-and-recover, not an automatic text merge. Fadi cannot know whether two divergent résumé edits should be combined. It preserves both, blocks the destructive write and gives the user both versions to review. Existing documents have no historical states from before this migration because those states were never recorded; their current state appears in History immediately and becomes an immutable revision on the next accepted save.
