import { createSupabaseServerClient } from "@/lib/supabase/server";

export type OnboardingStatus = "not_started" | "in_progress" | "completed";

export async function getOnboardingStatus(userId: string): Promise<OnboardingStatus> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarding_status")
      .eq("user_id", userId)
      .maybeSingle();

    if (error || !data?.onboarding_status) {
      return "not_started";
    }

    if (data.onboarding_status === "completed" || data.onboarding_status === "in_progress") {
      return data.onboarding_status;
    }

    return "not_started";
  } catch {
    return "not_started";
  }
}
