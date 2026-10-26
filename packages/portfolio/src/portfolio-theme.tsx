/**
 * Portfolio presentation projects the same semantic palette as the app and export.
 * Appearance belongs to this visitor's device, never to the published career data.
 * Hosts install the shared appearance stylesheet and before-paint bootstrap.
 */
export function PortfolioChrome() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
[data-pf-template]{
  --pf-bg:var(--background);
  --pf-surface:var(--card);
  --pf-surface-2:var(--muted);
  --pf-ink:var(--foreground);
  --pf-ink-2:var(--muted-foreground);
  --pf-ink-3:var(--muted-foreground);
  --pf-line:var(--border);
  --pf-accent:var(--primary);
  --pf-accent-soft:color-mix(in srgb, var(--primary) 12%, var(--background));
  --pf-gap:var(--warning);
  --pf-gap-soft:color-mix(in srgb, var(--warning) 10%, var(--background));
  --pf-invert:var(--background);
}
[data-pf-template]{background:var(--pf-bg);color:var(--pf-ink);}
[data-pf-template] ::selection{background:var(--pf-accent-soft);color:var(--pf-ink);}
[data-pf-template] :focus-visible{outline:2px solid var(--pf-accent);outline-offset:3px;border-radius:3px;}

/* Still, low-contrast atmosphere. Reading stays on opaque surfaces. */
.pf-art{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;}
.pf-art::before{
  content:"";position:absolute;inset:0;
  background:radial-gradient(58rem 40rem at 12% -8%, color-mix(in srgb, var(--primary) 7%, transparent), transparent 62%);
}
.pf-art::after{
  content:"";position:absolute;inset:0;opacity:.24;
  background-image:
    linear-gradient(to right, var(--pf-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--pf-line) 1px, transparent 1px);
  background-size:76px 76px;
  mask-image:radial-gradient(70% 55% at 50% 0%, #000 20%, transparent 75%);
  -webkit-mask-image:radial-gradient(70% 55% at 50% 0%, #000 20%, transparent 75%);
}
@media (prefers-contrast: more), (forced-colors: active){.pf-art{display:none;}}
@media print{.pf-art{display:none;}}
`,
        }}
      />
      <div className="pf-art" aria-hidden="true" />
    </>
  );
}
