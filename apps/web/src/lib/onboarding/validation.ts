import { z } from "zod";

export const experienceLevelOptions = [
  "entry",
  "mid",
  "senior",
  "lead",
  "executive",
  "career_switcher",
] as const;

export const onboardingFormSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name."),
  targetRole: z.string().trim().min(2, "Enter the role you want to target."),
  locationPreference: z.string().trim().min(2, "Enter a preferred location or remote preference."),
  experienceLevel: z.enum(experienceLevelOptions, {
    message: "Choose your current experience level.",
  }),
  linkedInProfile: z.string().trim().min(2, "Paste LinkedIn profile text or enter a profile URL."),
  resumeText: z.string().trim().min(50, "Paste at least 50 characters from your resume."),
  careerGoals: z.string().trim().min(20, "Describe your career goals in at least 20 characters."),
});

export type OnboardingFormValues = z.infer<typeof onboardingFormSchema>;
