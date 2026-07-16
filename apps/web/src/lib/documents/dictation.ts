/**
 * Speak-to-edit — dictation cleanup for document editing.
 *
 * WHY THIS EXISTS (PLATFORM_IDEOLOGY, Principle 3: "Never invent. Always claim.")
 *
 * The primary user has ~90 minutes after a 6–7 day work week and spends 1–2 hours per
 * application. Typing is the tax. Speaking runs ~3× faster — but the real argument for
 * voice is not speed, it is HONESTY:
 *
 *   AI writing your bullet  → you must verify every word (slow, and it reads as slop).
 *   You speaking the bullet → the claim is already yours; there is nothing to verify.
 *
 * So dictation inverts the usual division of labour. The user supplies the claims; the
 * AI supplies only the grammar. That is the one AI job that cannot produce slop,
 * because the substance never came from the model.
 *
 * It also fixes UNDER-claiming, which the doctrine names as the honest person's real
 * disadvantage: people type "Built a home lab" but they SAY "I had Wazuh and Suricata
 * on Proxmox and I was triaging about 200 alerts a week" — three concrete claims they'd
 * never have written down.
 *
 * THE DANGER, and why the guard below exists: a cleanup model asked to "polish" will
 * happily promote "triaged some alerts" into "expertly triaged 200+ complex security
 * incidents". That is fabrication laundered as editing, and it lands in a document the
 * user then signs their name to — for a visa-dependent candidate the downside is their
 * right to remain, not a lost interview. A prompt alone is not a control. So the tidy
 * is verified mechanically and REJECTED if it invented anything.
 */

/** Digits, and the number-words a transcript realistically contains. */
const NUMBER_WORDS = new Set([
  "zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
  "eleven", "twelve", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty",
  "ninety", "hundred", "thousand", "million", "billion", "dozen", "half", "quarter",
]);

/** Every numeric claim in a piece of text, normalised for comparison. */
export function numericClaims(text: string): string[] {
  const digits = text.match(/\d+(?:[.,]\d+)?/g) ?? [];
  const words = (text.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => NUMBER_WORDS.has(w));
  return [...digits.map((d) => d.replace(/,/g, "")), ...words].sort();
}

/**
 * Did the cleanup introduce a numeric claim the speaker never made?
 *
 * Metrics are the highest-risk fabrication in a résumé: they are the most persuasive
 * thing on the page and the easiest to check in an interview. Dropping a number is
 * fine (that's editing); ADDING one is fabrication, always.
 */
export function inventedNumbers(raw: string, tidied: string): string[] {
  const before = new Set(numericClaims(raw));
  const invented: string[] = [];
  for (const claim of numericClaims(tidied)) {
    if (!before.has(claim)) invented.push(claim);
  }
  return invented;
}

/** Words that turn a factual claim into a self-assessment nobody can verify. */
const PUFFERY = [
  "expertly", "seamlessly", "spearheaded", "leveraged", "orchestrated", "pivotal",
  "world-class", "cutting-edge", "state-of-the-art", "extensive experience",
  "proven track record", "passionate", "results-driven", "dynamic", "synergy",
  "robust", "comprehensive", "significantly", "substantially", "successfully",
];

/**
 * Puffery the cleanup ADDED. Not fabrication of fact, but fabrication of stature —
 * and it is exactly what makes a document read as machine-written. If the speaker
 * said it about themselves, it stays; the model may not award it to them.
 */
export function addedPuffery(raw: string, tidied: string): string[] {
  const before = raw.toLowerCase();
  const after = tidied.toLowerCase();
  return PUFFERY.filter((word) => after.includes(word) && !before.includes(word));
}

/**
 * Phrases that mean the model TALKED ABOUT the transcript instead of returning it.
 *
 * This shipped as a real defect: a near-empty capture produced the reply "There is no
 * text to clean.", which passed every guard (no invented numbers, no puffery) and was
 * appended to a live résumé as an achievement bullet. A model asked to return only
 * text will still, occasionally, answer the request instead of performing it — so the
 * refusal itself has to be treated as invented content, because that is exactly what
 * it is: words the speaker never said.
 */
const META_PATTERNS: RegExp[] = [
  /\bno text to clean\b/i,
  /\bthere is (?:no|nothing)\b/i,
  /\bnothing to (?:clean|correct|fix|transcribe)\b/i,
  /\b(?:the )?transcript (?:is|appears|seems|was)\b/i,
  /\bplease provide\b/i,
  /\b(?:I|as an AI)(?:'m| am)? (?:cannot|can't|unable|sorry)\b/i,
  /\bit (?:seems|appears|looks like)\b/i,
  /\bthe (?:input|text|audio|recording) (?:is|was|appears)\b/i,
  /\bcould not (?:hear|understand|detect)\b/i,
];

/** Noise a transcriber emits for a cough, a click, or an empty room. */
const NON_SPEECH = new Set([
  "um", "uh", "erm", "hmm", "mm", "mhm", "ah", "oh", "eh", "hm", "huh", "yeah", "yes",
  "no", "ok", "okay", "so", "and", "the", "a", "you",
]);

/**
 * Is there actually something here worth cleaning?
 *
 * Requires at least two words that aren't pure verbal noise. Deliberately strict: a
 * dropped half-word costs the user one repeat, while a hallucinated line costs them a
 * corrupted document they might not notice before sending it.
 */
export function isDictationWorthCleaning(raw: string): boolean {
  const words = (raw.toLowerCase().match(/[a-z0-9']+/g) ?? []).filter((w) => !NON_SPEECH.has(w));
  return words.length >= 2;
}

/** Did the model editorialise instead of returning the speaker's cleaned words? */
export function isMetaCommentary(tidied: string): boolean {
  return META_PATTERNS.some((re) => re.test(tidied));
}

/**
 * Cleanup removes filler and tightens — it never substantially LENGTHENS. Text that
 * grew far beyond the source is either commentary or embellishment; either way the
 * extra words did not come from the speaker. The allowance is loose (punctuation,
 * capitalisation and expanded contractions all add characters) so that only genuine
 * ballooning trips it.
 */
export function suspiciouslyExpanded(raw: string, tidied: string): boolean {
  return tidied.length > raw.length * 1.6 + 16;
}

export type TidyRejection = {
  ok: false;
  /** Always the speaker's raw words — the safe fallback. */
  text: string;
  reason: "invented_numbers" | "added_puffery" | "meta_commentary" | "expanded";
  details: string[];
};

export type TidyVerdict = { ok: true; text: string } | TidyRejection;

/**
 * Accept the cleanup only if it stayed honest; otherwise fall back to the speaker's
 * own raw words.
 *
 * The fallback is the whole point: the raw transcript is always publishable, because
 * the user actually said it. A failed tidy costs nothing but polish — so when in
 * doubt we keep their voice, which is what they came here for anyway.
 */
export function verifyTidy(raw: string, tidied: string): TidyVerdict {
  // Checked FIRST: a refusal or a comment about the text is not a worse cleanup, it is
  // not a cleanup at all, and it must never reach the document.
  if (isMetaCommentary(tidied)) {
    return { ok: false, text: raw, reason: "meta_commentary", details: [tidied.slice(0, 80)] };
  }
  if (suspiciouslyExpanded(raw, tidied)) {
    return { ok: false, text: raw, reason: "expanded", details: [`${raw.length} → ${tidied.length}`] };
  }
  const numbers = inventedNumbers(raw, tidied);
  if (numbers.length > 0) {
    return { ok: false, text: raw, reason: "invented_numbers", details: numbers };
  }
  const puffery = addedPuffery(raw, tidied);
  if (puffery.length > 0) {
    return { ok: false, text: raw, reason: "added_puffery", details: puffery };
  }
  return { ok: true, text: tidied };
}

export const TIDY_SYSTEM = `You are cleaning up a spoken transcript so it can go into a professional career document. The speaker's words are the product. You are a typist, not a writer.

YOU MAY:
- Fix grammar, punctuation, capitalisation and obvious speech-to-text errors.
- Remove filler ("um", "like", "you know", "basically", "sort of") and false starts.
- Merge rambling half-sentences into clean ones, and cut repetition.
- Fix the spelling of technical terms the transcriber misheard (e.g. "wazoo" -> "Wazuh").

YOU MAY NOT — these are absolute:
- Add any fact, number, metric, date, employer, tool, or skill the speaker did not say. If they said "a lot of alerts", it stays "a lot of alerts". NEVER invent a figure.
- Add praise or seniority ("expertly", "spearheaded", "extensive experience", "successfully"). Do not promote "helped with X" into "led X".
- Add corporate filler or resume cliches. Plain and specific beats impressive.
- Change what they actually claim, in either direction. Do not soften it either.

If the transcript is already clean, return it unchanged. Return ONLY the cleaned text, with no preamble, quotes, or commentary.`;

/**
 * Clean a dictated transcript. Returns the speaker's raw words unchanged if no AI
 * provider is configured, or if the cleanup failed verification — never an error,
 * because the raw transcript is always usable.
 */
export async function tidyDictation(
  userId: string,
  rawTranscript: string,
): Promise<{ text: string; tidied: boolean; rejected?: TidyRejection }> {
  const raw = rawTranscript.trim();
  if (!raw) return { text: "", tidied: false };

  // A stray "um", a cough, or a half-second of room noise is not dictation. Sending it
  // to a model invites an answer ABOUT the input rather than a cleanup of it — which is
  // precisely how "There is no text to clean." ended up in a résumé. Nothing
  // meaningful was said, so there is nothing to write: return empty and let the caller
  // discard it. Silence must produce silence.
  if (!isDictationWorthCleaning(raw)) return { text: "", tidied: false };

  const { getUserDocGenerate } = await import("@/lib/ai/user-generate");
  const generate = await getUserDocGenerate(userId);
  // No provider is not a failure: their own words are already the deliverable.
  if (!generate) return { text: raw, tidied: false };

  let cleaned: string;
  try {
    cleaned = (await generate.text(TIDY_SYSTEM, raw)).trim();
  } catch {
    return { text: raw, tidied: false };
  }
  if (!cleaned) return { text: raw, tidied: false };

  const verdict = verifyTidy(raw, cleaned);
  if (!verdict.ok) {
    const { logger } = await import("@/lib/observability/logger");
    logger.warn("dictation.tidy_rejected", {
      userId,
      reason: verdict.reason,
      details: verdict.details.join(", "),
    });
    return { text: raw, tidied: false, rejected: verdict };
  }
  return { text: verdict.text, tidied: true };
}
