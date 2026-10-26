import { z } from "zod";

/**
 * TRUSTED SOURCE REGISTRY — the curated allowlist of *where* Fadi gets live career-relevant facts.
 *
 * This is the one thing we deliberately hardcode: the vetted list of **sources**, never the
 * **facts**. Facts are always re-fetched live from these sources, dated, and re-checked (see
 * `docs/architecture/2026-10-21-trusted-live-source-wire.md` and memory
 * `fadi-no-false-hope-live-grounding`). A hardcoded source list is the opposite of a hardcoded
 * fact: it is what lets every fact stay live and attributable.
 *
 * STATUS: proposal data, pending the joint `SourceEntry` contract review with Codex and owner
 * product approval. It is importable but NOT yet wired to a fetch/refresh runtime; that is the next
 * joint step (Codex's pinned fetch `35f5148` + the outbox worker). No migration is reserved.
 *
 * Each entry is marked `verified` (endpoint/feed confirmed by Fadi on `verifiedOn`) or `candidate`
 * (plausible but unconfirmed — never gate a plan on a candidate until it is confirmed live). This
 * honesty is the same discipline we require of the product.
 */

export const SOURCE_DOMAINS = [
  "right_to_work", // visa / permit rules, eligibility, salary thresholds
  "processing_times", // current wait times for permits / registrations
  "occupation_list", // critical-skills / shortage / eligible-occupation lists
  "legislation", // statutory instruments, regulations, rule changes
  "labour_market", // demand, vacancies, shortage signals
  "salary", // official wage / earnings benchmarks
  "cost_of_living", // price indices, relocation economics
  "occupation_taxonomy", // ESCO / O*NET / SOC code mappings
  "business", // company registration, filings, self-employment
  "industry_trend", // sector outlook (context only; never gates a decision)
] as const;
export type SourceDomain = (typeof SOURCE_DOMAINS)[number];

/** How Fadi reaches the source. `mcp` = a trusted MCP server exposing the data as tools. */
export const SOURCE_ACCESS = ["api", "document", "rss", "mcp"] as const;
export type SourceAccess = (typeof SOURCE_ACCESS)[number];

/** Authority tier. A plan-BLOCKING fact may be gated only by `official` or `primary_data`. */
export const SOURCE_AUTHORITY = ["official", "primary_data", "reputable_secondary", "other"] as const;
export type SourceAuthority = (typeof SOURCE_AUTHORITY)[number];

/** How Fadi learns the source changed — the heart of "always latest". */
export const CHANGE_MECHANISM = [
  "rest_json", // versioned/dated JSON API (poll + diff)
  "api_version", // dataset carries its own version/updated stamp
  "content_api_updated", // publisher content API exposes public_updated_at (e.g. GOV.UK)
  "catalog_modified", // the open-data catalog's own metadata_modified (CKAN/DCAT) — the pro pattern
  "stable_id_dedup", // emit only new records by stable id (Federal Register doc number), never re-hash
  "http_conditional", // ETag / Last-Modified + If-None-Match / If-Modified-Since
  "rss_atom", // official RSS/Atom feed of updates / new items
  "page_date", // on-page "as of" / published / effective date, extracted
  "eli", // legislation fetched by European Legislation Identifier citation
  "mcp_tool", // a trusted MCP server call that returns current data
] as const;
export type ChangeMechanism = (typeof CHANGE_MECHANISM)[number];

/**
 * How the data is actually consumed — the standards real products use rather than scraping HTML.
 * Learned 21 Oct 2026 from how companies consume gov data (see
 * `docs/architecture/2026-10-21-open-data-consumption-methods.md`).
 */
export const API_STANDARD = [
  "ckan", // CKAN action API (/api/3/action/*) — data.gov.ie, data.gov.uk, data.gov
  "sdmx", // SDMX-ML / SDMX-JSON — Eurostat, OECD, ECB, ILOSTAT, CSO
  "json_stat", // JSON-stat — Eurostat, CSO PxStat
  "soda", // Socrata SODA + SoQL — many US state/city portals
  "content_api", // publisher content API (GOV.UK)
  "rest", // a plain REST JSON API (Federal Register, World Bank)
  "none", // no API; document retrieval only
] as const;
export type ApiStandard = (typeof API_STANDARD)[number];

export const sourceEntrySchema = z.object({
  id: z.string().min(1),
  domain: z.enum(SOURCE_DOMAINS),
  /** ISO-3166 alpha-2 country, "EU", or "global". */
  jurisdiction: z.string().min(2),
  publisher: z.string().min(1),
  canonicalUrl: z.string().url(),
  authority: z.enum(SOURCE_AUTHORITY),
  access: z.enum(SOURCE_ACCESS),
  /** The standard used to consume it (how real products do it), not scraping. */
  apiStandard: z.enum(API_STANDARD).optional(),
  /** The open-data catalog this dataset lives in (for CKAN/DCAT discovery + freshness). */
  catalog: z.string().url().optional(),
  /** Resource/dataset/dataflow/table id used to build the API query (CKAN id, SDMX dataflow, etc.). */
  datasetRef: z.string().optional(),
  /** Re-use licence; attribution is mandatory for CC-BY / OGL. Recorded so Fadi credits the source. */
  license: z.string().optional(),
  /** `verified` = Fadi confirmed it live on `verifiedOn`; `candidate` = unconfirmed. */
  verification: z.enum(["verified", "candidate"]),
  verifiedOn: z.string().optional(),
  change: z.object({
    mechanism: z.enum(CHANGE_MECHANISM),
    /** The feed / API / content-API URL when it differs from `canonicalUrl`. */
    feedUrl: z.string().url().optional(),
    recheckCadenceDays: z.number().int().positive(),
    /** Needs an owner-configured, server-held key (e.g. BLS v2, O*NET). */
    requiresKey: z.boolean().optional(),
    /** The publisher's WAF rejects plain clients; fetch through browser-grade headers. */
    needsBrowserFetch: z.boolean().optional(),
    /**
     * Enforced retrieval mode. `auto` (default): eligible for scheduled pulls. `verify_only`: a
     * human-verify reference that is NEVER auto-fetched (e.g. a WAF-blocked official site we still
     * cite as the authority). `selectDue`/`pullBatch` honour this.
     */
    retrieval: z.enum(["auto", "verify_only"]).optional(),
  }),
  /** Situation / research predicates this source may evidence. */
  predicates: z.array(z.string()),
  /** `global` = part of Fadi's curated set; `person` = a source a user added for themselves. */
  scope: z.enum(["global", "person"]).default("global"),
  /** Set when scope = "person": the Fadi user who added it. */
  ownerId: z.string().optional(),
  notes: z.string().optional(),
});
export type SourceEntry = z.infer<typeof sourceEntrySchema>;

const V = "2026-10-21"; // date this seed's "verified" entries were confirmed live by Fadi.

/**
 * SEED REGISTRY. Verified entries were confirmed on 2026-10-21 (API hit or page read). Candidates
 * are plausible official channels not yet confirmed end-to-end — confirm before gating any plan.
 * Extensible to any country by adding rows; a user's own sources are appended with scope "person".
 */
export const SOURCE_REGISTRY: readonly SourceEntry[] = [
  // ───────────────────────── Immigration / right to work ─────────────────────────
  {
    id: "ie-dete-permit-thresholds",
    domain: "right_to_work",
    jurisdiction: "IE",
    publisher: "Department of Enterprise, Trade and Employment (DETE)",
    canonicalUrl:
      "https://enterprise.gov.ie/en/news-and-events/department-news/2025/december/20251202.html",
    authority: "official",
    access: "document",
    verification: "verified",
    verifiedOn: V,
    change: { mechanism: "page_date", recheckCadenceDays: 30 },
    predicates: ["permit.salary_threshold", "permit.type_requirements"],
    scope: "global",
    notes: "HTML/PDF; no data feed. Dec-2025 roadmap set €40,904 CSEP / €36,849 grad from 1 Mar 2026.",
  },
  {
    id: "ie-dete-processing-dates",
    domain: "processing_times",
    jurisdiction: "IE",
    publisher: "DETE — current application processing dates",
    canonicalUrl:
      "https://enterprise.gov.ie/en/what-we-do/workplace-and-skills/employment-permits/current-application-processing-dates/",
    authority: "official",
    access: "document",
    verification: "verified",
    verifiedOn: V,
    change: { mechanism: "page_date", recheckCadenceDays: 7 },
    predicates: ["permit.processing_wait"],
    scope: "global",
    notes: "The official page askmanavi.com transcribes by hand. Snapshot weekly + read the on-page date.",
  },
  {
    id: "ie-isd-registration-renewal",
    domain: "processing_times",
    jurisdiction: "IE",
    publisher: "Immigration Service Delivery (ISD)",
    canonicalUrl:
      "https://www.irishimmigration.ie/registering-your-immigration-permission/how-to-renew-your-current-permission/",
    authority: "official",
    access: "document",
    verification: "candidate",
    change: { mechanism: "page_date", recheckCadenceDays: 7, needsBrowserFetch: true, retrieval: "verify_only" },
    predicates: ["stamp.renewal_rules", "stamp.processing_wait"],
    scope: "global",
    notes:
      "The authority, but the site HARD-BLOCKS automated access (plain, browser-headers and headless all 403 — IP/WAF). retrieval: verify_only — never auto-fetched; a human-verify reference. These stamp facts have NO pullable source today (honest coverage gap). Production fetch needs a clean egress + Codex's pinned fetch (which does not itself change egress or defeat the WAF).",
  },
  {
    id: "ie-isd-graduate-programme",
    domain: "right_to_work",
    jurisdiction: "IE",
    publisher: "ISD — Third Level Graduate Programme",
    canonicalUrl: "https://www.irishimmigration.ie/wp-content/uploads/2024/03/third-level-graduate-programme.pdf",
    authority: "official",
    access: "document",
    verification: "candidate",
    change: { mechanism: "http_conditional", recheckCadenceDays: 60, needsBrowserFetch: true, retrieval: "verify_only" },
    predicates: ["stamp.1g_duration", "stamp.1g_renewal_conditions"],
    scope: "global",
    notes:
      "Authoritative PDF, but same ISD hard-block from this egress. retrieval: verify_only. No pullable source covers these predicates today — an honest coverage gap. Level 9 → 12mo + 12mo renewal, conditional on evidenced job-search steps.",
  },
  {
    id: "ie-statute-book-eli",
    domain: "legislation",
    jurisdiction: "IE",
    publisher: "Irish Statute Book (eISB), Office of the Attorney General",
    canonicalUrl: "https://www.irishstatutebook.ie/eli/isbc/statutory.html",
    authority: "official",
    access: "document",
    verification: "candidate",
    change: { mechanism: "eli", recheckCadenceDays: 30 },
    predicates: ["permit.statutory_instrument"],
    scope: "global",
    notes: "No official API/feed; fetch SIs by ELI citation and snapshot. Print remains official.",
  },
  {
    id: "ie-gov-news",
    domain: "legislation",
    jurisdiction: "IE",
    publisher: "gov.ie news",
    canonicalUrl: "https://www.gov.ie/en/news/",
    authority: "official",
    access: "rss",
    verification: "candidate",
    change: { mechanism: "rss_atom", recheckCadenceDays: 2 },
    predicates: ["policy.announcement"],
    scope: "global",
    notes: "Confirm RSS endpoint on gov.ie; use to catch department announcements early.",
  },
  {
    id: "uk-govuk-skilled-worker",
    domain: "right_to_work",
    jurisdiction: "GB",
    publisher: "GOV.UK",
    canonicalUrl: "https://www.gov.uk/skilled-worker-visa",
    authority: "official",
    access: "api",
    verification: "verified",
    verifiedOn: V,
    change: {
      mechanism: "content_api_updated",
      feedUrl: "https://www.gov.uk/api/content/skilled-worker-visa",
      recheckCadenceDays: 7,
    },
    predicates: ["visa.skilled_worker_rules", "visa.salary_threshold"],
    scope: "global",
    notes: "Content API exposes first_published_at / public_updated_at — cheap change signal.",
  },
  {
    id: "uk-legislation",
    domain: "legislation",
    jurisdiction: "GB",
    publisher: "legislation.gov.uk (The National Archives)",
    canonicalUrl: "https://www.legislation.gov.uk/",
    authority: "official",
    access: "api",
    verification: "candidate",
    change: { mechanism: "rss_atom", recheckCadenceDays: 14 },
    predicates: ["immigration_rules.change"],
    scope: "global",
    notes: "Has Atom feeds + a data API (XML/RDF); confirm the immigration-rules feed path.",
  },
  {
    id: "us-federal-register",
    domain: "legislation",
    jurisdiction: "US",
    publisher: "Federal Register (NARA)",
    canonicalUrl: "https://www.federalregister.gov/",
    authority: "official",
    access: "api",
    apiStandard: "rest",
    license: "public-domain",
    verification: "verified",
    verifiedOn: V,
    change: {
      mechanism: "rest_json",
      feedUrl:
        "https://www.federalregister.gov/api/v1/documents.json?per_page=5&order=newest&conditions%5Bagencies%5D%5B%5D=u-s-citizenship-and-immigration-services",
      recheckCadenceDays: 1,
    },
    predicates: ["rule.published", "rule.proposed", "notice.published"],
    scope: "global",
    notes:
      "Official REST JSON, no key. Industry pattern: poll daily, filter by agency (USCIS/DHS), DEDUP by document_number (emit only new) — never content-hash. The best 'upcoming change' channel found.",
  },
  {
    id: "us-uscis-news",
    domain: "right_to_work",
    jurisdiction: "US",
    publisher: "USCIS Newsroom",
    canonicalUrl: "https://www.uscis.gov/newsroom/all-news",
    authority: "official",
    access: "rss",
    verification: "candidate",
    change: { mechanism: "rss_atom", recheckCadenceDays: 3 },
    predicates: ["policy.announcement", "form.update"],
    scope: "global",
    notes: "News-releases RSS (~3×/week); confirm current feed id on uscis.gov.",
  },
  {
    id: "us-regulations-gov",
    domain: "legislation",
    jurisdiction: "US",
    publisher: "Regulations.gov",
    canonicalUrl: "https://www.regulations.gov/",
    authority: "official",
    access: "api",
    verification: "candidate",
    change: { mechanism: "rest_json", recheckCadenceDays: 2, requiresKey: true },
    predicates: ["rule.proposed", "rule.comment_period"],
    scope: "global",
    notes: "Official API (free api.data.gov key) for proposed rules & comment windows.",
  },
  {
    id: "eu-eurlex-oj",
    domain: "legislation",
    jurisdiction: "EU",
    publisher: "EUR-Lex (Publications Office of the EU)",
    canonicalUrl: "https://eur-lex.europa.eu/",
    authority: "official",
    access: "rss",
    verification: "candidate",
    change: { mechanism: "rss_atom", recheckCadenceDays: 3 },
    predicates: ["eu_law.new_act"],
    scope: "global",
    notes: "Predefined + custom RSS of new OJ acts / proposals. Custom alerts need an account.",
  },
  {
    id: "eu-immigration-portal",
    domain: "right_to_work",
    jurisdiction: "EU",
    publisher: "European Commission — Immigration Portal / EU Blue Card",
    canonicalUrl: "https://immigration-portal.ec.europa.eu/",
    authority: "official",
    access: "document",
    verification: "candidate",
    change: { mechanism: "page_date", recheckCadenceDays: 30 },
    predicates: ["blue_card.rules"],
    scope: "global",
  },
  {
    id: "ca-ircc-news",
    domain: "right_to_work",
    jurisdiction: "CA",
    publisher: "Immigration, Refugees and Citizenship Canada (IRCC)",
    canonicalUrl: "https://www.canada.ca/en/immigration-refugees-citizenship/news.html",
    authority: "official",
    access: "rss",
    verification: "candidate",
    change: { mechanism: "rss_atom", recheckCadenceDays: 3 },
    predicates: ["express_entry.draw", "policy.announcement"],
    scope: "global",
    notes: "canada.ca publishes department news feeds; confirm IRCC feed path.",
  },
  {
    id: "au-home-affairs-news",
    domain: "right_to_work",
    jurisdiction: "AU",
    publisher: "Department of Home Affairs",
    canonicalUrl: "https://immi.homeaffairs.gov.au/",
    authority: "official",
    access: "document",
    verification: "candidate",
    change: { mechanism: "page_date", recheckCadenceDays: 14 },
    predicates: ["visa.rules"],
    scope: "global",
  },

  {
    id: "ie-citizens-information",
    domain: "right_to_work",
    jurisdiction: "IE",
    publisher: "Citizens Information Board",
    canonicalUrl:
      "https://www.citizensinformation.ie/en/moving-country/moving-to-ireland/rights-of-residence-in-ireland/",
    authority: "reputable_secondary",
    access: "document",
    verification: "verified",
    verifiedOn: V,
    change: { mechanism: "page_date", recheckCadenceDays: 30, needsBrowserFetch: true },
    // DISCOVERY only. The registered URL is a residence-rights DIRECTORY; it does NOT itself contain
    // Stamp 1G / graduate-scheme rules, so it must NOT claim those predicates (Codex review 26 Oct).
    // No link-following/extraction happens here; register a leaf article before claiming its facts.
    predicates: ["immigration.plain_rules.index"],
    scope: "global",
    notes:
      "Plain-English official directory; soft WAF cleared with browser headers. Discovery/corroboration only, reputable_secondary, never gates. Stamp 1G leaf articles are not yet registered.",
  },
  {
    id: "ie-wrc-employment-rights",
    domain: "labour_market",
    jurisdiction: "IE",
    publisher: "Workplace Relations Commission (WRC)",
    canonicalUrl: "https://www.workplacerelations.ie/en/what_you_should_know/",
    authority: "official",
    access: "document",
    verification: "candidate",
    change: { mechanism: "page_date", recheckCadenceDays: 60, needsBrowserFetch: true },
    predicates: ["employment.minimum_rights", "employment.contract_rules"],
    scope: "global",
  },
  {
    id: "ie-cro-companies",
    domain: "business",
    jurisdiction: "IE",
    publisher: "Companies Registration Office (CRO)",
    canonicalUrl: "https://www.cro.ie/",
    authority: "official",
    access: "api",
    verification: "candidate",
    change: { mechanism: "rest_json", recheckCadenceDays: 30, requiresKey: true },
    predicates: ["company.registration", "company.status_ie"],
    scope: "global",
    notes: "CRO has a CORE API (core.cro.ie) for company lookups; useful for target-employer checks.",
  },
  {
    id: "ie-revenue-tax",
    domain: "business",
    jurisdiction: "IE",
    publisher: "Revenue (Irish Tax and Customs)",
    canonicalUrl: "https://www.revenue.ie/en/employing-people/index.aspx",
    authority: "official",
    access: "document",
    verification: "candidate",
    change: { mechanism: "page_date", recheckCadenceDays: 60, needsBrowserFetch: true },
    predicates: ["tax.employment", "tax.self_employment_ie"],
    scope: "global",
  },

  // ───────────────────────── Occupation lists & taxonomy ─────────────────────────
  {
    id: "ie-csol",
    domain: "occupation_list",
    jurisdiction: "IE",
    publisher: "DETE — Critical Skills & Ineligible Occupations Lists",
    canonicalUrl:
      "https://enterprise.gov.ie/en/what-we-do/workplace-and-skills/employment-permits/employment-permit-eligibility/highly-skilled-eligible-occupations-list/",
    authority: "official",
    access: "document",
    verification: "candidate",
    change: { mechanism: "http_conditional", recheckCadenceDays: 30 },
    predicates: ["occupation.critical_skills_eligible"],
    scope: "global",
    notes: "Eligibility is decided by the exact SOC row, not the ICT category.",
  },
  {
    id: "uk-immigration-salary-list",
    domain: "occupation_list",
    jurisdiction: "GB",
    publisher: "GOV.UK — Immigration Salary List",
    canonicalUrl: "https://www.gov.uk/government/publications/immigration-salary-list",
    authority: "official",
    access: "api",
    verification: "candidate",
    change: {
      mechanism: "content_api_updated",
      feedUrl: "https://www.gov.uk/api/content/government/publications/immigration-salary-list",
      recheckCadenceDays: 14,
    },
    predicates: ["occupation.isl_listed", "occupation.going_rate"],
    scope: "global",
  },
  {
    id: "eu-esco",
    domain: "occupation_taxonomy",
    jurisdiction: "EU",
    publisher: "ESCO (European Commission)",
    canonicalUrl: "https://esco.ec.europa.eu/en/use-esco/download",
    authority: "official",
    access: "document",
    apiStandard: "none",
    verification: "candidate",
    change: { mechanism: "page_date", recheckCadenceDays: 90 },
    predicates: ["occupation.esco_taxonomy.discovery"],
    scope: "global",
    notes:
      "DISCOVERY only. The canonical URL is an HTML download page, NOT a dataset (Codex review 26 Oct: it was wrongly configured api_version and returned ~75KB text/html). Taxonomy ingest is via the bulk SKOS-RDF/CSV download or the ESCO services API with a real endpoint/version adapter — not yet wired, so no taxonomy data is claimed as pulled.",
  },
  {
    id: "us-onet",
    domain: "occupation_taxonomy",
    jurisdiction: "US",
    publisher: "O*NET (US Dept of Labor)",
    canonicalUrl: "https://services.onetcenter.org/",
    authority: "official",
    access: "api",
    verification: "verified",
    verifiedOn: V,
    change: { mechanism: "api_version", recheckCadenceDays: 90, requiresKey: true },
    predicates: ["occupation.onet_profile", "occupation.soc_code"],
    scope: "global",
    notes: "Free key; also quarterly bulk download (v31.0).",
  },

  // ───────────────────────── Labour market / salary / cost of living ─────────────────────────
  {
    id: "eu-eurostat",
    domain: "salary",
    jurisdiction: "EU",
    publisher: "Eurostat Statistics API",
    canonicalUrl: "https://ec.europa.eu/eurostat/web/main/data/web-services",
    authority: "primary_data",
    access: "api",
    apiStandard: "sdmx",
    datasetRef: "earn_mw_cur", // discover dataflows via the catalogue API; read structure → query
    license: "CC-BY-4.0",
    verification: "verified",
    verifiedOn: V,
    change: {
      mechanism: "api_version",
      feedUrl:
        "https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{ref}?format=JSON&lang=EN",
      recheckCadenceDays: 30,
    },
    predicates: ["wage.benchmark", "cost_of_living.hicp", "labour.cost"],
    scope: "global",
    notes: "JSON-stat 2.0, no key; dataset carries its own 'updated' stamp. Verified earn_mw_cur (IE €2391/mo, 2026-S2).",
  },
  {
    id: "ie-cso-pxstat",
    domain: "salary",
    jurisdiction: "IE",
    publisher: "CSO Ireland — PxStat",
    canonicalUrl: "https://data.cso.ie/",
    authority: "primary_data",
    access: "api",
    apiStandard: "json_stat",
    datasetRef: "EHQ03", // Average Earnings, Hours Worked, Employment & Labour Costs; more via PxStat TOC
    license: "CC-BY-4.0",
    verification: "verified",
    verifiedOn: V,
    change: {
      mechanism: "api_version",
      feedUrl: "https://ws.cso.ie/public/api.restful/PxStat.Data.Cube_API.ReadDataset/{ref}/JSON-stat/2.0/en",
      recheckCadenceDays: 30,
    },
    predicates: ["wage.earnings_ie", "labour.force_ie"],
    scope: "global",
    notes: "JSON-stat (SDMX-style structure→query); read via a specific table id, not the landing URL.",
  },
  {
    id: "ie-data-gov-catalog",
    domain: "labour_market",
    jurisdiction: "IE",
    publisher: "data.gov.ie (national open-data portal, CKAN 2.9)",
    canonicalUrl: "https://data.gov.ie/",
    authority: "official",
    access: "api",
    apiStandard: "ckan",
    catalog: "https://data.gov.ie/api/3/action/",
    license: "CC-BY-4.0",
    verification: "verified",
    verifiedOn: V,
    change: {
      mechanism: "catalog_modified",
      feedUrl: "https://data.gov.ie/api/3/action/package_search?q=employment+permits&rows=5",
      recheckCadenceDays: 7,
    },
    predicates: ["dataset.discovery_ie"],
    scope: "global",
    notes:
      "CKAN action API: package_search / package_show. Each dataset carries metadata_modified (freshness) + license_id. Use to DISCOVER official datasets, not just poll fixed URLs.",
  },
  {
    id: "us-bls",
    domain: "salary",
    jurisdiction: "US",
    publisher: "US Bureau of Labor Statistics — Public Data API v2",
    canonicalUrl: "https://www.bls.gov/developers/",
    authority: "primary_data",
    access: "api",
    verification: "verified",
    verifiedOn: V,
    change: {
      mechanism: "rest_json",
      feedUrl: "https://api.bls.gov/publicAPI/v2/timeseries/data/",
      recheckCadenceDays: 90,
      requiresKey: true,
    },
    predicates: ["wage.oews_us"],
    scope: "global",
    notes: "Free v2 key; OEWS occupational wages (annual).",
  },
  {
    id: "eu-eures-vacancies",
    domain: "labour_market",
    jurisdiction: "EU",
    publisher: "EURES — European job mobility portal",
    canonicalUrl: "https://eures.europa.eu/",
    authority: "official",
    access: "document",
    verification: "candidate",
    change: { mechanism: "page_date", recheckCadenceDays: 14 },
    predicates: ["vacancy.demand_by_occupation"],
    scope: "global",
    notes: "ESCO-coded vacancies; analytics via Cedefop Skills-OVATE. No confirmed public vacancy API.",
  },
  {
    id: "global-oecd",
    domain: "labour_market",
    jurisdiction: "global",
    publisher: "OECD Data Explorer (SDMX)",
    canonicalUrl: "https://data-explorer.oecd.org/",
    authority: "primary_data",
    access: "api",
    verification: "candidate",
    change: { mechanism: "api_version", recheckCadenceDays: 60 },
    predicates: ["labour.oecd_indicator", "migration.outlook"],
    scope: "global",
  },
  {
    id: "global-worldbank",
    domain: "cost_of_living",
    jurisdiction: "global",
    publisher: "World Bank Indicators API",
    canonicalUrl: "https://api.worldbank.org/v2/",
    authority: "primary_data",
    access: "api",
    verification: "candidate",
    change: { mechanism: "rest_json", recheckCadenceDays: 90 },
    predicates: ["economy.indicator"],
    scope: "global",
  },
  {
    id: "global-ilostat",
    domain: "labour_market",
    jurisdiction: "global",
    publisher: "ILOSTAT (ILO) — SDMX",
    canonicalUrl: "https://ilostat.ilo.org/data/",
    authority: "primary_data",
    access: "api",
    verification: "candidate",
    change: { mechanism: "api_version", recheckCadenceDays: 90 },
    predicates: ["labour.ilo_indicator"],
    scope: "global",
  },

  // ───────────────────────── Business / industry trend ─────────────────────────
  {
    id: "us-sec-edgar",
    domain: "business",
    jurisdiction: "US",
    publisher: "SEC EDGAR (data.sec.gov)",
    canonicalUrl: "https://www.sec.gov/edgar/sec-api-documentation",
    authority: "official",
    access: "api",
    verification: "candidate",
    change: { mechanism: "rest_json", recheckCadenceDays: 7 },
    predicates: ["company.filing", "company.financials"],
    scope: "global",
    notes: "data.sec.gov submissions + full-text search; hiring/health signals for target employers.",
  },
  {
    id: "global-wef-future-of-jobs",
    domain: "industry_trend",
    jurisdiction: "global",
    publisher: "World Economic Forum — Future of Jobs",
    canonicalUrl: "https://www.weforum.org/publications/the-future-of-jobs-report-2025/",
    authority: "reputable_secondary",
    access: "document",
    verification: "candidate",
    change: { mechanism: "page_date", recheckCadenceDays: 180 },
    predicates: ["trend.skills_outlook"],
    scope: "global",
    notes: "Context only; never gates a decision. ~39% of skills change by 2030.",
  },

  // ───────────────────────── Secondary cross-check & MCP channels ─────────────────────────
  {
    id: "ie-askmanavi-crosscheck",
    domain: "processing_times",
    jurisdiction: "IE",
    publisher: "askmanavi.com (Manavi Purohit, immigration adviser)",
    canonicalUrl: "https://askmanavi.com/timelines",
    authority: "reputable_secondary",
    access: "document",
    verification: "verified",
    verifiedOn: V,
    change: { mechanism: "page_date", recheckCadenceDays: 7 },
    predicates: ["permit.processing_wait", "stamp.processing_wait"],
    scope: "global",
    notes:
      "CROSS-CHECK ONLY, never gates a plan. Reverse-engineered 2026-10-21: an expert hand-curates DETE/ISD waits with an 'as of' date (no live feed). Useful to corroborate the official pages and flag divergence.",
  },
  {
    id: "ie-eli-mcp",
    domain: "legislation",
    jurisdiction: "IE",
    publisher: "ie-eli MCP server (community)",
    canonicalUrl: "https://glama.ai/mcp/servers/matematicsolutions/ie-eli-mcp",
    authority: "other",
    access: "mcp",
    verification: "candidate",
    change: { mechanism: "mcp_tool", recheckCadenceDays: 30 },
    predicates: ["permit.statutory_instrument"],
    scope: "global",
    notes:
      "Illustrates the `mcp` access type: a server returning Irish legislation by citation. Community-run → treat as `other`; use only to locate the official eISB text, never as the authority itself.",
  },

  // ───────────────────────── User-added sources (scope: "person") ─────────────────────────
  // Appended at runtime when a user brings their own trusted link (BYO sources). Example shape:
  // {
  //   id: "person-<uuid>-<slug>", domain: "right_to_work", jurisdiction: "IE",
  //   publisher: "<their source>", canonicalUrl: "https://…", authority: "other",
  //   access: "document", verification: "candidate",
  //   change: { mechanism: "page_date", recheckCadenceDays: 14 },
  //   predicates: [...], scope: "person", ownerId: "<fadi user id>",
  //   notes: "Added by the user; weighed first for them, never promoted to gate a legal fact.",
  // }
];

/** Entries that may gate a plan-blocking fact: official/primary_data and actually verified. */
export function gatingSources(entries: readonly SourceEntry[] = SOURCE_REGISTRY): SourceEntry[] {
  return entries.filter(
    (e) =>
      e.verification === "verified" &&
      (e.authority === "official" || e.authority === "primary_data")
  );
}

/** All sources (curated + a person's own) that can evidence a given predicate. */
export function sourcesForPredicate(
  predicate: string,
  opts: { jurisdiction?: string; ownerId?: string; entries?: readonly SourceEntry[] } = {}
): SourceEntry[] {
  const { jurisdiction, ownerId, entries = SOURCE_REGISTRY } = opts;
  return entries.filter(
    (e) =>
      e.predicates.includes(predicate) &&
      (jurisdiction ? e.jurisdiction === jurisdiction || e.jurisdiction === "EU" || e.jurisdiction === "global" : true) &&
      (e.scope === "global" || e.ownerId === ownerId)
  );
}
