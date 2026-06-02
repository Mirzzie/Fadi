"use server";

import { onboardingFormSchema, type OnboardingFormValues } from "@/lib/onboarding/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OnboardingActionResult = {
  ok: boolean;
  message?: string;
  redirectTo?: string;
};

function firstValidationMessage(values: unknown) {
  const parsed = onboardingFormSchema.safeParse(values);

  if (parsed.success) {
    return null;
  }

  return parsed.error.issues[0]?.message ?? "Check the onboarding form and try again.";
}

export async function completeOnboardingAction(
  values: OnboardingFormValues
): Promise<OnboardingActionResult> {
  const validationMessage = firstValidationMessage(values);

  if (validationMessage) {
    return {
      ok: false,
      message: validationMessage,
    };
  }

  const parsed = onboardingFormSchema.parse(values);

  try {
    const supabase = await createSupabaseServerClient();
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub ? String(claimsData.claims.sub) : null;
    const emailClaim = claimsData?.claims?.email;

    if (claimsError || !userId) {
      return {
        ok: false,
        message: "You need to be signed in to complete onboarding.",
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .upsert(
        {
          user_id: userId,
          full_name: parsed.fullName,
          email: typeof emailClaim === "string" ? emailClaim : null,
          onboarding_status: "in_progress",
        },
        {
          onConflict: "user_id",
        }
      )
      .select("id")
      .single();

    if (profileError || !profile) {
      return {
        ok: false,
        message: profileError?.message ?? "Could not save your profile.",
      };
    }

    const { data: existingCareerProfile } = await supabase
      .from("career_profiles")
      .select("id")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const careerProfilePayload = {
      user_id: userId,
      profile_id: profile.id,
      target_role: parsed.targetRole,
      location: parsed.locationPreference,
      preferred_locations: [parsed.locationPreference],
      experience_level: parsed.experienceLevel,
      career_goal: parsed.careerGoals,
    };

    const careerProfileMutation = existingCareerProfile?.id
      ? supabase
          .from("career_profiles")
          .update(careerProfilePayload)
          .eq("id", existingCareerProfile.id)
          .select("id")
          .single()
      : supabase.from("career_profiles").insert(careerProfilePayload).select("id").single();

    const { data: careerProfile, error: careerProfileError } = await careerProfileMutation;

    if (careerProfileError || !careerProfile) {
      return {
        ok: false,
        message: careerProfileError?.message ?? "Could not save your career profile.",
      };
    }

    const linkedInText = parsed.linkedInProfile?.trim();

    if (linkedInText) {
      const { error: linkedInError } = await supabase.from("linkedin_profiles").insert({
        user_id: userId,
        career_profile_id: careerProfile.id,
        source_type: linkedInText.startsWith("http") ? "profile_url" : "pasted_text",
        profile_url: linkedInText.startsWith("http") ? linkedInText : null,
        raw_text: linkedInText,
        import_status: "pending",
      });

      if (linkedInError) {
        return {
          ok: false,
          message: linkedInError.message,
        };
      }
    }

    const { error: resumeError } = await supabase.from("resumes").insert({
      user_id: userId,
      career_profile_id: careerProfile.id,
      file_path: `text-paste/${userId}/${Date.now()}`,
      file_name: "pasted-resume.txt",
      file_type: "text/plain",
      parsed_text: parsed.resumeText,
      summary: null,
      parse_status: "parsed",
      is_primary: true,
    });

    if (resumeError) {
      return {
        ok: false,
        message: resumeError.message,
      };
    }

    const { error: completionError } = await supabase
      .from("profiles")
      .update({
        onboarding_status: "completed",
      })
      .eq("id", profile.id)
      .eq("user_id", userId);

    if (completionError) {
      return {
        ok: false,
        message: completionError.message,
      };
    }

    return {
      ok: true,
      message: "Onboarding complete. Your career profile has been saved.",
      redirectTo: "/dashboard",
    };
  } catch {
    return {
      ok: false,
      message: "Could not save onboarding data. Check Supabase configuration and migrations.",
    };
  }
}
