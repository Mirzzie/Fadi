import {
  evidenceRelevance,
  termMatches,
  tokens,
  type EvidenceView,
  type TrackTerms,
} from "./pool";

/**
 * THE LEAD-EVIDENCE DECISION — "what should lead for *this* posting?"
 *
 * Why this exists, in the reviewer's words: *"For a junior application, the most
 * useful outcome is not another broad fit score, but a clear choice about which
 * evidence should lead for that specific role."*
 *
 * Fadi already had two of the three pieces and neither closed that gap:
 *   - `fit.ts` answers "should you apply?" with a verdict + score. That is a
 *     GO/NO-GO on the opportunity. It never touches presentation order.
 *   - `pool.ts#rankEvidenceForTrack` ranks the pool against a TRACK — a broad
 *     direction like "Cybersecurity Analyst". A candidate whose history spans IT
 *     operations, cloud, DevOps and security still ranks broadly, because the
 *     track itself is broad. Worse, the ranking was only ever consumed inside a
 *     prompt: the user never saw the choice, so they could never make it.
 *
 * HOW THE CHOICE IS MADE — and why not "what does the JD mention?".
 *
 * The obvious approach (score every item against the posting's words) was built
 * first and failed on real data. A real posting runs to 8000 characters of duties,
 * benefits and boilerplate, so nearly every tag finds SOMETHING to match: the tool
 * led with one item from each of the candidate's three directions at once and
 * produced an incoherent spine — exactly the scattered application the reviewer
 * was complaining about. Long descriptions also inflated the score enough that
 * "this really belongs to your other direction" could never win, so nothing was
 * ever actually held back.
 *
 * So the question is turned around. Rather than asking what the posting mentions,
 * ask **which of the user's OWN directions this posting most resembles** — then
 * lead with that direction's evidence and hold the other directions back. Both
 * sides are compared the same way, so the length of the description stops
 * mattering, and the result is a spine rather than a sample of everything.
 *
 * TWO INVARIANTS, both inherited from the pool and both load-bearing:
 *
 * 1. **Ordering is never deletion.** Nothing here removes evidence from the user's
 *    history. "Hold back" is a statement about ONE application's running order.
 *
 * 2. **A zero score means UNTRANSLATED, not irrelevant.** This is the whole product
 *    thesis (PLATFORM_IDEOLOGY, "the translation layer"). A home lab tagged only
 *    `wazuh/proxmox` shares no tokens with "SOC Analyst" and scores 0 — and it is
 *    precisely that candidate's best proof. Demoting it would invert the product.
 *    So zero-scoring items are reported in their own `untranslated` bucket with a
 *    prompt to NAME them in market language — never mixed into `holdBack`.
 *
 * Pure + deterministic, so it is unit-tested and callable without an AI round-trip.
 * Career-agnostic by construction: it reads the user's own vocabulary against the
 * posting's, so a nurse choosing between paediatric and theatre rotations gets the
 * same machinery as an engineer choosing between cloud and security.
 */

/** A specific opportunity — not a broad track. The description is the posting's own words. */
export type RoleTerms = { title: string; description?: string | null };

export type LeadPick = {
  item: EvidenceView;
  score: number;
  /**
   * The item's OWN named skills that this posting actually asks for. Body-prose
   * overlap is deliberately excluded: a JD and a CV share "team" and "support"
   * whatever the role, so only curated tags/marketTags count as a real signal.
   */
  named: string[];
  /** Which of the user's directions this evidence most belongs to (null = none clearly). */
  home: string | null;
  /** Plain-language why, written to be shown to the user verbatim. */
  reason: string;
};

export type LeadDecision = {
  /** The direction this posting most resembles — the claim the application makes. */
  spineDirection: string | null;
  /** The through-line the leading evidence actually claims — in the market's words. */
  spine: string[];
  /** Put these first. At most three: a junior application that leads with five leads with none. */
  lead: LeadPick[];
  /** Real support. Include them, but they must not out-shout the spine. */
  support: LeadPick[];
  /** Genuinely belongs to a different direction of yours. Held back for THIS role only. */
  holdBack: LeadPick[];
  /** Scores zero here — needs naming in this market's language, NOT demoting. */
  untranslated: LeadPick[];
  /** The reviewer's actual complaint, measured. */
  spread: { directions: string[]; diluted: boolean; note: string };
};

/**
 * Only experience and projects compete for the lead.
 *
 * A degree, a certification or a skills list is STRUCTURAL: you list it on every
 * application whatever direction you're pointing at, so it can't dilute a claim
 * the way a rival project can. Found on real data, where the first version told a
 * candidate to hold back their M.Sc. and their bachelor's degree from an
 * application — advice no careers adviser would ever give, in any field. A nurse
 * does not hide their nursing degree; a teacher does not hide their PGCE.
 */
const COMPETES_FOR_LEAD = new Set(["experience", "project"]);

/** How to name a structural item back to the user, in their own field's terms. */
const STRUCTURAL_NOUN: Record<string, string> = {
  education: "qualification",
  achievement: "credential",
  skill: "skills list",
};

/** The vocabulary of one direction: its role, its field, and its known synonyms. */
function directionTerms(d: TrackTerms): Set<string> {
  return new Set([
    ...tokens(d.role ?? ""),
    ...tokens(d.domain ?? ""),
    ...(d.synonyms ?? []).flatMap(tokens),
  ]);
}

/** Tag-level hits only — the signal that survives generic prose on either side. */
function namedMatches(item: EvidenceView, terms: ReadonlySet<string>): string[] {
  const hits = new Set<string>();
  for (const tag of [...item.marketTags, ...item.tags]) {
    const clean = tag.toLowerCase().trim();
    if (!clean) continue;
    if (tokens(clean).some((t) => termMatches(t, terms))) hits.add(clean);
  }
  return [...hits];
}

/**
 * Which direction does this evidence most belong to? Counted in tag hits rather
 * than raw score, so a wordy item can't out-shout a precise one.
 */
function homeDirection(
  item: EvidenceView,
  dirs: { name: string; terms: Set<string> }[]
): string | null {
  let best: { name: string; hits: number } | null = null;
  for (const d of dirs) {
    const hits = namedMatches(item, d.terms).length;
    if (hits > 0 && (!best || hits > best.hits)) best = { name: d.name, hits };
  }
  return best?.name ?? null;
}

/**
 * Decide what leads.
 *
 * @param items       the user's real evidence pool (never mutated, never filtered away)
 * @param role        the specific posting
 * @param directions  ALL of the user's career directions, including the one this posting
 *                    belongs to — the posting is matched against them to find the spine
 */
export function chooseLeadEvidence(
  items: EvidenceView[],
  role: RoleTerms,
  directions: TrackTerms[] = [],
  /**
   * Which kinds compete for the lead. Defaults to experience + projects (the CV
   * case). A PORTFOLIO overrides this to include skills: on a CV the skills list is
   * one structural block, but on a portfolio every skill is its own card, so
   * "DevOps · Cloud Engineering · Cybersecurity · SOC Analysis" on one page is
   * precisely what makes the site read as unfocused.
   */
  opts: { competing?: ReadonlySet<string> } = {}
): LeadDecision {
  const competing = opts.competing ?? COMPETES_FOR_LEAD;
  const postingTerms = new Set([...tokens(role.title ?? ""), ...tokens(role.description ?? "")]);
  const titleTerms = new Set(tokens(role.title ?? ""));
  const asTrack: TrackTerms = { role: role.title, domain: role.description ?? null };
  const dirs = directions.map((d) => ({ name: d.role, terms: directionTerms(d) }));

  // WHICH DIRECTION IS THIS POSTING? Weighted to the title, because a title is a
  // role's actual name while the body is mostly duties and boilerplate.
  let spineDirection: string | null = null;
  let bestDirScore = 0;
  for (const d of dirs) {
    let hits = 0;
    for (const term of d.terms) {
      if (termMatches(term, titleTerms)) hits += 3;
      else if (termMatches(term, postingTerms)) hits += 1;
    }
    if (hits > bestDirScore) {
      bestDirScore = hits;
      spineDirection = d.name;
    }
  }

  const scored = items.map((item) => {
    const { score } = evidenceRelevance(item, asTrack);
    return {
      item,
      score,
      named: namedMatches(item, postingTerms),
      home: homeDirection(item, dirs),
    };
  });

  const lead: LeadPick[] = [];
  const support: LeadPick[] = [];
  const holdBack: LeadPick[] = [];
  const untranslated: LeadPick[] = [];

  // Evidence that belongs to this posting's direction comes first, then by how many
  // of its named skills the posting asks for.
  const ordered = [...scored].sort((a, b) => {
    const aHome = a.home === spineDirection ? 1 : 0;
    const bHome = b.home === spineDirection ? 1 : 0;
    return bHome - aHome || b.named.length - a.named.length || b.score - a.score;
  });

  for (const { item, score, named, home } of ordered) {
    // An item that ALSO speaks to the focus is never set aside, however strongly it
    // matches somewhere else: shared foundations (Linux for a SOC analyst, safeguarding
    // for both teaching and social work) belong to every direction that uses them.
    // Only evidence with no connection at all to the focus is held back.
    const spineTerms = dirs.find((x) => x.name === spineDirection)?.terms;
    const touchesSpine = spineTerms ? namedMatches(item, spineTerms).length > 0 : false;
    const offSpine = Boolean(spineDirection && home && home !== spineDirection && !touchesSpine);

    // Belongs to a DIFFERENT direction of yours: the thing that makes an
    // application read as unfocused. Held back for this one application only —
    // and only if it's the kind of evidence that competes for the lead at all.
    //
    // Checked BEFORE the zero-score test on purpose. "Untranslated" protects
    // evidence we cannot place; an item with a known home in another direction is
    // the opposite of unplaceable — we know exactly what it is. A skill card
    // literally called "DevOps" shares no words with "SOC Analyst" and so scored
    // zero, and was being protected as untranslated instead of set aside.
    if (offSpine && competing.has(item.kind)) {
      holdBack.push({
        item,
        score,
        named,
        home,
        reason: `This is your ${home} evidence. Strong, but it pulls this application away from its spine.`,
      });
      continue;
    }

    if (score === 0) {
      untranslated.push({
        item,
        score,
        named,
        home,
        reason:
          "Shares no vocabulary with this posting. That usually means untranslated, not irrelevant — name it in this role's language if that is genuinely accurate.",
      });
      continue;
    }

    if (named.length > 0 && lead.length < 3) {
      lead.push({
        item,
        score,
        named,
        home,
        reason: `This posting asks for ${named.slice(0, 3).join(", ")} — and you have actually done it.`,
      });
      continue;
    }

    support.push({
      item,
      score,
      named,
      home,
      reason: offSpine
        ? `Keep it — a ${STRUCTURAL_NOUN[item.kind] ?? "credential"} belongs on every application. It just isn't this one's claim.`
        : named.length > 0
          ? `Also matches ${named.slice(0, 2).join(", ")} — include it, but don't let it lead.`
          : "Relevant background. Keep it behind the lead.",
    });
  }

  // The spine is what the leading evidence jointly claims — deduped, in the market's words.
  const spine = [...new Set(lead.flatMap((p) => p.named))].slice(0, 5);

  // The reviewer's complaint, made measurable — and now resolved rather than only
  // reported: `directions` names what was actually set aside to keep the claim sharp.
  const held = [...new Set(holdBack.map((p) => p.home).filter((h): h is string => Boolean(h)))];
  const diluted = held.length > 0;

  return {
    spineDirection,
    spine,
    lead,
    support,
    holdBack,
    untranslated,
    spread: {
      directions: held,
      diluted,
      note: diluted
        ? `Your evidence also spans ${held.join(" and ")}. For a junior application that reads as unfocused rather than broad — so ${holdBack.length} item${holdBack.length === 1 ? "" : "s"} ${holdBack.length === 1 ? "is" : "are"} held back here to keep the claim sharp.`
        : lead.length > 0
          ? `Focused: everything leading here supports one claim${spine.length > 0 ? ` (${spine.slice(0, 3).join(", ")})` : ""}.`
          : "Nothing in your pool names what this posting asks for yet — translate before you apply.",
    },
  };
}

/**
 * The decision for a specific posting, grounded in the user's real pool.
 *
 * ALL directions are passed through, including the one this posting belongs to:
 * the posting is matched against them to find its spine, so excluding any of them
 * would hide the very comparison the decision rests on. Duplicate tracks are
 * collapsed by name — a pool of eight identical "IT Support Specialist" rows
 * would otherwise repeat the same hold-back reason eight times.
 *
 * DB access is dynamically imported so the pure decision above stays unit-testable.
 */
export async function leadEvidenceForRole(userId: string, role: RoleTerms): Promise<LeadDecision> {
  const [{ createCareerProfilesRepository, createEvidenceRepository }, { getDatabase }] =
    await Promise.all([import("@careeros/database"), import("@/lib/database/client")]);
  const db = getDatabase();
  const [rows, profiles] = await Promise.all([
    createEvidenceRepository(db).listForUser(userId),
    createCareerProfilesRepository(db).listForUser(userId),
  ]);

  const seen = new Set<string>();
  const directions: TrackTerms[] = [];
  for (const p of profiles) {
    if (!p.targetRole) continue;
    const name = p.label || p.targetRole;
    if (seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    directions.push({ role: name, domain: p.domain, synonyms: p.roleSynonyms ?? [] });
  }

  const { toEvidenceView } = await import("./pool");
  return chooseLeadEvidence(rows.map(toEvidenceView), role, directions);
}
