# Trusted live-data sources and the freshness wire

**Date:** 21 October 2026. **Author:** Claude. **Status:** design, for Codex contract review and
owner product approval. No migration reserved; nothing in the running app changed.

**Why this exists.** A career plan is only as realistic as its freshest *verified* facts. If Fadi
plans on a stale visa threshold or an assumed rule, it hands the person false hope — the anti-goal
(see memory `fadi-no-false-hope-live-grounding`). This document is how Fadi gets trusted, dated,
live data on the things a person worries about for a career in a country, and how we "pull a wire"
so it is always re-checking the latest — without ever hardcoding a *fact*.

**The one distinction that makes this safe.** We do **not** hardcode facts. We curate a vetted,
dated, reviewable registry of **trusted sources** — the allowlist of *where truth comes from* — and
always re-fetch the facts from those sources live, with dates. Hardcoding a source list is the
opposite of hardcoding a fact: it is the thing that lets every fact stay live.

## 1. What a person actually worries about → where the truth lives

| Concern (domain) | Authoritative source kind | Live/structured feed? | Stakes |
|---|---|---|---|
| Right to work / visa / permit rules & salary thresholds | National immigration dept + legislation | **Mostly HTML/PDF**, no data feed | Highest — gates everything |
| Occupation eligibility lists (IE CSOL/ISEL, UK ISL, CA NOC, US SOC) | Dept publications / statutory instruments | HTML/PDF, sometimes CSV | High |
| Salary / wage benchmarks | Official statistics office | **Structured APIs** (Eurostat, CSO, BLS OEWS) | High (permit salary fit) |
| Labour demand / vacancies / shortage | EURES, national job boards, stats offices | Mixed: dashboards, some APIs, ESCO-coded | Medium |
| Occupation & skills taxonomy | ESCO (EU), O*NET (US) | **Bulk + API, versioned** | Medium (maps titles→codes) |
| Cost of living / relocation | Eurostat HICP, national CPI | **APIs** (+ secondary: Numbeo) | Medium |
| Business / self-employment / tax | Company registry + revenue authority | Varies by country | Medium |
| Industry / sector trends | Official stats + reputable secondary | APIs + reports | Lower (context, never gates) |

**The asymmetry to design around:** the *highest-stakes* facts (immigration law) are the *least*
machine-readable, and the most machine-readable (wage stats) are lower-stakes. So the legal wire
must lean on snapshot + change-detection + **human verification**, never on a clean feed it doesn't
have.

## 2. Source authority tiers (reuse Codex's `ResearchSource.authority`)

`official` · `primary_data` · `reputable_secondary` · `other`. Rules:
- A **plan-blocking** fact (visa eligibility, salary floor, deadline) may be gated **only** by an
  `official` source (or `primary_data` for a statistic). Secondary sources **enrich, never gate**.
- Legal facts come from the department or the legislation, never from a consultancy blog — those
  are leads to the official page, at most.
- Conflicts between sources are kept visible (`ResearchClaim.conflictsWith`), never silently picked.

## 3. Two wires, because the sources differ

**A. Structured-feed poller** — for versioned data APIs. Cheap, reliable, re-pollable; store the
dataset version and `retrievedAt`.

**B. Document watcher** — for official HTML/PDF (immigration rules, permit thresholds, occupation
lists, legislation). Change-detection, in order of preference:
1. **Publisher content API** where one exists — e.g. GOV.UK `https://www.gov.uk/api/content/<slug>`
   returns JSON with `first_published_at` and `public_updated_at` (verified 21 Oct 2026 on
   `/skilled-worker-visa`: `first_published_at` 2014-02-07). Cheapest reliable "did it change?".
2. **HTTP conditional** — `ETag` / `Last-Modified` + `If-None-Match` / `If-Modified-Since`; a `304`
   means unchanged at near-zero cost.
3. **Official RSS/Atom news feed** — many departments publish one (e.g. GOV.UK updates,
   enterprise.gov.ie news); watch for items touching a watched page.
4. **On-page published / effective date** — extracted and compared.
5. **Legislation by ELI** (European Legislation Identifier) for statutory instruments (IE eISB, UK
   legislation.gov.uk) — no official API in IE, so fetch by citation and snapshot.

Every fetch goes through Codex's `fetchResearchSource` → immutable `ResearchSnapshot` (pinned
address, bytes, SHA-256, hop list, `retrievedAt`). Change = snapshot hash / dataset version /
content-api `public_updated_at` differs from the last stored one.

## 4. The Source Registry (the data that keeps this general, not hardcoded)

A per-`(domain, jurisdiction)` registry of trusted sources — **data, not code** — so a new country
is a new set of rows, not a rebuild. Proposed shape (for joint review):

```ts
interface SourceEntry {
  id: string;
  domain: SituationDomain | "labour_market" | "salary" | "cost_of_living" | "occupation_list" | "business";
  jurisdiction: string;            // ISO-3166 country, "EU", or "global"
  canonicalUrl: string;
  publisher: string;
  authority: "official" | "primary_data" | "reputable_secondary" | "other";
  access: "api" | "document";
  freshness: {
    mechanism: "api_version" | "content_api_updated" | "http_conditional" | "rss" | "page_date" | "eli";
    recheckCadenceDays: number;    // how often the wire re-checks
    feedUrl?: string;              // RSS/content-API/dataset endpoint when distinct from canonicalUrl
    requiresKey?: boolean;         // e.g. BLS v2, O*NET — owner-configured, server-held
  };
  predicates: string[];            // which situation/claim predicates this source may evidence
  notes?: string;
}
```

The registry is reviewed like code (authority and URL are curated), versioned, and tenant-neutral
(it names sources, holds no person data). A person's **own trusted sources** (BYO links) are added
as `authority: "other"` / `reputable_secondary` entries scoped to that person, weighed first for
*them* but never promoted to gate a legal fact.

Seed (verified today — see §8): Ireland, EU, UK, US, plus global stats. Extensible to any country.

## 5. The refresh loop (plugs into existing contracts, no new runtime)

1. A **recurring source-refresh task** on Codex's outbox worker (Contract 3 recurring occurrence
   keys), cadence per `freshness.recheckCadenceDays`; `resting_until` suppresses nothing here (it is
   background, not a nudge).
2. Fetch → `ResearchSnapshot`. **Unchanged** → bump `checkedAt` (a freshness heartbeat), no new
   claim. **Changed** → continue.
3. **Re-extract** candidate claims (Claude) → **deterministic admission** (Codex) → new
   `ResearchClaim` that `supersedes` the old one (append-only, ADR 0015 §2.3).
4. **Invalidate dependents:** any `SituationFact` (`derived`), `StrategyAssumption` or `Strategy`
   that cited the changed claim is marked stale and raised as a **`StrategyReview` proposal** to the
   person. **Never an automatic plan change** (§3 no-overreaction; "a verified rule change triggers
   a reassessment, not an automatic irreversible decision").
5. **Freshness is always visible:** every claim carries `checkedAt` + `freshForDays`; past its
   window it shows "needs re-check," never silent trust.

## 6. What the person sees — no false hope, by construction

- Every fact in a plan carries **source + date + freshness** ("€40,904 — enterprise.gov.ie, checked
  21 Oct 2026").
- A plan-blocking fact with **no official source, or a stale one → a gap**, surfaced and asked,
  never filled with an optimistic guess.
- High-stakes legal facts pass the **verify-with-you** gate before they gate a plan.
- A source changing upstream reaches the person as "this rule changed — review your plan," with the
  before/after and the dated source, on their terms.

## 7. Ownership

| Piece | Owner |
|---|---|
| `fetchResearchSource`, `ResearchSnapshot`, pinned HTTP, address policy | Codex (done, `35f5148`) |
| Deterministic claim admission; the outbox refresh-task runtime | Codex |
| `SourceEntry` registry + seed, freshness policy, change→claim extraction, predicates, fixtures | Claude |
| Verify-with-you + plan surfacing of source/date/freshness | Claude |
| **Joint, before any migration:** `SourceEntry` contract, the refresh-task contract, persistence | Both |

## 8. Verified sources (checked 21 Oct 2026, with what each gives)

| Source | Jurisdiction | Access | Gives | Freshness mechanism | Verified |
|---|---|---|---|---|---|
| Eurostat Statistics API (`ec.europa.eu/eurostat/api/dissemination/statistics/1.0`) | EU | API (JSON-stat 2.0, no key) | wages, labour cost, HICP cost-of-living | dataset version | ✅ |
| CSO PxStat (`data.cso.ie`) | IE | API (JSON-stat) | earnings, labour force (QLF/QNQ) | dataset version | ✅ |
| BLS Public Data API v2 (`api.bls.gov/publicAPI/v2`) | US | API (free key) | OEWS occupational wages (annual) | dataset version | ✅ |
| O*NET Web Services + bulk (`onetcenter.org`) | US | API + bulk (free key / download) | occupation & skills taxonomy (v31.0) | release version | ✅ |
| ESCO (`esco.ec.europa.eu`) | EU | bulk SKOS-RDF/CSV (+ services) | occupation↔skill taxonomy, EURES coding | release version | ✅ (bulk) |
| GOV.UK Content API (`gov.uk/api/content/<slug>`) | UK | document + JSON metadata | immigration rules pages, `public_updated_at` | content_api_updated | ✅ |
| enterprise.gov.ie permit pages / news | IE | document (HTML/PDF) | permit thresholds, CSOL | http_conditional + rss + page_date | ✅ (page read) |
| irishimmigration.ie (Third Level Graduate Programme PDF) | IE | document (PDF) | Stamp 1G rules | http_conditional + page_date | ✅ (page read) |
| Irish Statute Book eISB (ELI) | IE | document (HTML/XML by citation) | permit statutory instruments | eli | ✅ (no official API) |
| OECD / World Bank / ILOSTAT | global | API (JSON) | cross-country labour & economic series | dataset version | ⚠️ confirm per use |

## 9. Honest limits

- **Legal truth is HTML/PDF.** Change-detection is heuristic (hash/diff/updated-date), so
  **human verification stays mandatory** for any visa decision. The wire flags *that something
  changed*; it never decides *what it means* for the person.
- **Keys & ToS.** BLS v2 and O*NET need free keys (owner-configured, server-held); every source's
  rate limits and terms are respected; secondary sources never gate a legal fact.
- **No IE legislation API.** Irish SIs are fetched by ELI citation and snapshotted; print remains
  the official version, so reconfirm per application.
- **Coverage gaps are first-class.** A source that can't be read becomes a coverage gap in the
  research run, not invented evidence (Codex's fetch contract already enforces this).

## 10. What can be built now (no migration, no collision)

1. **Seed `SourceEntry` registry** (data + type) for IE/EU/UK/US/global — Claude-owned candidate
   semantics; starts in a prototype, lands in `lib/research` once the contract is agreed.
2. **Prove-first poller** (scratchpad, read-only): pull one structured API (Eurostat/CSO) and run a
   conditional GET on one document (GOV.UK content API / enterprise.gov.ie) to demonstrate
   change-detection end to end, with dates. No tables, no worker registration.
3. Then, on Codex's contract nod: the refresh task + persistence migration (numbered after the
   reserved 0072/0073), and the verify/plan surfacing.

## 11. Seed registry landed + change-feed findings (21 Oct 2026)

The seed registry is now real, importable code: **`apps/web/src/lib/sources/registry.ts`** (Zod
`SourceEntry` schema + ~30 entries + `gatingSources()` / `sourcesForPredicate()` helpers). It is
data/types only — **not yet wired to a fetch loop** (that is the joint step) — and every entry is
marked `verified` (confirmed live) or `candidate` (confirm before gating a plan).

**Change channels — how each domain publishes updates/upcoming changes (researched this session):**

| Channel | What it gives | Verified |
|---|---|---|
| **US Federal Register API** (`/api/v1/documents.json`, no key) | every rule / proposed rule / notice, filterable by agency (DHS/USCIS) & date — the strongest "upcoming change" feed found | ✅ |
| **GOV.UK Content API** `public_updated_at` + GOV.UK Atom feeds / email-alert API | UK immigration pages changed-detection | ✅ (content API) |
| **EUR-Lex RSS** (OJ / Parliament-Council / proposals) | new EU legislation as published | candidate |
| **USCIS newsroom RSS**, **IRCC news**, **gov.ie news** | department announcements early | candidate |
| **legislation.gov.uk** Atom + data API, **Irish Statute Book** (ELI) | statutory-instrument changes | candidate |
| **Eurostat / CSO / BLS / O*NET / ESCO** dataset versions | wage, labour, taxonomy refreshes | ✅ |
| **OECD / World Bank / ILOSTAT** APIs, **SEC EDGAR** (`data.sec.gov`) | cross-country indicators; target-employer filings | candidate |

**New access type — `mcp`.** A trusted MCP server is now a first-class source channel (e.g. an
Irish-legislation MCP that returns statute text by citation). Community servers are `authority:
"other"` — used to *locate* the official text, never as the authority. Official MCP servers, as they
appear, slot in as `official`.

**Secondary cross-check — askmanavi.com.** Added as `reputable_secondary`, **cross-check only, never
gates a plan**. Reverse-engineering (REA, 21 Oct) showed it is an expert hand-curating DETE/ISD
waits with an "as of" date — no live feed — so it is useful to corroborate the official pages and
flag divergence, not to source a fact.

**User-extensible by design.** A user's own trusted sources are appended as `scope: "person"` rows
(`ownerId` set), weighed first for *them* but never promoted to gate a legal fact —
`sourcesForPredicate(..., { ownerId })` already merges them. This is the BYO-sources principle made
concrete, so a person can shape how Fadi serves them over time.
