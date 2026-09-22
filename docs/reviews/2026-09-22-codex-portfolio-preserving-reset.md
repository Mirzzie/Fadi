# Codex → Claude: user-directed reset and simpler product flow

The user explicitly asks to reset all non-portfolio user data, keep their login, and preserve ALL portfolio CMS content/media, especially image proof. They reject the accumulating control panels and repair workflow as too complicated.

**I am executing this reset. Do not run the existing delete-user action: it cascades into the portfolio. Please do not write/import/sync records for this account while I inventory, back up and reset it.** I will preserve the account identity, portfolio sites/items, media and publishing connection, detach their old career/evidence references, and verify them before and after. I will not delete physical Docker/VM disks as part of a database reset.

Pause new reconciliation/selection controls. The next product should start from one current résumé, show a readable career record once, ask only about factual conflicts, and tailor documents without requiring the person to manage versions, identity groups or three parallel lists. Advanced selections belong at the point of drafting, not as the first screen of their history. Keep provenance and versioning behind that flow.

The screenshot of a project containing employment, certification and degree “wordings” is old cross-kind corruption, not a wording problem for the user to manually manage. New guardrails do not repair those rows. The requested reset removes that contaminated working set while protecting the independently useful portfolio content. The user will supply a new base résumé afterwards; do not re-import the old text or silently pull old portfolio claims into the new career history.

Execution results and backup location will follow here. No new redesign is being represented as completed by this reset.

## Reset completed and verified

- Matched the account through its existing `mirzad-official` portfolio; no other account or shared job catalog was modified.
- Private backup: `/home/mirzzie/Backups/Fadi/2026-09-22-portfolio-before-reset/`. It contains the full portfolio CMS snapshot, publishing connection (encrypted token retained), proof/media manifest with checksums, seven downloaded images, public API snapshot and deletion result. Keep this outside Git.
- All 34 portfolio items, the site, images/galleries, publication state, portfolio analytics and GitHub publishing connection remain. Login and identity remain.
- Cleared non-portfolio account data: old résumé/history/source copies, evidence, documents/revisions, directions/reports, applications/private captured jobs, stories, learning/projects, agent records, AI settings, lab permissions/settings/requests and MCP tokens. Physical Docker/VM files were not touched.
- Detached the site's career direction and each item's evidence pointer so the preserved CMS stands independently of deleted working data. No content, media, confirmation or publication fields changed.
- The reset first ran as a transaction and rolled back after checking that protected content and other users' counts were unchanged. It then committed with the same checks. The public portfolio API response was identical before and after.
- Seven images were backed up successfully. One pre-existing Cloudinary PDF URL returned HTTP 401; the original URL and CMS references are preserved. This was not an image and was not deleted by the reset.

**Please do not restore or auto-extract the old portfolio content into the new career record.** The user will provide a new base résumé. The next step is one understandable intake/review flow, with factual discrepancies asked once. Remove duplicate management surfaces from the primary journey; keep versions, identity decisions and advanced selection behind it. Do not begin a large new architecture or add more knobs before observing that fresh import. No reset button/UI redesign is claimed implemented here; this was the user's requested targeted reset.
