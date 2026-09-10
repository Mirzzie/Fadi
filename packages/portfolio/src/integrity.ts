import { findSameThings, type IdentityInput } from "./identity";

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
  /**
   * For duplicates: which copy to keep and which to drop, so the UI can offer a
   * one-click resolution instead of leaving the owner to work it out. A
   * RECOMMENDATION, never an action — nothing is removed without their click.
   */
  keepId?: string;
  dropId?: string;
  /** Why that one — shown to the owner so the choice is theirs to overrule. */
  keepReason?: string;
};

/**
 * Which copy of a duplicate is worth keeping?
 *
 * Ranked by what a READER gets, not by what is tidiest to store: an artefact beats a
 * link, a link beats prose, and prose beats an empty record. Ties break toward the
 * canonical record — a job belongs in experience and a certificate in certifications,
 * so the project-shaped restatement is the one to drop.
 */
function worthOf(item: ItemLike): number {
  return (
    (item.imageUrl ? 4 : 0) +
    ((item.gallery?.length ?? 0) > 0 ? 3 : 0) +
    (item.url ? 2 : 0) +
    Math.min(item.bullets?.length ?? 0, 3) +
    (item.description ? 1 : 0) +
    // Canonical sections win a tie: the duplicate is nearly always the project copy.
    (item.section === "experience" || item.section === "certification" || item.section === "education"
      ? 0.5
      : 0)
  );
}

function recommend(a: ItemLike, b: ItemLike): { keepId: string; dropId: string; keepReason: string } {
  const [keep, drop] = worthOf(a) >= worthOf(b) ? [a, b] : [b, a];
  const reason = keep.imageUrl || keep.gallery?.length
    ? "it has the artefact"
    : keep.url
      ? "it has a working link"
      : (keep.bullets?.length ?? 0) > (drop.bullets?.length ?? 0)
        ? "it carries more detail"
        : `a ${keep.section} entry is the canonical record`;
  return { keepId: keep.id, dropId: drop.id, keepReason: reason };
}

type ItemLike = {
  id: string;
  section: string;
  title: string;
  subtitle?: string | null;
  dateRange?: string | null;
  /** Optional signals used to recommend which copy of a duplicate to keep. */
  imageUrl?: string | null;
  gallery?: string[] | null;
  url?: string | null;
  bullets?: string[] | null;
  description?: string | null;
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
        ...recommend(a, b),
      });
    }
  }
  return out;
}

/**
 * CROSS-SECTION DUPLICATES — the same real work recorded twice, in two places.
 *
 * `isSameEntry` is section-scoped by design (the sync uses it to match like with
 * like), which leaves a blind spot the checker could never see through: a job also
 * written up as a project, or a certification also entered as a project. On the
 * first real portfolio this ran against, FIVE pairs were hiding in that gap — an
 * internship at F13 filed as both "AWS Cloud Intern" and "AWS Cloud Environments",
 * a consultancy filed as both "Freelance IT Consultant" and "IT Support & Server
 * Operations" — while the panel cheerfully reported "no duplicates found".
 *
 * The signal is deliberately conservative: same organisation AND overlapping years,
 * or an identical title. Two genuinely different projects at one employer share an
 * organisation but not a title, so they don't trip it. Everything here is a
 * PROPOSAL — nothing is deleted automatically, because only the owner knows which
 * wording they want to keep.
 */
function orgTokens(item: ItemLike): Set<string> {
  // The org usually leads the subtitle ("F13 Technologies · Internship · 2023").
  const first = (item.subtitle ?? "").split("·")[0] ?? "";
  return new Set(
    first
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !["the", "and", "ltd", "inc", "llc"].includes(w)),
  );
}

function yearsOf(item: ItemLike): Set<number> {
  const src = `${item.dateRange ?? ""} ${item.subtitle ?? ""}`;
  return new Set((src.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number));
}

function normTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function findCrossSectionDuplicates(items: ItemLike[]): IntegrityFinding[] {
  const out: IntegrityFinding[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i];
      const b = items[j];
      if (a.section === b.section) continue; // same-section is the other pass's job

      const sameTitle = normTitle(a.title) && normTitle(a.title) === normTitle(b.title);

      const orgsA = orgTokens(a);
      const orgsB = orgTokens(b);
      const sharedOrg = [...orgsA].some((o) => orgsB.has(o));
      const ya = yearsOf(a);
      const yb = yearsOf(b);
      const sharedYear = [...ya].some((y) => yb.has(y));

      if (!sameTitle && !(sharedOrg && sharedYear)) continue;

      const key = [a.id, b.id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);

      out.push({
        severity: "duplicate",
        title: sameTitle ? "Same entry in two sections" : "Same work recorded twice",
        detail: sameTitle
          ? `“${a.title}” appears as both ${a.section} and ${b.section}.`
          : `“${a.title}” (${a.section}) and “${b.title}” (${b.section}) look like the same work at the same place.`,
        itemIds: [a.id, b.id],
        suggestion: "Keep whichever tells it better; fold anything useful from the other in first.",
        ...recommend(a, b),
      });
    }
  }
  return out;
}

/**
 * SAME THING, DIFFERENT WORDS — the pass the lexical ones cannot do.
 *
 * THE FAILURE THIS FIXES, measured on real data: after an evidence sync added 9 items,
 * the portfolio held six pairs that were plainly the same work — "WordPress on AWS +
 * Ansible" beside "Automated WordPress Deployment on AWS", "Self-Hosted Nextcloud"
 * beside "Private Network Storage & Identity Management Deployment" — and the integrity
 * panel said "No duplicates found". Both lexical passes need a shared title, or a shared
 * organisation AND year; a rewrite keeps none of those.
 *
 * Identity resolution keeps what a rewrite cannot change: the rare terms, the artefacts,
 * the dates. Restricted to the SAME section here — across sections is the other pass's
 * job, and a project filed as an experience is a filing question, not a duplicate.
 */
export function findRewordedDuplicates(items: ItemLike[]): IntegrityFinding[] {
  const inputs: IdentityInput[] = items.map((i) => ({
    id: i.id,
    kind: i.section,
    title: i.title,
    organization: i.subtitle ?? null,
    period: i.dateRange ?? null,
    detail: [i.description, ...(i.bullets ?? [])].filter(Boolean).join(" ") || null,
    url: i.url ?? null,
    imageUrl: i.imageUrl ?? null,
    gallery: i.gallery ?? [],
    tags: [],
  }));
  const byId = new Map(inputs.map((i) => [i.id, i]));

  const out: IntegrityFinding[] = [];
  for (const m of findSameThings(inputs)) {
    const a = items.find((i) => i.id === m.a);
    const b = items.find((i) => i.id === m.b);
    if (!a || !b || a.section !== b.section) continue;
    if (byId.get(m.a)?.kind !== byId.get(m.b)?.kind) continue;

    out.push({
      severity: "duplicate",
      // A confident match is a statement; a "maybe" is a question. Saying "these are
      // the same" about work that isn't destroys trust in every other finding here.
      title: m.verdict === "same" ? "The same work, written twice" : "These might be the same work",
      detail:
        `“${a.title}” and “${b.title}” ${m.verdict === "same" ? "are" : "look like"} one thing ` +
        `described two ways — ${m.reasons.join("; ")}.`,
      itemIds: [a.id, b.id],
      suggestion:
        "Tailoring for a different role produces new wording, not new work. Keep the version that tells it better.",
      ...recommend(a, b),
    });
  }
  return out;
}

/** Everything the deterministic pass can find: within a section, across sections, and
 *  the same thing re-worded — which is the case that actually happens. */
export function findAllDuplicates(items: ItemLike[]): IntegrityFinding[] {
  const found = [...findDuplicates(items), ...findCrossSectionDuplicates(items)];
  // Don't report a pair twice because two different passes noticed it.
  const seen = new Set(found.map((f) => [...(f.itemIds ?? [])].sort().join("|")));
  for (const f of findRewordedDuplicates(items)) {
    const key = [...(f.itemIds ?? [])].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(f);
  }
  return found;
}
