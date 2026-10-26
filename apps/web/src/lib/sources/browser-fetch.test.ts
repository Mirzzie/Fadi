import { createServer, type Server } from "node:http";
import { existsSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createHeadlessFetcher, type HeadlessFetcher } from "./browser-fetch";

/**
 * Regression for Codex's P1: the headless fetcher must report the ACTUAL final HTTP status, never
 * infer 200 from body size. Drives real Chromium against a local server. Skips where Chromium is
 * not installed (the behaviour is still covered by the status contract).
 */
const CHROMIUM = "/usr/bin/chromium";
const suite = existsSync(CHROMIUM) ? describe : describe.skip;

suite("headless fetcher reports the real status", () => {
  let server: Server;
  let port = 0;
  let fetcher: HeadlessFetcher;

  beforeAll(async () => {
    server = createServer((req, res) => {
      if (req.url === "/ok") {
        res.writeHead(200, { "content-type": "text/html" });
        res.end("<html><body><h1>Real page</h1><p>as of 1 March 2026</p></body></html>");
      } else if (req.url === "/redir") {
        res.writeHead(302, { location: "/ok" });
        res.end();
      } else {
        // A large (3KB+) block page, but still HTTP 403.
        res.writeHead(403, { "content-type": "text/html" });
        res.end(`<html><body>Access denied.${"x".repeat(3000)}</body></html>`);
      }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    port = (server.address() as { port: number }).port;
    fetcher = createHeadlessFetcher({ executablePath: CHROMIUM, settleMs: 300 });
  }, 60_000);

  afterAll(async () => {
    await fetcher?.close();
    await new Promise<void>((r) => server.close(() => r()));
  });

  it("a large 403 block page is reported as 403, not 200", async () => {
    const r = await fetcher(`http://127.0.0.1:${port}/blocked`);
    expect(r.status).toBe(403);
    expect(r.body.length).toBeGreaterThan(2000);
  }, 60_000);

  it("a real 200 page is reported as 200", async () => {
    const r = await fetcher(`http://127.0.0.1:${port}/ok`);
    expect(r.status).toBe(200);
    expect(r.body).toContain("Real page");
  }, 60_000);

  it("follows a redirect and reports the final 200", async () => {
    const r = await fetcher(`http://127.0.0.1:${port}/redir`);
    expect(r.status).toBe(200);
    expect(r.body).toContain("Real page");
  }, 60_000);
});
