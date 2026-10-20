/**
 * "IT SUPPORT" SHOULD FIND "SUPPORT ENGINEER, IT SERVICES" — AND NOT "SENIOR PRIVACY COUNSEL".
 *
 * Every keyword check in the pipeline asked whether the typed phrase appeared literally. Measured
 * on a live Dublin crawl (21 Sep 2026): 10 real postings read off company boards, 1 kept, because
 * their titles order the same words differently. No hiring manager writes titles to match a
 * search box.
 *
 * The obvious repair — every word of the phrase somewhere in the posting — is worse than the bug:
 * a job description contains the word "it" and the word "support" whatever the job is, and the
 * same crawl then kept a privacy counsel role. So the two questions are asked of different text:
 * the PHRASE may appear anywhere in the posting, but the loose word-order match is asked of the
 * TITLE alone, where the words are the job rather than the prose around it.
 */

/** Words that carry no meaning of their own in a title — ignored when matching word by word. */
const NOISE = new Set(["a", "an", "and", "of", "or", "the", "for", "in", "on", "to", "with"]);

function words(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9+#.]+/)
    .filter((w) => w.length > 0 && !NOISE.has(w));
}

export type Posting = { title: string; description?: string | null };

/** Does this posting answer to this one keyword or phrase? */
export function keywordMatches(posting: Posting, keyword: string): boolean {
  const phrase = keyword.trim().toLowerCase();
  if (!phrase) return false;
  if (`${posting.title} ${posting.description ?? ""}`.toLowerCase().includes(phrase)) return true;

  const parts = words(phrase);
  if (parts.length < 2) return false; // a single word already had its literal chance above
  const title = new Set(words(posting.title));
  return parts.every((part) => title.has(part));
}

/** Any of the keywords — the usual "these are the words I'm looking for" question. */
export function matchesAnyKeyword(posting: Posting, keywords: readonly string[]): boolean {
  return keywords.some((keyword) => keywordMatches(posting, keyword));
}
