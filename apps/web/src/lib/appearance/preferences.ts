/** One device-local preference; no account data or second theme store. */
export const PALETTES = ["ember", "iris", "cobalt"] as const;
export const MODES = ["system", "light", "dark"] as const;
export type Palette = (typeof PALETTES)[number];
export type AppearanceMode = (typeof MODES)[number];
export type Appearance = { palette: Palette; mode: AppearanceMode };
export const DEFAULT_APPEARANCE: Appearance = { palette: "ember", mode: "system" };
export const PALETTE_KEY = "fadi:palette";
// Keep the existing key so an explicitly selected light/dark mode survives the upgrade.
export const MODE_KEY = "theme";

export function parseAppearance(palette: unknown, mode: unknown): Appearance {
  return {
    palette: PALETTES.includes(palette as Palette) ? (palette as Palette) : "ember",
    mode: MODES.includes(mode as AppearanceMode) ? (mode as AppearanceMode) : "system",
  };
}

export function resolveDark(mode: AppearanceMode, systemDark: boolean) {
  return mode === "dark" || (mode === "system" && systemDark);
}

// Synchronous, before hydration. Storage failure must not skip the OS preference.
// Literal validated values only: stored text is never interpolated into executable code.
export const APPEARANCE_BOOTSTRAP = `(function(){var p='ember',m='system';try{var s=localStorage.getItem('${PALETTE_KEY}');if(${JSON.stringify(PALETTES)}.includes(s))p=s;}catch(e){}try{var t=localStorage.getItem('${MODE_KEY}');if(${JSON.stringify(MODES)}.includes(t))m=t;}catch(e){}var d=m==='dark';try{if(m==='system')d=matchMedia('(prefers-color-scheme:dark)').matches;}catch(e){}var r=document.documentElement;r.dataset.palette=p;r.dataset.appearance=m;r.classList.toggle('dark',d);r.style.colorScheme=d?'dark':'light';})();`;
