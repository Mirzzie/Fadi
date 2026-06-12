/**
 * Shared "write like a real person, not an AI" rules + a deterministic safety
 * net. Centralized so EVERY surface that drafts career content — the document
 * generator, the application agent, any future writer — applies the same
 * standard, and so the prompt's banned list and the post-generation detector
 * never drift apart.
 *
 * Honest stance (see the ATS reframe): content reads human because it's
 * SPECIFIC and in the candidate's real voice, not because it dodges a detector.
 *
 * Detection model (2026): the public detectors lean on perplexity + burstiness
 * + phrase-density classifiers, and the research consensus is that none of it
 * is reliable against modern models — which is exactly why we DON'T play that
 * game. What measurably helps a document read human: no stock AI vocabulary
 * (phrase density ~0), no template sentence shapes, and varied sentence rhythm.
 * Those three are what this module measures.
 */

/**
 * AI "tells", categorized. Single source of truth: the prompt ban AND the
 * runtime detector are both built from these, so a phrase is never banned in
 * one place but missed in the other. Inclusion bar: high-signal in CAREER
 * documents specifically — words a real candidate plausibly needs (e.g.
 * "streamlined onboarding 30%", "facilitated workshops") stay OFF this list,
 * because rewriting genuine human writing is worse than missing a tell.
 */
export const AI_TELL_CATEGORIES = {
  /** Corporate-cliché claims that say nothing without proof. */
  emptyClaims: [
    "results-driven",
    "results-oriented",
    "detail-oriented",
    "dynamic",
    "seasoned",
    "passionate",
    "proven track record",
    "track record",
    "team player",
    "go-getter",
    "meticulous",
    "wealth of experience",
    "proven ability",
    "demonstrated history",
  ],
  /** The 2026 "AI accent": vocabulary models over-produce in formal prose. */
  aiVocabulary: [
    "leverage",
    "spearheaded",
    "honed",
    "synergy",
    "delve",
    "utilize",
    "tapestry",
    "realm",
    "testament to",
    "multifaceted",
    "holistic",
    "transformative",
    "invaluable",
    "pivotal",
    "seamless",
    "cutting-edge",
    "fast-paced",
    "deep dive",
    "think outside the box",
    "hit the ground running",
  ],
  /** Stock transitions that mark machine-structured prose. */
  transitions: [
    "furthermore",
    "moreover",
    "it is important to note",
    "it's important to note",
    "it is worth noting",
    "in conclusion",
    "in summary",
    "in today's fast-paced",
    "in today's competitive",
  ],
  /** Generic job-application filler — reads like every other AI draft. */
  applicationFiller: [
    "i am writing to express my interest",
    "excited about the opportunity",
    "thrilled to apply",
    "looking forward to discussing",
    "looking forward to the opportunity",
    "confident in my ability",
    "eager to bring",
    "solid understanding",
    "strong communication skills",
    "contribute to the team's success",
    "align with my career goals",
    "make a meaningful impact",
  ],
} as const;

/** Flattened list (kept for compatibility with existing prompts/tests). */
export const AI_TELLS: readonly string[] = Object.values(AI_TELL_CATEGORIES).flat();

/**
 * Template sentence SHAPES — structural tells that survive synonym swaps.
 * Each pairs the detector regex with the instruction a rewrite needs.
 */
export const TEMPLATE_PATTERNS: ReadonlyArray<{ label: string; pattern: RegExp }> = [
  {
    label:
      'template bullet shape "<verb> X to <improve> Y" with no concrete result — replace with what actually happened, with a real number or named outcome',
    pattern:
      /\b(managed|implemented|developed|created|led|designed)\b[^.\n]{3,60}\bto\s+(increase|improve|drive|enhance|optimize|boost|streamline)\b[^.\n]{0,40}[.\n]/i,
  },
  {
    label: 'stock claim "played a key/pivotal/crucial/vital role" — name the actual contribution instead',
    pattern: /\bplay(?:ed|s)? an? (key|pivotal|crucial|vital|critical) role\b/i,
  },
  {
    label: 'the "not only … but also" construction — split into two plain sentences',
    pattern: /\bnot only\b[^.\n]{0,80}\bbut also\b/i,
  },
];

/**
 * Find AI tells present in a draft. Pure + deterministic (unit-testable).
 * Matches whole words/phrases case-insensitively so "honed" won't trip on
 * "phoned" and "track record" only matches the full phrase. Returns the
 * distinct tells found, in the order listed.
 */
export function findAiTells(text: string): string[] {
  if (!text) return [];
  const found = AI_TELLS.filter((tell) => {
    const escaped = tell.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`\\b${escaped}\\b`, "i").test(text);
  });
  // Drop a tell that's wholly contained in another matched tell (e.g. keep
  // "proven track record", drop the redundant "track record") so we never
  // double-count the same phrase.
  return found.filter(
    (tell) => !found.some((other) => other !== tell && other.includes(tell)),
  );
}

/** Template-shape matches present in a draft (labels, deduped). */
export function findTemplateTells(text: string): string[] {
  if (!text) return [];
  return TEMPLATE_PATTERNS.filter(({ pattern }) => pattern.test(text)).map(({ label }) => label);
}

function sentenceWordCounts(text: string): number[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => s.split(/\s+/).length);
}

/**
 * Burstiness: coefficient of variation of sentence lengths. Human prose varies
 * (CV commonly > 0.4); machine prose runs uniform. Returns null when there are
 * too few sentences to say anything honest about rhythm.
 */
export function burstiness(text: string): number | null {
  const counts = sentenceWordCounts(text);
  if (counts.length < 4) return null;
  const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
  if (mean === 0) return null;
  const variance = counts.reduce((a, b) => a + (b - mean) ** 2, 0) / counts.length;
  return Math.sqrt(variance) / mean;
}

/** Below this, prose rhythm is suspiciously uniform (resume bullets exempt —
 *  terse uniformity is the convention there, so only prose paths check this). */
export const UNIFORM_RHYTHM_THRESHOLD = 0.25;

export type HumanityAnalysis = {
  tells: string[];
  templateTells: string[];
  /** Tells per 100 words — density matters more than raw presence. */
  tellDensityPer100: number;
  burstiness: number | null;
  uniformRhythm: boolean;
  /** Combined count the critic loop tries to drive to zero. */
  issueCount: number;
};

export function analyzeHumanity(text: string): HumanityAnalysis {
  const tells = findAiTells(text);
  const templateTells = findTemplateTells(text);
  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const b = burstiness(text);
  const uniformRhythm = b !== null && b < UNIFORM_RHYTHM_THRESHOLD;

  return {
    tells,
    templateTells,
    tellDensityPer100: words > 0 ? (tells.length / words) * 100 : 0,
    burstiness: b,
    uniformRhythm,
    issueCount: tells.length + templateTells.length + (uniformRhythm ? 1 : 0),
  };
}

const BANNED_SENTENCE = AI_TELLS.map((t) => `"${t}"`).join(", ");

/** Injected into EVERY draft (resume + prose). */
export const HUMANIZE_CORE = `Write like a real, thoughtful person — never like an AI. Non-negotiable for every document:
- BANNED AI tells — never use these or close variants: ${BANNED_SENTENCE}.
- NO TEMPLATE SHAPES: never write the "<verb> X to <improve> Y" bullet shape without a concrete result, "played a key role", or "not only … but also". Say what actually happened instead.
- NO EMPTY CLAIMS: never assert a quality ("strong communication skills", "solid understanding", "I'm confident in my ability", "proactive") without a concrete proof right beside it — a number, a named tool/company/project, or a specific thing that happened. If there's no real specific to back a claim, CUT it rather than padding.
- Specificity beats adjectives: ONE real detail — an actual project name, a real number, a tool genuinely used — is worth more than three generic descriptors. Every concrete claim must come from the candidate's REAL experience; never invent.
- Vary sentence length and openings; don't start consecutive lines the same way or with "-ing" verbs. Natural rhythm, not uniform polish.
- Plain, confident voice. Active verbs. No em-dash overuse, no semicolon stacking, no emoji, no exclamation marks.
- Mirror the job description's real terminology ONLY where the candidate genuinely has that experience. Never claim a skill they don't have.`;

/** Extra rules for first-person PROSE docs (cover letter, cold email, value prop). */
export const HUMANIZE_PROSE = `This is first-person prose — make it sound like the candidate actually wrote it, not a template:
- Use natural contractions (I've, didn't, it's) where they fit. Don't over-polish — flawless, perfectly balanced formal prose reads machine-made.
- Open with something specific to THIS role or company, never a stock opener. Earn attention in the first sentence.
- Where it helps, ground a point in one short, real example (a concrete thing they did and what came of it) instead of asserting a trait.
- Keep it tight and punchy — a reader spends ~30 seconds. Shorter and sharper beats long and generic.`;

/** Extra rules for RESUME bullets (terse convention — NOT prose). */
export const HUMANIZE_RESUME = `Resume style — this is a résumé, not prose:
- Bullets are terse and impact-first: lead with a strong, VARIED past-tense action verb (don't reuse the same verb, no "-ing" openings, never "Responsible for"), then what was done, then the measurable result.
- No first-person pronouns and no contractions in bullets — that's the résumé convention.
- Quantify with the real numbers already in the candidate's material; where there's no real metric, state the concrete outcome rather than padding with adjectives.`;

/** Editor prompt for a corrective rewrite when a draft still reads AI-generated. */
export function buildDeAiSystemPrompt(analysis: {
  tells: string[];
  templateTells?: string[];
  uniformRhythm?: boolean;
}): string {
  const parts: string[] = [
    "You are a sharp editor making a draft read like a real person wrote it.",
  ];
  if (analysis.tells.length > 0) {
    parts.push(
      `Remove these AI-cliché phrases and any close variant: ${analysis.tells.map((t) => `"${t}"`).join(", ")}.`,
    );
  }
  if (analysis.templateTells && analysis.templateTells.length > 0) {
    parts.push(`Fix these template patterns: ${analysis.templateTells.join("; ")}.`);
  }
  if (analysis.uniformRhythm) {
    parts.push(
      "The sentences are suspiciously uniform in length — vary the rhythm: mix one short, punchy sentence among longer ones, and vary how sentences open.",
    );
  }
  parts.push(
    `Also replace every vague, unsubstantiated claim ("strong communication skills", "solid understanding", "confident in my ability", "proactive", etc.) with a concrete specific drawn from what's already in the draft — a real number, a named tool/company/project, or a specific thing that happened. If a claim has no real specific to back it, CUT it. Keep all real facts, names, dates and numbers exactly; never invent new ones. Keep the same format and voice, similar length. Return only the revised document text — no preamble.`,
  );
  return parts.join(" ");
}

/**
 * Generator→critic→revise loop for prose drafts (the "self-refine" pattern):
 * deterministically analyze the draft (tells + template shapes + rhythm), and
 * while issues remain run a bounded number of corrective rewrites. Keeps the
 * best draft, never loops forever, and swallows rewrite failures so a flaky
 * model can't break generation. `rewrite` is the caller's model call
 * (system, user) → text.
 */
export async function stripAiTells(
  text: string,
  rewrite: (system: string, user: string) => Promise<string>,
  maxRounds = 2,
): Promise<string> {
  let best = text;
  let bestAnalysis = analyzeHumanity(best);

  for (let round = 0; round < maxRounds && bestAnalysis.issueCount > 0; round++) {
    try {
      const revised = (await rewrite(buildDeAiSystemPrompt(bestAnalysis), best)).trim();
      const revisedAnalysis = analyzeHumanity(revised);
      // Only accept a revision that's non-empty and genuinely cleaner.
      if (revised.length > 0 && revisedAnalysis.issueCount < bestAnalysis.issueCount) {
        best = revised;
        bestAnalysis = revisedAnalysis;
      } else {
        break; // not improving — stop spending calls
      }
    } catch {
      break; // best-effort — keep the best draft so far
    }
  }
  return best;
}
