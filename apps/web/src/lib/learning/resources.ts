/**
 * Turn a skill/topic into real, free learning resources — plain URLs (no API keys),
 * so the Learning Hub is actionable instantly.
 *
 * CAREER-AGNOSTIC BY CONSTRUCTION. This module used to assume every learner was a
 * developer: an unmatched skill fell back to `roadmap.sh/roadmaps` (a software
 * roadmap index) and the practice link always read "build a <skill> project".
 * For a nurse learning venepuncture that produced a developer site and a YouTube
 * search for "build a venepuncture project" — two of four links wrong, and a clear
 * signal that the tool was not built for them.
 *
 * So the rule here is: only make a claim the input actually supports.
 *   - `roadmap` is now NULL unless the skill genuinely matches a software roadmap.
 *     No match, no link — an absent link is better than a wrong one.
 *   - the practice link only says "build a project" for fields where building is
 *     how you practise; everywhere else it searches for exercises and worked
 *     examples, which is what practice means in health, education, law or trades.
 *
 * Deliberately NOT a taxonomy of professions. Encoding "nursing → these sites"
 * would smuggle in exactly the kind of hardcoded assumption that made this module
 * IT-only in the first place, and would be wrong for every field nobody listed.
 * YouTube and Class Central are field-neutral search surfaces, so they carry every
 * career without needing to know what it is.
 */

// roadmap.sh has curated roadmaps at /{slug} — all of them software. Matching here
// is POSITIVE evidence only: it must never guess.
const ROADMAP_SLUGS: Array<[RegExp, string]> = [
  // Every pattern must be DISCRIMINATIVE. Bare words like "design", "operations",
  // "support", "data", "testing" and "architecture" belong to every profession, and
  // matching them sent theatre operations to DevOps, blood testing to software QA,
  // curriculum design and structural steel design to UX, and site architecture to
  // system design. If a token wouldn't make a software engineer nod, it can't be here.
  [/\b(devops|ci.?cd|kubernetes|docker|terraform|ansible)\b/i, "devops"],
  [/\b(cyber ?security|information security|infosec|soc|siem|network security|application security|penetration test|pen ?test|ethical hack)\b/i, "cyber-security"],
  [/\b(front.?end|react|css|html|tailwind)\b/i, "frontend"],
  [/\b(back.?end|api|node\.?js|express\.?js)\b/i, "backend"],
  [/\bfull.?stack\b/i, "full-stack"],
  [/\b(javascript|typescript)\b/i, "javascript"],
  [/\bpython\b/i, "python"],
  [/\b(aws|azure|gcp|cloud computing|cloud engineer|cloud infrastructure)\b/i, "aws"],
  [/\b(sql|postgres|mysql|relational database)\b/i, "sql"],
  [/\b(data analyst|data analytics|business intelligence|power ?bi|tableau)\b/i, "data-analyst"],
  [/\b(software architecture|system design|solution architect)\b/i, "system-design"],
  [/\b(software testing|test automation|qa|unit test)\b/i, "qa"],
  [/\bandroid\b/i, "android"],
  [/\b(ux|ui|user experience|user interface|product design|graphic design|web design|interaction design)\b/i, "ux-design"],
  [/\b(linux|sysadmin|system administrator|it support|technical support|it operations|it infrastructure|service management|itil|helpdesk|help desk|service desk)\b/i, "devops"],
];

export type LearningLinks = {
  /** A software roadmap — null for every field that isn't software. */
  roadmap: string | null;
  youtube: string;
  courses: string;
  /** How to practise this, phrased the way the field actually practises. */
  practice: string;
};

export function learningResources(skill: string): LearningLinks {
  const trimmed = skill.trim();
  const q = encodeURIComponent(trimmed);
  const slug = ROADMAP_SLUGS.find(([re]) => re.test(trimmed));

  // "Build a project" is how software, engineering and design practise. Health,
  // education, law and the trades practise through worked examples and drills, so
  // the phrasing follows the evidence rather than the other way round.
  const practiceQuery = slug
    ? `build a ${trimmed} project`
    : `${trimmed} practice exercises worked examples`;

  return {
    roadmap: slug ? `https://roadmap.sh/${slug[1]}` : null,
    youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${trimmed} full course tutorial`)}`,
    courses: `https://www.classcentral.com/search?q=${q}`,
    practice: `https://www.youtube.com/results?search_query=${encodeURIComponent(practiceQuery)}`,
  };
}
