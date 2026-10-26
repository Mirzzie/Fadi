import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { APPEARANCE_BOOTSTRAP, MODES, PALETTES, parseAppearance, resolveDark } from "./preferences";
import { applyAppearance, currentAppearance, observeAppearanceChanges, saveAppearance } from "./browser";

function fixture(values: Record<string, string> = {}, systemDark = false, blocked = false) {
  const stored = new Map(Object.entries(values));
  const root = { dataset: {} as Record<string, string>, style: {} as Record<string, string>, dark: false, classList: { toggle(_name: string, value: boolean) { root.dark = value; } } };
  const storage = { getItem(key: string) { if (blocked) throw Error("blocked"); return stored.get(key) ?? null; }, setItem(key: string, value: string) { if (blocked) throw Error("blocked"); stored.set(key, value); } };
  const listeners: Record<string, ((event?: unknown) => void) | undefined> = {};
  const media = { matches: systemDark, addEventListener: vi.fn((_name, fn) => { listeners.media = fn; }), removeEventListener: vi.fn() };
  const window = { addEventListener: vi.fn((_name, fn) => { listeners.storage = fn; }), removeEventListener: vi.fn() };
  return { root, stored, media, listeners, window, localStorage: storage, document: { documentElement: root }, matchMedia: () => media };
}

afterEach(() => vi.unstubAllGlobals());

describe("appearance bootstrap", () => {
  for (const palette of PALETTES) for (const mode of MODES) {
    it(`restores ${palette}/${mode} before hydration`, () => {
      const f = fixture({ "fadi:palette": palette, theme: mode }, true);
      runInNewContext(APPEARANCE_BOOTSTRAP, f);
      expect(f.root.dataset).toEqual({ palette, appearance: mode });
      expect(f.root.dark).toBe(resolveDark(mode, true));
      expect(f.root.style.colorScheme).toBe(mode === "light" ? "light" : "dark");
    });
  }
  it("preserves the old explicit mode and defaults the new palette", () => {
    const f = fixture({ theme: "light" }, true);
    runInNewContext(APPEARANCE_BOOTSTRAP, f);
    expect(f.root.dataset).toEqual({ palette: "ember", appearance: "light" });
    expect(f.root.dark).toBe(false);
  });
  it("still follows OS dark when storage throws", () => {
    const f = fixture({}, true, true);
    runInNewContext(APPEARANCE_BOOTSTRAP, f);
    expect(f.root.dark).toBe(true);
    expect(f.root.dataset.appearance).toBe("system");
  });
  it("rejects corrupt/injected stored values", () => {
    const f = fixture({ theme: "unknown", "fadi:palette": "';globalThis.injected=true;//" });
    runInNewContext(APPEARANCE_BOOTSTRAP, f);
    expect(f.root.dataset).toEqual({ palette: "ember", appearance: "system" });
    expect("injected" in f).toBe(false);
  });
});

describe("shared preference runtime", () => {
  function install(f: ReturnType<typeof fixture>) {
    vi.stubGlobal("document", f.document); vi.stubGlobal("window", f.window);
    vi.stubGlobal("localStorage", f.localStorage); vi.stubGlobal("matchMedia", f.matchMedia);
  }
  it("saves both choices and applies them immediately", () => {
    const f = fixture(); install(f);
    expect(saveAppearance({ palette: "cobalt", mode: "dark" })).toBe(true);
    expect(currentAppearance()).toEqual({ palette: "cobalt", mode: "dark" });
    expect(f.stored.get("theme")).toBe("dark");
    expect(f.stored.get("fadi:palette")).toBe("cobalt");
    expect(f.root.dark).toBe(true);
  });
  it("applies session-only choices when saving is blocked", () => {
    const f = fixture({}, false, true); install(f);
    expect(saveAppearance({ palette: "iris", mode: "dark" })).toBe(false);
    expect(f.root.dark).toBe(true);
    expect(currentAppearance().palette).toBe("iris");
  });
  it("reacts to system changes only in system mode and cleans up", () => {
    const f = fixture(); install(f);
    applyAppearance({ palette: "iris", mode: "system" });
    const cleanup = observeAppearanceChanges();
    f.media.matches = true; f.listeners.media?.(); expect(f.root.dark).toBe(true);
    applyAppearance({ palette: "iris", mode: "light" });
    f.listeners.media?.(); expect(f.root.dark).toBe(false);
    cleanup(); expect(f.media.removeEventListener).toHaveBeenCalledOnce();
    expect(f.window.removeEventListener).toHaveBeenCalledOnce();
  });
  it("synchronises relevant cross-tab changes and storage clearing", () => {
    const f = fixture(); install(f); observeAppearanceChanges();
    f.stored.set("theme", "dark"); f.stored.set("fadi:palette", "cobalt");
    f.listeners.storage?.({ storageArea: f.localStorage, key: "theme" });
    expect(currentAppearance()).toEqual({ palette: "cobalt", mode: "dark" });
    f.stored.clear(); f.listeners.storage?.({ storageArea: f.localStorage, key: null });
    expect(currentAppearance()).toEqual({ palette: "ember", mode: "system" });
  });
  it("normalises unsupported values", () => {
    expect(parseAppearance("teal", "auto")).toEqual({ palette: "ember", mode: "system" });
  });
});
