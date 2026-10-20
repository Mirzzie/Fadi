import { describe, expect, it } from "vitest";

/**
 * THE INVARIANT: exactly one canonical row per fact.
 *
 * Not "at most one". A fact with NO canonical row is worse than a duplicate — every
 * surface projects from the canonical set, so the record vanishes from the résumé, the
 * portfolio and the prompt block at once, while still sitting in the database.
 *
 * Codex found four ways to break it (D01–D04). These reproduce each in the merge
 * algebra, independently of Drizzle, so the rule is pinned even if the query layer is
 * rewritten. The transaction and SQL live in evidence.repository.ts; this is the logic
 * those queries have to implement.
 */
type Row = { id: string; factId: string | null; isCanonical: boolean };

/** The merge as the repository now performs it: demote first, never the keeper. */
function merge(rows: Row[], canonicalId: string, absorbedId: string): Row[] {
  if (canonicalId === absorbedId) return rows;
  const canonical = rows.find((r) => r.id === canonicalId);
  const absorbed = rows.find((r) => r.id === absorbedId);
  if (!canonical || !absorbed) return rows;

  const factId = canonical.factId ?? canonical.id;
  const absorbedFact = absorbed.factId ?? absorbed.id;

  return rows.map((r) => {
    if (r.id !== canonicalId && (r.id === absorbedId || r.factId === absorbedFact)) {
      return { ...r, factId, isCanonical: false };
    }
    if (r.id === canonicalId) return { ...r, factId, isCanonical: true };
    return r;
  });
}

const canonicalsFor = (rows: Row[], factId: string) =>
  rows.filter((r) => (r.factId ?? r.id) === factId && r.isCanonical);

describe("exactly one canonical per fact", () => {
  it("D01: a freshly created row has a NULL fact id and must still be demoted", () => {
    // The old demotion matched `factId = absorbed.id`. A new row's factId is null, so it
    // never matched itself and stayed canonical — two canonicals after a merge.
    const rows: Row[] = [
      { id: "keep", factId: null, isCanonical: true },
      { id: "drop", factId: null, isCanonical: true },
    ];
    const after = merge(rows, "keep", "drop");

    expect(canonicalsFor(after, "keep")).toHaveLength(1);
    expect(after.find((r) => r.id === "drop")!.isCanonical).toBe(false);
  });

  it("D02: merging rows that ALREADY share a fact must not leave zero canonicals", () => {
    // The old order promoted the keeper, then demoted everything with the absorbed
    // fact — which by then included the keeper. The fact lost its canonical row.
    const rows: Row[] = [
      { id: "keep", factId: "f1", isCanonical: true },
      { id: "drop", factId: "f1", isCanonical: false },
    ];
    const after = merge(rows, "keep", "drop");

    expect(canonicalsFor(after, "f1")).toHaveLength(1);
    expect(after.find((r) => r.id === "keep")!.isCanonical).toBe(true);
  });

  it("carries across everything already merged into the absorbed row", () => {
    const rows: Row[] = [
      { id: "keep", factId: null, isCanonical: true },
      { id: "drop", factId: "f2", isCanonical: true },
      { id: "old", factId: "f2", isCanonical: false },
    ];
    const after = merge(rows, "keep", "drop");

    expect(after.every((r) => (r.factId ?? r.id) === "keep")).toBe(true);
    expect(canonicalsFor(after, "keep")).toHaveLength(1);
  });

  it("is idempotent — a repeated or stale request changes nothing", () => {
    // Retries happen. A merge applied twice must not demote the keeper on the second run.
    const rows: Row[] = [
      { id: "keep", factId: null, isCanonical: true },
      { id: "drop", factId: null, isCanonical: true },
    ];
    const once = merge(rows, "keep", "drop");
    const twice = merge(once, "keep", "drop");

    expect(twice).toEqual(once);
    expect(canonicalsFor(twice, "keep")).toHaveLength(1);
  });

  it("refuses to merge a row into itself", () => {
    const rows: Row[] = [{ id: "a", factId: null, isCanonical: true }];
    expect(merge(rows, "a", "a")).toEqual(rows);
  });
});
