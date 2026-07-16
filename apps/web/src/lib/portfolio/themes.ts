// Per-template accent colours. The renderer sets `--pf-accent` on <main> from
// this; every accent in the portfolio (text/border/tints via color-mix) reads
// that var, so switching template re-skins the whole site — content untouched.
//
// NOTE: the var is namespaced `--pf-accent` on purpose — Fadi's design system
// already defines a global `--accent` (globals.css), and shadowing it here would
// silently re-colour any Fadi UI rendered inside the portfolio page.

export const THEME_ACCENT: Record<string, string> = {
  "noir-gold": "#c9a84c",
  aurora: "#2dd4bf",
  minimal: "#e4e4e7",
};

export function accentFor(template: string | null | undefined): string {
  return (template && THEME_ACCENT[template]) || THEME_ACCENT["noir-gold"];
}
