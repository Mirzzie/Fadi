import { Upload, UserRoundCheck, WandSparkles } from "lucide-react";

import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const steps = [
  {
    title: "CV upload",
    description: "Capture experience, skills, education, and achievements.",
    icon: Upload,
  },
  {
    title: "Profile context",
    description: "Add LinkedIn text or confirm details manually.",
    icon: UserRoundCheck,
  },
  {
    title: "Career report",
    description: "Generate the first Career Intelligence Report.",
    icon: WandSparkles,
  },
];

export function OnboardingShell() {
  return (
    <div className="mx-auto grid max-w-shell gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-4">
        <Badge variant="secondary">Onboarding shell</Badge>
        <div className="space-y-3">
          <h1 className="text-3xl font-semibold tracking-tight">Build your career profile</h1>
          <p className="text-muted-foreground">
            Paste your career context so CareerOS AI can prepare your profile foundation. This phase
            saves data only; AI report generation comes later.
          </p>
        </div>
        <div className="grid gap-3">
          {steps.map((step) => (
            <Card key={step.title}>
              <CardContent className="flex gap-4 p-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <step.icon className="size-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-medium">{step.title}</h2>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Profile foundation</CardTitle>
          <CardDescription>
            Complete these steps to unlock your protected dashboard.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <OnboardingForm />
        </CardContent>
      </Card>
    </div>
  );
}
