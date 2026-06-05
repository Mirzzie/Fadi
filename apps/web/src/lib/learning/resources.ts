/**
 * Turn a skill/topic into real, free learning resources — roadmap.sh paths,
 * YouTube tutorials, free-course search, and project ideas. All are plain URLs
 * (no API keys), so the Learning Hub becomes actionable instantly.
 */

// roadmap.sh has curated roadmaps at /{slug}. Map common skills/topics to the
// closest one; fall back to the roadmap index.
const ROADMAP_SLUGS: Array<[RegExp, string]> = [
  [/\b(devops|ci.?cd|kubernetes|docker|terraform|ansible)\b/i, "devops"],
  [/\b(security|soc|cyber|infosec|siem|threat|penetration|vendor.?specific cert)\b/i, "cyber-security"],
  [/\b(front.?end|react|css|html|tailwind)\b/i, "frontend"],
  [/\b(back.?end|\bapi\b|node|express)\b/i, "backend"],
  [/\bfull.?stack\b/i, "full-stack"],
  [/\b(javascript|typescript)\b/i, "javascript"],
  [/\bpython\b/i, "python"],
  [/\b(aws|cloud|azure|gcp)\b/i, "aws"],
  [/\b(sql|database|postgres)\b/i, "sql"],
  [/\b(data|analytics|analyst)\b/i, "data-analyst"],
  [/\b(system design|architecture)\b/i, "system-design"],
  [/\b(qa|testing)\b/i, "qa"],
  [/\bandroid\b/i, "android"],
  [/\b(ux|\bui\b|design)\b/i, "ux-design"],
  [/\b(linux|sysadmin|infrastructure|operations|service management|itil|support|helpdesk|service desk)\b/i, "devops"],
];

export type LearningLinks = {
  roadmap: string;
  youtube: string;
  courses: string;
  project: string;
};

export function learningResources(skill: string): LearningLinks {
  const q = encodeURIComponent(skill.trim());
  const slug = ROADMAP_SLUGS.find(([re]) => re.test(skill));
  return {
    roadmap: slug ? `https://roadmap.sh/${slug[1]}` : "https://roadmap.sh/roadmaps",
    youtube: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${skill} full course tutorial`)}`,
    courses: `https://www.classcentral.com/search?q=${q}`,
    project: `https://www.youtube.com/results?search_query=${encodeURIComponent(`build a ${skill} project`)}`,
  };
}
