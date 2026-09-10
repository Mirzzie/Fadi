/**
 * THE PORTFOLIO'S SKIN — one palette, dark by default, plus ambient background art.
 *
 * DARK FIRST, AND SOFT. The ground is a desaturated blue-charcoal, not black: pure
 * #000 under near-white text causes halation — the text appears to buzz — which is
 * the single most tiring thing a long reading page can do to someone's eyes. For the
 * same reason the body text is #e4e8ea rather than #fff: full-contrast white on a
 * black field is harsher than it looks in a screenshot and much harsher after five
 * minutes. Everything still clears WCAG AA against the ground it sits on.
 *
 * A light variant follows the reader's own OS setting, so someone who prefers light
 * is not overridden — but unset, or dark, gives dark.
 *
 * WHY GREEN. The accent marks verified evidence and nothing else, and it lifts to a
 * lighter teal-green on the dark ground because #0d7a5f goes muddy there. Green also
 * happens to be the calmest hue at this saturation; the warning colour is a warm
 * amber rather than red, because a missing artefact is a to-do, not a failure.
 *
 * The art is deliberately still. Drifting gradients look impressive for six seconds
 * and then compete with the words for the rest of the visit, so these are fixed, very
 * low alpha, and sit behind everything at z-0.
 *
 * Emitted as a scoped <style> rather than Tailwind's `dark:` variant on purpose: this
 * page renders both inside Fadi (whose <html> is permanently `dark`) and as a
 * standalone static export, and the variant would resolve differently in the two.
 */
export function PortfolioChrome() {
  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
[data-pf-template]{
  --pf-bg:#15181c;
  --pf-surface:#1c2126;
  --pf-surface-2:#232930;
  --pf-ink:#e4e8ea;
  --pf-ink-2:#a9b2b9;
  --pf-ink-3:#78838b;
  --pf-line:#2b3138;
  --pf-accent:#41c096;
  --pf-accent-soft:rgba(65,192,150,.13);
  --pf-gap:#d59155;
  --pf-gap-soft:rgba(213,145,85,.10);
  --pf-invert:#12151a;
  color-scheme:dark;
}
@media (prefers-color-scheme: light){
  [data-pf-template]{
    --pf-bg:#f4f5f3;
    --pf-surface:#ffffff;
    --pf-surface-2:#eef0ed;
    --pf-ink:#14171a;
    --pf-ink-2:#454c53;
    --pf-ink-3:#79828b;
    --pf-line:#dfe2de;
    --pf-accent:#0b6b53;
    --pf-accent-soft:rgba(11,107,83,.10);
    --pf-gap:#a54a1a;
    --pf-gap-soft:rgba(165,74,26,.06);
    --pf-invert:#f4f5f3;
    color-scheme:light;
  }
}
[data-pf-template]{background:var(--pf-bg);color:var(--pf-ink);}
[data-pf-template] ::selection{background:var(--pf-accent-soft);}
[data-pf-template] :focus-visible{outline:2px solid var(--pf-accent);outline-offset:2px;border-radius:3px;}

/* Ambient art: two soft pools of colour and a faint grid. Fixed and motionless —
   atmosphere, not animation. */
.pf-art{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden;}
.pf-art::before{
  content:"";position:absolute;inset:0;
  background:
    radial-gradient(58rem 40rem at 12% -8%, rgba(65,192,150,.10), transparent 62%),
    radial-gradient(50rem 38rem at 92% 8%, rgba(86,132,196,.09), transparent 60%);
}
.pf-art::after{
  content:"";position:absolute;inset:0;opacity:.30;
  background-image:
    linear-gradient(to right, var(--pf-line) 1px, transparent 1px),
    linear-gradient(to bottom, var(--pf-line) 1px, transparent 1px);
  background-size:76px 76px;
  mask-image:radial-gradient(70% 55% at 50% 0%, #000 20%, transparent 75%);
  -webkit-mask-image:radial-gradient(70% 55% at 50% 0%, #000 20%, transparent 75%);
}
@media (prefers-color-scheme: light){
  .pf-art::before{
    background:
      radial-gradient(58rem 40rem at 12% -8%, rgba(11,107,83,.07), transparent 62%),
      radial-gradient(50rem 38rem at 92% 8%, rgba(86,132,196,.06), transparent 60%);
  }
  .pf-art::after{opacity:.55;}
}
@media print{.pf-art{display:none;}}
`,
        }}
      />
      <div className="pf-art" aria-hidden="true" />
    </>
  );
}
