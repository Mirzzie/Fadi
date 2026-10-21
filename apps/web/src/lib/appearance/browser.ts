import { DEFAULT_APPEARANCE, MODE_KEY, PALETTE_KEY, parseAppearance, resolveDark, type Appearance } from "./preferences";

export function storedAppearance(): Appearance {
  let palette: string | null = null;
  let mode: string | null = null;
  try { palette = localStorage.getItem(PALETTE_KEY); } catch { /* session-only */ }
  try { mode = localStorage.getItem(MODE_KEY); } catch { /* session-only */ }
  return parseAppearance(palette, mode);
}

export function currentAppearance(): Appearance {
  if (typeof document === "undefined") return DEFAULT_APPEARANCE;
  return parseAppearance(document.documentElement.dataset.palette, document.documentElement.dataset.appearance);
}

export function applyAppearance(value: Appearance) {
  const appearance = parseAppearance(value.palette, value.mode);
  let systemDark = false;
  try { systemDark = matchMedia("(prefers-color-scheme:dark)").matches; } catch { /* light fallback */ }
  const dark = resolveDark(appearance.mode, systemDark);
  const root = document.documentElement;
  root.dataset.palette = appearance.palette;
  root.dataset.appearance = appearance.mode;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";
}

/** Apply even if persistence is blocked; caller can explain session-only changes. */
export function saveAppearance(value: Appearance): boolean {
  const safe = parseAppearance(value.palette, value.mode);
  applyAppearance(safe);
  let saved = true;
  try { localStorage.setItem(PALETTE_KEY, safe.palette); } catch { saved = false; }
  try { localStorage.setItem(MODE_KEY, safe.mode); } catch { saved = false; }
  return saved;
}

export function observeAppearanceChanges(): () => void {
  const systemChanged = () => applyAppearance(currentAppearance());
  const storageChanged = (event: StorageEvent) => {
    try {
      if (event.storageArea !== null && event.storageArea !== localStorage) return;
    } catch { return; }
    if (event.key === null || event.key === MODE_KEY || event.key === PALETTE_KEY) applyAppearance(storedAppearance());
  };
  let media: MediaQueryList | undefined;
  try {
    media = matchMedia("(prefers-color-scheme:dark)");
    media.addEventListener("change", systemChanged);
  } catch { /* explicit preferences still work without matchMedia */ }
  window.addEventListener("storage", storageChanged);
  return () => {
    media?.removeEventListener("change", systemChanged);
    window.removeEventListener("storage", storageChanged);
  };
}

export function subscribeAppearance(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-palette", "data-appearance"] });
  return () => observer.disconnect();
}

export function appearanceSnapshot() {
  const value = currentAppearance();
  return `${value.palette}:${value.mode}`;
}
