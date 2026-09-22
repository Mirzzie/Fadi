import { findSameThings } from "@careeros/portfolio";

/**
 * WHAT A SYNC SHOULD DO WITH A RECORD: ADD IT, OR ATTACH IT TO THE ENTRY THAT ALREADY SHOWS IT.
 *
 * The owner's site carries entries they built, with screenshots that are the actual proof. Their
 * CV describes the same projects in different words — "WordPress on AWS + Ansible" and
 * "Automated WordPress Deployment on AWS" are one project — and a reset had detached the links
 * between them. Sync published a second, image-less copy of each, and the integrity panel then
 * asked them to clean it up by hand: one feature making work, another asking them to undo it.
 *
 * The decision is here, in one pure function, so it can be tested against the real titles rather
 * than inferred from a screenshot afterwards.
 */

export type SyncCandidate = {
  evidenceItemId: string;
  section: string;
  title: string;
  subtitle: string | null;
  dateRange: string | null;
  description: string | null;
  bullets?: string[] | null;
};

export type ExistingEntry = Omit<SyncCandidate, "evidenceItemId"> & {
  id: string;
  /** Null when the entry has lost (or never had) its link to a record. */
  evidenceItemId: string | null;
};

export type SyncPlan<T extends SyncCandidate> = {
  /** Records with nothing like them on the site. */
  create: T[];
  /** Records whose work is already shown: the entry keeps everything and gains the missing link. */
  link: { itemId: string; evidenceItemId: string }[];
  /** How many records were recognised as already shown, linked or not. */
  alreadyShown: number;
};

function identity(x: Omit<SyncCandidate, "evidenceItemId">, id: string) {
  return {
    id,
    kind: x.section,
    title: x.title,
    organization: x.subtitle,
    period: x.dateRange,
    detail: [x.description, ...(x.bullets ?? [])].filter(Boolean).join(" "),
  };
}

export function planEvidenceSync<T extends SyncCandidate>(
  candidates: T[],
  existing: ExistingEntry[],
  options: {
    /** Evidence ids already attached to an entry. */
    have: Set<string>;
    /** Facts the person removed from their site on purpose. */
    dismissed?: Set<string>;
    factOf?: (evidenceItemId: string) => string;
    /** The section-scoped lexical check the CMS already used. */
    sameEntry?: (candidate: T, entry: ExistingEntry) => boolean;
  }
): SyncPlan<T> {
  const dismissed = options.dismissed ?? new Set<string>();
  const factOf = options.factOf ?? ((id: string) => id);
  const entries = existing.map((x) => identity(x, x.id));

  const create: T[] = [];
  const link: { itemId: string; evidenceItemId: string }[] = [];
  const claimed = new Set<string>();
  let alreadyShown = 0;

  candidates.forEach((candidate, index) => {
    if (options.have.has(candidate.evidenceItemId)) return;
    if (dismissed.has(factOf(candidate.evidenceItemId))) return;

    const lexical = options.sameEntry
      ? existing.find((entry) => options.sameEntry!(candidate, entry))
      : undefined;
    const me = identity(candidate, `candidate-${index}`);
    // Loose on purpose: the costs are not symmetric. A wrong match means one record is not copied
    // onto a public page and can still be added by hand; a missed match publishes their work twice.
    const best = findSameThings([me, ...entries], undefined, { requireAnchor: false })
      .filter((m) => m.a === me.id || m.b === me.id)
      .sort((a, b) => b.score - a.score)[0];
    const matchedId = lexical?.id ?? (best ? (best.a === me.id ? best.b : best.a) : null);

    if (!matchedId) {
      create.push(candidate);
      return;
    }

    alreadyShown += 1;
    const entry = existing.find((x) => x.id === matchedId);
    // One record per entry, and never overwrite a link the entry already has.
    if (entry && !entry.evidenceItemId && !claimed.has(entry.id)) {
      claimed.add(entry.id);
      link.push({ itemId: entry.id, evidenceItemId: candidate.evidenceItemId });
    }
  });

  return { create, link, alreadyShown };
}
