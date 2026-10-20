/**
 * THE SITE IS PUBLIC, AND IT DOES NOT KNOW WHEN THE RECORD BEHIND IT CHANGED.
 *
 * A portfolio item is a projection of one piece of evidence, written in the portfolio's own
 * voice. Once published it keeps saying what it said — after the person corrects the employer,
 * after they retract a claim, after a held import replaces the wording. The missing direction is
 * already handled ("proof that isn't on your portfolio yet"); this is the dangerous one, because
 * a stale document is only out of date while a stale PUBLIC page is a claim a stranger can read.
 *
 * Two things are worth interrupting someone for, and nothing else:
 *   - WITHDRAWN: the item presents evidence that is no longer an accepted record (deleted, or
 *     waiting on a review decision). The site is the only place it still stands.
 *   - REWORDED: the record changed after the item was last touched, so the page is showing the
 *     older side of a correction the person has already made.
 *
 * Both are read-only observations. Nothing is unpublished or rewritten automatically: a person's
 * public page is theirs, and a projection that has drifted is a decision to put to them.
 */

export type ProjectedItem = {
  id: string;
  title: string;
  /** The evidence this presents; null for a portfolio-only item, which is never stale. */
  evidenceItemId: string | null;
  isPublished: boolean;
  updatedAt: Date | string;
  /** Stamped when the evidence this presented was deleted — the link itself is gone by then. */
  unbackedSince?: Date | string | null;
};

export type AcceptedRecord = {
  id: string;
  title: string;
  updatedAt: Date | string;
};

export type PortfolioFreshness = {
  /** Live items whose evidence is no longer an accepted record. */
  withdrawn: { id: string; title: string }[];
  /** Live items the person has corrected since the item was last touched. */
  reworded: { id: string; title: string }[];
};

function time(value: Date | string): number {
  const ms = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isNaN(ms) ? 0 : ms;
}

export function portfolioFreshness(
  items: ProjectedItem[],
  accepted: AcceptedRecord[]
): PortfolioFreshness {
  const byId = new Map(accepted.map((record) => [record.id, record]));
  const withdrawn: { id: string; title: string }[] = [];
  const reworded: { id: string; title: string }[] = [];

  for (const item of items) {
    // An unpublished item is a draft: nobody can read it, so it is not a public claim.
    if (!item.isPublished) continue;
    // Deleting evidence severs the link, so the marker is the only thing left that remembers
    // this item ever stood on a record the person has since removed.
    if (item.unbackedSince) {
      withdrawn.push({ id: item.id, title: item.title });
      continue;
    }
    if (!item.evidenceItemId) continue;
    const record = byId.get(item.evidenceItemId);
    if (!record) {
      withdrawn.push({ id: item.id, title: item.title });
      continue;
    }
    // A second's difference is the same save, not an edit the person made afterwards.
    if (time(record.updatedAt) - time(item.updatedAt) > 1_000) {
      reworded.push({ id: item.id, title: item.title });
    }
  }

  return { withdrawn, reworded };
}

export function nothingDrifted(freshness: PortfolioFreshness): boolean {
  return freshness.withdrawn.length === 0 && freshness.reworded.length === 0;
}

function list(titles: { title: string }[]): string {
  const names = titles.map((t) => t.title.trim() || "an untitled item");
  const shown = names.slice(0, 3).join(", ");
  const rest = names.length - 3;
  return rest > 0 ? `${shown} and ${rest} more` : shown;
}

/** What to tell the owner — specific, and about their public page rather than their data. */
export function driftNote(freshness: PortfolioFreshness): string {
  const parts: string[] = [];
  if (freshness.withdrawn.length > 0) {
    parts.push(`${list(freshness.withdrawn)} is live but no longer in your record`);
  }
  if (freshness.reworded.length > 0) {
    parts.push(`you've since corrected ${list(freshness.reworded)}`);
  }
  if (parts.length === 0) return "";
  return `Your site is showing older wording — ${parts.join(", and ")}.`;
}
