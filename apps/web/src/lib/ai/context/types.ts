export interface KaiUserContext {
  userId: string;

  profile: {
    fullName: string | null;
    email: string | null;
    targetRole: string | null;
    experienceLevel: string | null;
    locationPreference: string | null;
    careerGoals: string | null;
  };

  evidence: {
    resumeText: string | null;
    linkedInText: string | null;
    hasResume: boolean;
    hasLinkedIn: boolean;
  };

  analysis: {
    hasReport: boolean;
    generatedAt: string | null;
    careerReadinessScore: number | null;
    resumeQualityScore: number | null;
    careerSummary: string | null;
    strengths: Array<{ title: string; detail: string }>;
    skillGaps: Array<{ title: string; detail: string }>;
    targetRoleFit: { rating?: string; explanation?: string } | null;
    recommendedActions: Array<{ title: string; detail: string }>;
    learningPath: Array<{ title: string; detail: string }>;
  };

  opportunities: {
    savedJobsCount: number;
    activeApplicationsCount: number;
    savedJobs: Array<{
      title: string;
      company: string;
      matchScore: number | null;
      status: string;
    }>;
  };

  marketContext: {
    available: boolean;
    note: string;
    /** Personalized live signals (geopolitical/economic + skill trends), ranked. */
    signals: Array<{
      title: string;
      url?: string;
      kind: "news" | "skill_trend" | "labor";
      relevance: number;
      reason: string;
    }>;
  };

  /**
   * The user's resilience/momentum state. Kai uses this to calibrate TONE and
   * pacing, never to shame: score the process (quality applications, autopsies,
   * referrals), protect rest, and frame setbacks with locus-of-control.
   */
  momentum: {
    available: boolean;
    score: number;
    band: string;
    bandMessage: string;
    isResting: boolean;
    cadenceTarget: number | null;
    cadencePeriod: string;
    cadenceMessage: string;
    qualityApplicationsThisPeriod: number;
  };
}
