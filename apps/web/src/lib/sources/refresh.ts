import { createHash } from "node:crypto";

import type { SourceEntry } from "./registry";

/**
 * RESEARCH-STAGE PULLER for the Adaptive Career Loop (Understand → **Research** → Verify → Plan,
 * ADR 0015). It pulls the latest from each integrated trusted source, dates it, and detects whether
 * the *content* changed since Fadi last looked. A change produces a dated reading only; admission
 * (Codex) turns it into a superseding claim and raises a review to the person — never an automatic
 * plan edit (§3). This module pulls, validates and dates; it decides nothing.
 *
 * Correctness rules (from Codex's 26 Oct review):
 * - **Fail closed.** A non-200, a non-JSON body under a JSON mechanism, a malformed payload or an
 *   unexpected shape is a COVERAGE GAP (`ok:false`), never a successful "unchanged" reading. A
 *   failed read carries no digest/date, so a caller must not advance a fact's freshness on it.
 * - **Content identity, not raw bytes.** Change is keyed on a normalized salient-content
 *   fingerprint (nonces/scripts/chrome stripped), with the raw-bytes hash kept separately for
 *   audit. A publisher date is a *hint*, compared independently — never proof that content is equal.
 * - **Honest dates.** Dates are extracted with their kind (updated/published/effective/ambiguous);
 *   an effective date is not relabelled as the publication/update date.
 *
 * FETCHING IS INJECTED. The default `fetchViaWeb` is a prototype with only a time/byte bound; it is
 * NOT a substitute for Codex's pinned `fetchResearchSource` / `ResearchSnapshot` (address pinning,
 * redirect/scheme limits, durable provenance), which the worker adapter must use before any
 * scheduled run or BYO URL.
 */

export type DateKind = "updated" | "published" | "effective_or_asof" | "http_last_modified" | "ambiguous";

/** One source, pulled, validated and dated. The unit the Research stage hands forward. */
export interface SourceReading {
  sourceId: string;
  checkedAt: string; // ISO — when Fadi pulled it
  ok: boolean;
  /** Primary change identity: normalized salient-content fingerprint (docs) / validated payload hash (APIs). */
  digest?: string;
  /** Hash of the raw bytes exactly as fetched — audit only, never the sole change signal. */
  rawHash?: string;
  /** The source's own date, best-effort. */
  observedDate?: string;
  /** What kind of date `observedDate` is — never silently treat an effective date as "updated". */
  dateKind?: DateKind;
  /** The normalizer/fingerprint version the digest was produced under (compare only within a version). */
  fingerprintVersion?: string;
  /** True when this reading differs from the prior one (digest OR observedDate moved). */
  changed?: boolean;
  summary?: string;
  /** Why a read failed or was skipped — a coverage gap, never invented data. */
  error?: string;
  /** True when the source was intentionally not fetched (verify-only / not due). */
  skipped?: boolean;
}

/** What Fadi stored from the last successful pull. */
export interface PriorReading {
  digest?: string;
  observedDate?: string;
  checkedAt?: string;
}

/** Injected retrieval. Swap for a Codex-pinned-fetch adapter in production. */
export interface Fetcher {
  (
    url: string,
    headers?: Record<string, string>
  ): Promise<{ status: number; body: string; headers: Record<string, string> }>;
}

export const sha256 = (s: string): string => createHash("sha256").update(s).digest("hex");

/** Version of the normalization/fingerprint algorithm. A change here means re-interpret, not compare. */
export const FINGERPRINT_VERSION = "1";

/** Named entities whose SEMANTIC character must survive normalization (currency, inequality, units). */
const NAMED_ENTITY: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  euro: "€", pound: "£", cent: "¢", yen: "¥", curren: "¤", dollar: "$",
  percnt: "%", permil: "‰", deg: "°", middot: "·", sect: "§",
  le: "≤", ge: "≥", ne: "≠", lt_: "<", plusmn: "±", times: "×", divide: "÷", minus: "−", frac12: "½",
};
function safeCodePoint(cp: number): string {
  try {
    return Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : " ";
  } catch {
    return " ";
  }
}
/** Decode HTML entities to their characters, KEEPING semantic symbols (€, £, <, >, %, …). */
export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => safeCodePoint(parseInt(d, 10)))
    .replace(/&([a-z][a-z0-9]*);/gi, (_, n: string) => NAMED_ENTITY[n.toLowerCase()] ?? " ");
}

/**
 * Normalize HTML to its salient text so a per-request nonce, script or markup change does not look
 * like a content change, while a changed figure, currency, inequality or unit DOES. Strips
 * scripts/styles/comments/tags and long opaque tokens, then DECODES entities (preserving their
 * meaning), collapses whitespace, lowercases. Versioned by `FINGERPRINT_VERSION`.
 */
export function normalizeContent(html: string): string {
  const stripped = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " "); // strip tags → removes attribute nonces/csrf tokens
  return decodeEntities(stripped)
    .replace(/\b[A-Fa-f0-9]{24,}\b/g, " ") // long opaque tokens printed in text
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Extract the publisher's date WITH its kind. A bare date is `ambiguous`, not assumed to be "updated". */
export function extractPublisherDate(html: string): { date?: string; kind: DateKind } {
  const text = html.replace(/<[^>]+>/g, " ");
  const DATE = "([0-9]{1,2}\\s+[A-Za-z]+\\s+[0-9]{4}|[0-9]{4}-[0-9]{2}-[0-9]{2})";
  const find = (re: RegExp) => text.match(re)?.[1]?.trim();
  const updated = find(new RegExp(`(?:last updated|updated(?:\\s+on)?)[:\\s]*${DATE}`, "i"));
  if (updated) return { date: updated, kind: "updated" };
  const published = find(new RegExp(`published(?:\\s+on)?[:\\s]*${DATE}`, "i"));
  if (published) return { date: published, kind: "published" };
  const asOf = find(new RegExp(`(?:as of|effective(?:\\s+from)?)[:\\s]*${DATE}`, "i"));
  if (asOf) return { date: asOf, kind: "effective_or_asof" };
  const bare = find(
    /\b([0-9]{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+[0-9]{4})\b/
  );
  if (bare) return { date: bare, kind: "ambiguous" };
  return { kind: "ambiguous" };
}

/** Parse a body as JSON, failing closed on wrong content-type or malformed/non-object payloads. */
export function parseJsonStrict(body: string, contentType?: string): unknown {
  const trimmed = body.trim();
  const looksJson = trimmed.startsWith("{") || trimmed.startsWith("[");
  if (contentType && /html|xml|text\/plain/i.test(contentType) && !looksJson) {
    throw new Error(`expected JSON, got content-type ${contentType}`);
  }
  if (!looksJson) throw new Error("payload is not JSON");
  const parsed: unknown = JSON.parse(trimmed); // throws on malformed
  if (parsed === null || typeof parsed !== "object") throw new Error("JSON payload is not an object");
  return parsed;
}

/** The dataset self-reported freshness date across the JSON shapes we integrate. */
export function jsonObservedDate(parsed: unknown): string | undefined {
  if (!parsed || typeof parsed !== "object") return undefined;
  const o = parsed as Record<string, unknown>;
  if (typeof o.updated === "string") return o.updated; // Eurostat / JSON-stat
  if (typeof o.public_updated_at === "string") return o.public_updated_at; // GOV.UK content API
  if (typeof o.first_published_at === "string") return o.first_published_at;
  const results = o.results;
  if (Array.isArray(results) && results[0] && typeof results[0] === "object") {
    const r0 = results[0] as Record<string, unknown>;
    if (typeof r0.publication_date === "string") return r0.publication_date; // Federal Register
  }
  return undefined;
}

/** CKAN/DCAT `metadata_modified` from package_show (result.*) or package_search (newest result). */
export function ckanMetadataModified(parsed: unknown): string | undefined {
  const result = (parsed as { result?: unknown } | null)?.result;
  if (!result || typeof result !== "object") return undefined;
  const r = result as Record<string, unknown>;
  if (typeof r.metadata_modified === "string") return r.metadata_modified;
  if (Array.isArray(r.results)) {
    const dates = r.results
      .map((d) => (d && typeof d === "object" ? (d as Record<string, unknown>).metadata_modified : undefined))
      .filter((v): v is string => typeof v === "string")
      .sort();
    return dates.at(-1);
  }
  return undefined;
}

/** Newest document ids from a Federal-Register-style feed, for dedup-by-id change detection. */
export function latestDocumentIds(parsed: unknown, n = 5): string[] {
  const results = (parsed as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  return results
    .map((d) => (d && typeof d === "object" ? (d as Record<string, unknown>).document_number : undefined))
    .filter((v): v is string => typeof v === "string")
    .slice(0, n);
}

/** Looks like a JSON-stat dataset (dimensions + values), not an error envelope or landing page. */
function isJsonStatDataset(parsed: unknown): boolean {
  const o = parsed as Record<string, unknown> | null;
  return !!o && typeof o === "object" && !!o.dimension && (o.value !== undefined || Array.isArray(o.value));
}

/** Reject a JSON *error* envelope returned with HTTP 200 (Eurostat/SDMX/REST fault shapes). */
function assertNotErrorEnvelope(parsed: unknown): void {
  const o = parsed as Record<string, unknown>;
  if (o.error !== undefined) throw new Error("JSON error envelope");
  if (o.class === "message" || o.class === "error") throw new Error("SDMX error message");
  if (typeof o.faultstring === "string") throw new Error("fault response");
  if (Array.isArray(o.errors) && o.errors.length > 0) throw new Error("errors array present");
}

/** A GOV.UK content-API document carries at least one of these identifying fields. */
function hasContentApiShape(parsed: unknown): boolean {
  const o = parsed as Record<string, unknown>;
  return (
    typeof o.public_updated_at === "string" ||
    typeof o.first_published_at === "string" ||
    typeof o.document_type === "string" ||
    typeof o.content_id === "string"
  );
}

/**
 * Changed when the content identity (digest) OR the publisher date moved — compared independently,
 * so a changed date is never ignored because the digest matched, and vice versa. When neither can
 * be compared, surface for a look (never silently "unchanged").
 */
export function isChanged(
  fresh: { digest?: string; observedDate?: string },
  prior?: PriorReading
): boolean {
  if (!prior) return true;
  const digestComparable = fresh.digest != null && prior.digest != null;
  const dateComparable = fresh.observedDate != null && prior.observedDate != null;
  if (!digestComparable && !dateComparable) return true;
  const digestChanged = digestComparable && fresh.digest !== prior.digest;
  const dateChanged = dateComparable && fresh.observedDate !== prior.observedDate;
  return digestChanged || dateChanged;
}

/** Pull one source to a validated, dated reading, per its declared change mechanism. */
export async function readSource(
  entry: SourceEntry,
  prior: PriorReading | undefined,
  fetcher: Fetcher,
  now: () => Date = () => new Date()
): Promise<SourceReading> {
  const checkedAt = now().toISOString();
  const base: SourceReading = { sourceId: entry.id, checkedAt, ok: false };
  const url = (entry.change.feedUrl ?? entry.canonicalUrl).replace("{ref}", entry.datasetRef ?? "");
  const mech = entry.change.mechanism;

  try {
    // ── Structured JSON mechanisms: fail closed on content-type / parse / shape ──
    if (
      mech === "rest_json" ||
      mech === "api_version" ||
      mech === "content_api_updated" ||
      mech === "catalog_modified" ||
      mech === "stable_id_dedup"
    ) {
      const res = await fetcher(url, { accept: "application/json" });
      if (res.status !== 200) return { ...base, error: `HTTP ${res.status}` };
      let parsed: unknown;
      try {
        parsed = parseJsonStrict(res.body, res.headers["content-type"]);
        assertNotErrorEnvelope(parsed); // a 200 JSON error body is a gap, not data
      } catch (e) {
        return { ...base, error: `invalid payload: ${e instanceof Error ? e.message : "parse failed"}` };
      }
      const rawHash = sha256(res.body);

      if (mech === "catalog_modified") {
        const success = (parsed as { success?: unknown }).success;
        const observedDate = ckanMetadataModified(parsed);
        if (success !== true || !observedDate)
          return { ...base, error: "CKAN response missing success/metadata_modified" };
        const digest = sha256(observedDate);
        return {
          ...base,
          ok: true,
          rawHash,
          digest,
          observedDate,
          dateKind: "updated",
          changed: isChanged({ digest, observedDate }, prior),
          summary: `${entry.publisher}: catalog modified ${observedDate}`,
        };
      }

      if (mech === "stable_id_dedup") {
        const ids = latestDocumentIds(parsed);
        if (ids.length === 0) return { ...base, error: "no document ids in feed" };
        const digest = sha256(ids.join(","));
        return {
          ...base,
          ok: true,
          rawHash,
          digest,
          observedDate: ids[0],
          dateKind: "published",
          changed: isChanged({ digest, observedDate: ids[0] }, prior),
          summary: `${entry.publisher}: latest doc ${ids[0]} (${ids.length} tracked)`,
        };
      }

      // Statistical datasets (JSON-stat or Eurostat/OECD SDMX JSON) must look like a dataset,
      // not an error envelope or download page. The guard runs per adapter, not one label.
      if (
        (entry.apiStandard === "json_stat" || entry.apiStandard === "sdmx") &&
        !isJsonStatDataset(parsed)
      )
        return { ...base, error: "expected a dataset (dimension/value absent)" };
      // GOV.UK content API must carry an identifying field, not an arbitrary 200 JSON body.
      if (mech === "content_api_updated" && !hasContentApiShape(parsed))
        return { ...base, error: "content API response missing identifying fields" };

      const observedDate = jsonObservedDate(parsed);
      const digest = sha256(res.body); // validated JSON body is the canonical identity
      return {
        ...base,
        ok: true,
        rawHash,
        digest,
        observedDate,
        dateKind: observedDate ? "updated" : undefined,
        fingerprintVersion: FINGERPRINT_VERSION,
        changed: isChanged({ digest, observedDate }, prior),
        summary: `${entry.publisher}: dataset pulled${observedDate ? `, updated ${observedDate}` : ""}`,
      };
    }

    // ── Document mechanisms: fingerprint normalized content; date is a separate hint ──
    if (mech === "page_date" || mech === "http_conditional") {
      const res = await fetcher(url);
      if (res.status !== 200) return { ...base, error: `HTTP ${res.status}` };
      // Guard against an accepted HTML error/challenge body masquerading as content.
      if (/access denied|request unsuccessful|<title>\s*just a moment|incident id/i.test(res.body))
        return { ...base, error: "received a block/challenge page, not content" };
      const rawHash = sha256(res.body);
      const digest = sha256(normalizeContent(res.body)); // salient content, nonce-insensitive
      const picked = extractPublisherDate(res.body);
      const lastMod = res.headers["last-modified"];
      const observedDate = picked.date ?? lastMod;
      const dateKind: DateKind = picked.date ? picked.kind : lastMod ? "http_last_modified" : "ambiguous";
      return {
        ...base,
        ok: true,
        rawHash,
        digest,
        observedDate,
        dateKind,
        fingerprintVersion: FINGERPRINT_VERSION,
        changed: isChanged({ digest, observedDate }, prior),
        summary: `${entry.publisher}${observedDate ? ` · ${dateKind} ${observedDate}` : ""}`,
      };
    }

    return { ...base, error: `mechanism '${mech}' not pulled in this prototype` };
  } catch (err) {
    return { ...base, error: err instanceof Error ? err.message : "pull failed" };
  }
}

/** Is a source due for a re-pull now, given its cadence and last successful check? */
export function isDue(entry: SourceEntry, prior: PriorReading | undefined, now: Date): boolean {
  if (!prior?.checkedAt) return true;
  const ageDays = (now.getTime() - new Date(prior.checkedAt).getTime()) / 86_400_000;
  return ageDays >= entry.change.recheckCadenceDays;
}

/** The entries a scheduled run should actually fetch: auto-retrieval only, and due by cadence. */
export function selectDue(
  entries: readonly SourceEntry[],
  priors: Record<string, PriorReading>,
  now: Date = new Date()
): SourceEntry[] {
  return entries.filter(
    (e) => (e.change.retrieval ?? "auto") !== "verify_only" && isDue(e, priors[e.id], now)
  );
}

/**
 * Execute a batch of pulls. This is a plain executor — it does NOT decide what is due (use
 * `selectDue`) and it will not fetch a `verify_only` source (those are human-verify references, e.g.
 * a WAF-blocked official site). Per-source fetcher chosen by `opts.fetcherFor`, else `fetcher`.
 */
export async function pullBatch(
  entries: readonly SourceEntry[],
  priors: Record<string, PriorReading>,
  fetcher: Fetcher,
  opts: { now?: () => Date; fetcherFor?: (entry: SourceEntry) => Fetcher } = {}
): Promise<SourceReading[]> {
  const now = opts.now ?? (() => new Date());
  const out: SourceReading[] = [];
  for (const entry of entries) {
    if ((entry.change.retrieval ?? "auto") === "verify_only") {
      out.push({
        sourceId: entry.id,
        checkedAt: now().toISOString(),
        ok: false,
        skipped: true,
        error: "verify_only: human-verify reference, not auto-fetched",
      });
      continue;
    }
    const f = opts.fetcherFor ? opts.fetcherFor(entry) : fetcher;
    out.push(await readSource(entry, priors[entry.id], f, now));
  }
  return out;
}

/** Pick the fetcher a source needs: browser-grade when flagged, else the honest default. */
export function fetcherFor(
  entry: SourceEntry,
  browser: Fetcher = fetchViaBrowser,
  plain: Fetcher = fetchViaWeb
): Fetcher {
  return entry.change.needsBrowserFetch ? browser : plain;
}

const MAX_BYTES = 8_000_000;

/** Low-level bounded GET (time + byte bound, http(s) only). NOT a pinned-fetch substitute. */
async function boundedGet(
  url: string,
  headers: Record<string, string>,
  timeoutMs = 15_000
): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  if (!/^https?:\/\//i.test(url)) throw new Error("only http(s) URLs are allowed");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { headers, redirect: "follow", signal: ctrl.signal });
    if (!/^https?:$/i.test(new URL(res.url).protocol)) throw new Error("redirected to a non-http(s) scheme");
    const buf = await res.arrayBuffer();
    const body = Buffer.from(buf.byteLength > MAX_BYTES ? buf.slice(0, MAX_BYTES) : buf).toString("utf8");
    const h: Record<string, string> = {};
    res.headers.forEach((v, k) => (h[k.toLowerCase()] = v));
    return { status: res.status, body, headers: h };
  } finally {
    clearTimeout(timer);
  }
}

/** Default fetcher: an honest descriptive UA. Right for APIs and most official pages. */
export const fetchViaWeb: Fetcher = (url, headers = {}) =>
  boundedGet(url, { "user-agent": "FADI-research-stage/0.1 (career planning)", ...headers });

/**
 * Browser-grade fetcher for public gov pages whose WAF rejects non-browser clients by UA. Sends the
 * headers a real browser sends to fetch the SAME public page a person sees — content negotiation,
 * not access-control circumvention. Use only for flagged `access: "document"` sources; APIs use the
 * honest default. Does NOT defeat IP/JS-challenge WAFs (e.g. ISD), which stay coverage gaps.
 */
export const fetchViaBrowser: Fetcher = (url, headers = {}) =>
  boundedGet(url, {
    "user-agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "accept-language": "en-IE,en;q=0.9",
    "sec-fetch-dest": "document",
    "sec-fetch-mode": "navigate",
    "sec-fetch-site": "none",
    "upgrade-insecure-requests": "1",
    ...headers,
  });
