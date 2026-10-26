# How products consume government data — and how Fadi adopts the same methods

**Date:** 21 October 2026. **Author:** Claude. **Status:** research + adoption notes for the
Research stage of the Adaptive Career Loop (ADR 0015). Part of the trusted-source wire
(`2026-10-21-trusted-live-source-wire.md`), not a separate system.

**Why.** Before widening Fadi's wire, I researched how real products, companies and services actually
use government data in Ireland and elsewhere — so Fadi copies proven methods instead of inventing
fragile ones (the live run had shown raw-HTML hashing giving false "changed" signals). The headline:
**professionals almost never scrape HTML; they consume open-data portal APIs and statistical
standards, and take freshness from catalog metadata, not from the page bytes.**

## The methods companies use (researched, with how Fadi adopts each)

| Method (as used in industry) | Where | How Fadi adopts it |
|---|---|---|
| **CKAN Action API** (`/api/3/action/package_search`, `package_show`, `datastore_search`) | data.gov.ie (CKAN 2.9), data.gov.uk, data.gov | `apiStandard: "ckan"`; a `data.gov.ie` catalog entry; **discover** official datasets, not just poll fixed URLs |
| **Catalog metadata freshness** (`metadata_modified`, DCAT `dct:modified`) | every CKAN/DCAT portal; data.europa.eu harvests all EU catalogs | `change.mechanism: "catalog_modified"` — key change on the catalog's own date, **not** an HTML hash (fixes the false-positive) |
| **SDMX** (SDMX-ML / SDMX-JSON): discover dataflow → read structure/codelists → filtered query | Eurostat, OECD, ECB, ILOSTAT | `apiStandard: "sdmx"` + `datasetRef` (dataflow id); structure-then-query |
| **JSON-stat** + dataset self-reported `updated` | Eurostat, CSO PxStat | `apiStandard: "json_stat"`; read a specific table id (not the landing URL — the live run's 404/406 lesson) |
| **Socrata SODA + SoQL** (free app token, 1000/hr) | many US state/city portals, parts of data.gov | `apiStandard: "soda"` for Socrata-hosted sources |
| **Regulatory monitoring**: official API, **poll daily, dedup by stable document id** (`newOnly`) | Federal Register, Regulations.gov | `change.mechanism: "stable_id_dedup"` keyed on `document_number`, filtered by agency (USCIS/DHS) |
| **Publisher content API** (`public_updated_at`) | GOV.UK | `change.mechanism: "content_api_updated"` (already in use) |
| **License + attribution** (CC-BY / OGL): commercial use allowed, **attribution mandatory** | IE CC-BY-4.0, UK OGL, FR Licence Ouverte | `license` field per source; Fadi always shows source + link (design already requires it) |
| **Scheduled ETL** (extract → transform → load; metadata-driven refresh) | standard data-engineering practice | the refresh task = scheduled ETL on Codex's outbox worker; discovery via catalog; dedup via stable ids |

## What changed in the code (21 Oct)

- `registry.ts`: added `apiStandard` (`ckan | sdmx | json_stat | soda | content_api | rest | none`),
  `catalog`, `datasetRef`, `license`; new mechanisms `catalog_modified` and `stable_id_dedup`;
  annotated CSO/Eurostat/Federal Register and added a `data.gov.ie` CKAN discovery source.
- `refresh.ts`: `ckanMetadataModified()` and `latestDocumentIds()` helpers; `catalog_modified` and
  `stable_id_dedup` readers that key change on the **source's own identity** (catalog date / doc id),
  not the page bytes. 20 tests green.

## Verified live (21 Oct 2026)

- `data.gov.ie/api/3/action/package_search?q=employment+permits` → 200, 11 datasets, each with
  `metadata_modified` and `license_id: CC-BY-4.0`.
- Through the puller: `ie-data-gov-catalog` pulled `metadata_modified 2026-10-21`, license CC-BY-4.0;
  re-pull correctly reported `changed=false` keyed on the catalog date.

## Correctness pass after Codex's review (26 Oct 2026)

Codex reviewed the first cut and found four P1 bugs; all are fixed on branch
`claude/research-source-wire` with failing-before/passing-after regression tests (34 tests green,
lint + typecheck clean). Summary of the corrected behaviour:

1. **Change detection = normalized-content fingerprint, with the date as an independent hint.** The
   first cut keyed `page_date` only on the extracted date, which fixed nonce false-positives by
   introducing worse false-negatives (a changed salary figure under an unchanged date read as
   `changed=false`). Now Fadi hashes the normalized salient content (scripts/tags/nonces/long
   tokens stripped) AND compares the date separately: a nonce-only change is unchanged; a **material
   edit with the same date is changed**. The raw-bytes hash is kept for audit. Dates are extracted
   **with their kind** (`updated | published | effective_or_asof | http_last_modified | ambiguous`) —
   an effective date is never relabelled as the publication/update date.
2. **Structured mechanisms fail closed.** Non-200, wrong content-type, malformed JSON or an
   unexpected shape is a coverage gap (`ok:false`), never a successful "unchanged" reading.
   JSON-stat must look like a dataset; CKAN must have `success` + `metadata_modified`; a stable-id
   feed must be non-empty. **ESCO**, which returns an HTML download page, is reclassified as a
   document/discovery source — it no longer claims a taxonomy dataset was pulled.
3. **Headless fetcher reports the real HTTP status** (final main-frame document response), never
   inferred from body size — a 3 KB 403 stays 403.
4. **Citizens Information is discovery-only.** The registered URL is a residence-rights directory
   with no Stamp 1G text, so it no longer claims `stamp.*` predicates. Those facts have **no
   pullable source today** (an honest coverage gap): ISD is the authority but hard-blocks automated
   access, so it is `retrieval: "verify_only"` — a human-verify reference that is never auto-fetched.

Contract corrections: `isChanged` compares date and digest independently; `refreshDue` was renamed
`pullBatch` (a plain executor) with explicit `selectDue`/`isDue` for cadence-based due selection and
enforced `verify_only`; `boundedGet` gained a byte bound and http(s)-scheme check. The production
worker must still use Codex's pinned fetch + durable snapshot before any scheduled run or BYO URL;
pinned fetch does not change egress or defeat a publisher WAF, so a 403 stays unavailable.

**Stats query builders** also landed: SDMX/JSON-stat sources use a templated `feedUrl` with `{ref}`
from `datasetRef`; Eurostat (`earn_mw_cur`) and CSO (`EHQ03`) now pull real datasets. **Browser-grade
headers** (`fetchViaBrowser`) clear UA-based soft WAFs (Citizens Information 403→200); hard IP/JS
WAFs (ISD) are not evaded.

## The principle this encodes

Freshness and change must come from the **source's own authoritative signal** — a catalog
`modified` date, a dataset version, a stable document id — in that order of preference, and only
fall back to content hashing or a page "as of" date for HTML with nothing better. This is both more
reliable and more honest: Fadi reports "changed" only when the publisher says something changed, and
flags a coverage gap otherwise — never a false alarm that would churn a person's plan.
