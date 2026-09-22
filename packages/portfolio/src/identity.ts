/** Identity suggestions: exact field replay is automatic; inferred similarity needs review.
 * Kind boundaries separate a job, a project within it, and a qualification.
 * Lexical and embedding scores retrieve candidates, not proof of shared identity.
 */
export type IdentityInput = {
  id: string;
  title: string;
  organization?: string | null;
  /**
   * personal | employment | education | platform | client. Default personal.
   *
   * Decides whether `organization` may act as an IDENTITY ANCHOR. A shared employer
   * plus overlapping years is strong evidence two records describe the same work. A
   * shared "Raspberry Pi" is evidence of nothing — it is a board two unrelated
   * projects happen to run on, and treating it as an employer made them look like
   * colleagues.
   */
  attribution?: string | null;
  period?: string | null;
  detail?: string | null;
  metrics?: string | null;
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
function comparableKinds(a: IdentityInput, b: IdentityInput): boolean {
  // Missing classification may produce a question, but different known objects are
  // not alternate wordings (e.g. a degree and the dissertation completed within it).
  return !a.kind || !b.kind || a.kind === b.kind;
}

const normalText = (value?: string | null) =>
  (value ?? "").normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

/** Exact source replay is independent of corpus size, origin and ranking tags. */
export function identicalRecord(a: IdentityInput, b: IdentityInput): boolean {
  return (
    normalText(a.attribution ?? "personal") === normalText(b.attribution ?? "personal") &&
    JSON.stringify([...(a.gallery ?? [])].sort()) ===
      JSON.stringify([...(b.gallery ?? [])].sort()) &&
    Boolean(a.kind && a.kind === b.kind && normalText(a.title)) &&
    ["title", "organization", "period", "detail", "metrics", "url", "imageUrl"].every(
      (key) =>
        normalText(a[key as keyof IdentityInput] as string | null) ===
        normalText(b[key as keyof IdentityInput] as string | null)
    )
  );
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
  "the",
  "and",
  "for",
  "with",
  "from",
  "into",
  "that",
  "this",
  "was",
  "were",
  "are",
  "our",
  "your",
  "their",
  "its",
  "using",
  "used",
  "use",
  "via",
  "per",
  "over",
  "under",
  "built",
  "build",
  "made",
  "make",
  "work",
  "worked",
  "working",
  "role",
  "project",
  "experience",
  "team",
  "teams",
  "support",
  "supported",
  "managed",
  "manage",
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
  idf: Map<string, number>
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


/**
 * Do these two records NAME the same thing?
 *
 * Exact titles rarely survive a rewrite ("CI/CD Pipeline for Node.js Application on AWS" becomes
 * "Node.js CI/CD pipeline on AWS"), so identity is read from the words of the title itself: most
 * of the shorter title present in the longer one, and at least two words in common so a single
 * generic word ("pipeline", "engineer") cannot pair two unrelated records.
 */
function titlesName(a: IdentityInput, b: IdentityInput): boolean {
  const ta = new Set(tokens(a.title ?? ""));
  const tb = new Set(tokens(b.title ?? ""));
  if (ta.size === 0 || tb.size === 0) return false;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared += 1;
  if (shared < 2) return false;
  return shared / Math.min(ta.size, tb.size) >= 0.6;
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
        .replace(/\/+$/, "")
    )
  );
}

/** Attributions where `organization` names a real institution someone can be "at". */
const ORG_ATTRIBUTIONS = new Set(["employment", "education", "client"]);

function orgKey(item: IdentityInput): string {
  // Employment records can use their employer even when older rows lack attribution.
  // Other kinds need explicit institutional attribution: a shared tool is not a place
  // of employment. These anchors retrieve a review candidate, not a merge decision.
  if (!ORG_ATTRIBUTIONS.has(item.attribution ?? "personal") && item.kind !== "experience")
    return "";
  return tokens(item.organization ?? "")
    .sort()
    .join(" ");
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
export type IdentityOptions = {
  /**
   * Must something NAME the same work before a pair is raised at all?
   *
   * True (the default) wherever a pair costs the person an answer: it holds an import out of
   * their record until they decide. False where a false pair costs nothing — reconciling a
   * résumé against a portfolio, where the only effect of a wrong match is that Fadi stays quiet
   * about work it thinks is already shown.
   */
  requireAnchor?: boolean;
};

export function compareIdentity(
  a: IdentityInput,
  b: IdentityInput,
  idf: Map<string, number>,
  similarity?: number,
  options: IdentityOptions = {}
): IdentityMatch {
  const reasons: string[] = [];
  let score = 0;

  if (!comparableKinds(a, b)) {
    return {
      a: a.id,
      b: b.id,
      score: 0,
      verdict: "different",
      reasons: ["different kinds of record"],
    };
  }

  if (identicalRecord(a, b)) {
    return { a: a.id, b: b.id, score: 1, verdict: "same", reasons: ["identical recorded fields"] };
  }
  if (a.kind === "skill" || b.kind === "skill") {
    return {
      a: a.id,
      b: b.id,
      score: 0,
      verdict: "different",
      reasons: ["different skill records"],
    };
  }

  // A matching title is a reason to ask even in a two-record corpus. It is
  // never sufficient to merge, particularly when employer or dates differ.
  const sameTitle = Boolean(normalText(a.title) && normalText(a.title) === normalText(b.title));
  const nearTitle = sameTitle || titlesName(a, b);
  if (sameTitle) {
    score += 0.55;
    reasons.push("same title with different recorded fields");
  } else if (nearTitle) {
    score += 0.4;
    reasons.push("nearly the same title");
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
    // Shared references can cover several distinct projects; ask, never merge.
    score += 0.9;
    reasons.push("both point at the same file or link");
  }

  // 2. Same place, same time.
  const sameOrg = orgKey(a) && orgKey(a) === orgKey(b);
  const sharedYear = Boolean(normalText(a.period) && normalText(a.period) === normalText(b.period));
  if (sameOrg && sharedYear) {
    score += 0.6;
    reasons.push("same organisation and stated period");
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
        : "share most of their distinctive wording"
    );
  } else if (rare.score >= 0.2 || someShared) {
    score += 0.3;
    reasons.push(
      rare.shared.length > 0
        ? `some distinctive terms in common (${rare.shared.slice(0, 3).join(", ")})`
        : "some wording in common"
    );
  }

  // 4. Meaning, for the pure paraphrase the anchors above cannot see.
  if (typeof similarity === "number") {
    if (similarity >= 0.9) {
      score += 0.5;
      reasons.push("similar meaning; identity still needs confirmation");
    } else if (similarity >= 0.8) {
      score += 0.3;
      reasons.push("closely related wording");
    } else if (similarity < 0.5) {
      // Actively disagreeing meaning is evidence AGAINST, which stops two unrelated
      // records at one employer being merged just because the dates line up.
      score -= 0.3;
    }
  }

  /**
   * AN ANCHOR, OR NO QUESTION.
   *
   * Shared vocabulary cannot identify a record, however much of it there is. Measured on the
   * owner's real CV (22 Sep 2026): "DevSecOps Pipeline & Security Monitoring", "Automated
   * WordPress Deployment on AWS" and "CI/CD Pipeline for Node.js Application on AWS" are three
   * different projects, and Fadi held two of them for review against the first — because
   * personal projects carry no employer and no dates, so the decision fell entirely to words
   * like "aws", "pipeline" and "deployment", which every cloud project shares. The person was
   * asked to adjudicate a question that had no reason to exist.
   *
   * An anchor is something that names the same THING rather than the same field: nearly the same
   * title, the same artefact, or the same place at the same time. Words and embeddings can only
   * strengthen an anchored candidate now; they can no longer create one. A duplicate that shares
   * no anchor slips through as a second record, which is visible and deletable — unlike a
   * question nobody can answer.
   */
  const anchored = nearTitle || sharedArtefact > 0 || (sameOrg && sharedYear);
  if (!anchored && (options.requireAnchor ?? true)) {
    return {
      a: a.id,
      b: b.id,
      score: 0,
      verdict: "different",
      reasons: [
        tooThin ? "too little detail to identify" : "nothing anchors these to the same work",
      ],
    };
  }

  // Similarity, including an embedding or shared URL, retrieves a REVIEW candidate.
  // Only exact recorded fields establish an automatic match in this containment pass.
  const verdict: Verdict = score >= 0.5 ? "maybe" : "different";
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
  options: IdentityOptions = {}
): IdentityMatch[] {
  const idf = rarityIndex(items);
  const out: IdentityMatch[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const m = compareIdentity(
        items[i],
        items[j],
        idf,
        similarityOf?.(items[i].id, items[j].id),
        options
      );
      if (m.verdict !== "different") out.push(m);
    }
  }
  return out.sort((x, y) => y.score - x.score);
}
