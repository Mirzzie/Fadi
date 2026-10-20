import "server-only";

import { getKv } from "@/lib/kv/store";
import { logger } from "@/lib/observability/logger";
import { fetchSafeUrl, isSafeFetchUrl } from "@/lib/security/url-guard";
import { detectClosedSignal, type PostingLiveness } from "./liveness-detect";

export type { LivenessState, PostingLiveness } from "./liveness-detect";
export { detectClosedSignal } from "./liveness-detect";

// Network checks are slow and rate-limit-prone, so cache per URL for a while.
// Shared KV (not a process Map) so multiple instances don't re-probe the same URL.
const LIVENESS_TTL_SECONDS = 10 * 60;
const FETCH_TIMEOUT_MS = 4000;
const MAX_BODY_BYTES = 24 * 1024; // enough to catch a banner/headline, not the whole page

/**
 * Read only the response prefix needed by the liveness detector.
 *
 * `arrayBuffer().slice(...)` placed the limit after the download, so a server could
 * still make Fadi buffer an arbitrarily large body. Cancel the stream as soon as the
 * bounded prefix is available. The streaming decoder preserves a multibyte character
 * split across network chunks.
 */
export async function readBodyPrefix(
  body: ReadableStream<Uint8Array> | null,
  maxBytes = MAX_BODY_BYTES
): Promise<string> {
  if (!body || maxBytes <= 0) return "";
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: false });
  let read = 0;
  let text = "";

  try {
    while (read < maxBytes) {
      const next = await reader.read();
      if (next.done) break;
      const remaining = maxBytes - read;
      const chunk =
        next.value.byteLength > remaining ? next.value.subarray(0, remaining) : next.value;
      read += chunk.byteLength;
      text += decoder.decode(chunk, { stream: true });
      if (next.value.byteLength > remaining || read === maxBytes) {
        await reader.cancel().catch(() => undefined);
        break;
      }
    }
    return text + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

async function readCache(url: string): Promise<PostingLiveness | null> {
  try {
    const raw = await getKv().get(`liveness:${url}`);
    return raw ? (JSON.parse(raw) as PostingLiveness) : null;
  } catch {
    return null;
  }
}

async function writeCache(url: string, result: PostingLiveness): Promise<void> {
  try {
    await getKv().set(`liveness:${url}`, JSON.stringify(result), LIVENESS_TTL_SECONDS);
  } catch {
    // best-effort cache
  }
}

/**
 * Best-effort liveness probe for a posting URL. Never throws — any failure
 * resolves to "unknown" so a flaky source can't break the workspace.
 */
export async function checkPostingLiveness(url: string): Promise<PostingLiveness> {
  const cached = await readCache(url);
  if (cached) return cached;

  // SSRF guard: job URLs come from external aggregators/scrapers, so never let the
  // server fetch an internal target (cloud metadata, localhost, private ranges).
  if (!(await isSafeFetchUrl(url))) {
    logger.warn("jobs.liveness.blocked_url", { reason: "ssrf_guard" });
    const result: PostingLiveness = {
      state: "unknown",
      reason: "Couldn't safely verify this link",
      checkedAt: new Date().toISOString(),
    };
    await writeCache(url, result);
    return result;
  }

  let result: PostingLiveness;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetchSafeUrl(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        // A plausible UA — many boards 403 a bare fetch, which we treat as unknown.
        "User-Agent": "Mozilla/5.0 (compatible; Fadi/1.0; +https://careeros.app) freshness-check",
        Accept: "text/html,application/xhtml+xml",
      },
    });

    let snippet = "";
    try {
      snippet = await readBodyPrefix(res.body);
    } catch {
      snippet = "";
    }

    result = detectClosedSignal(res.status, snippet);
  } catch (err) {
    result = {
      state: "unknown",
      reason:
        err instanceof Error && err.name === "AbortError"
          ? "Check timed out"
          : "Couldn't reach the source",
      checkedAt: new Date().toISOString(),
    };
  } finally {
    clearTimeout(timer);
  }

  await writeCache(url, result);
  logger.info("jobs.liveness.checked", { state: result.state, reason: result.reason });
  return result;
}
