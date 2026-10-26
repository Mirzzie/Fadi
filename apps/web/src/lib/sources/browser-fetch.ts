import type { Fetcher } from "./refresh";

/**
 * A `Fetcher` that drives a real headless Chromium (Playwright) so a JS/cookie WAF challenge
 * resolves and the SAME public page a person would see is returned. Used only for `access:
 * "document"` sources flagged `needsBrowserFetch` (e.g. the Irish ISD site); APIs and ordinary pages
 * use the honest default fetcher. This is content negotiation to read public content, not
 * access-control circumvention.
 *
 * The browser is launched lazily and reused; call `close()` when the refresh run ends.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Playwright Browser, imported lazily.
let browser: any = null;

async function getBrowser(executablePath?: string): Promise<unknown> {
  if (browser) return browser;
  const { chromium } = await import("playwright");
  try {
    browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  } catch {
    // Fall back to Playwright's bundled browser if the given executable is incompatible.
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

const UA =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export interface HeadlessFetcher extends Fetcher {
  close(): Promise<void>;
}

export function createHeadlessFetcher(
  opts: { executablePath?: string; settleMs?: number; timeoutMs?: number } = {}
): HeadlessFetcher {
  const settleMs = opts.settleMs ?? 3500;
  const timeoutMs = opts.timeoutMs ?? 30_000;

  const fetcher: Fetcher = async (url) => {
    const b = (await getBrowser(opts.executablePath ?? "/usr/bin/chromium")) as {
      newContext(o: unknown): Promise<unknown>;
    };
    const ctx = (await b.newContext({ userAgent: UA, locale: "en-IE" })) as {
      newPage(): Promise<unknown>;
      request: { get(u: string): Promise<{ status(): number; body(): Promise<Buffer> }> };
      close(): Promise<void>;
    };
    try {
      // Record every main-frame DOCUMENT response so we can report the status of the FINAL
      // navigation (a WAF challenge that resolves reloads to a real 200; a hard block stays 403).
      const docResponses: { status: number; url: string; headers: Record<string, string> }[] = [];
      const page = (await ctx.newPage()) as {
        on(ev: string, cb: (r: unknown) => void): void;
        mainFrame(): unknown;
        goto(u: string, o: unknown): Promise<{ status(): number; headers(): Record<string, string>; url(): string } | null>;
        waitForTimeout(ms: number): Promise<void>;
        content(): Promise<string>;
      };
      page.on("response", (r: unknown) => {
        const resp = r as {
          request(): { resourceType(): string; frame(): unknown };
          status(): number;
          url(): string;
          headers(): Record<string, string>;
        };
        try {
          if (resp.request().resourceType() === "document" && resp.request().frame() === page.mainFrame())
            docResponses.push({ status: resp.status(), url: resp.url(), headers: resp.headers() });
        } catch {
          /* response went away; ignore */
        }
      });

      const nav = await page.goto(url, { waitUntil: "domcontentloaded", timeout: timeoutMs });
      await page.waitForTimeout(settleMs); // let any JS challenge complete and reload the real page

      const ct = nav?.headers()["content-type"] ?? "";
      if (/pdf/i.test(ct) || url.toLowerCase().endsWith(".pdf")) {
        // For a PDF, download bytes through the browser context (it carries any WAF cookie now).
        const r = await ctx.request.get(url);
        return { status: r.status(), body: (await r.body()).toString("latin1"), headers: nav?.headers() ?? {} };
      }

      const body = await page.content();
      // The ACTUAL final document status — never inferred from body size. A 403/404/503 stays that.
      const finalDoc = docResponses.at(-1);
      const status = finalDoc?.status ?? nav?.status() ?? 0;
      const headers = finalDoc?.headers ?? nav?.headers() ?? {};
      return { status, body, headers };
    } finally {
      await ctx.close();
    }
  };

  return Object.assign(fetcher, {
    close: async () => {
      if (browser) {
        await (browser as { close(): Promise<void> }).close();
        browser = null;
      }
    },
  });
}
