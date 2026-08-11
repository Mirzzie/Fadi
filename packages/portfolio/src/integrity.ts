import { isSameEntry } from "./view";

// Portfolio integrity findings — problems a reader would catch. Two layers feed this shape:
// a free, deterministic pass (duplicates — runs client-side on every change) and Fadi's AI
// pass (contradictions / timeline / anomalies — on demand). Detect & propose only; nothing
// here mutates the portfolio.

export type IntegritySeverity = "contradiction" | "timeline" | "duplicate" | "anomaly" | "info";

export type IntegrityFinding = {
  severity: IntegritySeverity;
  title: string;
  detail: string;
  /** The offending item ids (so the UI can point at them). */
  itemIds: string[];
  /** A short, concrete fix — advisory only. */
  suggestion?: string;
};

type ItemLike = {
  id: string;
  section: string;
  title: string;
  subtitle?: string | null;
  dateRange?: string | null;
};

/**
 * Deterministic, dependency-free duplicate detection across the whole portfolio. Reuses the
 * same section-scoped matcher the sync uses, so "MSc" / "M.Sc." and "BCA" / "Bachelor of
 * Computer Application" surface as one finding. Pure — safe to run on the client on every edit.
 */
export function findDuplicates(items: ItemLike[]): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (!isSameEntry(a, b)) continue;
      const key = [a.id, b.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        severity: "duplicate",
        title: "Possible duplicate",
        detail: `“${a.title}” and “${b.title}” look like the same entry.`,
        itemIds: [a.id, b.id],
        suggestion: "Remove one, or merge their details into a single entry.",
      });
    }
  }
  return out;
}
