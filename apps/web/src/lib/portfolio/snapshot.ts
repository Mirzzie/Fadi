/**
 * Build the self-contained portfolio `index.html` — pure, no I/O.
 *
 * This is the single renderer for the "static snapshot": the `portfolio.js` SDK and the
 * portfolio JSON baked into one file that runs on any static host (GitHub Pages,
 * Netlify, offline) with no server. The client download and the server-side GitHub
 * publish (ADR 0008) both call this, so there is exactly one snapshot format, not two
 * that can drift.
 */

/**
 * Inline JSON safely inside a <script> tag. A literal "</script>" anywhere in the data
 * (a description, a URL) would close the tag early and break the page or inject markup;
 * escaping "<" makes the payload unable to break out. Mirrors the client snapshot.
 */
export function inlineJson(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

/**
 * Inline raw JavaScript inside a <script> tag. The one thing that can break out is a
 * literal "</script" sequence (case-insensitive) — and the SDK's own doc comment contains
 * example `</script>` tags, so inlining it raw closed the tag early and the whole page
 * failed to define `FadiPortfolio` (nothing rendered). Escaping the slash keeps the JS
 * byte-identical to the parser while making it impossible to break out.
 */
export function inlineScript(js: string): string {
  return js.replace(/<\/(script)/gi, "<\\/$1");
}

/** Best-effort human title from the portfolio view, with safe fallbacks. */
export function snapshotTitle(view: {
  site?: { profile?: { name?: string } | null; title?: string | null };
  handle?: string;
}): string {
  return (
    view.site?.profile?.name ||
    view.site?.title ||
    view.handle ||
    "Portfolio"
  );
}

/** HTML-escape text destined for an element/attribute (the <title>). */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * The finished, deployable page. `sdk` is the contents of `/portfolio.js`; `view` is the
 * Content-API shape (`toPortfolioView`). No trailing server dependency — it renders from
 * the baked-in data via `FadiPortfolio.mountData`.
 */
export function buildSnapshotHtml(args: { sdk: string; view: unknown; handle: string }): string {
  const title = escapeHtml(
    snapshotTitle({ ...(args.view as Record<string, unknown>), handle: args.handle }),
  );
  const data = inlineJson(args.view);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title} — Portfolio</title>
</head>
<body style="margin:0;background:#0a0a0b">
<div id="portfolio"></div>
<script>${inlineScript(args.sdk)}</script>
<script>FadiPortfolio.mountData(${data}, "#portfolio");</script>
</body>
</html>
`;
}
