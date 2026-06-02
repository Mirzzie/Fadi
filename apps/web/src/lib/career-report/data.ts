import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { DashboardProfileSummary, StoredCareerReport } from "@/lib/career-report/schema";

type CareerReportContext = {
  userId: string;
  profileId: string | null;
  careerProfileId: string;
  resumeId: string | null;
  linkedInProfileId: string | null;
  fullName: string | null;
  email?: string;
  targetRole: string | null;
  locationPreference: string | null;
  experienceLevel: string | null;
  careerGoals: string | null;
  linkedInProfileText: string | null;
  resumeText: string | null;
};

type CareerProfileRow = {
  id: string;
  profile_id: string | null;
  target_role: string | null;
  location: string | null;
  experience_level: string | null;
  career_goal: string | null;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
};

type ResumeRow = {
  id: string;
  parsed_text: string | null;
};

type LinkedInProfileRow = {
  id: string;
  raw_text: string | null;
  profile_url: string | null;
};

function preview(value: string | null | undefined, maxLength = 220) {
  if (!value) {
    return null;
  }

  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

export async function getCareerReportContext(userId: string): Promise<CareerReportContext | null> {
  const supabase = await createSupabaseServerClient();

  const { data: careerProfile } = await supabase
    .from("career_profiles")
    .select("id, profile_id, target_role, location, experience_level, career_goal")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<CareerProfileRow>();

  if (!careerProfile) {
    return null;
  }

  const [{ data: profile }, { data: resume }, { data: linkedInProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("user_id", userId)
      .maybeSingle<ProfileRow>(),
    supabase
      .from("resumes")
      .select("id, parsed_text")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<ResumeRow>(),
    supabase
      .from("linkedin_profiles")
      .select("id, raw_text, profile_url")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<LinkedInProfileRow>(),
  ]);

  return {
    userId,
    profileId: profile?.id ?? careerProfile.profile_id ?? null,
    careerProfileId: careerProfile.id,
    resumeId: resume?.id ?? null,
    linkedInProfileId: linkedInProfile?.id ?? null,
    fullName: profile?.full_name ?? null,
    email: profile?.email ?? undefined,
    targetRole: careerProfile.target_role,
    locationPreference: careerProfile.location,
    experienceLevel: careerProfile.experience_level,
    careerGoals: careerProfile.career_goal,
    linkedInProfileText: linkedInProfile?.raw_text ?? linkedInProfile?.profile_url ?? null,
    resumeText: resume?.parsed_text ?? null,
  };
}

export async function getDashboardProfileSummary(
  userId: string
): Promise<DashboardProfileSummary | null> {
  const context = await getCareerReportContext(userId);

  if (!context) {
    return null;
  }

  return {
    fullName: context.fullName,
    email: context.email,
    targetRole: context.targetRole,
    locationPreference: context.locationPreference,
    experienceLevel: context.experienceLevel,
    careerGoals: context.careerGoals,
    linkedInProfilePreview: preview(context.linkedInProfileText),
    resumePreview: preview(context.resumeText),
  };
}

export async function getLatestCareerReport(userId: string): Promise<StoredCareerReport | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("career_reports")
    .select(
      "id, career_summary, strengths, missing_skills, target_role_fit, resume_quality_score, career_readiness_score, recommended_actions, recommended_learning_path, model_name, generated_at, created_at"
    )
    .eq("user_id", userId)
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<StoredCareerReport>();

  return data ?? null;
}
