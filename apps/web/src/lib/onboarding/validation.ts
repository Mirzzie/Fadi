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

/**
 * Lenient server-side completion schema. Onboarding only needs the five
 * essentials to bootstrap a career track; resume + LinkedIn are optional
 * enrichments the OS collects afterward (see the OS guidance layer). The
 * Kai-led conversation can't reliably extract a pasted CV/LinkedIn, and the
 * strict form schema blocking on them stranded new users on "Setting things
 * up…". The manual form still enforces `onboardingFormSchema` client-side, so
 * this only loosens the conversational path.
 */
export const onboardingEssentialsSchema = z.object({
  fullName: z.string().trim().min(2, "I just need a name to call you."),
  targetRole: z.string().trim().min(2, "Tell me the role or field you're aiming for."),
  locationPreference: z
    .string()
    .trim()
    .min(2, "A city, country, or 'remote' is enough."),
  experienceLevel: z.enum(experienceLevelOptions, {
    message: "Roughly how much experience do you have?",
  }),
  careerGoals: z.string().trim().min(2, "What do you want from this move?"),
  linkedInProfile: z.string().trim().optional().default(""),
  resumeText: z.string().trim().optional().default(""),
});
