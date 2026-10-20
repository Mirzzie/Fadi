/**
 * ENTITY RESOLUTION — "is this the same real thing, described differently?"
 *
 * THE BUG THIS EXISTS TO FIX. Fadi conflates two different kinds of object:
 *
 *   · a FACT      — a real thing that happened (an MSc dissertation, an internship,
 *                   a home lab). There is exactly one of each, forever.
 *   · a RENDERING — one description of that fact, worded for an audience.
 *
 * Every ingest path writes a rendering as though it were a new fact. So the moment a
 * user tailors their history for a different role — which is the whole point of the
 * product — the same reality is written again in different words and stored as new
 * evidence, a new project, a new résumé line. The pool inflates with restatements and
 * the person looks scattered to a reader, which is precisely the failure a reviewer
 * flagged on this user's portfolio.
 *
 * Lexical duplicate-detection cannot fix this: "Automated DevSecOps Pipeline
 * Deployment & Runtime Protection" and "Shield-Right DevSecOps" are the same MSc
 * project and share neither a title, an organisation, nor a date string.
 *
 * WHAT SURVIVES REWORDING. Rewriting changes the prose and leaves the world alone —
 * so identity is built only out of things a rewrite cannot touch:
 *
 *   1. ARTEFACTS      a repo, an image, a live URL. The strongest signal there is:
 *                     two records pointing at one artefact are one thing.
 *   2. TIME AND PLACE an organisation plus an overlapping period.
 *   3. RARE TOKENS    the proper nouns a rewrite keeps because they name reality —
 *                     "wazuh", "proxmox", "juice shop", "nextcloud".
 *   4. MEANING        an embedding, for the pure-paraphrase case the above miss.
 *
 * RARITY IS MEASURED AGAINST THE USER'S OWN CORPUS, never a hardcoded vocabulary.
 * A word common across someone's records tells you nothing; a word in two of forty
 * records is a fingerprint. This is what keeps the module career-agnostic: a nurse's
 * "cannulation" and an engineer's "terraform" are found the same way, and no list of
 * technologies is smuggled in (the mistake that made the Learning Hub IT-only).
 *
 * THE OUTPUT IS A VERDICT, NOT AN ACTION. `same` / `maybe` / `different`, with the
 * reasons in plain language. Merging is the caller's decision and the user's click.
 */

export type IdentityInput = {
  id: string;
  title: string;
  organization?: string | null;
  period?: string | null;
  detail?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  gallery?: string[] | null;
  tags?: string[] | null;
  /**
   * What KIND of thing this is (experience / project / skill / education …). Records
   * of incompatible kinds are never the same thing: a skill named "Linux" is not the
   * same object as a project that happens to use Linux, however much they overlap.
   */
  kind?: string | null;
};

/**
 * Kinds that name a THING THAT HAPPENED and can therefore be duplicated by rewording.
 * A skill or a tag is a label, not an event: it shares vocabulary with the work that
 * demonstrates it by design, so comparing the two produces nothing but false matches.
 */
const EVENTISH = new Set(["experience", "project", "education", "certification", "achievement", "custom"]);

function comparableKinds(a: IdentityInput, b: IdentityInput): boolean {
  const ka = a.kind ?? "";
  const kb = b.kind ?? "";
  if (!ka || !kb) return true; // unknown kinds: fall back to the evidence itself
  if (!EVENTISH.has(ka) || !EVENTISH.has(kb)) return false;
  return true;
}

export type Verdict = "same" | "maybe" | "different";

export type IdentityMatch = {
  a: string;
  b: string;
  score: number;
  verdict: Verdict;
  /** Plain-language, shown to the user — the reason must survive being read aloud. */
  reasons: string[];
};

const STOP = new Set([
  "the", "and", "for", "with", "from", "into", "that", "this", "was", "were", "are",
  "our", "your", "their", "its", "using", "used", "use", "via", "per", "over", "under",
  "built", "build", "made", "make", "work", "worked", "working", "role", "project",
  "experience", "team", "teams", "support", "supported", "managed", "manage",
]);

export function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+#.\s-]/g, " ")
    .split(/[\s-]+/)
    .map((w) => w.trim().replace(/\.+$/, ""))
    .filter((w) => w.length > 2 && !STOP.has(w));
}

/** Everything about a record that words can be drawn from. */
function textOf(item: IdentityInput): string {
  return [item.title, item.organization, item.detail, ...(item.tags ?? [])]
    .filter(Boolean)
    .join(" ");
}

/**
 * How rare each token is ACROSS THIS USER'S OWN RECORDS. Document frequency, not a
 * dictionary — so the distinctive words of any profession surface without anyone
 * having to enumerate them.
 */
export function rarityIndex(items: IdentityInput[]): Map<string, number> {
  const docFreq = new Map<string, number>();
  for (const item of items) {
    for (const t of new Set(tokens(textOf(item)))) {
      docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
    }
  }
  const n = Math.max(items.length, 1);
  const idf = new Map<string, number>();
  for (const [t, df] of docFreq) idf.set(t, Math.log(n / df));
  return idf;
}

/**
 * The distinctive words of one record — for DISPLAY ("they share wazuh, proxmox").
 *
 * Deliberately NOT used to compute overlap. Ranking by rarity and taking the top N
 * favours tokens that appear in exactly one record, which are by definition the ones
 * that cannot be shared: the first version of this scored the reworded MSc pair as
 * unrelated because every genuinely shared term had been pushed out of the top 12 by
 * unique ones. Matching uses `rareOverlap` below, which weighs every term it has.
 */
export function rareTokens(item: IdentityInput, idf: Map<string, number>, top = 12): string[] {
  const seen = new Set(tokens(textOf(item)));
  return [...seen]
    .map((t) => ({ t, w: idf.get(t) ?? 0 }))
    .filter((x) => x.w > 0.3)
    .sort((a, b) => b.w - a.w)
    .slice(0, top)
    .map((x) => x.t);
}

/**
 * Weighted overlap of two records' distinctive vocabulary: how much of the rarer
 * record's "identity mass" the other one also carries. Rare words count for more
 * than common ones, and nothing is discarded before comparing.
 */
export function rareOverlap(
  a: IdentityInput,
  b: IdentityInput,
  idf: Map<string, number>,
): { score: number; shared: string[] } {
  const wa = new Map<string, number>();
  const wb = new Map<string, number>();
  for (const t of new Set(tokens(textOf(a)))) wa.set(t, idf.get(t) ?? 0);
  for (const t of new Set(tokens(textOf(b)))) wb.set(t, idf.get(t) ?? 0);

  const mass = (m: Map<string, number>) => [...m.values()].reduce((s, w) => s + w, 0);
  const totalA = mass(wa);
  const totalB = mass(wb);
  if (totalA === 0 || totalB === 0) return { score: 0, shared: [] };

  let sharedMass = 0;
  const shared: { t: string; w: number }[] = [];
  for (const [t, w] of wa) {
    if (!wb.has(t)) continue;
    sharedMass += w;
    if (w > 0.3) shared.push({ t, w });
  }

  return {
    score: sharedMass / Math.min(totalA, totalB),
    shared: shared.sort((x, y) => y.w - x.w).map((x) => x.t),
  };
}

/** Normalised artefact identity — the same repo written two ways is one artefact. */
function artefacts(item: IdentityInput): Set<string> {
  const raw = [item.url, item.imageUrl, ...(item.gallery ?? [])].filter(Boolean) as string[];
  return new Set(
    raw.map((u) =>
      u
        .trim()
        .toLowerCase()
        .replace(/^https?:\/\//, "")
        .replace(/^www\./, "")
        .replace(/[/?#].*$/, (m) => (m.startsWith("/") ? m.replace(/\/+$/, "") : ""))
        .replace(/\/+$/, ""),
    ),
  );
}

function orgKey(item: IdentityInput): string {
  return tokens(item.organization ?? "").sort().join(" ");
}

function years(item: IdentityInput): Set<number> {
  const src = `${item.period ?? ""} ${item.title ?? ""}`;
  return new Set((src.match(/\b(19|20)\d{2}\b/g) ?? []).map(Number));
}

function overlap<T>(a: Set<T>, b: Set<T>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const x of a) if (b.has(x)) hits += 1;
  return hits / Math.min(a.size, b.size);
}

/**
 * Compare two records.
 *
 * `similarity` is an optional embedding cosine (0–1). It is injected rather than
 * fetched so this stays pure and testable, and so the whole thing still works with no
 * embeddings provider configured — the lexical anchors alone catch the common cases.
 */
export function compareIdentity(
  a: IdentityInput,
  b: IdentityInput,
  idf: Map<string, number>,
  similarity?: number,
): IdentityMatch {
  const reasons: string[] = [];
  let score = 0;

  if (!comparableKinds(a, b)) {
    return { a: a.id, b: b.id, score: 0, verdict: "different", reasons: ["different kinds of record"] };
  }

  // A record with almost no words cannot be identified by its words. Requiring a
  // minimum vocabulary stops one-line entries ("Linux") from matching everything
  // that mentions them — which is most of the pool.
  const vocabA = new Set(tokens(textOf(a))).size;
  const vocabB = new Set(tokens(textOf(b))).size;
  const tooThin = Math.min(vocabA, vocabB) < 4;

  // 1. An artefact in common is the strongest evidence of sameness there is:
  //    a rewrite never changes which repository the work lives in.
  const sharedArtefact = overlap(artefacts(a), artefacts(b));
  if (sharedArtefact > 0) {
    // Decisive by itself: a rewrite never changes which file the work lives in.
    score += 0.9;
    reasons.push("both point at the same file or link");
  }

  // 2. Same place, same time.
  const sameOrg = orgKey(a) && orgKey(a) === orgKey(b);
  const sharedYear = overlap(years(a), years(b)) > 0;
  if (sameOrg && sharedYear) {
    score += 0.45;
    reasons.push("same organisation, overlapping dates");
  } else if (sameOrg) {
    score += 0.15;
    reasons.push("same organisation");
  }

  // 3. The proper nouns a rewrite keeps.
  // Two readings of the same evidence, because either alone is fooled:
  //   · the MASS RATIO is diluted when both records carry a lot of unique wording
  //     (the reworded MSc pair scored only 0.28 despite sharing seven proper nouns);
  //   · the COUNT alone would over-fire on long records that happen to share words.
  // Sharing several distinctive terms is strong evidence however verbose either side is.
  const rare = rareOverlap(a, b, idf);
  const manyShared = rare.shared.length >= 4;
  const someShared = rare.shared.length >= 2;
  if (rare.score >= 0.4 || manyShared) {
    score += 0.55;
    reasons.push(
      rare.shared.length > 0
        ? `share distinctive terms (${rare.shared.slice(0, 4).join(", ")})`
        : "share most of their distinctive wording",
    );
  } else if (rare.score >= 0.2 || someShared) {
    score += 0.3;
    reasons.push(
      rare.shared.length > 0
        ? `some distinctive terms in common (${rare.shared.slice(0, 3).join(", ")})`
        : "some wording in common",
    );
  }

  // 4. Meaning, for the pure paraphrase the anchors above cannot see.
  if (typeof similarity === "number") {
    if (similarity >= 0.9) {
      score += 0.5;
      reasons.push("describe the same thing in different words");
    } else if (similarity >= 0.8) {
      score += 0.3;
      reasons.push("closely related wording");
    } else if (similarity < 0.5) {
      // Actively disagreeing meaning is evidence AGAINST, which stops two unrelated
      // records at one employer being merged just because the dates line up.
      score -= 0.3;
    }
  }

  // A thin record needs an anchor a rewrite cannot fake — a shared artefact, or the
  // same place at the same time. Shared words alone are not enough to identify it.
  const anchored = sharedArtefact > 0 || (sameOrg && sharedYear);
  if (tooThin && !anchored) {
    return {
      a: a.id,
      b: b.id,
      score: 0,
      verdict: "different",
      reasons: ["too little detail to identify"],
    };
  }

  const verdict: Verdict = score >= 0.8 ? "same" : score >= 0.5 ? "maybe" : "different";
  return { a: a.id, b: b.id, score: Number(score.toFixed(3)), verdict, reasons };
}

/**
 * Every pair worth a second look, strongest first.
 *
 * `similarityOf` lets a caller supply embedding cosines; without it the lexical
 * anchors do the work alone, which is the degraded-but-useful mode when no
 * embeddings provider is configured.
 */
export function findSameThings(
  items: IdentityInput[],
  similarityOf?: (a: string, b: string) => number | undefined,
): IdentityMatch[] {
  const idf = rarityIndex(items);
  const out: IdentityMatch[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const m = compareIdentity(items[i], items[j], idf, similarityOf?.(items[i].id, items[j].id));
      if (m.verdict !== "different") out.push(m);
    }
  }
  return out.sort((x, y) => y.score - x.score);
}
