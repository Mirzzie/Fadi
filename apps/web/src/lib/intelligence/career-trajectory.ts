import "server-only";

/**
 * Career trajectory diagnostics. IDEOLOGY CONSTRAINT (read before wiring this
 * into any UI): the composite cptScore blends OUTCOME metrics (response rate,
 * interview conversion) the user does not control. That makes it a valid
 * internal diagnostic for bottleneck detection, but it must NEVER be surfaced
 * as a user-facing score, grade, or trend — only the bottleneck, weeklyFocus,
 * and estimates (which are framed as forecasts, not judgments) belong on
 * screen. The user-facing momentum score lives in lib/resilience and is
 * process-only by design.
 */

// ─── Market benchmarks (from 2025-2026 research) ──────────────────────────────

const BENCHMARKS = {
  avgApplicationsPerHire: 32,
  avgResponseRate: 0.025, // 2.5%
  avgInterviewConversionRate: 0.30, // 30%
  referralHireRate: 0.066, // 6.6%
  coldApplicationHireRate: 0.004, // 0.4%
  avgDaysToOffer: 68.5,
  strongResponseRate: 0.08, // 8%+ is strong
  strongAQS: 80,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrajectoryInput {
  userId: string;

  // Application history
  totalApplicationsSent: number;
  totalResponsesReceived: number;
  totalInterviews: number;
  totalOffers: number;
  referralApplications: number;

  // Profile quality
  careerReadinessScore: number | null;
  resumeQualityScore: number | null;
  profileCompleteness: number; // 0–100
  proofOfWorkCount: number;
  targetRoleSkillCoverage: number; // % of required skills documented

  // Activity
  applicationsSentLast30Days: number;
  avgAQSLast30Days: number | null;

  // Target
  targetRole: string;
  targetSeniority: string | null;
  marketDemand: "growing" | "stable" | "declining" | "unknown";

  /** Prior composite score, if one was computed before. A trend is a change
   *  over time — without this, no trend is claimed. */
  previousCptScore?: number | null;
}

export interface TrajectoryResult {
  cptScore: number; // 0–100 composite
  trend: "rising" | "flat" | "falling" | "insufficient_data";

  metrics: {
    responseRateIndex: number; // actual vs benchmark %
    interviewConversionRate: number;
    networkActivation: "strong" | "moderate" | "weak" | "none";
    skillGapStatus: "closing" | "stable" | "widening" | "unknown";
  };

  estimates: {
    estimatedDaysToFirstInterview: number | null;
    estimatedDaysToOffer: number | null;
    confidenceLevel: "high" | "medium" | "low";
    note: string;
  };

  bottleneck: {
    type:
      | "targeting"
      | "application_quality"
      | "ats_formatting"
      | "network_gap"
      | "skills_gap"
      | "market_misalignment"
      | "volume"
      | "none";
    description: string;
    primaryAction: string;
  };

  competitivePosition: {
    percentile: number | null;
    assessment: string;
  };

  weeklyFocus: {
    action: string;
    rationale: string;
    expectedImpact: string;
  };
}

// ─── Computation ───────────────────────────────────────────────────────────────

export function computeCareerTrajectory(input: TrajectoryInput): TrajectoryResult {
  const hasEnoughData = input.totalApplicationsSent >= 5;

  // ── Response Rate Index ──
  const actualRR =
    input.totalApplicationsSent > 0
      ? input.totalResponsesReceived / input.totalApplicationsSent
      : 0;
  const rrIndex = Math.min(100, Math.round((actualRR / BENCHMARKS.avgResponseRate) * 50));

  // ── Interview Conversion Rate ──
  const actualICR =
    input.totalResponsesReceived > 0
      ? input.totalInterviews / input.totalResponsesReceived
      : 0;
  const icrScore = Math.min(100, Math.round((actualICR / BENCHMARKS.avgInterviewConversionRate) * 50));

  // ── Network Activation ──
  const referralRatio =
    input.totalApplicationsSent > 0
      ? input.referralApplications / input.totalApplicationsSent
      : 0;
  const networkActivation: TrajectoryResult["metrics"]["networkActivation"] =
    referralRatio >= 0.2
      ? "strong"
      : referralRatio >= 0.1
        ? "moderate"
        : referralRatio > 0
          ? "weak"
          : "none";

  const networkScore = referralRatio >= 0.2 ? 100 : referralRatio >= 0.1 ? 65 : referralRatio > 0 ? 35 : 10;

  // ── Profile / Skills ──
  const profileScore = Math.round(
    (input.careerReadinessScore ?? 50) * 0.4 +
      (input.resumeQualityScore ?? 50) * 0.3 +
      input.profileCompleteness * 0.15 +
      Math.min(100, input.proofOfWorkCount * 15) * 0.15,
  );

  const skillsScore = Math.min(100, Math.round(input.targetRoleSkillCoverage));

  // ── AQS contribution ──
  const aqsScore = input.avgAQSLast30Days ?? 50;

  // ── Market alignment ──
  const marketScore =
    input.marketDemand === "growing"
      ? 85
      : input.marketDemand === "stable"
        ? 65
        : input.marketDemand === "declining"
          ? 30
          : 55;

  // ── CPT composite ──
  const weights = {
    aqsScore: 0.20,
    rrIndex: 0.20,
    icrScore: 0.12,
    networkScore: 0.18,
    profileScore: 0.15,
    skillsScore: 0.08,
    marketScore: 0.07,
  };

  const cptScore = Math.round(
    aqsScore * weights.aqsScore +
      rrIndex * weights.rrIndex +
      icrScore * weights.icrScore +
      networkScore * weights.networkScore +
      profileScore * weights.profileScore +
      skillsScore * weights.skillsScore +
      marketScore * weights.marketScore,
  );

  // ── Bottleneck ──
  const bottleneck = identifyBottleneck(input, { rrIndex, aqsScore, networkScore, skillsScore, marketScore });

  // ── Estimates ──
  const estimates = computeEstimates(input, actualRR, actualICR);

  // ── Competitive position ──
  const competitivePosition = assessCompetitivePosition(input, cptScore);

  // ── Weekly focus ──
  const weeklyFocus = deriveWeeklyFocus(bottleneck, input, estimates);

  // A trend is a CHANGE over time, never a relabelled level — calling a static
  // low score "falling" would be both false and demoralizing.
  const boundedScore = Math.max(0, Math.min(100, cptScore));
  const prev = input.previousCptScore;
  const trend: TrajectoryResult["trend"] =
    !hasEnoughData || prev == null
      ? "insufficient_data"
      : boundedScore - prev > 3
        ? "rising"
        : boundedScore - prev < -3
          ? "falling"
          : "flat";

  return {
    cptScore: boundedScore,
    trend,

    metrics: {
      responseRateIndex: rrIndex,
      interviewConversionRate: Math.round(actualICR * 100),
      networkActivation,
      skillGapStatus: input.targetRoleSkillCoverage > 70 ? "closing" : input.targetRoleSkillCoverage > 40 ? "stable" : "widening",
    },

    estimates,
    bottleneck,
    competitivePosition,
    weeklyFocus,
  };
}

function identifyBottleneck(
  input: TrajectoryInput,
  scores: { rrIndex: number; aqsScore: number; networkScore: number; skillsScore: number; marketScore: number },
): TrajectoryResult["bottleneck"] {
  if (input.marketDemand === "declining" && scores.marketScore < 40) {
    return {
      type: "market_misalignment",
      description: `The ${input.targetRole} market is showing declining hiring signals. You may be targeting a shrinking field.`,
      primaryAction: "Run a niche validation with Scout to assess whether to pivot your target role or adjust your positioning.",
    };
  }

  if (scores.skillsScore < 50 && input.targetRoleSkillCoverage < 50) {
    return {
      type: "skills_gap",
      description: `Your profile covers less than 50% of the skills typically required for ${input.targetRole} roles.`,
      primaryAction: "Generate your Career Intelligence Report to get a specific skill gap analysis and prioritised learning plan.",
    };
  }

  if (scores.networkScore < 30) {
    return {
      type: "network_gap",
      description: "You have almost no referral applications. The data shows 1 referral is worth 40 cold applications.",
      primaryAction: "Identify 3 people in your target companies this week and send a genuine outreach message. Scout can help you draft it.",
    };
  }

  if (scores.aqsScore < 65 && input.applicationsSentLast30Days > 5) {
    return {
      type: "application_quality",
      description: `Your recent applications are averaging ${Math.round(scores.aqsScore)}/100 on application quality. Applications below 70 rarely receive responses.`,
      primaryAction: "Run the Application Quality Score on your next 3 applications before sending. Raise all to 75+ before submitting.",
    };
  }

  if (scores.rrIndex < 30 && input.totalApplicationsSent >= 20) {
    return {
      type: "targeting",
      description: `Your response rate is significantly below market average. This usually indicates targeting roles where your profile is not a strong match.`,
      primaryAction: "Ask Scout to identify 5 roles where your profile is objectively a top-20% candidate match rather than an average applicant.",
    };
  }

  if (input.applicationsSentLast30Days < 5 && input.totalOffers === 0) {
    return {
      type: "volume",
      description: "Application volume is low. At current rates, the search will take significantly longer than necessary.",
      primaryAction: "Aim for 3–5 high-quality targeted applications per week. Use Scout's workspace to keep quality high without spending 45 minutes per application.",
    };
  }

  return {
    type: "none",
    description: "No single dominant bottleneck identified. Search is progressing at a reasonable pace.",
    primaryAction: "Maintain current momentum. Consider activating network connections to accelerate.",
  };
}

function computeEstimates(
  input: TrajectoryInput,
  actualRR: number,
  actualICR: number,
): TrajectoryResult["estimates"] {
  if (input.totalApplicationsSent < 5) {
    return {
      estimatedDaysToFirstInterview: null,
      estimatedDaysToOffer: null,
      confidenceLevel: "low",
      note: "Send at least 5 applications to generate trajectory estimates.",
    };
  }

  const effectiveRR = actualRR > 0 ? actualRR : BENCHMARKS.avgResponseRate;
  const effectiveICR = actualICR > 0 ? actualICR : BENCHMARKS.avgInterviewConversionRate;

  const appsPerWeek = input.applicationsSentLast30Days / 4 || 3;
  const responsesPerWeek = appsPerWeek * effectiveRR;
  const interviewsPerWeek = responsesPerWeek * effectiveICR;

  const weeksToFirstInterview =
    interviewsPerWeek > 0 ? Math.ceil(1 / interviewsPerWeek) : null;

  const daysToFirstInterview = weeksToFirstInterview ? weeksToFirstInterview * 7 : null;

  const weeksToOffer =
    daysToFirstInterview !== null
      ? Math.ceil(daysToFirstInterview / 7 + BENCHMARKS.avgDaysToOffer / 7 / 2)
      : null;

  const daysToOffer = weeksToOffer ? weeksToOffer * 7 : null;

  const confidence: TrajectoryResult["estimates"]["confidenceLevel"] =
    input.totalApplicationsSent >= 20 ? "medium" : "low";

  return {
    estimatedDaysToFirstInterview: daysToFirstInterview,
    estimatedDaysToOffer: daysToOffer,
    confidenceLevel: confidence,
    note:
      confidence === "low"
        ? "Estimates improve with more application history."
        : "Based on your actual response and interview conversion rates.",
  };
}

/**
 * Honest framing: we cannot observe other applicants, so no invented
 * "top X% of applicants" percentile. The assessment compares the user's
 * process against published market BENCHMARKS and says so; percentile stays
 * null until a real comparative data source exists.
 */
function assessCompetitivePosition(
  input: TrajectoryInput,
  cptScore: number,
): TrajectoryResult["competitivePosition"] {
  const assessment =
    cptScore >= 80
      ? `Measured against market benchmarks, your search process is in strong shape for ${input.targetRole} roles — keep the same quality bar.`
      : cptScore >= 60
        ? `Measured against market benchmarks, your process is above average for ${input.targetRole} roles, with specific, fixable gaps — see the bottleneck below.`
        : cptScore >= 40
          ? `Measured against market benchmarks, your process is around typical for ${input.targetRole} applications. The bottleneck below is the highest-leverage thing to improve.`
          : `Measured against market benchmarks, the foundations for ${input.targetRole} roles need building before volume will pay off. The gaps are specific and closable — start with the bottleneck below.`;

  return { percentile: null, assessment };
}

function deriveWeeklyFocus(
  bottleneck: TrajectoryResult["bottleneck"],
  input: TrajectoryInput,
  estimates: TrajectoryResult["estimates"],
): TrajectoryResult["weeklyFocus"] {
  switch (bottleneck.type) {
    case "network_gap":
      return {
        action: "Activate one genuine professional connection this week",
        rationale: "1 referral is worth 40 cold applications. Network activation is your highest-leverage move right now.",
        expectedImpact: "A single referral application at a target company could shorten your search by weeks.",
      };
    case "skills_gap":
      return {
        action: "Complete one concrete learning milestone toward your top skill gap",
        rationale: "Your profile covers less than half the skills typically required for your target role.",
        expectedImpact: "Closing the top skill gap could raise your application quality by 10–15 points.",
      };
    case "application_quality":
      return {
        action: "Run Application Quality Score on every application before sending — target 75+",
        rationale: `Your recent applications are averaging below 70/100. Applications below this threshold are rarely competitive.`,
        expectedImpact: "Raising AQS to 75+ can double your response rate.",
      };
    case "targeting":
      return {
        action: "Ask Scout to identify your 5 strongest role matches from the current job pool",
        rationale: "Below-average response rates usually indicate role targeting mismatch — you are competing where you are not the strongest candidate.",
        expectedImpact: "Targeting better-matched roles can 3× your response rate immediately.",
      };
    case "volume":
      return {
        action: `Send 3–5 high-quality targeted applications this week using Scout's workspace`,
        rationale: `At your current application pace, the search timeline stretches significantly. ${estimates.estimatedDaysToFirstInterview ? `Scout estimates ${estimates.estimatedDaysToFirstInterview} days to first interview at current pace.` : ""}`,
        expectedImpact: "Consistent quality volume is the most reliable path to shortening the search.",
      };
    default:
      return {
        action: "Maintain momentum and consider adding one network activation this week",
        rationale: "Your search is progressing. Referrals remain the highest-leverage accelerator at any stage.",
        expectedImpact: "Sustained activity at current quality level will continue generating results.",
      };
  }
}
