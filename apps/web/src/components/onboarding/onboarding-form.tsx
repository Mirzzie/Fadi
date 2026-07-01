"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";

import { completeOnboardingAction, type OnboardingActionResult } from "@/app/onboarding/actions";
import { CvUpload } from "@/components/profile/cv-upload";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { onboardingFormSchema, type OnboardingFormValues } from "@/lib/onboarding/validation";

const stepFields: Array<Array<keyof OnboardingFormValues>> = [
  ["fullName", "targetRole", "locationPreference", "experienceLevel"],
  ["linkedInProfile", "resumeText"],
  ["careerGoals"],
];

const steps = [
  {
    title: "Career direction",
    aiCopy:
      "First, tell me who you are and what role you want to move toward. I will use this to judge readiness.",
  },
  {
    title: "Profile evidence",
    aiCopy:
      "Now the career evidence I'll reason from. Your LinkedIn is the full record — paste it or your profile URL. A resume is optional and is often tailored to one role, so I treat LinkedIn as the source of truth.",
  },
  {
    title: "Career goals",
    aiCopy:
      "Finally, describe what you want Fadi to optimize for. Your goals will shape the first dashboard recommendations.",
  },
];

export function OnboardingForm() {
  const router = useRouter();
  const [activeStep, setActiveStep] = useState(0);
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<OnboardingActionResult | null>(null);

  const form = useForm<OnboardingFormValues>({
    resolver: zodResolver(onboardingFormSchema),
    defaultValues: {
      fullName: "",
      targetRole: "",
      locationPreference: "",
      experienceLevel: "mid",
      linkedInProfile: "",
      resumeText: "",
      careerGoals: "",
    },
  });

  const progress = ((activeStep + 1) / steps.length) * 100;
  const isFinalStep = activeStep === steps.length - 1;

  async function goNext() {
    const isValid = await form.trigger(stepFields[activeStep], {
      shouldFocus: true,
    });

    if (!isValid) {
      return;
    }

    setResult(null);
    setActiveStep((step) => Math.min(step + 1, steps.length - 1));
  }

  function goBack() {
    setResult(null);
    setActiveStep((step) => Math.max(step - 1, 0));
  }

  function onSubmit(values: OnboardingFormValues) {
    setResult(null);

    startTransition(async () => {
      const actionResult = await completeOnboardingAction(values);
      setResult(actionResult);

      if (actionResult.redirectTo) {
        window.setTimeout(() => {
          router.push(actionResult.redirectTo ?? "/dashboard");
          router.refresh();
        }, 650);
      }
    });
  }

  return (
    <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)} noValidate>
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm font-medium">
            Step {activeStep + 1} of {steps.length}: {steps[activeStep].title}
          </p>
          <p className="text-sm text-muted-foreground">{Math.round(progress)}%</p>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Career Agent: </span>
          {steps[activeStep].aiCopy}
        </div>
      </div>

      {result?.message ? (
        <div
          className={
            result.ok
              ? "flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 p-3 text-sm text-primary"
              : "rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
          }
          role="status"
        >
          {result.ok ? <CheckCircle2 className="size-4" aria-hidden="true" /> : null}
          {result.message}
        </div>
      ) : null}

      {activeStep === 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <FieldError message={form.formState.errors.fullName?.message}>
            <Label htmlFor="full-name">Full name</Label>
            <Input id="full-name" placeholder="Alex Morgan" {...form.register("fullName")} />
          </FieldError>

          <FieldError message={form.formState.errors.targetRole?.message}>
            <Label htmlFor="target-role">Target role</Label>
            <Input
              id="target-role"
              placeholder="Product Analyst"
              {...form.register("targetRole")}
            />
          </FieldError>

          <FieldError message={form.formState.errors.locationPreference?.message}>
            <Label htmlFor="location-preference">Location preference</Label>
            <Input
              id="location-preference"
              placeholder="Ireland, UK, remote"
              {...form.register("locationPreference")}
            />
          </FieldError>

          <FieldError message={form.formState.errors.experienceLevel?.message}>
            <Label htmlFor="experience-level">Experience level</Label>
            <select
              id="experience-level"
              className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              {...form.register("experienceLevel")}
            >
              <option value="entry">Entry level</option>
              <option value="mid">Mid level</option>
              <option value="senior">Senior</option>
              <option value="lead">Lead / principal</option>
              <option value="executive">Executive</option>
              <option value="career_switcher">Career switcher</option>
            </select>
          </FieldError>
        </div>
      ) : null}

      {activeStep === 1 ? (
        <div className="space-y-4">
          <FieldError message={form.formState.errors.linkedInProfile?.message}>
            <Label htmlFor="linkedin-profile">Career history — LinkedIn (your source of truth)</Label>
            <Textarea
              id="linkedin-profile"
              placeholder="Paste your LinkedIn About + experience (the full record), or your profile URL..."
              rows={5}
              {...form.register("linkedInProfile")}
            />
          </FieldError>

          <FieldError message={form.formState.errors.resumeText?.message}>
            <Label htmlFor="resume-text">Resume / CV (a role-tailored example — optional)</Label>
            <CvUpload
              onExtracted={(text) =>
                form.setValue("resumeText", text, { shouldValidate: true, shouldDirty: true })
              }
            />
            <Textarea
              id="resume-text"
              placeholder="Upload your CV above (PDF, DOCX, TXT), or paste the text here."
              rows={9}
              {...form.register("resumeText")}
            />
          </FieldError>
        </div>
      ) : null}

      {activeStep === 2 ? (
        <FieldError message={form.formState.errors.careerGoals?.message}>
          <Label htmlFor="career-goals">Career goals</Label>
          <Textarea
            id="career-goals"
            placeholder="Describe your target role, timeline, constraints, and what you want Fadi to help with."
            rows={8}
            {...form.register("careerGoals")}
          />
        </FieldError>
      ) : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
        <Button
          type="button"
          variant="outline"
          onClick={goBack}
          disabled={activeStep === 0 || isPending}
        >
          Back
        </Button>
        {isFinalStep ? (
          <Button type="submit" disabled={isPending}>
            {isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {isPending ? "Saving..." : "Complete onboarding"}
          </Button>
        ) : (
          <Button type="button" onClick={goNext}>
            Continue
          </Button>
        )}
      </div>
    </form>
  );
}

function FieldError({ children, message }: { children: React.ReactNode; message?: string }) {
  return (
    <div className="space-y-2">
      {children}
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
