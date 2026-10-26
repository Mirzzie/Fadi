"use client";

import { useId, useState, useSyncExternalStore } from "react";
import { appearanceSnapshot, currentAppearance, saveAppearance, subscribeAppearance } from "../../lib/appearance/browser";
import { MODES, PALETTES, type AppearanceMode, type Palette } from "../../lib/appearance/preferences";

const paletteNames = { ember: "Ember · warm coral", iris: "Iris · soft violet", cobalt: "Cobalt · clear blue" };
const modeNames = { system: "Follow system", light: "Light", dark: "Dark" };

export function AppearanceSettings({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const snapshot = useSyncExternalStore(subscribeAppearance, appearanceSnapshot, () => "ember:system");
  const [palette, mode] = snapshot.split(":") as [Palette, AppearanceMode];
  const [saved, setSaved] = useState<boolean | null>(null);

  function update(next: { palette?: Palette; mode?: AppearanceMode }) {
    setSaved(saveAppearance({ ...currentAppearance(), ...next }));
  }

  return (
    <section id={compact ? undefined : "appearance"} aria-labelledby={`${id}-title`} className="appearance-settings">
      <h2 id={`${id}-title`} className="font-heading text-lg font-semibold">Appearance</h2>
      <p className="mt-1 text-sm text-muted-foreground">One visual language, with a colour palette and brightness that suit you.</p>
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Colour palette</legend>
          <div className="space-y-2">
            {PALETTES.map((value) => <label className="appearance-choice" key={value}>
              <input type="radio" name={`${id}-palette`} value={value} checked={palette === value} onChange={() => update({ palette: value })} />
              <span className="appearance-swatch" data-swatch={value} aria-hidden="true" />
              <span>{paletteNames[value]}</span>
            </label>)}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Brightness</legend>
          <div className="space-y-2">
            {MODES.map((value) => <label className="appearance-choice" key={value}>
              <input type="radio" name={`${id}-mode`} value={value} checked={mode === value} onChange={() => update({ mode: value })} />
              <span>{modeNames[value]}</span>
            </label>)}
          </div>
        </fieldset>
      </div>
      <p role="status" className="mt-4 text-xs text-muted-foreground">
        {saved === false ? "Applied for this session. Browser storage is unavailable, so this choice may not survive a reload." : saved === true ? "Appearance saved in this browser." : "Changes apply immediately in this browser. Your work and records are unchanged."}
      </p>
    </section>
  );
}
