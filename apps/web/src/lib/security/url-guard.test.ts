import { describe, expect, it } from "vitest";

import {
  fetchSafeUrl,
  isBlockedHostLiteral,
  parseSafeUrl,
  readTextBodyLimited,
  ResponseBodyTooLargeError,
  UnsafeFetchUrlError,
} from "./url-guard";

describe("isBlockedHostLiteral", () => {
  it("blocks loopback, localhost, link-local + cloud metadata, and private ranges", () => {
    for (const h of [
      "localhost",
      "app.localhost",
      "127.0.0.1",
      "169.254.169.254", // AWS/GCP metadata
      "metadata.google.internal",
      "10.0.0.5",
      "192.168.1.1",
      "172.16.0.1",
      "100.64.0.1", // CGNAT
      "::1",
      "fd00::1",
    ]) {
      expect(isBlockedHostLiteral(h), h).toBe(true);
    }
  });

  it("allows real public hosts", () => {
    for (const h of ["jobs.example.com", "8.8.8.8", "203.0.113.10", "linkedin.com"]) {
      expect(isBlockedHostLiteral(h), h).toBe(false);
    }
  });
});

describe("parseSafeUrl", () => {
  it("rejects non-http(s) schemes and internal hosts", () => {
    expect(parseSafeUrl("file:///etc/passwd")).toBeNull();
    expect(parseSafeUrl("http://169.254.169.254/latest/meta-data/")).toBeNull();
    expect(parseSafeUrl("http://localhost:3000/admin")).toBeNull();
    expect(parseSafeUrl("ftp://example.com")).toBeNull();
    expect(parseSafeUrl("not a url")).toBeNull();
  });

  it("accepts ordinary public postings", () => {
    expect(parseSafeUrl("https://jobs.example.com/123")?.hostname).toBe("jobs.example.com");
  });
});

describe("fetchSafeUrl", () => {
  it("revalidates a redirect before following it", async () => {
    const called: string[] = [];
    const fetchImpl = async (input: string | URL | Request) => {
      called.push(String(input));
      return new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1:3000/admin" },
      });
    };

    await expect(
      fetchSafeUrl(
        "https://public.example/start",
        {},
        {
          fetch: fetchImpl as typeof fetch,
          isSafe: async (url) => !url.includes("127.0.0.1"),
        }
      )
    ).rejects.toBeInstanceOf(UnsafeFetchUrlError);
    expect(called).toEqual(["https://public.example/start"]);
  });

  it("does not forward credentials to a different origin", async () => {
    const seen: Array<{ url: string; authorization: string | null }> = [];
    const fetchImpl = async (input: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      seen.push({ url: String(input), authorization: headers.get("authorization") });
      return seen.length === 1
        ? new Response(null, { status: 307, headers: { location: "https://other.example/rpc" } })
        : new Response("ok", { status: 200 });
    };

    const response = await fetchSafeUrl(
      "https://mcp.example/rpc",
      { headers: { Authorization: "Bearer secret" } },
      { fetch: fetchImpl as typeof fetch, isSafe: async () => true }
    );

    expect(response.status).toBe(200);
    expect(seen).toEqual([
      { url: "https://mcp.example/rpc", authorization: "Bearer secret" },
      { url: "https://other.example/rpc", authorization: null },
    ]);
  });
});

describe("readTextBodyLimited", () => {
  it("reads a response within the byte limit", async () => {
    await expect(readTextBodyLimited(new Response("small"), 5)).resolves.toBe("small");
  });

  it("rejects a declared oversized response before buffering it", async () => {
    const response = new Response("ignored", { headers: { "content-length": "1000" } });
    await expect(readTextBodyLimited(response, 10)).rejects.toBeInstanceOf(
      ResponseBodyTooLargeError
    );
  });

  it("stops a streamed response that grows beyond the limit", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("12345"));
        controller.enqueue(new TextEncoder().encode("67890"));
        controller.close();
      },
    });
    await expect(readTextBodyLimited(new Response(body), 8)).rejects.toBeInstanceOf(
      ResponseBodyTooLargeError
    );
  });
});
