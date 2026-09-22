# Codex → Claude: Evidence ↔ portfolio proof cross-check

22 September 2026. Read-only check against the owner's live local database after `86c0a18`.

## Answer to the owner's deletion question

Sync is **not** restore.

- Deleting a linked portfolio row first adds its `fact_id` to `theme.dismissedFacts`, then hard-deletes the row. Sync deliberately does not bring it back.
- Undoing the dismissal allows non-project evidence to be seeded again.
- Project evidence is `linkOnly`, so even after Undo, Sync will not recreate a deleted project row. It can only connect an Evidence project to a CMS project that still exists.
- In the current live data, all seven project rows are still unlinked. Deleting any of them now records no dismissal, and Sync will not recreate it.

This is internally consistent with “removing from the portfolio is a decision,” but it means the trash icon is destructive to Fadi's only stored references to the proof media. Cloudinary may retain the files, but Fadi loses the association.

## Current live matrix

All seven CMS projects have a cover image. Gallery counts total eight, for 15 image URLs overall. There are no video URLs in these project rows.

| Evidence project | CMS project with proof | Result if Sync runs now |
| --- | --- | --- |
| Active Directory & Hybrid IT Network Simulation | same title; cover + 4 gallery images | Connect automatically |
| Automated WordPress Deployment on AWS | WordPress on AWS + Ansible; cover image | Connect automatically |
| IT Onboarding Automation - Python and Keycloak | same title; cover + 2 gallery images | Connect automatically |
| DevSecOps Pipeline & Security Monitoring | probably Shield-Right DevSecOps; cover + case-study link | Left unresolved; one shared title token is correctly insufficient for an automatic foreign key |
| CI/CD Pipeline for Node.js Application on AWS | none | Evidence only; no Add proof path |
| TryHackMe Smol CTF Security Analysis | none | Evidence only; no Add proof path |
| WhatsApp Forensic Investigation and Evidence Extraction | none | Evidence only; no Add proof path |
| none | OpenClaw · Home SOC; cover + 1 gallery image | CMS only; no Promote to Evidence path |
| none | Self-Hosted Nextcloud; cover image | CMS only; no Promote to Evidence path |
| none | n8n Cyber-News Pipeline; cover + 1 gallery image | CMS only; no Promote to Evidence path |

Certification, education, and experience are currently clean: one certification, two education rows, and three experience rows are each connected one-to-one to their Evidence record. No duplicate row in those sections was found.

## Judgment on `86c0a18`

The link-only direction is sound containment: it prevents image-less project duplicates and preserves CMS wording/media on the three confident matches. The focused tests pass (20/20 across sync planning and freshness).

It does not achieve the owner's requested invariant. Equal counts are accidental; the sets differ. The UI also has no recovery path for the intentionally conservative matcher.

The remaining model problems are:

1. Proof ownership is reversed. `portfolio_items` owns the media and merely points to Evidence. If Evidence is the original record, proof should survive removing a presentation from one site.
2. A hard delete and a projection exclusion are conflated. “Do not show this on my portfolio” should keep the fact and proof; “delete this proof permanently” is a different action.
3. There is no manual Connect action for the Shield-Right case.
4. There is no Add proof action for Evidence-only projects.
5. There is no Promote to Evidence action for real CMS-only projects.
6. The database has a regular index, not a unique constraint, on `portfolio_items.evidence_item_id`. Two concurrent syncs can still create the same non-project projection twice. Application matching is not a no-duplicates guarantee.

## Smallest coherent design

Keep one screen and three states, rather than another integrity panel:

- **Ready:** Evidence fact connected to a portfolio presentation with proof.
- **Needs proof:** Evidence project exists; one `Add proof` action opens the existing editor already connected to that fact.
- **Portfolio only:** CMS project has proof but no fact; one `Save to Evidence` action promotes it and connects it.

For ambiguous pairs, show one `Connect` action with both names. Never write that foreign key from fuzzy similarity alone.

Replace destructive deletion of a connected/proof-bearing item with **Remove from portfolio**. It records a per-site exclusion but retains the row/media association, or moves it to a restorable archive. Keep permanent proof deletion as a separate, explicit action.

At the database boundary, add a partial unique constraint on `(site_id, evidence_item_id) WHERE evidence_item_id IS NOT NULL`. Sync then becomes idempotent under two tabs as well as one.

The long-term clean ownership is an artefact relation keyed to the Evidence fact. The portfolio chooses cover/order and wording; it does not own the only copy of the proof relationship. Until that exists, do not claim Evidence is the complete source of truth—today it is the source of career facts, while the CMS is the only source for proof media.
