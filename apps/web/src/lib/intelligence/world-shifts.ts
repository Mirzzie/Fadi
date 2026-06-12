/**
 * Structural global forces that reshape careers — the honest, curated backbone
 * behind Kai's "should I rethink my strategy given what's happening in the
 * world?" advice. Same model as doc-guidance: VERSIONED and dated, sourced
 * from named 2026 publications, refreshed by bumping the version — never
 * presented as prediction. Kai layers live signals (GDELT news, BLS) on top;
 * this catalog provides the structural context those point-signals lack.
 *
 * Psychological-lens rule (non-negotiable): every shift names BOTH the
 * pressure AND the resilient adjacencies + one controllable positioning move.
 * World events are presented as positioning information, never doom — the
 * user's locus of control is the thing we're protecting.
 */

export const WORLD_SHIFTS_VERSION = "2026.06";

export type WorldShift = {
  id: string;
  name: string;
  whatsHappening: string;
  careerImplication: string;
  /** Sectors/domains under pressure from this force (lowercase keywords). */
  pressuredDomains: string[];
  /** Sectors/domains this force is feeding (lowercase keywords). */
  resilientDomains: string[];
  /** The controllable move — what a person can actually DO about it. */
  positioningMove: string;
  sources: string;
  reviewed: string; // ISO date
};

export const WORLD_SHIFTS: WorldShift[] = [
  {
    id: "ai_disruption",
    name: "AI task automation & skill churn",
    whatsHappening:
      "WEF projects ~22% of jobs disrupted by 2030 (170M created, 92M displaced); skills in AI-affected roles are evolving 66% faster than two years ago. Entry-level exposure is real: employment for 22–25-year-olds in AI-exposed roles fell ~13%.",
    careerImplication:
      "Roles built on routine information tasks (basic content, data entry, tier-1 support, junior analysis) face compression. Roles that direct, verify, or apply AI output — and roles grounded in physical presence, trust, or judgment — gain leverage. AI proficiency carries a 20–56% wage premium across sectors.",
    pressuredDomains: [
      "customer support",
      "data entry",
      "content writing",
      "translation",
      "junior analyst",
      "bookkeeping",
      "telemarketing",
    ],
    resilientDomains: [
      "healthcare",
      "skilled trades",
      "ai",
      "machine learning",
      "cybersecurity",
      "education",
      "care",
      "engineering",
    ],
    positioningMove:
      "Whatever your field, document one concrete win using AI tools in your actual work — that single proof point is currently worth more than a certificate.",
    sources: "WEF Future of Jobs / Global Risks Report 2026; Gloat AI Workforce Trends 2026",
    reviewed: "2026-06-12",
  },
  {
    id: "geopolitical_fragmentation",
    name: "Geopolitical fragmentation & strategic-sector protection",
    whatsHappening:
      "The global order is fragmenting: US–China competition, trade barriers, and active conflicts are pushing states to protect strategic inputs — semiconductors, critical minerals, biotech, energy, defence — and to re-shore supply chains.",
    careerImplication:
      "Careers tied to friction-free globalization (some logistics, export-dependent manufacturing, international expansion roles) carry more volatility. Careers inside strategically protected sectors, domestic supply chains, compliance, and security inherit state-backed demand.",
    pressuredDomains: [
      "import",
      "export",
      "global supply chain",
      "international trade",
      "offshoring",
    ],
    resilientDomains: [
      "defence",
      "semiconductor",
      "energy",
      "critical minerals",
      "biotech",
      "compliance",
      "security",
      "manufacturing",
      "logistics",
    ],
    positioningMove:
      "If your field straddles borders, build the domestic/regulated-side version of your skill set — same craft, more sheltered demand.",
    sources: "WEF Global Risks Report 2026; Wellington Geopolitics 2026; IMF Apr 2026 outlook",
    reviewed: "2026-06-12",
  },
  {
    id: "inflation_tight_money",
    name: "Inflation & slower growth",
    whatsHappening:
      "Persistent inflation and slower expansion are making employers cautious: longer hiring cycles, fewer speculative roles, more scrutiny per hire. The market is slowing, not stopping — essential-demand sectors keep hiring through it.",
    careerImplication:
      "Nice-to-have roles (brand experiments, growth bets, internal innovation labs) are cut first in tight money. Roles tied to revenue, cost reduction, or essential demand (healthcare, infrastructure, maintenance, core operations) hold. Expect slower processes everywhere — that's the market, not you.",
    pressuredDomains: ["advertising", "media", "recruiting", "real estate", "startup", "hospitality"],
    resilientDomains: [
      "healthcare",
      "infrastructure",
      "construction",
      "utilities",
      "accounting",
      "maintenance",
      "operations",
      "logistics",
    ],
    positioningMove:
      "Reframe your evidence in money terms — revenue protected, cost cut, downtime avoided. In tight cycles, the candidates who quantify survive the first screen.",
    sources: "IMF Apr 2026; Indeed Hiring Lab 2026; Addison Group 2026 hiring trends",
    reviewed: "2026-06-12",
  },
  {
    id: "demographic_care_gap",
    name: "Aging populations & the care gap",
    whatsHappening:
      "Rich-world workforces are aging out faster than they're replaced. Healthcare, eldercare, and the trades face structural shortages that automation can't close on current technology.",
    careerImplication:
      "Healthcare and skilled trades carry decade-scale demand floors — among the few careers with structural, not cyclical, security. Adjacent roles (health tech, medical administration, care logistics, training) inherit the tailwind without requiring clinical retraining.",
    pressuredDomains: [],
    resilientDomains: ["healthcare", "nursing", "eldercare", "trades", "plumbing", "electrical", "health tech", "medical"],
    positioningMove:
      "If you're considering a pivot, check the care-adjacent version of your current skill first — operations, tech, training, or admin inside health and care systems.",
    sources: "Indeed Hiring Lab 2026; Addison Group 2026",
    reviewed: "2026-06-12",
  },
  {
    id: "climate_transition",
    name: "Climate transition & physical risk",
    whatsHappening:
      "Climate is now a structural economic force: transition spending (grid, retrofit, adaptation engineering, insurance analytics) is growing while physical risk re-prices exposed industries and regions.",
    careerImplication:
      "Green-transition skills (energy systems, sustainable construction, climate risk analysis, ESG-adjacent compliance) attach to long-cycle public and private spending. Roles in heavily exposed industries face slow re-pricing rather than sudden shocks.",
    pressuredDomains: ["oil", "gas", "coal"],
    resilientDomains: [
      "renewable",
      "energy",
      "construction",
      "engineering",
      "insurance",
      "sustainability",
      "utilities",
    ],
    positioningMove:
      "You usually don't need a new career to catch this — the transition version of your existing role (same skill, green-spend employer) is the lower-risk entry.",
    sources: "WEF Global Risks Report 2026",
    reviewed: "2026-06-12",
  },
  {
    id: "shock_preparedness",
    name: "Shock events (pandemics, conflicts, supply crises)",
    whatsHappening:
      "The 2020s pattern is recurring shocks: pandemic, war, supply crises. Nobody can predict the next one — anyone claiming otherwise is selling something. What's knowable is which career SHAPES absorb shocks better.",
    careerImplication:
      "Shock-resilient careers share traits: skills transferable across industries, essential-demand anchoring, remote-capable components, and more than one income-relevant capability. Fragile careers depend on one employer type, one location, and discretionary spending.",
    pressuredDomains: ["events", "tourism", "travel", "luxury"],
    resilientDomains: ["healthcare", "logistics", "it", "accounting", "education", "agriculture", "trades"],
    positioningMove:
      "Stress-test your direction with one question: 'If my industry froze for six months, what part of my skill set still sells?' Build that part deliberately — it's career insurance you control.",
    sources: "WEF Global Risks Report 2026; IMF Apr 2026",
    reviewed: "2026-06-12",
  },
];

function matchesDomain(haystack: string, keywords: string[]): boolean {
  return keywords.some((k) => haystack.includes(k));
}

export type ShiftRelevance = {
  shift: WorldShift;
  /** Why it matched this user: pressured, resilient-fit, or general context. */
  relation: "pressure" | "tailwind" | "context";
};

/**
 * Pure: rank the catalog for a user's role/domain. Shifts that pressure their
 * field come first (most decision-relevant), then tailwinds they could ride,
 * then the always-relevant general forces.
 */
export function relevantShiftsFor(targetRole: string, domain?: string | null): ShiftRelevance[] {
  const hay = `${targetRole} ${domain ?? ""}`.toLowerCase();

  const scored = WORLD_SHIFTS.map((shift): ShiftRelevance => {
    if (matchesDomain(hay, shift.pressuredDomains)) return { shift, relation: "pressure" };
    if (matchesDomain(hay, shift.resilientDomains)) return { shift, relation: "tailwind" };
    return { shift, relation: "context" };
  });

  const order = { pressure: 0, tailwind: 1, context: 2 } as const;
  return scored.sort((a, b) => order[a.relation] - order[b.relation]);
}

/** Compact prompt block — the structural backdrop for Kai / the niche finder. */
export function formatShiftsForPrompt(ranked: ShiftRelevance[], max = 4): string {
  return ranked
    .slice(0, max)
    .map(({ shift, relation }) => {
      const tag =
        relation === "pressure"
          ? "PRESSURES THIS USER'S FIELD"
          : relation === "tailwind"
            ? "TAILWIND FOR THIS USER'S FIELD"
            : "GENERAL FORCE";
      return `- [${tag}] ${shift.name}: ${shift.careerImplication} Positioning move: ${shift.positioningMove} (Sources: ${shift.sources}, reviewed ${shift.reviewed})`;
    })
    .join("\n");
}
