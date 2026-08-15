import { createHash } from "node:crypto";

/**
 * Deterministic 128-bit content hash for job IDs.
 *
 * Why this exists: some sources (Jooble) hand back a 19-digit numeric id that both OVERFLOWS
 * Number.MAX_SAFE_INTEGER (so it silently rounds — note the trailing zeros) AND is reassigned
 * between crawls. Keyed on that, the upsert can never match the row it already stored, so every
 * pull inserts a fresh duplicate. Deriving the id from the job's stable identity instead makes
 * the same posting map to the same key every time.
 *
 * 128 bits (SHA-256 truncated) rather than a 32-bit FNV: at catalog scale a 32-bit space has a
 * ~50% collision chance around 77k keys, which would merge unrelated postings. 128 bits makes
 * that vanishingly unlikely.
 */
export function stableHash(...parts: Array<string | null | undefined>): string {
  const s = parts.map((p) => (p ?? "").toLowerCase().replace(/\s+/g, " ").trim()).join("|");
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}
