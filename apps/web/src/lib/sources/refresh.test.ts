import { describe, expect, it, vi } from "vitest";

import type { SourceEntry } from "./registry";
import {
  type Fetcher,
  ckanMetadataModified,
  extractPublisherDate,
  fetcherFor,
  isChanged,
  isDue,
  jsonObservedDate,
  latestDocumentIds,
  normalizeContent,
  parseJsonStrict,
  pullBatch,
  readSource,
  selectDue,
} from "./refresh";

/**
 * Correctness-focused tests for the Research-stage puller, including the regressions from Codex's
 * 26 Oct review: nonce-only vs material edits, effective-vs-publication dates, invalid payloads,
 * independent date/digest comparison, and enforced verify-only retrieval.
 */

const at = () => new Date("2026-10-26T12:00:00Z");

function entry(
  over: Partial<Omit<SourceEntry, "change">> & { change?: Partial<SourceEntry["change"]> } = {}
): SourceEntry {
  const { change, ...rest } = over;
  return {
    id: "t",
    domain: "right_to_work",
    jurisdiction: "IE",
    publisher: "Test Publisher",
    canonicalUrl: "https://example.test/page",
    authority: "official",
    access: "document",
    verification: "verified",
    predicates: ["x"],
    scope: "global",
    ...rest,
    change: { mechanism: "page_date", recheckCadenceDays: 7, ...change },
  } as SourceEntry;
}

function canned(body: string, status = 200, headers: Record<string, string> = {}) {
  const urls: string[] = [];
  const fetcher: Fetcher = async (url) => {
    urls.push(url);
    return { status, body, headers };
  };
  return { fetcher, urls };
}

describe("normalizeContent", () => {
  it("strips tags, scripts and long opaque tokens so nonces don't look like content", () => {
    const a = normalizeContent('<input name="csrf" value="deadbeefdeadbeefdeadbeef01"><p>Fee €40,904</p><script>x=1</script>');
    const b = normalizeContent('<input name="csrf" value="0011223344556677889900aa"><p>Fee €40,904</p><script>x=2</script>');
    expect(a).toBe(b);
  });
  it("keeps a changed figure visible", () => {
    expect(normalizeContent("<p>Fee €40,904</p>")).not.toBe(normalizeContent("<p>Fee €45,000</p>"));
  });
});

describe("extractPublisherDate — never relabel an effective date as 'updated'", () => {
  it("reads an explicit updated date as updated", () => {
    expect(extractPublisherDate("Last updated: 2 December 2025")).toEqual({ date: "2 December 2025", kind: "updated" });
  });
  it("reads a published date as published", () => {
    expect(extractPublisherDate("Published 2 December 2025")).toEqual({ date: "2 December 2025", kind: "published" });
  });
  it("classifies an effective/as-of date distinctly, not as the publication date", () => {
    expect(extractPublisherDate("Thresholds effective from 1 March 2026")).toEqual({
      date: "1 March 2026",
      kind: "effective_or_asof",
    });
    expect(extractPublisherDate("as of 23 October 2026")).toEqual({ date: "23 October 2026", kind: "effective_or_asof" });
  });
  it("marks a bare body date as ambiguous, not authoritative", () => {
    expect(extractPublisherDate("the figure of 1 March 2026 applies")).toEqual({
      date: "1 March 2026",
      kind: "ambiguous",
    });
  });
  it("reports no date rather than inventing one", () => {
    expect(extractPublisherDate("no dates here")).toEqual({ kind: "ambiguous" });
  });
});

describe("page_date change detection (the core P1 regression)", () => {
  it("a nonce-only change with the same date is NOT a change", async () => {
    const d = "as of 1 March 2026";
    const { fetcher: f1 } = canned(`<input value="aaaaaaaaaaaaaaaaaaaaaaaa"><p>€40,904 ${d}</p>`);
    const { fetcher: f2 } = canned(`<input value="zzzzzzzzzzzzzzzzzzzzzzzz"><p>€40,904 ${d}</p>`);
    const first = await readSource(entry({}), undefined, f1, at);
    const second = await readSource(entry({}), { digest: first.digest, observedDate: first.observedDate }, f2, at);
    expect(second.changed).toBe(false);
  });

  it("a MATERIAL edit with the SAME date IS a change (no false negative)", async () => {
    const d = "as of 1 March 2026";
    const { fetcher: f1 } = canned(`<p>Critical Skills €40,904 ${d}</p>`);
    const { fetcher: f2 } = canned(`<p>Critical Skills €45,000 ${d}</p>`);
    const first = await readSource(entry({}), undefined, f1, at);
    const second = await readSource(entry({}), { digest: first.digest, observedDate: first.observedDate }, f2, at);
    expect(first.observedDate).toBe("1 March 2026");
    expect(second.changed).toBe(true);
  });

  it("rejects a block/challenge page instead of recording it as content", async () => {
    const { fetcher } = canned("<html><body>Access Denied — incident id 123</body></html>");
    const r = await readSource(entry({}), undefined, fetcher, at);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/block|challenge/i);
  });
});

describe("structured mechanisms fail closed on bad payloads (P1)", () => {
  it("rejects non-JSON under a JSON mechanism", async () => {
    const { fetcher } = canned("<html>Download</html>", 200, { "content-type": "text/html" });
    const r = await readSource(entry({ apiStandard: "json_stat", change: { mechanism: "api_version" } }), undefined, fetcher, at);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid payload|expected json/i);
  });
  it("rejects malformed JSON", async () => {
    const { fetcher } = canned('{"updated": ', 200, { "content-type": "application/json" });
    const r = await readSource(entry({ change: { mechanism: "rest_json" } }), undefined, fetcher, at);
    expect(r.ok).toBe(false);
  });
  it("rejects a JSON-stat endpoint that returns no dataset", async () => {
    const { fetcher } = canned(JSON.stringify({ updated: "2026", error: "bad" }), 200, { "content-type": "application/json" });
    const r = await readSource(entry({ apiStandard: "json_stat", change: { mechanism: "api_version" } }), undefined, fetcher, at);
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/json-stat/i);
  });
  it("accepts a real JSON-stat dataset", async () => {
    const body = JSON.stringify({ updated: "2026-07-31", dimension: { time: {} }, value: [1, 2] });
    const { fetcher } = canned(body, 200, { "content-type": "application/json" });
    const r = await readSource(entry({ apiStandard: "json_stat", change: { mechanism: "api_version" } }), undefined, fetcher, at);
    expect(r.ok).toBe(true);
    expect(r.observedDate).toBe("2026-07-31");
  });
  it("rejects an empty stable-id feed instead of hashing the empty string", async () => {
    const { fetcher } = canned(JSON.stringify({ results: [] }), 200, { "content-type": "application/json" });
    const r = await readSource(entry({ change: { mechanism: "stable_id_dedup" } }), undefined, fetcher, at);
    expect(r.ok).toBe(false);
  });
  it("rejects a CKAN response without success/metadata_modified", async () => {
    const { fetcher } = canned(JSON.stringify({ success: false }), 200, { "content-type": "application/json" });
    const r = await readSource(entry({ change: { mechanism: "catalog_modified" } }), undefined, fetcher, at);
    expect(r.ok).toBe(false);
  });
  it("accepts a valid CKAN package_show", async () => {
    const body = JSON.stringify({ success: true, result: { metadata_modified: "2026-10-21T01:00:00" } });
    const { fetcher } = canned(body, 200, { "content-type": "application/json" });
    const r = await readSource(entry({ change: { mechanism: "catalog_modified" } }), undefined, fetcher, at);
    expect(r.ok).toBe(true);
    expect(r.observedDate).toBe("2026-10-21T01:00:00");
  });
  it("treats a non-200 as a coverage gap with no digest", async () => {
    const { fetcher } = canned("nope", 403);
    const r = await readSource(entry({ change: { mechanism: "rest_json" } }), undefined, fetcher, at);
    expect(r.ok).toBe(false);
    expect(r.digest).toBeUndefined();
  });
});

describe("isChanged compares date and digest independently (P2)", () => {
  it("never seen before → changed", () => expect(isChanged({ digest: "a" }, undefined)).toBe(true));
  it("same digest AND same date → unchanged", () =>
    expect(isChanged({ digest: "a", observedDate: "d" }, { digest: "a", observedDate: "d" })).toBe(false));
  it("same digest but DIFFERENT date → changed (date not ignored)", () =>
    expect(isChanged({ digest: "a", observedDate: "d2" }, { digest: "a", observedDate: "d1" })).toBe(true));
  it("different digest but same date → changed", () =>
    expect(isChanged({ digest: "b", observedDate: "d" }, { digest: "a", observedDate: "d" })).toBe(true));
  it("nothing comparable → surface for a look", () => expect(isChanged({}, { digest: "a" })).toBe(true));
});

describe("helpers", () => {
  it("parseJsonStrict rejects html", () => expect(() => parseJsonStrict("<html>", "text/html")).toThrow());
  it("jsonObservedDate reads GOV.UK and Federal Register shapes", () => {
    expect(jsonObservedDate({ public_updated_at: "2024-10-31" })).toBe("2024-10-31");
    expect(jsonObservedDate({ results: [{ publication_date: "2026-10-06" }] })).toBe("2026-10-06");
  });
  it("ckanMetadataModified takes the newest from package_search", () => {
    expect(
      ckanMetadataModified({ result: { results: [{ metadata_modified: "2022-01-03" }, { metadata_modified: "2026-10-21" }] } })
    ).toBe("2026-10-21");
  });
  it("latestDocumentIds collects document numbers", () =>
    expect(latestDocumentIds({ results: [{ document_number: "2026-1" }] })).toEqual(["2026-1"]));
});

describe("due selection and verify-only enforcement (P2)", () => {
  it("isDue is true with no prior and false within the cadence window", () => {
    const e = entry({ change: { recheckCadenceDays: 7 } });
    expect(isDue(e, undefined, at())).toBe(true);
    expect(isDue(e, { checkedAt: "2026-10-24T12:00:00Z" }, at())).toBe(false); // 2 days
    expect(isDue(e, { checkedAt: "2026-10-10T12:00:00Z" }, at())).toBe(true); // 16 days
  });

  it("selectDue excludes verify_only and not-due sources", () => {
    const due = entry({ id: "due", change: { recheckCadenceDays: 7 } });
    const vonly = entry({ id: "vonly", change: { retrieval: "verify_only" } });
    const fresh = entry({ id: "fresh", change: { recheckCadenceDays: 7 } });
    const picked = selectDue([due, vonly, fresh], { fresh: { checkedAt: "2026-10-25T12:00:00Z" } }, at());
    expect(picked.map((e) => e.id)).toEqual(["due"]);
  });

  it("pullBatch NEVER fetches a verify_only source", async () => {
    const spy = vi.fn<Fetcher>(async () => ({ status: 200, body: "x", headers: {} }));
    const vonly = entry({ id: "isd", change: { retrieval: "verify_only" } });
    const readings = await pullBatch([vonly], {}, spy, { now: at });
    expect(spy).not.toHaveBeenCalled();
    expect(readings[0]).toMatchObject({ sourceId: "isd", ok: false, skipped: true });
  });

  it("pullBatch routes each source through fetcherFor", async () => {
    const browser: Fetcher = async () => ({ status: 200, body: "B via browser as of 1 March 2026", headers: {} });
    const plain: Fetcher = async () => ({ status: 200, body: "P plain as of 1 March 2026", headers: {} });
    const soft = entry({ id: "soft", change: { needsBrowserFetch: true } });
    const api = entry({ id: "api", change: {} });
    expect(fetcherFor(soft, browser, plain)).toBe(browser);
    expect(fetcherFor(api, browser, plain)).toBe(plain);
    const readings = await pullBatch([soft], {}, plain, { now: at, fetcherFor: (e) => fetcherFor(e, browser, plain) });
    expect(readings[0].summary).toContain("Test Publisher");
  });
});
