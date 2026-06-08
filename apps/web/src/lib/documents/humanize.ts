/**
 * Shared "write like a real person, not an AI" rules + a deterministic safety
 * net. Centralized so EVERY surface that drafts career content — the document
 * generator, the application agent, any future writer — applies the same
 * standard, and so the prompt's banned list and the post-generation detector
 * never drift apart.
 *
 * Honest stance (see the ATS reframe): content reads human because it's
 * SPECIFIC and in the candidate's real voice, not because it dodges a detector.
 */

/**
 * AI "tells" — clichés/buzzwords that make writing read machine-made. Single
 * source of truth: the prompt ban below AND the runtime detector are both built
 * from this list, so a phrase is never banned in one place but missed in the
 * other.
 */
export const AI_TELLS = [
  "leverage",
  "spearheaded",
  "passionate",
  "results-driven",
  "results-oriented",
  "detail-oriented",
  "dynamic",
  "seasoned",
  "proven track record",
  "track record",
  "synergy",
  "deep dive",
  "fast-paced",
  "wealth of experience",
  "honed",
  "team player",
  "go-getter",
  "think outside the box",
  "hit the ground running",
  "meticulous",
  // Generic job-application filler — the phrases that make a cover letter /
  // value-prop read like every other AI draft (multi-word, so low false-positive).
  "i am writing to express my interest",
  "excited about the opportunity",
  "looking forward to discussing",
  "looking forward to the opportunity",
  "confident in my ability",
  "eager to bring",
  "solid understanding",
  "strong communication skills",
  "contribute to the team's success",
  "align with my career goals",
] as const;

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

const BANNED_SENTENCE = AI_TELLS.map((t) => `"${t}"`).join(", ");

/** Injected into EVERY draft (resume + prose). */
export const HUMANIZE_CORE = `Write like a real, thoughtful person — never like an AI. Non-negotiable for every document:
- BANNED AI tells — never use these or close variants: ${BANNED_SENTENCE}.
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
export function buildDeAiSystemPrompt(tells: string[]): string {
  const tellLine = tells.length
    ? `Remove these AI-cliché phrases and any close variant: ${tells.map((t) => `"${t}"`).join(", ")}. `
    : "";
  return `You are a sharp editor making a draft read like a real person wrote it. ${tellLine}Also replace every vague, unsubstantiated claim ("strong communication skills", "solid understanding", "confident in my ability", "proactive", etc.) with a concrete specific drawn from what's already in the draft — a real number, a named tool/company/project, or a specific thing that happened. If a claim has no real specific to back it, CUT it. Keep all real facts, names, dates and numbers exactly; never invent new ones. Keep the same format and voice, similar length. Return only the revised document text — no preamble.`;
}

/**
 * Generator→critic→revise loop for prose drafts (the "self-refine" pattern):
 * deterministically scan for AI tells, and if any are present run a bounded
 * number of corrective rewrites that both strip clichés and push for concrete
 * specificity. Keeps the best draft, never loops forever, and swallows rewrite
 * failures so a flaky model can't break generation. `rewrite` is the caller's
 * model call (system, user) → text. (Was: a single pass; now bounded loop.)
 */
export async function stripAiTells(
  text: string,
  rewrite: (system: string, user: string) => Promise<string>,
  maxRounds = 2,
): Promise<string> {
  let best = text;
  let bestTells = findAiTells(best);

  for (let round = 0; round < maxRounds && bestTells.length > 0; round++) {
    try {
      const revised = (await rewrite(buildDeAiSystemPrompt(bestTells), best)).trim();
      const revisedTells = findAiTells(revised);
      // Only accept a revision that's non-empty and genuinely cleaner.
      if (revised.length > 0 && revisedTells.length < bestTells.length) {
        best = revised;
        bestTells = revisedTells;
      } else {
        break; // not improving — stop spending calls
      }
    } catch {
      break; // best-effort — keep the best draft so far
    }
  }
  return best;
}
