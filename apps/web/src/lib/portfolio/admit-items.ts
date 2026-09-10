import "server-only";

import { admitAgainst, toIdentity, type Candidate } from "@/lib/identity/admit";

type ItemLike = {
  section: string;
  title: string;
  subtitle?: string | null;
  dateRange?: string | null;
  description?: string | null;
  bullets?: string[] | null;
  url?: string | null;
  imageUrl?: string | null;
};

const asCandidate = (i: ItemLike): Candidate => ({
  kind: i.section,
  title: i.title,
  organization: i.subtitle ?? null,
  period: i.dateRange ?? null,
  detail: [i.description, ...(i.bullets ?? [])].filter(Boolean).join(" ") || null,
  url: i.url ?? null,
  imageUrl: i.imageUrl ?? null,
});

/**
 * Filter a batch of would-be portfolio items down to the ones that are genuinely new.
 *
 * The portfolio has three doors — the first seed, the evidence sync, and the JSON
 * import — and only the sync ever checked. So the identical batch of items behaved
 * differently depending on which button produced it, which is exactly how six copies
 * of the user's own projects ended up on a public site.
 *
 * A candidate that resolves to something already there is DROPPED rather than absorbed:
 * unlike the evidence pool, a portfolio item is a projection, and the wording it would
 * have carried already lives on its evidence row. Dropped ones are counted so the caller
 * can say so — silence would just be a quieter version of the original bug.
 */
export function admitPortfolioItems<T extends ItemLike>(
  candidates: T[],
  existing: (ItemLike & { id: string })[],
): { keep: T[]; heldBack: { title: string; matches: string }[] } {
  const pool = existing.map((e) => toIdentity(asCandidate(e), e.id));
  const titleOf = new Map(existing.map((e) => [e.id, e.title]));
  const keep: T[] = [];
  const heldBack: { title: string; matches: string }[] = [];

  for (const c of candidates) {
    // Compare against what is already IN, plus what this same batch has admitted —
    // otherwise a file containing the same project twice sails straight through.
    const seen = [...pool, ...keep.map((k, i) => toIdentity(asCandidate(k), `batch-${i}`))];
    // The portfolio drops rather than absorbs, so authorship never changes the outcome
    // here — an item is either new or it is already represented.
    const verdict = admitAgainst(asCandidate(c), seen, (id) => ({ factId: id }));
    if (verdict.decision === "create") {
      keep.push(c);
      continue;
    }
    heldBack.push({
      title: c.title,
      matches: titleOf.get(verdict.intoId) ?? "something already in this import",
    });
  }

  return { keep, heldBack };
}
