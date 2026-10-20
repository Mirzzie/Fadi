/**
 * Domain-agnostic job-source coverage — pure logic (no server-only deps), so it's
 * unit-testable and shared by the discovery service + the Jobs UI.
 *
 * The problem it solves (domain-agnostic mandate): the always-on keyless job feeds
 * (Remotive, Arbeitnow) are tech-focused. A nurse, electrician, or accountant must
 * not be silently fed tech roles — and must be told honestly when the live sources
 * don't cover their field, with the concrete fix (add a general job-board key).
 */

export type SourceCoverage = "general" | "tech";

export type SourceCoverageInfo = {
  id: string;
  name: string;
  coverage: SourceCoverage;
};

export type JobSourceCoverage = {
  domain: string | null;
  /** Is there a configured source that actually covers this domain? */
  hasCoverage: boolean;
  /** A non-tech domain with only tech-focused sources configured. */
  needsGeneralSource: boolean;
  /** Names of cross-industry sources currently configured. */
  generalSources: string[];
  /** Honest advisory for the UI, or null when coverage is fine. */
  message: string | null;
};

/**
 * Whether a domain is (broadly) a tech field. Unknown/blank → treated as tech so
 * we never *remove* sources for someone whose field we can't read (back-compat);
 * the cost of a false "tech" is only that a tech board stays in the mix.
 */
export function isLikelyTechDomain(domain?: string | null): boolean {
  if (!domain || !domain.trim()) return true;
  return /tech|\bit\b|information technology|software|develop|engineer|data|cyber|security|cloud|devops|\bweb\b|\bai\b|\bml\b|computer|programming|sre|network/.test(
    domain.toLowerCase(),
  );
}

const ADD_KEY_HINT =
  "Add a job-source key in Settings to pull real roles: a JSearch key gives the broadest reach (Google for Jobs — LinkedIn, Indeed, Glassdoor, compliantly), or Reed / Adzuna / Jooble for cross-industry coverage.";

/** Decide coverage for a domain against the configured sources. Pure. */
export function decideJobCoverage(
  domain: string | null | undefined,
  sources: SourceCoverageInfo[],
): JobSourceCoverage {
  const d = domain?.trim() || null;
  const general = sources.filter((s) => s.coverage !== "tech");
  const generalSources = general.map((s) => s.name);

  if (sources.length === 0) {
    return {
      domain: d,
      hasCoverage: false,
      needsGeneralSource: !isLikelyTechDomain(d),
      generalSources: [],
      message: `No live job sources are configured yet. ${ADD_KEY_HINT}`,
    };
  }

  // Tech (or unknown) field: any configured source is acceptable coverage.
  if (isLikelyTechDomain(d)) {
    return { domain: d, hasCoverage: true, needsGeneralSource: false, generalSources, message: null };
  }

  // Non-tech field with a general source available → covered.
  if (general.length > 0) {
    return { domain: d, hasCoverage: true, needsGeneralSource: false, generalSources, message: null };
  }

  // Non-tech field, only tech feeds live → honest advisory, no silent tech noise.
  const field = d ? `your field (${d})` : "non-tech fields";
  return {
    domain: d,
    hasCoverage: false,
    needsGeneralSource: true,
    generalSources: [],
    message: `The job sources running right now mostly cover tech roles, so live listings for ${field} will be thin. ${ADD_KEY_HINT}`,
  };
}
