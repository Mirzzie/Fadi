/**
 * Canonical job identity — the single source of truth for "are these two postings the same
 * vacancy?", shared by the write path (upsertSeedJob) and the one-off consolidation migration
 * so they can never disagree. Lives in the database package precisely because BOTH need it.
 *
 * Two layers:
 *  - canonicalJobKey(): a CROSS-SOURCE content identity (normalized company + title + city).
 *    Indeed, Jooble, and a company's own site all describe one vacancy with different URLs and
 *    different provider ids; keyed on content they collapse to one row. It also absorbs the
 *    "same posting re-crawled with rotating tracking params" duplicates.
 *  - canonicalizeUrl(): strips rotating tracking parameters (and reduces Indeed to its stable
 *    `jk`) so the STORED apply link is stable and clean.
 */

// Legal-entity suffixes that don't distinguish a company ("Stripe" == "Stripe, Inc.").
const COMPANY_SUFFIXES = new Set([
  "inc",
  "incorporated",
  "llc",
  "ltd",
  "limited",
  "plc",
  "gmbh",
  "ag",
  "sa",
  "srl",
  "bv",
  "nv",
  "co",
  "corp",
  "corporation",
  "company",
  "group",
  "holdings",
  "international",
  "global",
]);

/** Lowercase, &→and, punctuation→space, collapse whitespace. */
function norm(s: string | null | undefined): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Company name minus trailing legal suffixes ("Acme Corp Ltd" → "acme"). */
function canonicalCompany(company: string | null | undefined): string {
  const tokens = norm(company).split(" ").filter(Boolean);
  while (tokens.length > 1 && COMPANY_SUFFIXES.has(tokens[tokens.length - 1])) {
    tokens.pop();
  }
  return tokens.join(" ");
}

/** City part of a location, coarse enough that "Dublin" and "Dublin, Ireland" agree. */
function canonicalCity(location: string | null | undefined): string {
  const first = (location ?? "").split(",")[0];
  return norm(first);
}

/**
 * Stable cross-source identity for a vacancy. Same company + same title + same city ⇒ same key,
 * regardless of which provider surfaced it or what tracking noise was on its URL.
 */
export function canonicalJobKey(
  company: string | null | undefined,
  title: string | null | undefined,
  location: string | null | undefined
): string {
  return `${canonicalCompany(company)}|${norm(title)}|${canonicalCity(location)}`;
}

// UNAMBIGUOUS tracking params — safe to drop on ANY host. Deliberately excludes generic names
// like `source`, `from`, `ref`, `src` which are real functional inputs on some ATS boards.
// Host-specific noise (Indeed's rotating `bb`/`xkcb`/`fccid`/`vjs`) never reaches here because
// Indeed is reduced to its `jk` below.
const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid",
  "msclkid",
  "mc_cid",
  "mc_eid",
  "trk",
  "trkinfo",
]);

/**
 * Normalize an apply URL to a stable, clean form: https, lowercased host without www, tracking
 * params removed, remaining params sorted, fragment dropped. Indeed collapses to its stable
 * `/viewjob?jk=<jk>`. The query is serialized with URLSearchParams so values are correctly
 * percent-encoded (a hand-built `k=v` join corrupts a value that itself contains `&`/`=`, e.g. a
 * nested redirect URL). Returns the input trimmed if it can't be parsed (never throws).
 */
export function canonicalizeUrl(raw: string | null | undefined): string | null {
  const input = (raw ?? "").trim();
  if (!input) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return input;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return input;

  const host = url.hostname.toLowerCase().replace(/^www\./, "");

  // Indeed: the `jk` job key is the stable identity; everything else is session noise.
  if (host.endsWith("indeed.com")) {
    const jk = url.searchParams.get("jk");
    if (jk) return `https://${host}/viewjob?jk=${encodeURIComponent(jk)}`;
  }

  const params = new URLSearchParams();
  for (const [k, v] of url.searchParams) {
    if (!TRACKING_PARAMS.has(k.toLowerCase())) params.append(k, v);
  }
  params.sort();
  const qs = params.toString();
  const path = url.pathname.replace(/\/+$/, "") || "/";
  return `https://${host}${path}${qs ? `?${qs}` : ""}`;
}
