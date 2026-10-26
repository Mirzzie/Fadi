import { AppearanceSettings } from "../settings/appearance-settings";

/** Shared by live portfolios and static exports; preferences belong to the visitor. */
export function PublicAppearance() {
  return (
    <aside aria-label="Portfolio appearance" className="public-appearance print:hidden">
      <details>
        <summary>Appearance</summary>
        <AppearanceSettings compact />
      </details>
    </aside>
  );
}
