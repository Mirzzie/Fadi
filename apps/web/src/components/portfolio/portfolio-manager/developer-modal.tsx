"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { Modal } from "./modal";

/** "API & SDK" dialog: headless endpoint snippets + static-snapshot / live-embed export. */
export function DeveloperModal({
  handle,
  published,
  onClose,
}: {
  handle: string;
  published: boolean;
  onClose: () => void;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-fadi-host";
  const api = `${origin}/api/portfolio/${handle}`;
  const [copied, setCopied] = useState<string | null>(null);

  const snippets: { label: string; code: string }[] = [
    { label: "REST API", code: api },
    {
      label: "Fetch (any site)",
      code: `const res = await fetch("${api}");\nconst portfolio = await res.json();\n// { site, items }`,
    },
    {
      label: "Embed (drop-in, zero JS)",
      code: `<div id="portfolio"></div>\n<script src="${origin}/portfolio.js"\n        data-handle="${handle}" data-target="#portfolio"></script>`,
    },
    {
      label: "SDK (render or read)",
      code: `<script src="${origin}/portfolio.js"></script>\n<script>\n  // render into an element:\n  FadiPortfolio.mount("${handle}", "#portfolio");\n  // …or just get the data:\n  FadiPortfolio.get("${handle}").then(console.log);\n</script>`,
    },
    {
      label: "React",
      code: `import { useEffect, useState } from "react";\n\nexport function Portfolio() {\n  const [data, setData] = useState(null);\n  useEffect(() => {\n    fetch("${api}").then((r) => r.json()).then(setData);\n  }, []);\n  if (!data) return null;\n  return <pre>{JSON.stringify(data, null, 2)}</pre>;\n}`,
    },
  ];

  function copy(code: string, label: string) {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(label);
      setTimeout(() => setCopied((c) => (c === label ? null : c)), 1500);
    });
  }

  const [busy, setBusy] = useState(false);

  function save(html: string) {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "index.html";
    a.click();
    URL.revokeObjectURL(url);
  }

  // Live embed — tiny file, always fresh; needs Fadi online + published.
  function downloadEmbed() {
    save(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${handle} — Portfolio</title>
</head>
<body style="margin:0;background:#0a0a0b">
<div id="portfolio"></div>
<script src="${origin}/portfolio.js" data-handle="${handle}" data-target="#portfolio"></script>
</body>
</html>
`);
  }

  // Static snapshot — self-contained (SDK + data baked in). Works on GitHub Pages
  // and any static host with NO server and even if Fadi is offline. Re-export to
  // refresh. This is the "host it anywhere on your own domain" option.
  async function downloadSnapshot() {
    setBusy(true);
    try {
      const [sdk, res] = await Promise.all([
        fetch(`${origin}/portfolio.js`).then((r) => r.text()),
        fetch(api),
      ]);
      if (!res.ok) throw new Error("Publish your site first, then export.");
      const data = await res.json();
      // Inlining into a <script> is unsafe raw: any "</script>" would close the tag early
      // and break the page. Escape `<` in the DATA, and `</script` in the SDK — the SDK's
      // own doc comment contains example </script> tags, so inlining it raw broke the page
      // (FadiPortfolio never defined, nothing rendered). Verified by rendering offline.
      const safeData = JSON.stringify(data).replace(/</g, "\\u003c");
      const safeSdk = sdk.replace(/<\/(script)/gi, "<\\/$1");
      save(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${(data.site?.profile?.name || data.site?.title || handle)} — Portfolio</title>
</head>
<body style="margin:0;background:#0a0a0b">
<div id="portfolio"></div>
<script>${safeSdk}</script>
<script>FadiPortfolio.mountData(${safeData}, "#portfolio");</script>
</body>
</html>
`);
    } catch (e) {
      setCopied(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="API & SDK — use this portfolio on any website" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Your portfolio is a headless content source. Any website — React, Astro, WordPress, plain
          HTML — can read it over this public, CORS-open JSON API, or embed it with one line.
        </p>
        {!published && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            Heads up: the API only returns content while your site is <strong>Published</strong>.
            It’s currently a draft.
          </div>
        )}
        <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
          <div>
            <p className="text-sm font-medium">Host on your own domain (GitHub Pages, Netlify, …)</p>
            <p className="text-xs text-muted-foreground">
              Download an <code>index.html</code>, drop it on any static host, and point your
              purchased domain at it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={downloadSnapshot} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
              Static snapshot
            </Button>
            <Button size="sm" variant="outline" onClick={downloadEmbed}>
              <Download className="size-4" /> Live embed
            </Button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            <strong>Static snapshot</strong> bakes your data in — fully self-contained, works offline
            and on GitHub Pages with no server (re-export to refresh). <strong>Live embed</strong> is
            a tiny file that always shows your latest, but needs Fadi online.
          </p>
        </div>
        {snippets.map((s) => (
          <div key={s.label} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{s.label}</Label>
              <button
                type="button"
                onClick={() => copy(s.code, s.label)}
                className="text-xs text-amber-400 hover:underline"
              >
                {copied === s.label ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="overflow-x-auto rounded-md border border-border bg-muted/40 p-3 text-xs text-foreground/90">
              <code>{s.code}</code>
            </pre>
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Fields: <code>site</code> (handle, title, headline, template, theme, profile, resumeLinks)
          and <code>items[]</code> (section, title, subtitle, location, dateRange, description,
          bullets, roles, tag, url, imageUrl, gallery).
        </p>
      </div>
    </Modal>
  );
}
